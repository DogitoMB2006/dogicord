
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../config/firebase'
import { authService } from '../services/authService'
import { profileService } from '../services/profileService'
import type { UserProfile } from '../services/authService'

interface AuthContextType {
  currentUser: User | null
  userProfile: UserProfile | null
  loading: boolean
  register: (email: string, username: string, password: string) => Promise<void>
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (updates: { username?: string, avatar?: File }) => Promise<void>
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

  const register = async (email: string, username: string, password: string) => {
    const user = await authService.register(email, username, password)
    const profile = await authService.getUserProfile(user.uid)
    setUserProfile(profile)
  }

  const login = async (usernameOrEmail: string, password: string) => {
    const user = await authService.login(usernameOrEmail, password)
    const profile = await authService.getUserProfile(user.uid)
    setUserProfile(profile)
  }

  const logout = async () => {
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
        const isAvailable = await profileService.checkUsernameAvailability(updates.username, currentUser.uid)
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      
      if (user) {
        const profile = await authService.getUserProfile(user.uid)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
      
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    register,
    login,
    logout,
    updateUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}