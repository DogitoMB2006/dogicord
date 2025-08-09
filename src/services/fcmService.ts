import { getToken, onMessage, getMessaging, isSupported } from 'firebase/messaging'
import type { MessagePayload } from 'firebase/messaging'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import app from '../config/firebase'
import { vapidKey, db } from '../config/firebase'

export interface FCMToken {
  token: string
  userId: string
  createdAt: Date
  lastUsed: Date
  userAgent: string
  isActive: boolean
}

export interface NotificationSettings {
  userId: string
  serverId: string
  isMuted: boolean
  onlyMentions: boolean // For future implementation
  createdAt: Date
  updatedAt: Date
}

class FCMService {
  private currentToken: string | null = null
  private userId: string | null = null
  private isInitialized = false
  private messagingInstance: any = null
  private tokenRefreshInterval: NodeJS.Timeout | null = null
  private retryCount = 0
  private maxRetries = 3

  // Initialize FCM service with optimizations
  async initialize(userId: string): Promise<void> {
    const supported = await isSupported().catch(() => false)
    if (!supported) {
      console.warn('FCM not supported in this browser')
      return
    }

    this.userId = userId
    
    try {
      // Parallel initialization for faster setup
      const [permission, registration] = await Promise.all([
        this.requestPermission(),
        this.registerServiceWorker()
      ])

      if (permission !== 'granted') {
        console.log('Notification permission not granted')
        return
      }

      // Init messaging instance immediately
      this.messagingInstance = getMessaging(app)

      // Parallel token and listener setup
      await Promise.all([
        this.getAndSaveToken(registration),
        this.setupForegroundListener()
      ])

      // Setup token refresh every 30 minutes
      this.setupTokenRefresh()

      this.isInitialized = true
      this.retryCount = 0
      console.log('✅ FCM Service initialized successfully')
      
      // Make FCM status globally available for debugging
      ;(window as any).fcmStatus = () => this.getSimpleStatus()
      ;(window as any).testFCMNotification = () => {
        if (Notification.permission === 'granted') {
          const notification = new Notification('FCM Test', {
            body: 'FCM service is working!',
            icon: '/vite.svg',
            tag: 'fcm-test'
          })
          setTimeout(() => notification.close(), 3000)
          return 'Notification sent'
        } else {
          return `Permission: ${Notification.permission}`
        }
      }
      
      ;(window as any).checkFCMToken = async () => {
        const currentToken = this.getCurrentToken()
        if (!currentToken || !this.userId) {
          return { error: 'No token or user' }
        }
        
        try {
          // Check if token exists in Firestore
          const { collection, getDocs } = await import('firebase/firestore')
          const { db } = await import('../config/firebase')
          
          const tokensRef = collection(db, 'users', this.userId, 'fcmTokens')
          const tokensSnapshot = await getDocs(tokensRef)
          
          const tokenExists = tokensSnapshot.docs.some(doc => doc.data().token === currentToken)
          
          return {
            hasCurrentToken: !!currentToken,
            currentTokenPreview: currentToken.substring(0, 20) + '...',
            tokenExistsInDB: tokenExists,
            totalTokensInDB: tokensSnapshot.size,
            allTokens: tokensSnapshot.docs.map(doc => ({
              id: doc.id,
              isActive: doc.data().isActive,
              tokenPreview: doc.data().token?.substring(0, 20) + '...',
              lastUsed: doc.data().lastUsed?.toDate?.() || doc.data().lastUsed
            }))
          }
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) }
        }
      }
      // Load diagnostics helper
      this.loadDiagnosticsHelper()
      
