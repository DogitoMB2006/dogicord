import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore'
import { db } from '../config/firebase'

interface RealtimeNotification {
  id: string
  targetUserId: string
  title: string
  body: string
  url?: string
  icon?: string
  data?: any
  timestamp: Date
  delivered: boolean
}

class RealtimeNotificationService {
  private userId: string | null = null
  private unsubscribe: (() => void) | null = null
  private isListening = false

  async initialize(userId: string): Promise<void> {
    this.userId = userId

    // Start listening for real-time notifications
    this.startListening()
    
    console.log('✅ Realtime Notification Service initialized')

    // Debug function
    ;(window as any).realtimeNotificationStatus = () => ({
      userId: this.userId,
      isListening: this.isListening
    })
  }

  private startListening(): void {
    if (!this.userId || this.isListening) return

    console.log('🎧 Starting to listen for real-time notifications...')

    // Listen for new notifications in user's notification queue
    const notificationsRef = collection(db, 'users', this.userId, 'notifications')
    const q = query(
      notificationsRef,
      where('delivered', '==', false),
      orderBy('timestamp', 'desc'),
      limit(10)
    )

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const notificationData = change.doc.data()
          const notification: RealtimeNotification = {
            id: change.doc.id,
            targetUserId: notificationData.targetUserId,
            title: notificationData.title,
            body: notificationData.body,
            url: notificationData.url,
            icon: notificationData.icon,
            data: notificationData.data,
            timestamp: notificationData.timestamp?.toDate() || new Date(),
            delivered: notificationData.delivered
          }

          // Show the notification
          await this.showNotification(notification)

          // Mark as delivered
          await this.markAsDelivered(change.doc.id)
        }
      })
    }, (error) => {
      console.error('❌ Real-time notification listener error:', error)
    })

    this.isListening = true
  }

  private async showNotification(notification: RealtimeNotification): Promise<void> {
    try {
      console.log('🔔 Received real-time notification:', notification.title)

      // Check if user is currently viewing the related content
      const currentUrl = window.location.href
      const shouldSkip = notification.data?.serverId && notification.data?.channelId &&
                        currentUrl.includes(`server=${notification.data.serverId}`) && 
                        currentUrl.includes(`channel=${notification.data.channelId}`) &&
                        !document.hidden && document.hasFocus()

      if (shouldSkip) {
        console.log('🔕 Notification skipped - user is actively viewing related content')
        return
      }

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const browserNotification = new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/vite.svg',
          badge: '/vite.svg',
          tag: `realtime-${notification.id}`,
          requireInteraction: false,
          silent: false
        })

        // Auto close after 6 seconds
        setTimeout(() => browserNotification.close(), 6000)

        browserNotification.onclick = () => {
          window.focus()
          if (notification.url) {
            window.location.href = notification.url
          }
          browserNotification.close()
        }

        console.log('✅ Real-time notification shown successfully')
      } else {
        console.warn('❌ Cannot show notification - permission not granted')
      }
    } catch (error) {
      console.error('❌ Failed to show real-time notification:', error)
    }
  }

  private async markAsDelivered(notificationId: string): Promise<void> {
    if (!this.userId) return

    try {
      const notificationRef = doc(db, 'users', this.userId, 'notifications', notificationId)
      await updateDoc(notificationRef, {
        delivered: true,
        deliveredAt: new Date()
      })
    } catch (error) {
      console.error('❌ Failed to mark notification as delivered:', error)
    }
  }

  async cleanup(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.isListening = false
    this.userId = null
    console.log('Real-time Notification Service cleaned up')
  }
}

export const realtimeNotificationService = new RealtimeNotificationService()
export default realtimeNotificationService
