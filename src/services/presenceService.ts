// src/services/presenceService.ts
import { ref, onValue, set, onDisconnect, serverTimestamp, get } from 'firebase/database'
import { getDatabase } from 'firebase/database'
import app from '../config/firebase'

export interface UserPresence {
  userId: string
  isOnline: boolean
  lastSeen: Date
  serverId?: string
}

export type PresenceCallback = (userId: string, presence: UserPresence) => void

class PresenceService {
  private database = getDatabase(app)
  private listeners = new Map<string, () => void>()
  private presenceCallbacks = new Set<PresenceCallback>()
  private currentUserId: string | null = null
  private visibilityListener: (() => void) | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isInitialized = false

  initialize(userId: string, serverId?: string): void {
    if (this.currentUserId === userId && this.isInitialized) return
    
    this.cleanup()
    this.currentUserId = userId
    this.isInitialized = true
    
    this.setupPresence(userId, serverId)
    this.setupVisibilityHandling(userId, serverId)
    this.startHeartbeat(userId, serverId)
  }

  private setupPresence(userId: string, serverId?: string): void {
    const userPresenceRef = ref(this.database, `presence/${userId}`)
    const presenceData = {
      isOnline: true,
      lastSeen: serverTimestamp(),
      serverId: serverId || null,
      timestamp: serverTimestamp()
    }

    set(userPresenceRef, presenceData)

    onDisconnect(userPresenceRef).set({
      isOnline: false,
      lastSeen: serverTimestamp(),
      serverId: serverId || null,
      timestamp: serverTimestamp()
    })
  }

  private setupVisibilityHandling(userId: string, serverId?: string): void {
    const handleVisibilityChange = () => {
      const userPresenceRef = ref(this.database, `presence/${userId}`)
      
      if (document.hidden) {
        // Usuario cambió de pestaña pero sigue conectado
        set(userPresenceRef, {
          isOnline: true, // Mantener online
          lastSeen: serverTimestamp(),
          serverId: serverId || null,
          timestamp: serverTimestamp(),
          tabVisible: false
        })
      } else {
        // Usuario regresó a la pestaña
        set(userPresenceRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
          serverId: serverId || null,
          timestamp: serverTimestamp(),
          tabVisible: true
        })
      }
    }

    const handleBeforeUnload = () => {
      if (this.currentUserId) {
        const userPresenceRef = ref(this.database, `presence/${this.currentUserId}`)
        // Solo desconectar cuando realmente cierre la pestaña/navegador
        navigator.sendBeacon?.(`data:application/json,${JSON.stringify({
          action: 'setOffline',
          userId: this.currentUserId
        })}`) || 
        set(userPresenceRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
          serverId: serverId || null,
          timestamp: serverTimestamp()
        })
      }
    }

    // Solo escuchar cambios de visibilidad para actualizar estado de pestaña
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Detectar cierre real de pestaña/navegador
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleBeforeUnload)

    this.visibilityListener = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleBeforeUnload)
    }
  }

  private startHeartbeat(userId: string, serverId?: string): void {
    // Heartbeat más frecuente para mantener conexión activa
    this.heartbeatInterval = setInterval(() => {
      const userPresenceRef = ref(this.database, `presence/${userId}`)
      set(userPresenceRef, {
        isOnline: true, // Siempre online mientras el heartbeat funcione
        lastSeen: serverTimestamp(),
        serverId: serverId || null,
        timestamp: serverTimestamp(),
        tabVisible: !document.hidden
      })
    }, 15000) // Cada 15 segundos
  }

  subscribeToUserPresence(userId: string, callback: (presence: UserPresence) => void): () => void {
    const userPresenceRef = ref(this.database, `presence/${userId}`)
    
    const unsubscribe = onValue(userPresenceRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const presence: UserPresence = {
          userId,
          isOnline: data.isOnline || false,
          lastSeen: data.lastSeen ? new Date(data.lastSeen) : new Date(),
          serverId: data.serverId
        }
        callback(presence)
        this.notifyPresenceChange(userId, presence)
      } else {
        const offlinePresence: UserPresence = {
          userId,
          isOnline: false,
          lastSeen: new Date(),
          serverId: undefined
        }
        callback(offlinePresence)
        this.notifyPresenceChange(userId, offlinePresence)
      }
    })

    this.listeners.set(userId, unsubscribe)
    return unsubscribe
  }

  subscribeToMultipleUsersPresence(userIds: string[], callback: (presences: Map<string, UserPresence>) => void): () => void {
    const presences = new Map<string, UserPresence>()
    const unsubscribes: (() => void)[] = []

    userIds.forEach(userId => {
      const unsubscribe = this.subscribeToUserPresence(userId, (presence) => {
        presences.set(userId, presence)
        callback(new Map(presences))
      })
      unsubscribes.push(unsubscribe)
    })

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
    }
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      const userPresenceRef = ref(this.database, `presence/${userId}`)
      const snapshot = await get(userPresenceRef)
      const data = snapshot.val()
      
      if (data) {
        return {
          userId,
          isOnline: data.isOnline || false,
          lastSeen: data.lastSeen ? new Date(data.lastSeen) : new Date(),
          serverId: data.serverId
        }
      }
      
      return {
        userId,
        isOnline: false,
        lastSeen: new Date(),
        serverId: undefined
      }
    } catch (error) {
      console.error('Error fetching user presence:', error)
      return null
    }
  }

  onPresenceChange(callback: PresenceCallback): () => void {
    this.presenceCallbacks.add(callback)
    return () => {
      this.presenceCallbacks.delete(callback)
    }
  }

  private notifyPresenceChange(userId: string, presence: UserPresence): void {
    this.presenceCallbacks.forEach(callback => {
      try {
        callback(userId, presence)
      } catch (error) {
        console.error('Error in presence callback:', error)
      }
    })
  }

  setOffline(userId?: string): void {
    const targetUserId = userId || this.currentUserId
    if (!targetUserId) return

    const userPresenceRef = ref(this.database, `presence/${targetUserId}`)
    set(userPresenceRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
      serverId: null,
      timestamp: serverTimestamp()
    })
  }

  setOnline(userId?: string, serverId?: string): void {
    const targetUserId = userId || this.currentUserId
    if (!targetUserId) return

    const userPresenceRef = ref(this.database, `presence/${targetUserId}`)
    set(userPresenceRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
      serverId: serverId || null,
      timestamp: serverTimestamp(),
      tabVisible: !document.hidden
    })
  }

  cleanup(): void {
    if (this.currentUserId) {
      this.setOffline(this.currentUserId)
    }

    this.listeners.forEach(unsubscribe => unsubscribe())
    this.listeners.clear()

    if (this.visibilityListener) {
      this.visibilityListener()
      this.visibilityListener = null
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    this.presenceCallbacks.clear()
    this.currentUserId = null
    this.isInitialized = false
  }

  cleanupUser(userId: string): void {
    const unsubscribe = this.listeners.get(userId)
    if (unsubscribe) {
      unsubscribe()
      this.listeners.delete(userId)
    }
  }

  // Método para forzar estado online (útil para debugging)
  forceOnline(userId?: string, serverId?: string): void {
    const targetUserId = userId || this.currentUserId
    if (!targetUserId) return

    this.setOnline(targetUserId, serverId)
  }
}

export const presenceService = new PresenceService()