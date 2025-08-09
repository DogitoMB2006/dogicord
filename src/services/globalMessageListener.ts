import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  limit
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { notificationService } from './notificationService'

class GlobalMessageListener {
  private listeners = new Map<string, () => void>()
  private isListening = false
  private lastMessageTimestamps = new Map<string, number>()

  startGlobalListener(userId: string, userServers: string[]): void {
    if (this.isListening || userServers.length === 0) return

    this.isListening = true

   
    userServers.forEach(serverId => {
      const q = query(
        collection(db, 'messages'),
        where('serverId', '==', serverId),
        orderBy('timestamp', 'desc'),
        limit(50) 
      )

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data()
            const messageDate = data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date()
            const messageTimestamp = messageDate.getTime()

            const lastTimestamp = this.lastMessageTimestamps.get(`${serverId}-${data.channelId}`) || 0
            
            if (messageTimestamp > lastTimestamp && data.authorId !== userId) {
              notificationService.addUnreadMessage(
                data.serverId,
                data.channelId,
                change.doc.id,
                messageTimestamp
              )
            }

            // Actualizar el timestamp más reciente para este canal
            this.lastMessageTimestamps.set(`${serverId}-${data.channelId}`, messageTimestamp)
          }
        })
      }, (error) => {
        console.error(`Error in global message listener for server ${serverId}:`, error)
      })

      this.listeners.set(serverId, unsubscribe)
    })
  }

  stopGlobalListener(): void {
    this.listeners.forEach(unsubscribe => unsubscribe())
    this.listeners.clear()
    this.isListening = false
    this.lastMessageTimestamps.clear()
  }

  updateServers(userId: string, userServers: string[]): void {
    this.stopGlobalListener()
    if (userServers.length > 0) {
      this.startGlobalListener(userId, userServers)
    }
  }

  cleanup(): void {
    this.listeners.forEach(unsubscribe => unsubscribe())
    this.listeners.clear()
    this.isListening = false
  }
}

export const globalMessageListener = new GlobalMessageListener()
