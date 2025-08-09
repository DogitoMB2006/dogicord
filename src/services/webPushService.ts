class WebPushService {
  private userId: string | null = null
  private subscription: PushSubscription | null = null
  private isInitialized = false

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return

    this.userId = userId

    try {
      // Check if browser supports notifications and service workers
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications')
        return
      }

      if (!('serviceWorker' in navigator)) {
        console.log('This browser does not support service workers')
        return
      }

      // Register our existing service worker for push notifications
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        console.log('No service worker registered, cannot use web push')
        return
      }

      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.log('Notification permission not granted')
        return
      }

      // Subscribe to push notifications (optional - for advanced features)
      try {
        this.subscription = await registration.pushManager.getSubscription()
        if (!this.subscription) {
          console.log('No existing push subscription found')
        }
      } catch (error) {
        console.log('Push subscription not available:', error)
      }

      this.isInitialized = true
      console.log('✅ Web Push Service initialized')

      // Debug functions
      ;(window as any).webPushStatus = () => this.getStatus()
      ;(window as any).sendTestWebPush = (title: string, body: string) => 
        this.sendTestNotification(title, body)

    } catch (error) {
      console.error('❌ Web Push initialization failed:', error)
      this.isInitialized = false
    }
  }

  async sendNotificationToUser(targetUserId: string, notification: {
    title: string
    body: string
    url?: string
    icon?: string
    data?: any
  }): Promise<boolean> {
    try {
      // Send notification via API to target user
      const response = await fetch('/api/web-push-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId,
          notification
        })
      })

      const result = await response.json()
      if (result.success) {
        console.log('✅ Web push notification sent successfully')
        return true
      } else {
        console.error('❌ Web push notification failed:', result.error)
        return false
      }
    } catch (error) {
      console.error('❌ Web push send error:', error)
      return false
    }
  }

  async sendTestNotification(title: string, body: string): Promise<void> {
    // Send local browser notification (for testing)
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/vite.svg',
        tag: 'web-push-test'
      })

      setTimeout(() => notification.close(), 5000)
      
      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      console.log('Test web push notification sent')
    } else {
      console.error('Cannot send test notification - permission not granted')
    }
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      userId: this.userId,
      hasSubscription: !!this.subscription,
      notificationPermission: 'Notification' in window ? Notification.permission : 'unsupported',
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushSupported: 'PushManager' in window
    }
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false
    this.userId = null
    this.subscription = null
    console.log('Web Push Service cleaned up')
  }
}

export const webPushService = new WebPushService()
export default webPushService
