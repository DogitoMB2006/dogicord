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
      // Wait for OneSignal to be available (it's loaded in index.html)
      let retries = 0
      while (!window.OneSignal && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 500))
        retries++
      }
      
      if (!window.OneSignal) {
        throw new Error('OneSignal SDK not loaded after waiting')
      }

      // Wait for OneSignal to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Set external user ID for targeting
      try {
        await window.OneSignal.setExternalUserId(userId)
        console.log('✅ OneSignal external user ID set:', userId)
      } catch (error) {
        console.warn('⚠️ Failed to set external user ID:', error)
      }

      // Request permission if not already granted
      try {
        const permission = await window.OneSignal.getNotificationPermission()
        if (permission !== 'granted') {
          await window.OneSignal.showNativePrompt()
        }
      } catch (error) {
        console.warn('⚠️ Failed to request permission:', error)
      }

      this.isInitialized = true
      console.log('✅ OneSignal service initialized successfully')

      // Debug functions
      ;(window as any).oneSignalStatus = () => this.getStatus()
      ;(window as any).sendTestOneSignal = (title: string, body: string) => 
        this.sendTestNotification(title, body)

    } catch (error) {
      console.error('❌ OneSignal initialization failed:', error)
      // Don't throw error, just mark as not initialized
      this.isInitialized = false
    }
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
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { initialized: false, error: errorMessage }
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
