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

export const messageService = {
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
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

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
  },

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
  },

  subscribeToMessages(
    serverId: string, 
    channelId: string, 
    callback: (messages: Message[]) => void,
    userId?: string
  ): () => void {
    const q = query(
      collection(db, 'messages'),
      where('serverId', '==', serverId),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'asc')
    )

    return onSnapshot(q, async (querySnapshot) => {
      const messages: Message[] = []

      if (userId) {
        try {
          const server = await serverService.getServer(serverId)
          if (!server) return

          const channel = server.channels.find(ch => ch.id === channelId)
          if (!channel) return

          const userRoles = await serverService.getUserRoles(serverId, userId)
          const isOwner = server.ownerId === userId

          const viewPermCheck = permissionService.hasChannelPermission(
            userRoles,
            channel,
            'view_channel',
            isOwner
          )

          if (!viewPermCheck.allowed) {
            callback([])
            return
          }

          const historyPermCheck = permissionService.hasChannelPermission(
            userRoles,
            channel,
            'read_message_history',
            isOwner
          )

          querySnapshot.forEach((doc) => {
            const data = doc.data()
            const messageDate = data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date()

            if (!historyPermCheck.allowed) {
              const now = new Date()
              const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
              if (messageDate < fiveMinutesAgo) {
                return
              }
            }

            messages.push({
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
        } catch (error) {
          console.error('Error checking permissions for messages:', error)
          callback([])
          return
        }
      } else {
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          messages.push({
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
      }

      callback(messages)
    })
  },

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
  },

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