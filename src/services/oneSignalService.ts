export interface OneSignalConfig {
  appId: string
  restApiKey?: string
}

export interface NotificationData {
  title: string
  body: string
  url?: string
  icon?: string
  data?: Record<string, any>
}

class OneSignalService {
  private appId: string = ''
  private isInitialized = false
  private userId: string | null = null

  async initialize(userId: string, config: OneSignalConfig): Promise<void> {
    if (this.isInitialized) return

    this.userId = userId
    this.appId = config.appId

    try {
      // Load OneSignal SDK
      await this.loadOneSignalSDK()
      
      // OneSignal is already initialized in index.html, just use it
      if (!window.OneSignal) {
        throw new Error('OneSignal SDK not loaded')
      }
      
      // Wait for OneSignal to be ready
      await window.OneSignal.init({
        appId: config.appId
      })

      // Set external user ID for targeting
      await window.OneSignal.setExternalUserId(userId)

      // Request permission
      await window.OneSignal.showNativePrompt()

      this.isInitialized = true
      console.log('✅ OneSignal initialized successfully')

      // Debug functions
      ;(window as any).oneSignalStatus = () => this.getStatus()
      ;(window as any).sendTestOneSignal = (title: string, body: string) => 
        this.sendTestNotification(title, body)

    } catch (error) {
      console.error('❌ OneSignal initialization failed:', error)
      throw error
    }
  }

  private async loadOneSignalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.OneSignal) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load OneSignal SDK'))
      document.head.appendChild(script)
    })
  }

  async sendNotificationToUser(targetUserId: string, notification: NotificationData): Promise<boolean> {
    if (!this.appId) {
      console.error('OneSignal not configured')
      return false
    }

    try {
      const response = await fetch('/api/onesignal-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: this.appId,
          targetUserId,
          notification
        })
      })

      const result = await response.json()
      if (result.success) {
        console.log('✅ OneSignal notification sent successfully')
        return true
      } else {
        console.error('❌ OneSignal notification failed:', result.error)
        return false
      }
    } catch (error) {
      console.error('❌ OneSignal send error:', error)
      return false
    }
  }

  async sendTestNotification(title: string, body: string): Promise<void> {
    if (!this.userId) {
      console.error('No user ID available')
      return
    }

    const success = await this.sendNotificationToUser(this.userId, {
      title,
      body,
      icon: '/vite.svg'
    })

    if (success) {
      console.log('Test notification sent via OneSignal')
    } else {
      console.error('Test notification failed')
    }
  }

  async getStatus(): Promise<any> {
    if (!window.OneSignal) {
      return { initialized: false, error: 'SDK not loaded' }
    }

    try {
      const [isPushSupported, permission, playerId] = await Promise.all([
        window.OneSignal.isPushNotificationsSupported(),
        window.OneSignal.getNotificationPermission(),
        window.OneSignal.getPlayerId()
      ])

      return {
        initialized: this.isInitialized,
        isPushSupported,
        permission,
        playerId,
        userId: this.userId,
        appId: this.appId
      }
    } catch (error) {
      return { initialized: false, error: error.message }
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (window.OneSignal && this.isInitialized) {
        await window.OneSignal.setExternalUserId(null)
      }
      this.isInitialized = false
      this.userId = null
      console.log('OneSignal cleaned up')
    } catch (error) {
      console.error('OneSignal cleanup error:', error)
    }
  }
}

// Global OneSignal types
declare global {
  interface Window {
    OneSignal: any
  }
}

export const oneSignalService = new OneSignalService()
export default oneSignalService
