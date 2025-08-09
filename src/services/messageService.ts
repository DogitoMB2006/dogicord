
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { serverService } from './serverService'
import { permissionService } from './permissionService'
import { notificationService } from './notificationService'
import type { Role } from '../types/permissions'

export interface Message {
  id: string
  content: string
  authorId: string
  authorName: string
  authorAvatarUrl?: string
  serverId: string
  channelId: string
  timestamp: Date
  edited?: boolean
  editedAt?: Date
  replyTo?: {
    messageId: string
    authorName: string
    content: string
  }
}

interface MessageCache {
  messages: Message[]
  lastUpdated: number
  hasMore: boolean
  isLoading: boolean
}

interface CachedChannelData {
  messages: Message[]
  lastUpdated: number
}

class MessageService {
  private messageCache = new Map<string, MessageCache>()
  private activeListeners = new Map<string, () => void>()
  private readonly CACHE_EXPIRY_MS = 30 * 60 * 1000 // 30 minutos
  private readonly MAX_CACHED_CHANNELS = 10
  private cleanupInitialized = false

  constructor() {
    if (!this.cleanupInitialized) {
      this.initializeCleanup()
      this.cleanupInitialized = true
    }
  }

  private getCacheKey(serverId: string, channelId: string): string {
    return `${serverId}-${channelId}`
  }

  private getLocalStorageKey(serverId: string, channelId: string): string {
    return `dogicord-messages-${serverId}-${channelId}`
  }

  private saveMessagesToLocalStorage(serverId: string, channelId: string, messages: Message[]): void {
    try {
      const cacheData: CachedChannelData = {
        messages: messages.slice(-100), 
        lastUpdated: Date.now()
      }
      const key = this.getLocalStorageKey(serverId, channelId)
      localStorage.setItem(key, JSON.stringify(cacheData))
      
      this.cleanupOldCache()
    } catch (error) {
      console.warn('Failed to save messages to localStorage:', error)
    }
  }

