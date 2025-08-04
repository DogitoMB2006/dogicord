// src/services/messageService.ts
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
  getDoc,
  limit,
  startAfter,
  DocumentSnapshot,
  getDocs
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { serverService } from './serverService'
import { permissionService } from './permissionService'
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
}

interface MessageCache {
  messages: Message[]
  lastVisible?: DocumentSnapshot
  hasMore: boolean
  isLoading: boolean
}

class MessageService {
  private messageCache = new Map<string, MessageCache>()
  private activeListeners = new Map<string, () => void>()
  private realtimeListeners = new Map<string, () => void>()
  private MESSAGES_PER_LOAD = 50
  private CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutos
  private lastCacheClean = Date.now()

  private getCacheKey(serverId: string, channelId: string): string {
    return `${serverId}-${channelId}`
  }

  private cleanExpiredCache(): void {
    const now = Date.now()
    if (now - this.lastCacheClean < 60000) return

    this.messageCache.forEach((_, key) => {
      if (now - this.lastCacheClean > this.CACHE_EXPIRY) {
        this.messageCache.delete(key)
      }
    })
    this.lastCacheClean = now
  }

  async sendMessage(
    content: string, 
    authorId: string, 
    authorName: string,
    authorAvatarUrl: string | null,
    serverId: string, 
    channelId: string
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

      await addDoc(collection(db, 'messages'), {
        content,
        authorId,
        authorName,
        authorAvatarUrl,
        serverId,
        channelId,
        timestamp: serverTimestamp(),
        edited: false
      })

      // Invalidar cache para forzar recarga
      const cacheKey = this.getCacheKey(serverId, channelId)
      this.messageCache.delete(cacheKey)

    } catch (error: any) {
      throw new Error(error.message)
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

      // Actualizar cache local si existe
      const cacheKey = this.getCacheKey(messageData.serverId, messageData.channelId)
      const cache = this.messageCache.get(cacheKey)
      if (cache) {
        cache.messages = cache.messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: newContent, edited: true, editedAt: new Date() }
            : msg
        )
      }

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

      // Remover del cache local si existe
      const cacheKey = this.getCacheKey(messageData.serverId, messageData.channelId)
      const cache = this.messageCache.get(cacheKey)
      if (cache) {
        cache.messages = cache.messages.filter(msg => msg.id !== messageId)
      }

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
    
    // Limpiar listener anterior si existe
    const existingListener = this.activeListeners.get(cacheKey)
    if (existingListener) {
      existingListener()
    }

    // Limpiar listener de tiempo real anterior
    const existingRealtimeListener = this.realtimeListeners.get(cacheKey)
    if (existingRealtimeListener) {
      existingRealtimeListener()
    }

    this.cleanExpiredCache()

    // Cargar mensajes iniciales
    this.loadInitialMessages(serverId, channelId, userId).then(initialMessages => {
      callback(initialMessages)
      
      // Configurar listener de tiempo real solo para mensajes nuevos
      this.setupRealtimeListener(serverId, channelId, userId, callback)
    })

    const cleanup = () => {
      const realtimeListener = this.realtimeListeners.get(cacheKey)
      if (realtimeListener) {
        realtimeListener()
        this.realtimeListeners.delete(cacheKey)
      }
      this.activeListeners.delete(cacheKey)
    }

    this.activeListeners.set(cacheKey, cleanup)
    return cleanup
  }

  private async loadInitialMessages(
    serverId: string,
    channelId: string,
    userId?: string
  ): Promise<Message[]> {
    const cacheKey = this.getCacheKey(serverId, channelId)
    let cache = this.messageCache.get(cacheKey)

    if (cache && cache.messages.length > 0) {
      return cache.messages
    }

    if (userId) {
      const hasPermission = await this.checkChannelPermissions(serverId, channelId, userId)
      if (!hasPermission.canView) {
        return []
      }
    }

    try {
      // Cargar últimos mensajes
      const q = query(
        collection(db, 'messages'),
        where('serverId', '==', serverId),
        where('channelId', '==', channelId),
        orderBy('timestamp', 'desc'),
        limit(this.MESSAGES_PER_LOAD)
      )

      const querySnapshot = await getDocs(q)
      const messages: Message[] = []
      let lastVisible: DocumentSnapshot | undefined

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        messages.unshift({
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatarUrl: data.authorAvatarUrl || undefined,
          serverId: data.serverId,
          channelId: data.channelId,
          timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          edited: data.edited,
          editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined
        })
      })

      if (querySnapshot.docs.length > 0) {
        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1]
      }

      cache = {
        messages,
        lastVisible,
        hasMore: querySnapshot.docs.length === this.MESSAGES_PER_LOAD,
        isLoading: false
      }
      this.messageCache.set(cacheKey, cache)

      return messages
    } catch (error) {
      console.error('Error loading initial messages:', error)
      return []
    }
  }

  private setupRealtimeListener(
    serverId: string,
    channelId: string,
    userId: string | undefined,
    callback: (messages: Message[]) => void
  ): void {
    const cacheKey = this.getCacheKey(serverId, channelId)
    const cache = this.messageCache.get(cacheKey)
    
    // Obtener timestamp del último mensaje para solo escuchar nuevos
    const lastMessageTime = cache?.messages.length ? 
      cache.messages[cache.messages.length - 1].timestamp : 
      new Date(Date.now() - 60000) // Últimos 60 segundos por seguridad

    // Query solo para mensajes nuevos
    const q = query(
      collection(db, 'messages'),
      where('serverId', '==', serverId),
      where('channelId', '==', channelId),
      where('timestamp', '>', lastMessageTime),
      orderBy('timestamp', 'asc')
    )

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      if (querySnapshot.empty) return

      if (userId) {
        const hasPermission = await this.checkChannelPermissions(serverId, channelId, userId)
        if (!hasPermission.canView) {
          callback([])
          return
        }
      }

      const newMessages: Message[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        newMessages.push({
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatarUrl: data.authorAvatarUrl || undefined,
          serverId: data.serverId,
          channelId: data.channelId,
          timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          edited: data.edited,
          editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined
        })
      })

      // Actualizar cache con nuevos mensajes
      const currentCache = this.messageCache.get(cacheKey)
      if (currentCache) {
        const updatedMessages = [...currentCache.messages]
        
        newMessages.forEach(newMsg => {
          const existingIndex = updatedMessages.findIndex(msg => msg.id === newMsg.id)
          if (existingIndex >= 0) {
            updatedMessages[existingIndex] = newMsg
          } else {
            updatedMessages.push(newMsg)
          }
        })

        const maxCacheSize = this.MESSAGES_PER_LOAD * 2
        if (updatedMessages.length > maxCacheSize) {
          updatedMessages.splice(0, updatedMessages.length - maxCacheSize)
        }

        currentCache.messages = updatedMessages
        callback(updatedMessages)
      }
    }, (error) => {
      console.error('Error in realtime message listener:', error)
    })

    this.realtimeListeners.set(cacheKey, unsubscribe)
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

      const viewPermCheck = permissionService.hasChannelPermission(userRoles, channel, 'view_channel', isOwner)
      const historyPermCheck = permissionService.hasChannelPermission(userRoles, channel, 'read_message_history', isOwner)

      return {
        canView: viewPermCheck.allowed,
        canReadHistory: historyPermCheck.allowed
      }
    } catch (error) {
      console.error('Error checking channel permissions:', error)
      return { canView: false, canReadHistory: false }
    }
  }

  async loadMoreMessages(serverId: string, channelId: string): Promise<Message[]> {
    const cacheKey = this.getCacheKey(serverId, channelId)
    const cache = this.messageCache.get(cacheKey)

    if (!cache || !cache.hasMore || cache.isLoading) {
      return cache?.messages || []
    }

    cache.isLoading = true

    try {
      const q = query(
        collection(db, 'messages'),
        where('serverId', '==', serverId),
        where('channelId', '==', channelId),
        orderBy('timestamp', 'desc'),
        startAfter(cache.lastVisible),
        limit(this.MESSAGES_PER_LOAD)
      )

      const querySnapshot = await getDocs(q)
      const olderMessages: Message[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        olderMessages.unshift({
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatarUrl: data.authorAvatarUrl || undefined,
          serverId: data.serverId,
          channelId: data.channelId,
          timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          edited: data.edited,
          editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined
        })
      })

      cache.messages = [...olderMessages, ...cache.messages]
      cache.lastVisible = querySnapshot.docs.length > 0 ? 
        querySnapshot.docs[querySnapshot.docs.length - 1] : cache.lastVisible
      cache.hasMore = querySnapshot.docs.length === this.MESSAGES_PER_LOAD
      cache.isLoading = false

      return cache.messages
    } catch (error) {
      console.error('Error loading more messages:', error)
      cache.isLoading = false
      return cache.messages
    }
  }

  clearCache(serverId?: string, channelId?: string): void {
    if (serverId && channelId) {
      const cacheKey = this.getCacheKey(serverId, channelId)
      this.messageCache.delete(cacheKey)
    } else {
      this.messageCache.clear()
    }
  }

  getCacheStats(): { cacheSize: number, activeListeners: number } {
    return {
      cacheSize: this.messageCache.size,
      activeListeners: this.activeListeners.size
    }
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
}

export const messageService = new MessageService()