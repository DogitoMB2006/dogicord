// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../config/firebase'
import { authService } from '../services/authService'
import { profileService } from '../services/profileService'
import { roleSyncService } from '../services/roleSyncService'
import { presenceService } from '../services/presenceService'
import { fcmService } from '../services/fcmService'
import { hybridNotificationService } from '../services/hybridNotificationService'
import '../utils/pwaInstallHelper'
import '../services/visibilityService'
import type { UserProfile } from '../services/authService'
import type { Role } from '../types/permissions'

interface AuthContextType {
  currentUser: User | null
  userProfile: UserProfile | null
  loading: boolean
  register: (email: string, username: string, password: string) => Promise<void>
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (updates: { username?: string, avatar?: File }) => Promise<void>
  getUserRolesRealtime: (serverId: string, callback: (roles: Role[]) => void) => () => void
  forceRefreshRoles: (serverId: string) => Promise<Role[]>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      
      if (user) {
        try {
          const profile = await authService.getUserProfile(user.uid)
          setUserProfile(profile)
          
          presenceService.initialize(user.uid)
          
          // Initialize hybrid notification service (FCM + OneSignal + Browser)
          try {
            await hybridNotificationService.initialize(user.uid)
          } catch (error) {
            console.warn('Failed to initialize notification service:', error)
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
        }
      } else {
        setUserProfile(null)
        roleSyncService.cleanup()
        presenceService.cleanup()
        fcmService.cleanup()
      }
      
      setLoading(false)
    })

    return () => {
      unsubscribeAuth()
      roleSyncService.cleanup()
      presenceService.cleanup()
      fcmService.cleanup()
    }
  }, [])

  const register = async (email: string, username: string, password: string) => {
    const user = await authService.register(email, username, password)
    const profile = await authService.getUserProfile(user.uid)
    setUserProfile(profile)
    
    presenceService.initialize(user.uid)
    
    // Initialize FCM service for push notifications
    try {
      await fcmService.initialize(user.uid)
    } catch (error) {
      console.warn('Failed to initialize FCM service:', error)
    }
  }

  const login = async (usernameOrEmail: string, password: string) => {
    const user = await authService.login(usernameOrEmail, password)
    const profile = await authService.getUserProfile(user.uid)
    setUserProfile(profile)
    
    presenceService.initialize(user.uid)
    
    // Initialize FCM service for push notifications
    try {
      await fcmService.initialize(user.uid)
    } catch (error) {
      console.warn('Failed to initialize FCM service:', error)
    }
  }

  const logout = async () => {
    if (currentUser) {
      presenceService.setOffline(currentUser.uid)
    }
    
    roleSyncService.cleanup()
    presenceService.cleanup()
    fcmService.cleanup()
    await authService.logout()
    setUserProfile(null)
  }

  const updateUserProfile = async (updates: { username?: string, avatar?: File }) => {
    if (!currentUser || !userProfile) {
      throw new Error('User not authenticated')
    }

    try {
      const profileUpdates: any = {}

      if (updates.username && updates.username !== userProfile.username) {
        const isAvailable = await authService.checkUsernameAvailability(updates.username, currentUser.uid)
        if (!isAvailable) {
          throw new Error('Username is already taken')
        }
        profileUpdates.username = updates.username
        profileUpdates.displayName = updates.username
      }

      if (updates.avatar) {
        if ((userProfile as any).avatar) {
          await profileService.deleteAvatar((userProfile as any).avatar)
        }
        
        const avatarUrl = await profileService.uploadAvatar(updates.avatar, currentUser.uid)
        profileUpdates.avatar = avatarUrl
      }

      if (Object.keys(profileUpdates).length > 0) {
        await profileService.updateUserProfile(currentUser.uid, profileUpdates)
        
        const updatedProfile = await authService.getUserProfile(currentUser.uid)
        setUserProfile(updatedProfile)
      }
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  const getUserRolesRealtime = (serverId: string, callback: (roles: Role[]) => void): (() => void) => {
    if (!currentUser) {
      callback([])
      return () => {}
    }

    return roleSyncService.subscribeToUserRoles(currentUser.uid, serverId, callback)
  }

  const forceRefreshRoles = async (serverId: string): Promise<Role[]> => {
    if (!currentUser) {
      return []
    }

    try {
      return await roleSyncService.forceRefreshUserPermissions(currentUser.uid, serverId)
    } catch (error) {
      console.error('Error refreshing roles:', error)
      return []
    }
  }

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    register,
    login,
    logout,
    updateUserProfile,
    getUserRolesRealtime,
    forceRefreshRoles
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}