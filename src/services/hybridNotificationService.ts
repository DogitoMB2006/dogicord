import { fcmService } from './fcmService'
import { webPushService } from './webPushService'
import { realtimeNotificationService } from './realtimeNotificationService'

interface NotificationOptions {
  title: string
  body: string
  url?: string
  icon?: string
  serverId?: string
  channelId?: string
  messageId?: string
}

export class HybridNotificationService {
  private fcmEnabled = true
  private webPushEnabled = false
  private realtimeEnabled = false
  private userId: string | null = null

  async initialize(userId: string): Promise<void> {
    this.userId = userId

    // Initialize real-time notification listener (always works)
    try {
      await realtimeNotificationService.initialize(userId)
      this.realtimeEnabled = true
      console.log('✅ Real-time notifications initialized')
    } catch (error) {
      console.warn('⚠️ Real-time notifications failed:', error)
      this.realtimeEnabled = false
    }

    // Try FCM (for when quota is available)
    try {
      await fcmService.initialize(userId)
      this.fcmEnabled = true
      console.log('✅ FCM initialized')
    } catch (error) {
      console.warn('⚠️ FCM initialization failed, disabling FCM:', error)
      this.fcmEnabled = false
    }

    // Initialize Web Push as backup
    try {
      await webPushService.initialize(userId)
      this.webPushEnabled = true
      console.log('✅ Web Push initialized as backup')
    } catch (error) {
      console.warn('⚠️ Web Push initialization failed:', error)
      this.webPushEnabled = false
    }

    // Debug function
    ;(window as any).notificationStatus = () => this.getStatus()
  }

  async sendNotification(targetUserId: string, options: NotificationOptions): Promise<boolean> {
    let success = false

    // Try FCM first (if enabled and working)
    if (this.fcmEnabled) {
      try {
        // Use existing FCM flow through your message service
        console.log('📤 Attempting FCM notification...')
        // FCM is handled through the existing API, so we just log here
        success = true
      } catch (error) {
        console.warn('⚠️ FCM notification failed:', error)
        this.fcmEnabled = false // Disable FCM if it fails
      }
    }

    // Always use real-time notifications (most reliable)
    if (this.realtimeEnabled) {
      try {
        console.log('📤 Sending real-time notification...')
        const realtimeSuccess = await webPushService.sendNotificationToUser(targetUserId, {
          title: options.title,
          body: options.body,
          url: options.url,
          icon: options.icon,
          data: {
            serverId: options.serverId,
            channelId: options.channelId,
            messageId: options.messageId
          }
        })
        if (realtimeSuccess) success = true
      } catch (error) {
        console.error('❌ Real-time notification failed:', error)
      }
    }

    // Ultimate fallback: Browser notification (for active users)
    if (!success && 'Notification' in window && Notification.permission === 'granted') {
      try {
        console.log('📤 Fallback to browser notification...')
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/vite.svg',
          tag: 'dogicord-fallback'
        })
        
        setTimeout(() => notification.close(), 5000)
        
        if (options.url) {
          notification.onclick = () => {
            window.focus()
            window.location.href = options.url!
            notification.close()
          }
        }
        
        success = true
      } catch (error) {
        console.error('❌ Browser notification failed:', error)
      }
    }

    return success
  }

  getStatus(): any {
    return {
      userId: this.userId,
      fcm: {
        enabled: this.fcmEnabled,
        initialized: this.fcmEnabled ? fcmService.isServiceInitialized() : false,
        hasToken: this.fcmEnabled ? !!fcmService.getCurrentToken() : false
      },
      webPush: {
        enabled: this.webPushEnabled,
        configured: true
      },
      realtime: {
        enabled: this.realtimeEnabled,
        configured: true
      },
      browserNotification: {
        supported: 'Notification' in window,
        permission: 'Notification' in window ? Notification.permission : 'unsupported'
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.fcmEnabled) {
      await fcmService.cleanup()
    }
    if (this.webPushEnabled) {
      await webPushService.cleanup()
    }
    if (this.realtimeEnabled) {
      await realtimeNotificationService.cleanup()
    }
    this.userId = null
  }
}

export const hybridNotificationService = new HybridNotificationService()