  private loadMessagesFromLocalStorage(serverId: string, channelId: string): Message[] {
    try {
      const key = this.getLocalStorageKey(serverId, channelId)
      const cached = localStorage.getItem(key)
      
      if (!cached) return []
      
      const cacheData: CachedChannelData = JSON.parse(cached)
      
      if (Date.now() - cacheData.lastUpdated > this.CACHE_EXPIRY_MS) {
        localStorage.removeItem(key)
        return []
      }
      
      return cacheData.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined
      }))
    } catch (error) {
      console.warn('Failed to load messages from localStorage:', error)
      return []
    }
  }

  private cleanupOldCache(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('dogicord-messages-'))
      
      if (keys.length <= this.MAX_CACHED_CHANNELS) return
      
      const cacheInfo = keys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          return { key, lastUpdated: data.lastUpdated || 0 }
        } catch {
          return { key, lastUpdated: 0 }
        }
      }).sort((a, b) => a.lastUpdated - b.lastUpdated)
      
      const toRemove = cacheInfo.slice(0, keys.length - this.MAX_CACHED_CHANNELS)
      toRemove.forEach(item => localStorage.removeItem(item.key))
    } catch (error) {
      console.warn('Failed to cleanup old cache:', error)
    }
  }

  private mergeMessages(cachedMessages: Message[], realtimeMessages: Message[]): Message[] {
    const messageMap = new Map<string, Message>()
    
    cachedMessages.forEach(msg => messageMap.set(msg.id, msg))
    
    realtimeMessages.forEach(msg => messageMap.set(msg.id, msg))
    
    return Array.from(messageMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  async sendMessage(
    content: string, 
    authorId: string, 
    authorName: string,
    authorAvatarUrl: string | null,
    serverId: string, 
    channelId: string,
    replyTo?: { messageId: string; authorName: string; content: string }
  ): Promise<void> {
    try {
      const server = await serverService.getServer(serverId)
      if (!server) {
        throw new Error('Server not found')
      }

      const channel = server.channels.find(ch => ch.id === channelId)
      if (!channel) {
        throw new Error('Channel not found')
      }

      const userRoles = await serverService.getUserRoles(serverId, authorId)
      const isOwner = server.ownerId === authorId

      const channelPermCheck = permissionService.hasChannelPermission(
        userRoles, 
        channel, 
        'send_messages', 
        isOwner
      )

      if (!channelPermCheck.allowed) {
        throw new Error('You do not have permission to send messages in this channel')
      }

      if (content.includes('@everyone') || content.includes('@here')) {
        if (!permissionService.canMentionEveryone(userRoles, isOwner)) {
          throw new Error('You do not have permission to mention @everyone or @here')
        }
      }

      if (content.length > 2000) {
        throw new Error('Message too long (max 2000 characters)')
      }

      const messageData: any = {
        content,
        authorId,
        authorName,
        authorAvatarUrl,
        serverId,
        channelId,
        timestamp: serverTimestamp(),
        edited: false
      }

      if (replyTo) {
        messageData.replyTo = replyTo
      }

      const docRef = await addDoc(collection(db, 'messages'), messageData)

      console.log('Message sent to Firestore successfully')

      try {
        const message: Message = {
          id: docRef.id,
          content,
          authorId,
          authorName,
          authorAvatarUrl: authorAvatarUrl || undefined,
          serverId,
          channelId,
          timestamp: new Date(),
          edited: false,
          replyTo
        }
        
        await this.sendNotificationViaAPI(message, server.name, channel.name)
      } catch (notificationError) {
        console.warn('Failed to send push notifications:', notificationError)
      }

    } catch (error: any) {
      console.error('Error sending message:', error)
      throw new Error(error.message)
    }
  }

  private async sendNotificationViaAPI(message: Message, serverName: string, channelName: string): Promise<void> {
    try {
      console.log('📨 Sending notification for message:', {
        author: message.authorName,
        content: message.content.substring(0, 50) + '...',
        server: serverName,
        channel: channelName,
        isDev: import.meta.env.DEV
      })

      // Development: Simulate notification + try real API (for testing Vercel integration)
      if (import.meta.env.DEV) {
        // Local simulation for immediate feedback
        setTimeout(() => {
          this.simulateNotificationForOtherUsers(message, serverName, channelName)
        }, 500)
        
        // Also try real API if available (for testing)
        try {
          const apiUrl = window.location.origin + '/api/send-notification'
          console.log('🔧 [DEV] Attempting real API call to:', apiUrl)
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message,
              serverName,
              channelName
            })
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log('✅ [DEV] Real API also worked:', result)
          } else {
            console.log('🔧 [DEV] Real API not available (expected in local dev)')
          }
        } catch (apiError) {
          console.log('🔧 [DEV] Real API not available (expected in local dev):', (apiError as Error).message)
        }
        
        return
      }

      // Production: Use real Vercel API
      console.log('📡 Sending notification request to Vercel API...')
      const apiUrl = '/api/send-notification'
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          serverName,
          channelName
        })
      })

      console.log(`📡 API Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ API Error: ${response.status} - ${errorText}`)
        throw new Error(`Notification API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('📡 API Response:', result)
      
      if (result.success) {
        console.log(`✅ FCM notifications sent to ${result.totalRecipients} recipients (${result.totalSuccess} successful, ${result.totalFailures} failed)`)
      } else {
        console.error(`❌ Notification API returned error: ${result.error}`)
        throw new Error(result.error || 'Failed to send notifications')
      }
    } catch (error) {
      console.error('❌ Failed to send notifications:', error)
      
      // In production, if API fails, don't throw - just log the error
      if (!import.meta.env.DEV) {
        console.warn('Notification delivery failed but message was sent successfully')
      }
    }
  }

  // Development helper to simulate notifications
  private simulateNotificationForOtherUsers(message: Message, serverName: string, channelName: string): void {
    // Only show notification if user is not in the current channel
    const currentUrl = window.location.href
    const isInSameChannel = currentUrl.includes(`server=${message.serverId}`) && 
                           currentUrl.includes(`channel=${message.channelId}`)
    
    if (!isInSameChannel && 'Notification' in window && Notification.permission === 'granted') {
      console.log('🔔 [DEV] Showing simulated FCM notification')
      
      const notification = new Notification(`#${channelName} in ${serverName}`, {
        body: `${message.authorName}: ${message.content}`,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'dogicord-dev-message'
      })
      
      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000)
      
      notification.onclick = () => {
        window.focus()
        // Navigate to the message channel
        const url = `/?server=${message.serverId}&channel=${message.channelId}`
        window.location.href = url
        notification.close()
      }
    } else {
      console.log('🔕 [DEV] Notification skipped (user in same channel or no permission)')
    }
  }

  async editMessage(messageId: string, newContent: string, userId: string): Promise<void> {
    try {
      const messageRef = doc(db, 'messages', messageId)
      const messageDoc = await getDoc(messageRef)
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found')
      }

      const messageData = messageDoc.data()
      
      if (messageData.authorId !== userId) {
        throw new Error('You can only edit your own messages')
      }

      const server = await serverService.getServer(messageData.serverId)
      if (!server) {
        throw new Error('Server not found')
      }

      const channel = server.channels.find(ch => ch.id === messageData.channelId)
      if (!channel) {
        throw new Error('Channel not found')
      }

      const userRoles = await serverService.getUserRoles(messageData.serverId, userId)
      const isOwner = server.ownerId === userId

      const channelPermCheck = permissionService.hasChannelPermission(
        userRoles, 
        channel, 
        'send_messages', 
        isOwner
      )

      if (!channelPermCheck.allowed) {
        throw new Error('You do not have permission to edit messages in this channel')
      }

      if (newContent.includes('@everyone') || newContent.includes('@here')) {
        if (!permissionService.canMentionEveryone(userRoles, isOwner)) {
          throw new Error('You do not have permission to mention @everyone or @here')
        }
      }

      if (newContent.length > 2000) {
        throw new Error('Message too long (max 2000 characters)')
      }

      await updateDoc(messageRef, {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp()
      })

    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  async deleteMessage(messageId: string, userId: string, userRoles?: Role[], isOwner?: boolean): Promise<void> {
    try {
      const messageRef = doc(db, 'messages', messageId)
      const messageDoc = await getDoc(messageRef)
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found')
      }

      const messageData = messageDoc.data()
      const isOwnMessage = messageData.authorId === userId

      if (!isOwnMessage) {
        if (!userRoles || isOwner === undefined) {
          const server = await serverService.getServer(messageData.serverId)
          if (!server) {
            throw new Error('Server not found')
          }
          
          userRoles = await serverService.getUserRoles(messageData.serverId, userId)
          isOwner = server.ownerId === userId
        }

        const canManage = permissionService.canManageMessage(
          userRoles,
          messageData.authorId,
          userId,
          isOwner
        )

        if (!canManage.allowed) {
          throw new Error(canManage.reason || 'You do not have permission to delete this message')
        }
      }

      await deleteDoc(messageRef)

    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  subscribeToMessages(
    serverId: string, 
    channelId: string, 
    callback: (messages: Message[]) => void,
    userId?: string
  ): () => void {
    const cacheKey = this.getCacheKey(serverId, channelId)
    
    const existingListener = this.activeListeners.get(cacheKey)
    if (existingListener) {
      existingListener()
    }

    console.log('Setting up message subscription for:', cacheKey)

    const cachedMessages = this.loadMessagesFromLocalStorage(serverId, channelId)
    if (cachedMessages.length > 0) {
      console.log('Loaded', cachedMessages.length, 'messages from cache')
      callback(cachedMessages)
    }

    const q = query(
      collection(db, 'messages'),
      where('serverId', '==', serverId),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'asc')
    )

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      console.log('Message snapshot received, docs count:', querySnapshot.docs.length)
      
      if (userId) {
        try {
          const hasPermission = await this.checkChannelPermissions(serverId, channelId, userId)
          if (!hasPermission.canView) {
            console.log('User does not have permission to view channel')
            callback([])
            return
          }
        } catch (error) {
          console.error('Error checking permissions for messages:', error)
          callback([])
          return
        }
      }

      const realtimeMessages: Message[] = []
      
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const messageDate = data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date()

        realtimeMessages.push({
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatarUrl: data.authorAvatarUrl || undefined,
          serverId: data.serverId,
          channelId: data.channelId,
          timestamp: messageDate,
          edited: data.edited,
          editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined,
          replyTo: data.replyTo || undefined
        })
      })

      const previousLength = this.messageCache.get(this.getCacheKey(serverId, channelId))?.messages.length || 0
      if (realtimeMessages.length > previousLength && userId) {
        const newMessages = realtimeMessages.slice(previousLength)
        newMessages.forEach(msg => {
          // Use the improved unread detection logic
          if (notificationService.isMessageUnread(
            serverId, 
            channelId, 
            msg.id, 
            msg.timestamp.getTime(), 
            msg.authorId, 
            userId
          )) {
            notificationService.addUnreadMessage(
              serverId, 
              channelId, 
              msg.id, 
              msg.timestamp.getTime()
            )
          }
        })
      }

      this.messageCache.set(this.getCacheKey(serverId, channelId), {
        messages: realtimeMessages,
        lastUpdated: Date.now(),
        hasMore: false,
        isLoading: false
      })

      const mergedMessages = this.mergeMessages(cachedMessages, realtimeMessages)
      
      this.saveMessagesToLocalStorage(serverId, channelId, mergedMessages)
      
      console.log('Processed messages:', mergedMessages.length, '(cached:', cachedMessages.length, ', realtime:', realtimeMessages.length, ')')
      callback(mergedMessages)
    }, (error) => {
      console.error('Error in message subscription:', error)
      if (cachedMessages.length > 0) {
        callback(cachedMessages)
      } else {
        callback([])
      }
    })

    const cleanup = () => {
      console.log('Cleaning up message subscription for:', cacheKey)
      unsubscribe()
    }

    this.activeListeners.set(cacheKey, cleanup)
    return cleanup
  }

  private async checkChannelPermissions(serverId: string, channelId: string, userId: string): Promise<{
    canView: boolean
    canReadHistory: boolean
  }> {
    try {
      const server = await serverService.getServer(serverId)
      if (!server) return { canView: false, canReadHistory: false }

      const channel = server.channels.find(ch => ch.id === channelId)
      if (!channel) return { canView: false, canReadHistory: false }

      const userRoles = await serverService.getUserRoles(serverId, userId)
      const isOwner = server.ownerId === userId

      // Use the enhanced permission service for better channel visibility logic
      const canView = permissionService.canUserSeeChannel(userRoles, channel, isOwner)
      const historyPermCheck = permissionService.hasChannelPermission(userRoles, channel, 'read_message_history', isOwner)

      return {
        canView,
        canReadHistory: historyPermCheck.allowed
      }
    } catch (error) {
      console.error('Error checking channel permissions:', error)
      return { canView: false, canReadHistory: false }
    }
  }

  clearCache(serverId?: string, channelId?: string): void {
    if (serverId && channelId) {
      const cacheKey = this.getCacheKey(serverId, channelId)
      this.messageCache.delete(cacheKey)
      
      const localStorageKey = this.getLocalStorageKey(serverId, channelId)
      localStorage.removeItem(localStorageKey)
    } else {
      this.messageCache.clear()
      
      const keys = Object.keys(localStorage).filter(key => key.startsWith('dogicord-messages-'))
      keys.forEach(key => localStorage.removeItem(key))
    }
  }

  clearExpiredCache(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('dogicord-messages-'))
      
      keys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          if (Date.now() - (data.lastUpdated || 0) > this.CACHE_EXPIRY_MS) {
            localStorage.removeItem(key)
          }
        } catch {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.warn('Failed to cleanup expired cache:', error)
    }
  }

  getCacheStats(): { cacheSize: number, activeListeners: number, localStorageChannels: number } {
    const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('dogicord-messages-'))
    
    return {
      cacheSize: this.messageCache.size,
      activeListeners: this.activeListeners.size,
      localStorageChannels: localStorageKeys.length
    }
  }

  private initializeCleanup(): void {
    this.clearExpiredCache()
    
    setInterval(() => {
      this.clearExpiredCache()
    }, 5 * 60 * 1000)
  }

  async validateMessageContent(content: string, userRoles: Role[], isOwner: boolean = false): Promise<{
    valid: boolean
    reason?: string
  }> {
    if (content.length === 0) {
      return { valid: false, reason: 'Message cannot be empty' }
    }

    if (content.length > 2000) {
      return { valid: false, reason: 'Message too long (max 2000 characters)' }
    }

    if ((content.includes('@everyone') || content.includes('@here')) && 
        !permissionService.canMentionEveryone(userRoles, isOwner)) {
      return { valid: false, reason: 'You do not have permission to mention @everyone or @here' }
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g
    const hasLinks = urlRegex.test(content)
    
    if (hasLinks && !permissionService.hasServerPermission(userRoles, 'embed_links', isOwner)) {
      return { valid: false, reason: 'You do not have permission to post links' }
    }

    return { valid: true }
  }

  async canUserSendMessage(
    userId: string,
    serverId: string,
    channelId: string
  ): Promise<{ canSend: boolean; reason?: string }> {
    try {
      const server = await serverService.getServer(serverId)
      if (!server) {
        return { canSend: false, reason: 'Server not found' }
      }

      const channel = server.channels.find(ch => ch.id === channelId)
      if (!channel) {
        return { canSend: false, reason: 'Channel not found' }
      }

      const userRoles = await serverService.getUserRoles(serverId, userId)
      const isOwner = server.ownerId === userId

      const permCheck = permissionService.hasChannelPermission(
        userRoles,
        channel,
        'send_messages',
        isOwner
      )

      return {
        canSend: permCheck.allowed,
        reason: permCheck.reason
      }
    } catch (error: any) {
      return { canSend: false, reason: error.message }
    }
  }

  getActiveListeners(): string[] {
    return Array.from(this.activeListeners.keys())
  }
}

export const messageService = new MessageService()