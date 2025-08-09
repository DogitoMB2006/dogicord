import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { serverService } from '../../services/serverService'
import { notificationService } from '../../services/notificationService'
import { permissionService } from '../../services/permissionService'
import type { Channel, Category } from '../../types/channels'
import type { Role } from '../../types/permissions'
import NotificationSettingsModal from './NotificationSettingsModal'
import '../../styles/glow.css'

interface ChannelSidebarProps {
  serverName: string
  serverId: string
  channels: Channel[]
  categories: Category[]
  userRoles: Role[]
  isOwner: boolean
  activeChannelId?: string
  onChannelSelect: (channelId: string) => void
  onLeaveServer: () => void
  onOpenServerSettings: () => void
  onOpenProfileModal: () => void
  canManageServer: boolean
  isMobile: boolean
  onBackToServers?: () => void
}

export default function ChannelSidebar({ 
  serverName, 
  serverId,
  channels = [],
  categories = [],
  userRoles = [],
  isOwner = false,
  activeChannelId, 
  onChannelSelect,
  onLeaveServer,
  onOpenServerSettings,
  onOpenProfileModal,
  canManageServer,
  isMobile,
  onBackToServers
}: ChannelSidebarProps) {
  const { userProfile, logout, currentUser } = useAuth()
  const [showServerDropdown, setShowServerDropdown] = useState(false)
  const [userRoleColor, setUserRoleColor] = useState('#99AAB5')
  const [, setForceUpdate] = useState(0)
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(() => {
      setForceUpdate(prev => prev + 1)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const loadUserRoleColor = async () => {
      if (!currentUser || !channels.length) return

      try {
        const serverId = channels[0]?.categoryId || 'unknown'
        if (serverId === 'unknown') return

        const userRoles = await serverService.getUserRoles(serverId, currentUser.uid)
        const highestRole = getHighestRole(userRoles)
        setUserRoleColor(highestRole.color)
      } catch (error) {
        console.error('Failed to load user role color:', error)
      }
    }

    loadUserRoleColor()
  }, [currentUser, channels])

  const getHighestRole = (roles: Role[]): Role => {
    const nonEveryoneRoles = roles.filter(role => role.name !== '@everyone')
    if (nonEveryoneRoles.length === 0) {
      return roles.find(role => role.name === '@everyone') || { 
        id: 'default', 
        name: 'Member', 
        color: '#99AAB5', 
        permissions: [], 
        position: 0, 
        mentionable: false, 
        createdAt: new Date() 
      }
    }
    
    return nonEveryoneRoles.reduce((highest, current) => 
      current.position > highest.position ? current : highest
    )
  }

  const hasUnreadMessages = (channelId: string): boolean => {
    if (!channels.length) return false
    const channel = channels.find(ch => ch.id === channelId)
    if (!channel) return false
    
    // No mostrar indicador si es el canal activo
    if (activeChannelId === channelId) return false
    
    return notificationService.hasUnreadInChannel(serverId, channelId)
  }

  // Filter channels based on user permissions
  const visibleChannels = permissionService.getVisibleChannels(userRoles, channels, isOwner)

  const organizedChannels = categories
    .sort((a, b) => a.position - b.position)
    .map(category => ({
      category,
      channels: visibleChannels
        .filter(ch => ch.categoryId === category.id)
        .sort((a, b) => a.position - b.position)
    }))
    .filter(group => group.channels.length > 0) // Only show categories that have visible channels

  const uncategorizedChannels = visibleChannels
    .filter(ch => !categories.find(cat => cat.id === ch.categoryId))
    .sort((a, b) => a.position - b.position)

  return (
    <div className={`${isMobile ? 'w-full' : 'w-60'} bg-gray-800 flex flex-col h-full`}>
      <div className="relative">
        {isMobile && onBackToServers && (
          <div className="flex items-center px-4 py-3 border-b border-gray-700">
            <button
              onClick={onBackToServers}
              className="mr-3 p-1 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div 
              className="flex items-center justify-between flex-1 cursor-pointer hover:bg-gray-750 rounded px-2 py-1 transition-colors"
              onClick={() => setShowServerDropdown(!showServerDropdown)}
            >
              <h2 className="text-white font-semibold truncate">{serverName}</h2>
              <svg 
                className={`w-4 h-4 text-gray-400 hover:text-white transition-all duration-200 ${
                  showServerDropdown ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
        
        {!isMobile && (
          <div 
            className="h-12 border-b border-gray-700 flex items-center justify-between px-4 cursor-pointer hover:bg-gray-750 group"
            onClick={() => setShowServerDropdown(!showServerDropdown)}
          >
            <h2 className="text-white font-semibold truncate">{serverName}</h2>
            <svg 
              className={`w-4 h-4 text-gray-400 group-hover:text-white transition-all duration-200 ${
                showServerDropdown ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {showServerDropdown && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowServerDropdown(false)}
            />
            <div className={`absolute ${isMobile ? 'top-16 left-4 right-4' : 'top-12 left-4 right-4'} bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20 py-2`}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/invite/' + serverName)
                  setShowServerDropdown(false)
                }}
                className={`w-full px-4 py-3 md:py-2 text-left text-indigo-400 hover:bg-gray-800 transition-colors ${isMobile ? 'text-base' : 'text-sm'}`}
              >
                Invite People
              </button>
              
              {canManageServer && (
                <button
                  onClick={() => {
                    onOpenServerSettings()
                    setShowServerDropdown(false)
                  }}
                  className={`w-full px-4 py-3 md:py-2 text-left text-gray-300 hover:bg-gray-800 transition-colors ${isMobile ? 'text-base' : 'text-sm'}`}
                >
                  Server Settings
                </button>
              )}
              
              {/* Notification Settings Button */}
              <button
                onClick={() => {
                  setShowNotificationSettings(true)
                  setShowServerDropdown(false)
                }}
                className={`w-full px-4 py-3 md:py-2 text-left text-gray-300 hover:bg-gray-800 transition-colors flex items-center ${isMobile ? 'text-base' : 'text-sm'}`}
              >
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 17H7a3 3 0 01-3-3V7a3 3 0 013-3h5m0 0h5a3 3 0 013 3v3M12 4V2m0 0L10 4m2-2l2 2" />
                </svg>
                Notifications
              </button>
              
              <div className="h-px bg-gray-700 my-2" />
              
              <button
                onClick={() => {
                  onLeaveServer()
                  setShowServerDropdown(false)
                }}
                className={`w-full px-4 py-3 md:py-2 text-left text-red-400 hover:bg-gray-800 transition-colors ${isMobile ? 'text-base' : 'text-sm'}`}
              >
                Leave Server
              </button>
            </div>
          </>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {organizedChannels.map((group) => (
          <div key={group.category.id} className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-300 cursor-pointer">
              <div className="flex items-center">
                <svg 
                  className={`w-3 h-3 mr-1 transition-transform ${group.category.collapsed ? '-rotate-90' : 'rotate-0'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span>{group.category.name}</span>
              </div>
              {canManageServer && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
            
            {!group.category.collapsed && (
              <div className="mt-1 space-y-0.5">
                {group.channels.map((channel) => (
                  <div
                    key={channel.id}
                    onClick={() => onChannelSelect(channel.id)}
                    className={`flex items-center px-3 py-3 md:py-1.5 rounded cursor-pointer transition-all duration-300 group mobile-touch-target ${
                      activeChannelId === channel.id
                        ? 'bg-gray-700 text-white'
                        : hasUnreadMessages(channel.id)
                        ? 'text-white hover:bg-gray-700'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <span className={`mr-2 ${
                      hasUnreadMessages(channel.id) && activeChannelId !== channel.id 
                        ? 'text-white' 
                        : 'text-gray-400'
                    }`}>
                      {channel.type === 'text' ? '#' : '🔊'}
                    </span>
                    <span className={`${isMobile ? 'text-base' : 'text-sm'} truncate flex-1 ${
                      hasUnreadMessages(channel.id) && activeChannelId !== channel.id 
                        ? 'font-semibold text-white' 
                        : ''
                    }`}>{channel.name}</span>
                    {hasUnreadMessages(channel.id) && activeChannelId !== channel.id && (
                      <div className="w-3 h-3 bg-white rounded-full ml-1 white-dot-glow"></div>
                    )}
                    {channel.permissions && channel.permissions.length > 0 && (
                      <svg className="w-3 h-3 text-yellow-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {uncategorizedChannels.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-300 cursor-pointer">
              <span>Uncategorized</span>
              {canManageServer && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
            
            <div className="mt-1 space-y-0.5">
              {uncategorizedChannels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  className={`flex items-center px-3 py-3 md:py-1.5 rounded cursor-pointer transition-all duration-300 group mobile-touch-target ${
                    activeChannelId === channel.id
                      ? 'bg-gray-700 text-white'
                      : hasUnreadMessages(channel.id)
                      ? 'text-white hover:bg-gray-700'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className={`mr-2 ${
                    hasUnreadMessages(channel.id) && activeChannelId !== channel.id 
                      ? 'text-white' 
                      : 'text-gray-400'
                  }`}>
                    {channel.type === 'text' ? '#' : '🔊'}
                  </span>
                  <span className={`${isMobile ? 'text-base' : 'text-sm'} truncate flex-1 ${
                    hasUnreadMessages(channel.id) && activeChannelId !== channel.id 
                      ? 'font-semibold text-white' 
                      : ''
                  }`}>{channel.name}</span>
                  {hasUnreadMessages(channel.id) && activeChannelId !== channel.id && (
                    <div className="w-3 h-3 bg-white rounded-full ml-1 white-dot-glow"></div>
                  )}
                  {channel.permissions && channel.permissions.length > 0 && (
                    <svg className="w-3 h-3 text-yellow-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {organizedChannels.length === 0 && uncategorizedChannels.length === 0 && (
          <div className="text-center py-8">
            <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4`}>
              <span className={`${isMobile ? 'text-lg' : 'text-2xl'}`}>#</span>
            </div>
            <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>No channels available</p>
            {canManageServer && (
              <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                Create channels in Server Settings
              </p>
            )}
          </div>
        )}
      </div>

      <div className={`${isMobile ? 'h-20 pb-24' : 'h-14'} bg-gray-850 flex items-center px-3 space-x-3 border-t border-gray-700`}>
        <div className={`${isMobile ? 'w-12 h-12' : 'w-8 h-8'} bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 transition-all`}
             style={{ '--tw-ring-color': userRoleColor } as React.CSSProperties}>
          {(userProfile as any)?.avatar ? (
            <img 
              src={(userProfile as any).avatar} 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={`text-white font-medium ${isMobile ? 'text-lg' : 'text-sm'}`}>
              {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`${isMobile ? 'text-lg' : 'text-sm'} font-medium truncate`}
               style={{ color: userRoleColor }}>
            {userProfile?.username || 'User'}
          </div>
          <div className={`${isMobile ? 'text-base' : 'text-xs'} text-gray-400`}>Online</div>
        </div>

        <div className="flex space-x-2">
          <button 
            onClick={onOpenProfileModal}
            className={`${isMobile ? 'p-3' : 'p-1'} text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors mobile-touch-target`}
          >
            <svg className={`${isMobile ? 'w-6 h-6' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          
          <button 
            onClick={logout}
            className={`${isMobile ? 'p-3' : 'p-1'} text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors mobile-touch-target`}
          >
            <svg className={`${isMobile ? 'w-6 h-6' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        serverId={serverId}
        serverName={serverName}
        currentUserId={currentUser?.uid || ''}
        isMobile={isMobile}
      />
    </div>
  )
}