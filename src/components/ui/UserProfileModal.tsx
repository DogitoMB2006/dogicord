import { useState, useEffect } from 'react'
import { authService } from '../../services/authService'
import { serverService } from '../../services/serverService'
import type { UserProfile } from '../../services/authService'
import type { Role } from '../../types/permissions'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  serverId: string
  isMobile: boolean
}

export default function UserProfileModal({ isOpen, onClose, userId, serverId, isMobile }: UserProfileModalProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userRoles, setUserRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const formatDate = (date: any): string => {
    if (!date) return 'Unknown'
    
    try {
      let dateObj: Date
      
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate()
      } else if (date instanceof Date) {
        dateObj = date
      } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date)
      } else {
        return 'Unknown'
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Unknown'
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Unknown'
    }
  }

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile()
    }
  }, [isOpen, userId, serverId])

  const loadUserProfile = async () => {
    setLoading(true)
    try {
      const [profile, roles] = await Promise.all([
        authService.getUserProfile(userId),
        serverService.getUserRoles(serverId, userId)
      ])
      
      setUserProfile(profile)
      setUserRoles(roles)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )
    }

    if (!userProfile) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">User profile not found</p>
        </div>
      )
    }

    const highestRole = userRoles
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)[0]

    return (
      <div className={`${isMobile ? 'p-4' : 'p-6'} space-y-6`}>
        <div className="relative">
          <div className={`w-full ${isMobile ? 'h-24' : 'h-32'} bg-gradient-to-r from-slate-600 to-slate-700 rounded-t-2xl`}></div>
          
          <div className={`absolute ${isMobile ? '-bottom-8' : '-bottom-12'} left-6`}>
            <div className="relative">
              <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-slate-600 rounded-full border-4 border-gray-800 flex items-center justify-center overflow-hidden`}>
                {(userProfile as any)?.avatar ? (
                  <img 
                    src={(userProfile as any).avatar} 
                    alt={userProfile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className={`text-white font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                    {userProfile.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 ${isMobile ? 'w-4 h-4' : 'w-6 h-6'} bg-green-500 border-2 border-gray-800 rounded-full`}></div>
            </div>
          </div>
        </div>

        <div className={`${isMobile ? 'mt-8' : 'mt-12'} space-y-4`}>
          <div>
            <h2 className={`font-bold text-white ${isMobile ? 'text-xl' : 'text-2xl'}`}>
              {userProfile.displayName || userProfile.username}
            </h2>
            <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
              @{userProfile.username}
            </p>
          </div>

          {highestRole && (
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: highestRole.color }}
              ></div>
              <span className={`font-medium ${isMobile ? 'text-sm' : 'text-base'}`} style={{ color: highestRole.color }}>
                {highestRole.name}
              </span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <h3 className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'} mb-1`}>
                Member Since
              </h3>
              <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {formatDate(userProfile.createdAt)}
              </p>
            </div>

            {userRoles.length > 1 && (
              <div>
                <h3 className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'} mb-2`}>
                  Roles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {userRoles
                    .filter(role => role.name !== '@everyone')
                    .map((role) => (
                      <div
                        key={role.id}
                        className={`px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}
                        style={{ 
                          backgroundColor: `${role.color}20`,
                          color: role.color,
                          border: `1px solid ${role.color}40`
                        }}
                      >
                        {role.name}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div>
              <h3 className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'} mb-1`}>
                Last Active
              </h3>
              <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {formatDate(userProfile.lastActive)}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className={`font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50">
        <div className="bg-gray-800 rounded-t-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">User Profile</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {renderContent()}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">User Profile</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  )
}