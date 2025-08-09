import { fcmService } from './fcmService'
import { oneSignalService } from './oneSignalService'

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
  private oneSignalEnabled = false
  private userId: string | null = null

  async initialize(userId: string): Promise<void> {
    this.userId = userId

    // Try FCM first
    try {
      await fcmService.initialize(userId)
      this.fcmEnabled = true
      console.log('✅ FCM initialized')
    } catch (error) {
      console.warn('⚠️ FCM initialization failed, disabling FCM:', error)
      this.fcmEnabled = false
    }

    // Initialize OneSignal as backup
    try {
      await oneSignalService.initialize(userId, { 
        appId: "f9aa53f3-b5ca-4b5e-844c-269b4c7f3713" 
      })
      this.oneSignalEnabled = true
      console.log('✅ OneSignal initialized as backup')
    } catch (error) {
      console.warn('⚠️ OneSignal initialization failed:', error)
      this.oneSignalEnabled = false
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

    // Fallback to OneSignal if FCM failed or is disabled
    if (!success && this.oneSignalEnabled) {
      try {
        console.log('📤 Fallback to OneSignal notification...')
        success = await oneSignalService.sendNotificationToUser(targetUserId, {
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
      } catch (error) {
        console.error('❌ OneSignal notification also failed:', error)
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
      oneSignal: {
        enabled: this.oneSignalEnabled,
        configured: !!import.meta.env.VITE_ONESIGNAL_APP_ID
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
    if (this.oneSignalEnabled) {
      await oneSignalService.cleanup()
    }
    this.userId = null
  }
}

export const hybridNotificationService = new HybridNotificationService()
