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

      await updateDoc(messageRef, {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp()
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async deleteMessage(messageId: string, userId: string, canManageMessages: boolean = false): Promise<void> {
    try {
      const messageRef = doc(db, 'messages', messageId)
      const messageDoc = await getDoc(messageRef)
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found')
      }

      const messageData = messageDoc.data()
      
      if (messageData.authorId !== userId && !canManageMessages) {
        throw new Error('You can only delete your own messages')
      }

      await deleteDoc(messageRef)
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  subscribeToMessages(
    serverId: string, 
    channelId: string, 
    callback: (messages: Message[]) => void
  ): () => void {
    const q = query(
      collection(db, 'messages'),
      where('serverId', '==', serverId),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'asc')
    )

    return onSnapshot(q, (querySnapshot) => {
      const messages: Message[] = []

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

      callback(messages)
    })
  }
}