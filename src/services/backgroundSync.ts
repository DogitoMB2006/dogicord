// Background Sync Service for enhanced mobile push notifications
// Optimized for iOS and Android background processing

interface QueuedNotification {
  id: string
  userId: string
  serverId: string
  channelId: string
  messageId: string
  title: string
  body: string
  timestamp: number
  retryCount: number
}

class BackgroundSyncService {
  private isSupported = false
  private registration: ServiceWorkerRegistration | null = null
  private queuedNotifications: QueuedNotification[] = []
  private readonly QUEUE_KEY = 'dogicord-notification-queue'
  private readonly MAX_RETRY_COUNT = 3
  private visibilityChangeHandler: (() => void) | null = null

  async initialize(): Promise<void> {
    // Check for Background Sync support
    this.isSupported = 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype

    if (!this.isSupported) {
      console.log('Background Sync not supported, using fallback methods')
      this.setupFallbackMethods()
      return
    }

    try {
      // Get service worker registration
      this.registration = await navigator.serviceWorker.ready
      console.log('Background Sync initialized successfully')

      // Load queued notifications from localStorage
      this.loadQueuedNotifications()

      // Setup visibility change listener for mobile app lifecycle
      this.setupVisibilityListener()

      // Register background sync
      await this.registerBackgroundSync()
    } catch (error) {
      console.error('Failed to initialize Background Sync:', error)
      this.setupFallbackMethods()
    }
  }

  // Queue notification for background sync
  async queueNotification(notification: Omit<QueuedNotification, 'id' | 'retryCount'>): Promise<void> {
    const queuedNotification: QueuedNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0
    }

    this.queuedNotifications.push(queuedNotification)
    this.saveQueuedNotifications()

    if (this.isSupported && this.registration) {
      try {
        // Register for background sync with proper type casting
        const syncRegistration = this.registration as any
        await syncRegistration.sync.register('notification-sync')
        console.log('Background sync registered for notification:', queuedNotification.id)
      } catch (error) {
        console.error('Failed to register background sync:', error)
        // Fallback to immediate processing
        this.processNotificationFallback(queuedNotification)
      }
    } else {
      // Fallback for browsers without background sync
      this.processNotificationFallback(queuedNotification)
    }
  }

  // Register background sync event
  private async registerBackgroundSync(): Promise<void> {
    if (!this.registration) return

    try {
      // Type cast for Background Sync API
      const syncRegistration = this.registration as any
      await syncRegistration.sync.register('notification-sync')
      console.log('Background sync service registered')
    } catch (error) {
      console.error('Failed to register background sync service:', error)
    }
  }

  // Setup fallback methods for browsers without background sync
  private setupFallbackMethods(): void {
    // Use Page Visibility API to detect when app becomes visible
    this.setupVisibilityListener()

    // Use service worker postMessage for immediate processing
    this.setupServiceWorkerMessaging()

    // Setup periodic processing for missed notifications
    setInterval(() => {
      this.processQueuedNotifications()
    }, 30000) // Every 30 seconds
  }

  // Setup visibility change listener for mobile optimization
  private setupVisibilityListener(): void {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
    }

    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('App became visible, processing queued notifications')
        this.processQueuedNotifications()
      } else if (document.visibilityState === 'hidden') {
        console.log('App went to background, ensuring notifications are queued')
        this.ensureBackgroundProcessing()
      }
    }

    document.addEventListener('visibilitychange', this.visibilityChangeHandler)
  }

  // Setup service worker messaging for immediate notification processing
  private setupServiceWorkerMessaging(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_PROCESSED') {
          this.removeProcessedNotification(event.data.notificationId)
        }
      })
    }
  }

  // Ensure background processing when app goes to background
  private ensureBackgroundProcessing(): void {
    // For mobile browsers, send notifications to service worker for processing
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'QUEUE_NOTIFICATIONS',
        notifications: this.queuedNotifications
      })
    }
  }

  // Process queued notifications
  private async processQueuedNotifications(): Promise<void> {
    if (this.queuedNotifications.length === 0) return

    const notifications = [...this.queuedNotifications]
    
    for (const notification of notifications) {
      try {
        await this.sendNotification(notification)
        this.removeProcessedNotification(notification.id)
      } catch (error) {
        console.error('Failed to process notification:', error)
        
        // Increment retry count
        notification.retryCount++
        
        if (notification.retryCount >= this.MAX_RETRY_COUNT) {
          console.log('Max retries reached for notification:', notification.id)
          this.removeProcessedNotification(notification.id)
        } else {
          // Update notification in queue
          const index = this.queuedNotifications.findIndex(n => n.id === notification.id)
          if (index !== -1) {
            this.queuedNotifications[index] = notification
            this.saveQueuedNotifications()
          }
        }
      }
    }
  }

  // Send notification via API
  private async sendNotification(notification: QueuedNotification): Promise<void> {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          id: notification.messageId,
          serverId: notification.serverId,
          channelId: notification.channelId,
          authorId: notification.userId,
          authorName: 'System', // This should be the actual author name
          content: notification.body
        },
        serverName: 'Server', // This should be the actual server name
        channelName: 'Channel' // This should be the actual channel name
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Failed to send notification')
    }
  }

  // Fallback notification processing
  private processNotificationFallback(notification: QueuedNotification): void {
    // For browsers without background sync, process immediately
    setTimeout(() => {
      this.sendNotification(notification).catch((error) => {
        console.error('Fallback notification processing failed:', error)
      })
    }, 1000) // Small delay to avoid blocking UI
  }

  // Remove processed notification from queue
  private removeProcessedNotification(notificationId: string): void {
    this.queuedNotifications = this.queuedNotifications.filter(n => n.id !== notificationId)
    this.saveQueuedNotifications()
  }

  // Load queued notifications from localStorage
  private loadQueuedNotifications(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_KEY)
      if (stored) {
        this.queuedNotifications = JSON.parse(stored)
        console.log(`Loaded ${this.queuedNotifications.length} queued notifications`)
      }
    } catch (error) {
      console.error('Failed to load queued notifications:', error)
      this.queuedNotifications = []
    }
  }

  // Save queued notifications to localStorage
  private saveQueuedNotifications(): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.queuedNotifications))
    } catch (error) {
      console.error('Failed to save queued notifications:', error)
    }
  }

  // Get current queue status
  getQueueStatus(): { count: number; isSupported: boolean } {
    return {
      count: this.queuedNotifications.length,
      isSupported: this.isSupported
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
      this.visibilityChangeHandler = null
    }
    
    this.queuedNotifications = []
    localStorage.removeItem(this.QUEUE_KEY)
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService()
export default backgroundSyncService
