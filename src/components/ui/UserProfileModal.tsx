
import { useState, useEffect } from 'react'
import { authService } from '../../services/authService'
import { serverService } from '../../services/serverService'
import { presenceService } from '../../services/presenceService'
import { useAuth } from '../../contexts/AuthContext'
import type { UserProfile } from '../../services/authService'
import type { Role } from '../../types/permissions'
import type { UserPresence } from '../../services/presenceService'
import RoleAssignment from '../server/RoleAssignment'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  serverId: string
  isMobile: boolean
  currentUserId?: string
  currentUserRoles?: Role[]
  isOwner?: boolean
  onRoleUpdate?: () => Promise<void>
}

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  userId, 
  serverId, 
  isMobile,
  currentUserId,
  currentUserRoles = [],
  isOwner = false,
  onRoleUpdate
}: UserProfileModalProps) {
  const { userProfile: currentUserProfile } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userRoles, setUserRoles] = useState<Role[]>([])
  const [allServerRoles, setAllServerRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showRoleAssignment, setShowRoleAssignment] = useState(false)
  const [userPresence, setUserPresence] = useState<UserPresence | null>(null)

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

  const formatLastSeen = (lastSeen: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - lastSeen.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return lastSeen.toLocaleDateString()
  }

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile()
      loadUserPresence()
    }
  }, [isOpen, userId, serverId])

  useEffect(() => {
    if (!isOpen || !userId) return

    const unsubscribePresence = presenceService.subscribeToUserPresence(userId, (presence) => {
      setUserPresence(presence)
    })

    return () => {
      unsubscribePresence()
    }
  }, [isOpen, userId])

  const loadUserProfile = async () => {
    setLoading(true)
    try {
      const [profile, roles, server] = await Promise.all([
        authService.getUserProfile(userId),
        serverService.getUserRoles(serverId, userId),
        serverService.getServer(serverId)
      ])
      
      setUserProfile(profile)
      setUserRoles(roles)
      setAllServerRoles(server?.roles || [])
    } catch (error) {
      console.error('Failed to load user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserPresence = async () => {
    try {
      const presence = await presenceService.getUserPresence(userId)
      setUserPresence(presence)
    } catch (error) {
      console.error('Failed to load user presence:', error)
    }
  }

  const canManageRoles = (): boolean => {
    if (!currentUserId || currentUserId === userId) return false
    if (isOwner) return true
    
    return currentUserRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes('manage_roles')
    )
  }

  const handleAssignRole = async (targetUserId: string, roleId: string) => {
    try {
      await serverService.assignRoleToUser(
        serverId, 
        targetUserId, 
        roleId, 
        currentUserId, 
        currentUserProfile?.username || 'Unknown User'
      )
      await loadUserProfile()
      if (onRoleUpdate) {
        await onRoleUpdate()
      }
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  const handleRemoveRole = async (targetUserId: string, roleId: string) => {
    try {
      await serverService.removeRoleFromUser(
        serverId, 
        targetUserId, 
        roleId, 
        currentUserId, 
        currentUserProfile?.username || 'Unknown User'
      )
      await loadUserProfile()
      if (onRoleUpdate) {
        await onRoleUpdate()
      }
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  if (!isOpen) return null

  const renderContent = () => {
    if (showRoleAssignment) {
      return (
        <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <RoleAssignment
            availableRoles={allServerRoles}
            userRoles={userRoles}
            targetUserId={userId}
            targetUsername={userProfile?.username || 'Unknown'}
            currentUserRoles={currentUserRoles}
            isOwner={isOwner}
            onAssignRole={handleAssignRole}
            onRemoveRole={handleRemoveRole}
            onClose={() => setShowRoleAssignment(false)}
            isMobile={isMobile}
          />
        </div>
      )
    }

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

    const isOnline = userPresence?.isOnline || false
    const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500'
    const statusText = isOnline ? 'Online' : 'Offline'
    const userColor = isOnline ? (highestRole?.color || '#99AAB5') : '#747F8D'

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
              <div className={`absolute -bottom-1 -right-1 ${isMobile ? 'w-4 h-4' : 'w-6 h-6'} ${statusColor} border-2 border-gray-800 rounded-full`}></div>
            </div>
          </div>
        </div>

        <div className={`${isMobile ? 'mt-8' : 'mt-12'} space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`} style={{ color: userColor }}>
                {userProfile.displayName || userProfile.username}
              </h2>
              <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
                @{userProfile.username}
              </p>
            </div>
            
            {canManageRoles() && (
              <button
                onClick={() => setShowRoleAssignment(true)}
                className={`px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-1 ${
                  isMobile ? 'text-sm' : 'text-sm'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Roles</span>
              </button>
            )}
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
              <div className={`flex items-center space-x-2 ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 ${statusColor} rounded-full ${isOnline ? 'animate-pulse' : ''}`}></div>
                <span className={`font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                  {statusText}
                </span>
              </div>
            </div>
            {!isOnline && userPresence?.lastSeen && (
              <div className="text-center mt-1">
                <span className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  Last seen {formatLastSeen(userPresence.lastSeen)}
                </span>
              </div>
            )}
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
            <h2 className="text-lg font-semibold text-white">
              {showRoleAssignment ? 'Manage Roles' : 'User Profile'}
            </h2>
            <button
              onClick={showRoleAssignment ? () => setShowRoleAssignment(false) : onClose}
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
          <h2 className="text-xl font-semibold text-white">
            {showRoleAssignment ? 'Manage Roles' : 'User Profile'}
          </h2>
          <button
            onClick={showRoleAssignment ? () => setShowRoleAssignment(false) : onClose}
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