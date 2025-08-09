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

      // NEW LOGIC: Only skip if user is actively viewing the EXACT same channel AND window is focused
      const shouldShow = this.shouldShowNotification(notification)
      
      console.log('🔍 Notification decision:', {
        shouldShow,
        currentUrl: window.location.href,
        targetChannel: `${notification.data?.serverId}/${notification.data?.channelId}`,
        windowHidden: document.hidden,
        windowFocused: document.hasFocus()
      })

      if (!shouldShow) {
        console.log('🔕 Notification skipped - user is actively viewing this exact channel')
        return
      }

      // Always try Service Worker notification first (works in all scenarios)
      const swNotificationSent = await this.showServiceWorkerNotification(notification)
      
      if (swNotificationSent) {
        console.log('✅ Service Worker notification sent (works in background/foreground/PWA)')
        return
      }

      // Fallback to browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        console.log('📤 Using browser notification as fallback')
        const browserNotification = new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/vite.svg',
          badge: '/vite.svg',
          tag: `realtime-${notification.id}`,
          requireInteraction: false,
          silent: false,
          vibrate: [200, 100, 200]
        })

        // Auto close after 8 seconds
        setTimeout(() => {
          try {
            browserNotification.close()
          } catch (e) {
            // Notification might already be closed
          }
        }, 8000)

        browserNotification.onclick = () => {
          window.focus()
          if (notification.url) {
            window.location.href = notification.url
          }
          try {
            browserNotification.close()
          } catch (e) {
            // Notification might already be closed
          }
        }

        console.log('✅ Browser notification shown successfully')
      } else {
        console.warn('❌ Cannot show notification - permission not granted or API not available')
      }
    } catch (error) {
      console.error('❌ Failed to show real-time notification:', error)
    }
  }

  private shouldShowNotification(notification: RealtimeNotification): boolean {
    // Get current page info
    const currentUrl = window.location.href
    const urlParams = new URLSearchParams(window.location.search)
    const currentServerId = urlParams.get('server')
    const currentChannelId = urlParams.get('channel')
    
    // Check if this notification is for the current channel
    const isCurrentChannel = notification.data?.serverId === currentServerId && 
                            notification.data?.channelId === currentChannelId

    // Page visibility states
    const isWindowHidden = document.hidden
    const isWindowFocused = document.hasFocus()
    const isPageVisible = !isWindowHidden && isWindowFocused

    console.log('🔍 Notification context:', {
      isCurrentChannel,
      isWindowHidden,
      isWindowFocused, 
      isPageVisible,
      currentChannel: `${currentServerId}/${currentChannelId}`,
      notificationChannel: `${notification.data?.serverId}/${notification.data?.channelId}`
    })

    // SHOW notification in these cases:
    // 1. User is in a different channel (even if window is focused)
    // 2. User is in the same channel but window is minimized/hidden
    // 3. User is in the same channel but window is not focused
    
    // ONLY SKIP if: user is in the exact same channel AND page is fully visible and focused
    if (isCurrentChannel && isPageVisible) {
      return false // Skip - user is actively viewing this channel
    }

    return true // Show in all other cases
  }

  private async showServiceWorkerNotification(notification: RealtimeNotification): Promise<boolean> {
    try {
      // Check if service worker is available
      if (!('serviceWorker' in navigator)) {
        return false
      }

      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration || !registration.active) {
        return false
      }

      // Send message to service worker to show notification
      registration.active.postMessage({
        type: 'SHOW_NOTIFICATION',
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/vite.svg',
          url: notification.url,
          data: notification.data
        }
      })

      return true
    } catch (error) {
      console.error('❌ Service Worker notification failed:', error)
      return false
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
