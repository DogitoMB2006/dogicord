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

  // Initialize FCM service
  async initialize(userId: string): Promise<void> {
    const supported = await isSupported().catch(() => false)
    if (!supported) {
      console.warn('FCM not supported in this browser')
      return
    }

    this.userId = userId
    
    try {
      // Request notification permission
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.log('Notification permission not granted')
        return
      }

      // Register service worker
      const registration = await this.registerServiceWorker()

      // Init messaging instance after SW
      this.messagingInstance = getMessaging(app)

      // Get FCM token
      await this.getAndSaveToken(registration)

      // Listen for foreground messages
      this.setupForegroundListener()

      this.isInitialized = true
      console.log('FCM Service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize FCM:', error)
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
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        console.log('Service worker registered:', registration)
        return registration
      } catch (error) {
        console.error('Service worker registration failed:', error)
        throw error
      }
    }
    return undefined
  }

  // Get FCM token and save to database
  private async getAndSaveToken(registration?: ServiceWorkerRegistration): Promise<void> {
    if (!this.messagingInstance || !this.userId) return

    try {
      const token = await getToken(this.messagingInstance, {
        vapidKey: vapidKey,
        serviceWorkerRegistration:
          registration || (await navigator.serviceWorker.getRegistration()) || undefined
      })

      if (token) {
        console.log('FCM token obtained:', token)
        this.currentToken = token
        await this.saveTokenToDatabase(token)
      } else {
        console.log('No registration token available')
      }
    } catch (error) {
      console.error('An error occurred while retrieving token:', error)
      throw error
    }
  }

  // Save token to database via Vercel API
  private async saveTokenToDatabase(token: string): Promise<void> {
    if (!this.userId) return

    try {
      const response = await fetch('/api/fcm-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          token,
          userAgent: navigator.userAgent
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        console.log('FCM token saved to database via Vercel API')
      } else {
        throw new Error(result.error || 'Failed to save token')
      }
    } catch (error) {
      console.error('Failed to save token to database:', error)
      // Fallback to direct Firestore save if API fails
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
      } catch (fallbackError) {
        console.error('Fallback token save also failed:', fallbackError)
        throw fallbackError
      }
    }
  }

  // Setup listener for foreground messages
  private setupForegroundListener(): void {
    if (!this.messagingInstance) return

    onMessage(this.messagingInstance, (payload: MessagePayload) => {
      console.log('Foreground message received:', payload)
      
      // Show in-app notification when app is in foreground
      this.showForegroundNotification(payload)
    })
  }

  // Show notification when app is in foreground
  private showForegroundNotification(payload: MessagePayload): void {
    const title = payload.notification?.title || 'New message'
    const body = payload.notification?.body || 'You have a new message'

    // Create a toast-like notification or update UI
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/vite.svg',
        tag: 'dogicord-foreground'
      })

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000)

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }
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
  }

  // Get current token
  getCurrentToken(): string | null {
    return this.currentToken
  }

  // Check if service is initialized
  isServiceInitialized(): boolean {
    return this.isInitialized
  }
}

// Export singleton instance
export const fcmService = new FCMService()
export default fcmService
