
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { Role } from '../types/permissions'
import { serverService } from './serverService'

export interface UserRoleUpdate {
  userId: string
  serverId: string
  roles: Role[]
  timestamp: Date
}

export type RoleUpdateCallback = (update: UserRoleUpdate) => void

export const roleSyncService = {
  userRoleListeners: new Map<string, () => void>(),
  serverRoleListeners: new Map<string, () => void>(),
  roleUpdateCallbacks: new Set<RoleUpdateCallback>(),

  subscribeToUserRoles(userId: string, serverId: string, callback: (roles: Role[]) => void): () => void {
    const memberDocRef = doc(db, 'serverMembers', `${serverId}_${userId}`)
    
    const unsubscribe = onSnapshot(memberDocRef, async (doc) => {
      if (doc.exists()) {
        const memberData = doc.data()
        const roleIds = memberData.roles || []
        
        try {
          const server = await serverService.getServer(serverId)
          if (server) {
            const userRoles = server.roles.filter(role => 
              roleIds.includes(role.id) || role.id === 'everyone'
            )
            
            callback(userRoles)
            
            this.notifyRoleUpdate({
              userId,
              serverId,
              roles: userRoles,
              timestamp: new Date()
            })
          }
        } catch (error) {
          console.error('Error loading user roles:', error)
        }
      } else {
        callback([])
      }
    }, (error) => {
      console.error('Error listening to user roles:', error)
    })

    const listenerId = `${userId}_${serverId}`
    this.userRoleListeners.set(listenerId, unsubscribe)
    
    return () => {
      unsubscribe()
      this.userRoleListeners.delete(listenerId)
    }
  },

  subscribeToServerRoles(serverId: string, callback: (roles: Role[]) => void): () => void {
    const serverDocRef = doc(db, 'servers', serverId)
    
    const unsubscribe = onSnapshot(serverDocRef, (doc) => {
      if (doc.exists()) {
        const serverData = doc.data()
        const roles = serverData.roles || []
        callback(roles)
      } else {
        callback([])
      }
    }, (error) => {
      console.error('Error listening to server roles:', error)
    })

    this.serverRoleListeners.set(serverId, unsubscribe)
    
    return () => {
      unsubscribe()
      this.serverRoleListeners.delete(serverId)
    }
  },

  subscribeToAllServerMembers(serverId: string, callback: (memberUpdates: Map<string, Role[]>) => void): () => void {
    const membersQuery = query(
      collection(db, 'serverMembers'),
      where('serverId', '==', serverId)
    )
    
    const unsubscribe = onSnapshot(membersQuery, async (querySnapshot) => {
      const memberUpdates = new Map<string, Role[]>()
      
      try {
        const server = await serverService.getServer(serverId)
        if (!server) return
        
        querySnapshot.forEach((doc) => {
          const memberData = doc.data()
          const userId = memberData.userId
          const roleIds = memberData.roles || []
          
          const userRoles = server.roles.filter(role => 
            roleIds.includes(role.id) || role.id === 'everyone'
          )
          
          memberUpdates.set(userId, userRoles)
        })
        
        callback(memberUpdates)
        
        memberUpdates.forEach((roles, userId) => {
          this.notifyRoleUpdate({
            userId,
            serverId,
            roles,
            timestamp: new Date()
          })
        })
      } catch (error) {
        console.error('Error processing member updates:', error)
      }
    }, (error) => {
      console.error('Error listening to server members:', error)
    })

    return unsubscribe
  },

  onRoleUpdate(callback: RoleUpdateCallback): () => void {
    this.roleUpdateCallbacks.add(callback)
    
    return () => {
      this.roleUpdateCallbacks.delete(callback)
    }
  },

  notifyRoleUpdate(update: UserRoleUpdate): void {
    this.roleUpdateCallbacks.forEach(callback => {
      try {
        callback(update)
      } catch (error) {
        console.error('Error in role update callback:', error)
      }
    })
  },

  checkPermissionRealtime(userRoles: Role[], permission: string, isOwner: boolean = false): boolean {
    if (isOwner) return true
    
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  },

  validateUserAction(userId: string, serverId: string, requiredPermission: string): Promise<boolean> {
    return new Promise((resolve) => {
      const unsubscribe = this.subscribeToUserRoles(userId, serverId, (roles) => {
        unsubscribe()
        
        const hasPermission = roles.some(role => 
          role.permissions.includes('administrator') || 
          role.permissions.includes(requiredPermission)
        )
        
        resolve(hasPermission)
      })
    })
  },

  forceRefreshUserPermissions(userId: string, serverId: string): Promise<Role[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe()
        reject(new Error('Timeout waiting for role update'))
      }, 5000)
      
      const unsubscribe = this.subscribeToUserRoles(userId, serverId, (roles) => {
        clearTimeout(timeout)
        unsubscribe()
        resolve(roles)
      })
    })
  },

  cleanup(): void {
    this.userRoleListeners.forEach(unsubscribe => unsubscribe())
    this.serverRoleListeners.forEach(unsubscribe => unsubscribe())
    this.userRoleListeners.clear()
    this.serverRoleListeners.clear()
    this.roleUpdateCallbacks.clear()
  },

  cleanupUser(userId: string, serverId: string): void {
    const listenerId = `${userId}_${serverId}`
    const unsubscribe = this.userRoleListeners.get(listenerId)
    if (unsubscribe) {
      unsubscribe()
      this.userRoleListeners.delete(listenerId)
    }
  },

  cleanupServer(serverId: string): void {
    const unsubscribe = this.serverRoleListeners.get(serverId)
    if (unsubscribe) {
      unsubscribe()
      this.serverRoleListeners.delete(serverId)
    }
  }
}