      console.log('🔧 Quick FCM status: window.fcmStatus()')
      console.log('🔧 Test notification: window.testFCMNotification()')
      console.log('🔧 Check FCM token in DB: window.checkFCMToken()')
      console.log('🔧 Debug my tokens: window.debugMyTokens()')
      console.log('🔧 Full diagnostics: window.printNotificationDiagnostics()')
    } catch (error) {
      console.error('Failed to initialize FCM:', error)
      
      // Retry logic for initialization
      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(`Retrying FCM initialization (${this.retryCount}/${this.maxRetries})`)
        setTimeout(() => this.initialize(userId), 2000 * this.retryCount)
      }
    }
  }

  // Request notification permission
  private async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications')
      return 'denied'
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      console.log('Notification permission denied')
      return 'denied'
    }

    // Request permission
    const permission = await Notification.requestPermission()
    console.log('Notification permission:', permission)
    return permission
  }

  // Register service worker
  private async registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
    if ('serviceWorker' in navigator) {
      try {
        // First, unregister any existing service workers to avoid conflicts
        const existingRegistrations = await navigator.serviceWorker.getRegistrations()
        for (let registration of existingRegistrations) {
          if (registration.scope.includes('firebase-messaging')) {
            console.log('Unregistering old firebase service worker')
            await registration.unregister()
          }
        }

        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        })
        
        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready
        
        console.log('✅ Service worker registered successfully:', registration)
        console.log('SW State:', registration.active?.state)
        
        return registration
      } catch (error) {
        console.error('❌ Service worker registration failed:', error)
        throw error
      }
    }
    console.warn('❌ Service workers not supported')
    return undefined
  }

  // Get FCM token and save to database with retry logic
  private async getAndSaveToken(registration?: ServiceWorkerRegistration): Promise<void> {
    if (!this.messagingInstance || !this.userId) return

    let retryAttempts = 0
    const maxTokenRetries = 3

    while (retryAttempts < maxTokenRetries) {
      try {
        const token = await getToken(this.messagingInstance, {
          vapidKey: vapidKey,
          serviceWorkerRegistration:
            registration || (await navigator.serviceWorker.getRegistration()) || undefined
        })

        if (token) {
          console.log('✅ FCM token obtained:', token.substring(0, 20) + '...')
          this.currentToken = token
          await this.saveTokenToDatabase(token)
          console.log('✅ FCM token saved successfully')
          return // Success, exit retry loop
        } else {
          console.log('No registration token available')
          return
        }
      } catch (error) {
        retryAttempts++
        console.error(`Token retrieval attempt ${retryAttempts} failed:`, error)
        
        if (retryAttempts < maxTokenRetries) {
          // Wait before retry, with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryAttempts)))
        } else {
          throw error
        }
      }
    }
  }

  // Setup automatic token refresh
  private setupTokenRefresh(): void {
    // Clear existing interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval)
    }

    // Refresh token every 30 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      if (this.isInitialized && this.userId) {
        try {
          console.log('Refreshing FCM token...')
          await this.getAndSaveToken()
        } catch (error) {
          console.error('Token refresh failed:', error)
        }
      }
    }, 30 * 60 * 1000) // 30 minutes
  }

  // Save token to database via Vercel API with retry logic
  private async saveTokenToDatabase(token: string): Promise<void> {
    if (!this.userId) return

    let retryAttempts = 0
    const maxSaveRetries = 2

    while (retryAttempts <= maxSaveRetries) {
      try {
        const response = await fetch('/api/fcm-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            userId: this.userId,
            token,
            userAgent: navigator.userAgent,
            timestamp: Date.now()
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        if (result.success) {
          console.log('FCM token saved to database via Vercel API')
          return // Success
        } else {
          throw new Error(result.error || 'Failed to save token')
        }
      } catch (error) {
        retryAttempts++
        console.error(`Token save attempt ${retryAttempts} failed:`, error)

        if (retryAttempts <= maxSaveRetries) {
          // Try fallback to direct Firestore on last attempt
          if (retryAttempts === maxSaveRetries) {
            try {
              const tokenData: FCMToken = {
                token,
                userId: this.userId,
                createdAt: new Date(),
                lastUsed: new Date(),
                userAgent: navigator.userAgent,
                isActive: true
              }

              const tokenRef = doc(db, 'users', this.userId, 'fcmTokens', token)
              await setDoc(tokenRef, tokenData, { merge: true })
              console.log('FCM token saved to database (fallback)')
              return
            } catch (fallbackError) {
              console.error('Fallback token save also failed:', fallbackError)
              throw fallbackError
            }
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } else {
          throw error
        }
      }
    }
  }

  // Setup listener for foreground messages
  private setupForegroundListener(): void {
    if (!this.messagingInstance) {
      console.error('❌ Cannot setup foreground listener: messaging instance not available')
      return
    }

    console.log('🔧 Setting up FCM foreground message listener...')
    
    onMessage(this.messagingInstance, (payload: MessagePayload) => {
      console.log('🔔 FCM Foreground message received:', payload)
      
      // Always show notification regardless of app state
      this.showForegroundNotification(payload)
    })
    
    console.log('✅ FCM foreground listener setup complete')
  }

  // Show notification when app is in foreground
  private showForegroundNotification(payload: MessagePayload): void {
    const title = payload.notification?.title || 'New message'
    const body = payload.notification?.body || 'You have a new message'

    console.log('🔔 FCM Foreground notification received:', { title, body })
    console.log('📦 FCM Payload data:', payload.data)

    // Use the same logic as real-time notifications
    const shouldShow = this.shouldShowFCMNotification(payload)
    
    console.log('🔍 FCM Notification decision:', {
      shouldShow,
      currentUrl: window.location.href,
      targetChannel: `${payload.data?.serverId}/${payload.data?.channelId}`,
      windowHidden: document.hidden,
      windowFocused: document.hasFocus()
    })

    if (!shouldShow) {
      console.log('🔕 FCM Notification skipped - user is actively viewing this exact channel')
      return
    }

    // Create notification - user is in different channel or page is not fully visible
    if ('Notification' in window && Notification.permission === 'granted') {
      console.log('🔔 Showing FCM foreground notification')
      
      const notificationOptions: NotificationOptions = {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: `dogicord-fcm-${Date.now()}`, // Unique tag for each notification
        requireInteraction: false,
        silent: false
      }

      // Add vibrate if supported (mobile devices)
      if ('vibrate' in navigator) {
        (notificationOptions as any).vibrate = [200, 100, 200]
      }

      const notification = new Notification(title, notificationOptions)

      // Auto close after 8 seconds
      setTimeout(() => {
        try {
          notification.close()
        } catch (e) {
          // Notification might already be closed
        }
      }, 8000)

      notification.onclick = () => {
        window.focus()
        // Navigate to the specific channel if data is available
        if (payload.data?.serverId && payload.data?.channelId) {
          const url = `/?server=${payload.data.serverId}&channel=${payload.data.channelId}`
          console.log('🔗 Navigating to channel:', url)
          window.location.href = url
        }
        try {
          notification.close()
        } catch (e) {
          // Notification might already be closed
        }
      }
      
      console.log('✅ FCM foreground notification shown successfully')
    } else {
      console.warn('❌ Cannot show FCM notification:', {
        hasNotificationAPI: 'Notification' in window,
        permission: Notification.permission,
        reason: Notification.permission !== 'granted' ? 'Permission not granted' : 'API not available'
      })
    }
  }

  private shouldShowFCMNotification(payload: MessagePayload): boolean {
    // Get current page info
    const urlParams = new URLSearchParams(window.location.search)
    const currentServerId = urlParams.get('server')
    const currentChannelId = urlParams.get('channel')
    
    // Check if this notification is for the current channel
    const isCurrentChannel = payload.data?.serverId === currentServerId && 
                            payload.data?.channelId === currentChannelId

    // Page visibility states
    const isWindowHidden = document.hidden
    const isWindowFocused = document.hasFocus()
    const isPageVisible = !isWindowHidden && isWindowFocused

    // ONLY SKIP if: user is in the exact same channel AND page is fully visible and focused
    if (isCurrentChannel && isPageVisible) {
      return false // Skip - user is actively viewing this channel
    }

    return true // Show in all other cases
  }

  // Get notification settings for a server via Vercel API
  async getNotificationSettings(serverId: string): Promise<NotificationSettings | null> {
    if (!this.userId) return null

    try {
      const response = await fetch(`/api/notification-settings?userId=${this.userId}&serverId=${serverId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        return result.settings
      } else {
        throw new Error(result.error || 'Failed to get settings')
      }
    } catch (error) {
      console.error('Failed to get notification settings via API:', error)
      // Fallback to direct Firestore query
      try {
        const settingsRef = doc(db, 'notificationSettings', `${this.userId}_${serverId}`)
        const settingsDoc = await getDoc(settingsRef)
        
        if (settingsDoc.exists()) {
          return settingsDoc.data() as NotificationSettings
        }
        
        return null
      } catch (fallbackError) {
        console.error('Fallback settings fetch also failed:', fallbackError)
        return null
      }
    }
  }

  // Update notification settings for a server via Vercel API
  async updateNotificationSettings(serverId: string, settings: Partial<NotificationSettings>): Promise<void> {
    if (!this.userId) return

    try {
      const response = await fetch('/api/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          serverId,
          isMuted: settings.isMuted,
          onlyMentions: settings.onlyMentions
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        console.log('Notification settings updated for server via Vercel API:', serverId)
      } else {
        throw new Error(result.error || 'Failed to update settings')
      }
    } catch (error) {
      console.error('Failed to update notification settings via API:', error)
      // Fallback to direct Firestore update
      try {
        const settingsRef = doc(db, 'notificationSettings', `${this.userId}_${serverId}`)
        const settingsData: NotificationSettings = {
          userId: this.userId,
          serverId,
          isMuted: settings.isMuted ?? false,
          onlyMentions: settings.onlyMentions ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...settings
        }

        await setDoc(settingsRef, settingsData, { merge: true })
        console.log('Notification settings updated for server (fallback):', serverId)
      } catch (fallbackError) {
        console.error('Fallback settings update also failed:', fallbackError)
        throw fallbackError
      }
    }
  }

  // Toggle mute status for a server
  async toggleServerMute(serverId: string): Promise<boolean> {
    const currentSettings = await this.getNotificationSettings(serverId)
    const newMuteStatus = !currentSettings?.isMuted

    await this.updateNotificationSettings(serverId, {
      isMuted: newMuteStatus
    })

    return newMuteStatus
  }

  // Check if server is muted
  async isServerMuted(serverId: string): Promise<boolean> {
    const settings = await this.getNotificationSettings(serverId)
    return settings?.isMuted ?? false
  }

  // Cleanup when user logs out
  async cleanup(): Promise<void> {
    // Clear token refresh interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval)
      this.tokenRefreshInterval = null
    }

    if (this.currentToken && this.userId) {
      try {
        // Deactivate token via Vercel API
        const response = await fetch('/api/fcm-tokens', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: this.userId,
            token: this.currentToken
          })
        })

        if (response.ok) {
          console.log('FCM token deactivated via Vercel API')
        } else {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
      } catch (error) {
        console.error('Failed to deactivate FCM token via API:', error)
        // Fallback to direct Firestore update
        try {
          const tokenRef = doc(db, 'users', this.userId, 'fcmTokens', this.currentToken)
          await setDoc(tokenRef, { isActive: false }, { merge: true })
          console.log('FCM token deactivated (fallback)')
        } catch (fallbackError) {
          console.error('Fallback token deactivation also failed:', fallbackError)
        }
      }
    }

    this.currentToken = null
    this.userId = null
    this.isInitialized = false
    this.retryCount = 0
  }

  // Get current token
  getCurrentToken(): string | null {
    return this.currentToken
  }

  // Check if service is initialized
  isServiceInitialized(): boolean {
    return this.isInitialized
  }

  // Simple status check for production debugging
  getSimpleStatus(): { initialized: boolean; hasToken: boolean; permission: string } {
    return {
      initialized: this.isInitialized,
      hasToken: !!this.currentToken,
      permission: Notification.permission
    }
  }

  // Load diagnostics helper
  private async loadDiagnosticsHelper(): Promise<void> {
    try {
      await import('../utils/notificationDiagnostics')
      console.log('🔧 Diagnostics helper loaded')
    } catch (error) {
      console.warn('Could not load diagnostics helper:', error)
    }
  }

  // Debug function to check FCM status
  async getDebugInfo(): Promise<any> {
    return {
      isInitialized: this.isInitialized,
      hasToken: !!this.currentToken,
      token: this.currentToken ? this.currentToken.substring(0, 20) + '...' : null,
      userId: this.userId,
      notificationPermission: Notification.permission,
      isSupported: await isSupported().catch(() => false),
      serviceWorkerRegistration: !!(await navigator.serviceWorker?.getRegistration()),
      messagingInstance: !!this.messagingInstance
    }
  }
}

// Export singleton instance
export const fcmService = new FCMService()
export default fcmService
