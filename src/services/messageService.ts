
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
    // Inicializar limpieza automática solo una vez
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
        messages: messages.slice(-100), // Solo guardar los últimos 100 mensajes
        lastUpdated: Date.now()
      }
      const key = this.getLocalStorageKey(serverId, channelId)
      localStorage.setItem(key, JSON.stringify(cacheData))
      
      // Limpiar caché viejo
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
      
      // Verificar si el caché no está expirado
      if (Date.now() - cacheData.lastUpdated > this.CACHE_EXPIRY_MS) {
        localStorage.removeItem(key)
        return []
      }
      
      // Convertir timestamps de string a Date
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
      
      // Ordenar por última actualización y eliminar los más viejos
      const cacheInfo = keys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          return { key, lastUpdated: data.lastUpdated || 0 }
        } catch {
          return { key, lastUpdated: 0 }
        }
      }).sort((a, b) => a.lastUpdated - b.lastUpdated)
      
      // Eliminar los más viejos
      const toRemove = cacheInfo.slice(0, keys.length - this.MAX_CACHED_CHANNELS)
      toRemove.forEach(item => localStorage.removeItem(item.key))
    } catch (error) {
      console.warn('Failed to cleanup old cache:', error)
    }
  }

  private mergeMessages(cachedMessages: Message[], realtimeMessages: Message[]): Message[] {
    const messageMap = new Map<string, Message>()
    
    // Agregar mensajes en caché
    cachedMessages.forEach(msg => messageMap.set(msg.id, msg))
    
    // Agregar/actualizar con mensajes en tiempo real
    realtimeMessages.forEach(msg => messageMap.set(msg.id, msg))
    
    // Convertir de vuelta a array y ordenar
    return Array.from(messageMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
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

      // Enviar mensaje a Firestore
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

      console.log('Message sent to Firestore successfully')

    } catch (error: any) {
      console.error('Error sending message:', error)
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
    
    // Limpiar listener anterior si existe
    const existingListener = this.activeListeners.get(cacheKey)
    if (existingListener) {
      existingListener()
    }

    console.log('Setting up message subscription for:', cacheKey)

    // Cargar mensajes desde localStorage inmediatamente
    const cachedMessages = this.loadMessagesFromLocalStorage(serverId, channelId)
    if (cachedMessages.length > 0) {
      console.log('Loaded', cachedMessages.length, 'messages from cache')
      callback(cachedMessages)
    }

    // Configurar listener en tiempo real
    const q = query(
      collection(db, 'messages'),
      where('serverId', '==', serverId),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'asc')
    )

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      console.log('Message snapshot received, docs count:', querySnapshot.docs.length)
      
      // Verificar permisos si hay userId
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
          editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined
        })
      })

      // Detectar mensajes nuevos para notificaciones
      const previousLength = this.messageCache.get(this.getCacheKey(serverId, channelId))?.messages.length || 0
      if (realtimeMessages.length > previousLength && userId) {
        const newMessages = realtimeMessages.slice(previousLength)
        newMessages.forEach(msg => {
          if (msg.authorId !== userId) {
            notificationService.addUnreadMessage(
              serverId, 
              channelId, 
              msg.id, 
              msg.timestamp.getTime()
            )
          }
        })
      }

      // Actualizar caché en memoria
      this.messageCache.set(this.getCacheKey(serverId, channelId), {
        messages: realtimeMessages,
        lastUpdated: Date.now(),
        hasMore: false,
        isLoading: false
      })

      // Fusionar mensajes en caché con mensajes en tiempo real
      const mergedMessages = this.mergeMessages(cachedMessages, realtimeMessages)
      
      // Guardar en localStorage
      this.saveMessagesToLocalStorage(serverId, channelId, mergedMessages)
      
      console.log('Processed messages:', mergedMessages.length, '(cached:', cachedMessages.length, ', realtime:', realtimeMessages.length, ')')
      callback(mergedMessages)
    }, (error) => {
      console.error('Error in message subscription:', error)
      // Si hay error, al menos mostrar los mensajes en caché
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

  clearCache(serverId?: string, channelId?: string): void {
    if (serverId && channelId) {
      const cacheKey = this.getCacheKey(serverId, channelId)
      this.messageCache.delete(cacheKey)
      
      // También limpiar localStorage
      const localStorageKey = this.getLocalStorageKey(serverId, channelId)
      localStorage.removeItem(localStorageKey)
    } else {
      this.messageCache.clear()
      
      // Limpiar todo el localStorage de mensajes
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

  // Inicializar limpieza automática al cargar
  private initializeCleanup(): void {
    this.clearExpiredCache()
    
    // Limpiar caché expirado cada 5 minutos
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

  // Método para debug - verificar estado de listeners
  getActiveListeners(): string[] {
    return Array.from(this.activeListeners.keys())
  }
}

export const messageService = new MessageService()