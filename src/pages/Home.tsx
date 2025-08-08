// src/pages/Home.tsx
import { useState, useEffect, useCallback } from 'react'
import { useServer } from '../contexts/ServerContext'
import { useAuth } from '../contexts/AuthContext'
import { messageService } from '../services/messageService'
import { serverService } from '../services/serverService'
import { permissionService } from '../services/permissionService'
import { roleSyncService } from '../services/roleSyncService'
import { notificationService } from '../services/notificationService'
import { globalMessageListener } from '../services/globalMessageListener'
import type { Server } from '../services/serverService'
import ServerSidebar from '../components/ui/ServerSidebar'
import ServerModal from '../components/ui/ServerModal'
import ChannelSidebar from '../components/ui/ChannelSidebar'
import ChatArea from '../components/ui/ChatArea'
import ServerSettingsModal from '../components/ui/ServerSettingsModal'
import ProfileModal from '../components/ui/ProfileModal'
import MemberList from '../components/ui/MemberList'
import UserProfileModal from '../components/ui/UserProfileModal'
import type { Message } from '../services/messageService'
import type { Role } from '../types/permissions'

type MobileView = 'servers' | 'channels' | 'chat'

export default function Home() {
  const { currentUser, userProfile, updateUserProfile, getUserRolesRealtime, forceRefreshRoles } = useAuth()
  const { 
    servers, 
    activeServerId, 
    activeServer, 
    loading: serverLoading,
    createServer, 
    joinServerByCode, 
    selectServer,
    refreshServers
  } = useServer()
  
  const [activeChannelId, setActiveChannelId] = useState<string>(() => {
    return localStorage.getItem('dogicord-active-channel') || 'general'
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState('')
  const [userRoles, setUserRoles] = useState<Role[]>([])
  const [mobileView, setMobileView] = useState<MobileView>('chat')
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(true)
  const [showMemberList, setShowMemberList] = useState(() => {
    const saved = localStorage.getItem('dogicord-memberlist-open')
    return saved === 'true'
  })
  const [showMobileMemberList, setShowMobileMemberList] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [canSendMessages, setCanSendMessages] = useState(true)
  const [sendMessageError, setSendMessageError] = useState('')
  const [roleChangeNotification, setRoleChangeNotification] = useState<string | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (currentUser && servers.length > 0) {
      const serverIds = servers.map(s => s.id)
      globalMessageListener.updateServers(currentUser.uid, serverIds)
    }

    return () => {
      if (currentUser) {
        globalMessageListener.stopGlobalListener()
      }
    }
  }, [currentUser, servers])

  // Suscripción a mensajes con el nuevo sistema optimizado
  useEffect(() => {
    if (!activeServerId || !activeChannelId || !currentUser) {
      setMessages([])
      return
    }

    console.log('Setting up message subscription for:', { activeServerId, activeChannelId })

    const unsubscribe = messageService.subscribeToMessages(
      activeServerId,
      activeChannelId,
      (newMessages) => {
        console.log('Received messages update:', newMessages.length)
        setMessages(newMessages)
      },
      currentUser.uid
    )

    return () => {
      console.log('Cleaning up message subscription')
      unsubscribe()
    }
  }, [activeServerId, activeChannelId, currentUser])

  useEffect(() => {
    if (activeServer) {
      // Solo cambiar al canal general si no hay un canal activo válido en el servidor
      const currentChannelExists = activeServer.channels.find(ch => ch.id === activeChannelId)
      
      if (!currentChannelExists) {
        const defaultChannel = activeServer.channels.find(ch => ch.name === 'general')
        if (defaultChannel) {
          setActiveChannelId(defaultChannel.id)
          localStorage.setItem('dogicord-active-channel', defaultChannel.id)
        } else if (activeServer.channels.length > 0) {
          // Si no hay canal 'general', usar el primer canal disponible
          setActiveChannelId(activeServer.channels[0].id)
          localStorage.setItem('dogicord-active-channel', activeServer.channels[0].id)
        }
      }
    }
  }, [activeServer])

  const updateUserRoles = useCallback((newRoles: Role[]) => {
    const oldRoleNames = userRoles.map(r => r.name).sort()
    const newRoleNames = newRoles.map(r => r.name).sort()
    
    if (JSON.stringify(oldRoleNames) !== JSON.stringify(newRoleNames)) {
      const addedRoles = newRoles.filter(newRole => 
        !userRoles.some(oldRole => oldRole.id === newRole.id)
      )
      const removedRoles = userRoles.filter(oldRole => 
        !newRoles.some(newRole => newRole.id === oldRole.id)
      )
      
      if (addedRoles.length > 0 || removedRoles.length > 0) {
        let notification = ''
        if (addedRoles.length > 0) {
          notification += `Added roles: ${addedRoles.map(r => r.name).join(', ')}`
        }
        if (removedRoles.length > 0) {
          if (notification) notification += ' | '
          notification += `Removed roles: ${removedRoles.map(r => r.name).join(', ')}`
        }
        
        setRoleChangeNotification(notification)
        setTimeout(() => setRoleChangeNotification(null), 5000)
        
        if (removedRoles.some(role => role.permissions.includes('manage_server'))) {
          setIsServerSettingsOpen(false)
        }
      }
    }
    
    setUserRoles(newRoles)
  }, [userRoles])

  useEffect(() => {
    if (!activeServerId || !currentUser) {
      setUserRoles([])
      return
    }

    const unsubscribeRoles = getUserRolesRealtime(activeServerId, updateUserRoles)
    
    return () => {
      unsubscribeRoles()
    }
  }, [activeServerId, currentUser, getUserRolesRealtime, updateUserRoles])

  useEffect(() => {
    if (activeServerId && activeChannelId && currentUser && userRoles.length > 0) {
      checkMessagePermissions()
    }
  }, [activeServerId, activeChannelId, currentUser, userRoles])

  const checkMessagePermissions = async () => {
    if (!activeServerId || !activeChannelId || !currentUser) return

    try {
      const result = await messageService.canUserSendMessage(
        currentUser.uid,
        activeServerId,
        activeChannelId
      )
      
      setCanSendMessages(result.canSend)
      setSendMessageError(result.reason || '')
    } catch (error) {
      console.error('Failed to check message permissions:', error)
      setCanSendMessages(false)
      setSendMessageError('Failed to check permissions')
    }
  }

  const isOwner = (): boolean => {
    return activeServer?.ownerId === currentUser?.uid
  }

  const hasPermission = (permission: string): boolean => {
    return roleSyncService.checkPermissionRealtime(userRoles, permission, isOwner())
  }

  const canManageServer = (): boolean => {
    return hasPermission('manage_server') || isOwner()
  }

  const canManageMessages = (): boolean => {
    return hasPermission('manage_messages') || isOwner()
  }

  const handleCreateServer = async (serverName: string) => {
    try {
      setError('')
      await createServer(serverName)
      setIsModalOpen(false)
      if (isMobile) setMobileView('channels')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleJoinServer = async (inviteCode: string) => {
    try {
      setError('')
      await joinServerByCode(inviteCode)
      setIsModalOpen(false)
      if (isMobile) setMobileView('channels')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleServerSelect = (serverId: string) => {
    selectServer(serverId)
    // Limpiar mensajes cuando cambia de servidor
    setMessages([])
    if (isMobile) setMobileView('channels')
  }

  const handleChannelSelect = async (channelId: string) => {
    if (!activeServer || !currentUser) return

    const channel = activeServer.channels.find(ch => ch.id === channelId)
    if (!channel) return

    try {
      const hasPermission = await roleSyncService.validateUserAction(
        currentUser.uid,
        activeServer.id,
        'view_channels'
      )

      if (!hasPermission) {
        const viewPermCheck = permissionService.hasChannelPermission(
          userRoles,
          channel,
          'view_channel',
          isOwner()
        )

        if (!viewPermCheck.allowed) {
          setError('You do not have permission to view this channel')
          return
        }
      }

      // Marcar canal como leído al entrar
      notificationService.markChannelAsRead(activeServer.id, channelId)

      // Limpiar mensajes antes de cambiar de canal
      setMessages([])
      setActiveChannelId(channelId)
      localStorage.setItem('dogicord-active-channel', channelId)
      
      if (isMobile) {
        setMobileView('chat')
        setShowMobileNav(false)
      }
    } catch (error) {
      setError('Failed to verify channel permissions')
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!activeServerId || !activeChannelId || !currentUser || !userProfile) {
      setError('Missing required information to send message')
      return
    }

    if (!canSendMessages) {
      setError(sendMessageError || 'You cannot send messages in this channel')
      return
    }

    try {
      console.log('Sending message:', { content, activeServerId, activeChannelId })
      
      const validation = await messageService.validateMessageContent(content, userRoles, isOwner())
      if (!validation.valid) {
        setError(validation.reason || 'Invalid message content')
        return
      }

      await messageService.sendMessage(
        content,
        currentUser.uid,
        userProfile.username,
        (userProfile as any).avatar || null,
        activeServerId,
        activeChannelId
      )
      
      console.log('Message sent successfully')
      setError('')
    } catch (error: any) {
      console.error('Failed to send message:', error)
      setError(error.message)
    }
  }

  const handleUpdateServer = async (updates: Partial<Server>) => {
    if (!activeServerId) return
    
    if (updates.name && !canManageServer()) {
      setError('You do not have permission to manage server settings')
      return
    }
    
    try {
      await serverService.updateServer(activeServerId, updates)
      await refreshServers()
    } catch (error) {
      console.error('Failed to update server:', error)
      throw error
    }
  }

  const handleToggleMemberList = () => {
    if (isMobile) {
      setShowMobileMemberList(!showMobileMemberList)
    } else {
      const newState = !showMemberList
      setShowMemberList(newState)
      localStorage.setItem('dogicord-memberlist-open', newState.toString())
    }
  }

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId)
    setShowUserProfile(true)
  }

  const handleRoleUpdate = async () => {
    if (activeServerId && currentUser) {
      try {
        await forceRefreshRoles(activeServerId)
      } catch (error) {
        console.error('Failed to refresh roles:', error)
      }
    }
    await refreshServers()
    setRefreshTrigger(prev => prev + 1)
  }

  const handleLeaveServer = async () => {
    if (!activeServerId || !currentUser) return
    
    if (isOwner()) {
      setError('You cannot leave a server you own. Transfer ownership first.')
      return
    }

    if (confirm('Are you sure you want to leave this server?')) {
      try {
        await refreshServers()
        if (isMobile) setMobileView('servers')
      } catch (error) {
        console.error('Failed to leave server:', error)
        setError('Failed to leave server')
      }
    }
  }

  const renderMobileNavigation = () => {
    if (!isMobile || !showMobileNav) return null

    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 flex z-40 transition-transform duration-300">
        <button
          onClick={() => {
            setMobileView('servers')
            setShowMobileNav(true)
          }}
          className={`flex-1 py-3 px-2 flex flex-col items-center ${
            mobileView === 'servers' ? 'text-white bg-gray-800' : 'text-gray-400'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-2H5" />
          </svg>
          <span className="text-xs">Servers</span>
        </button>
        
        <button
          onClick={() => {
            setMobileView('channels')
            setShowMobileNav(true)
          }}
          className={`flex-1 py-3 px-2 flex flex-col items-center ${
            mobileView === 'channels' ? 'text-white bg-gray-800' : 'text-gray-400'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-xs">Channels</span>
        </button>
        
        <button
          onClick={() => {
            setMobileView('chat')
            setShowMobileNav(false)
          }}
          className={`flex-1 py-3 px-2 flex flex-col items-center ${
            mobileView === 'chat' ? 'text-white bg-gray-800' : 'text-gray-400'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs">Chat</span>
        </button>
      </div>
    )
  }

  const renderMainContent = () => {
    if (serverLoading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading servers...</p>
          </div>
        </div>
      )
    }

    if (servers.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-800 px-4">
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">No servers yet</h2>
            <p className="text-gray-400 mb-6 text-sm md:text-base">Create your first server or join one to get started!</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 md:px-6 md:py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm md:text-base"
            >
              Add a Server
            </button>
          </div>
        </div>
      )
    }

    if (!activeServer) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-800 px-4">
          <div className="text-center">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Select a server</h3>
            <p className="text-gray-400 text-sm md:text-base">Choose a server from the sidebar to start chatting.</p>
          </div>
        </div>
      )
    }

    const activeChannel = activeServer.channels.find(ch => ch.id === activeChannelId)
    
    if (isMobile) {
      return (
        <div className={`flex-1 flex flex-col ${showMobileNav ? 'pb-16' : 'pb-0'}`}>
          <div className={`${mobileView === 'servers' ? 'block' : 'hidden'} h-full`}>
            <ServerSidebar
              servers={serverList}
              activeServerId={activeServerId}
              onServerSelect={handleServerSelect}
              onAddServerClick={() => setIsModalOpen(true)}
              isMobile={true}
            />
          </div>
          
          <div className={`${mobileView === 'channels' ? 'block' : 'hidden'} h-full`}>
            <ChannelSidebar
              serverName={activeServer.name}
              serverId={activeServerId!}
              channels={activeServer.channels.filter(ch => {
                const viewPermCheck = permissionService.hasChannelPermission(
                  userRoles,
                  ch,
                  'view_channel',
                  isOwner()
                )
                return viewPermCheck.allowed
              })}
              categories={activeServer.categories}
              activeChannelId={activeChannelId}
              onChannelSelect={handleChannelSelect}
              onLeaveServer={handleLeaveServer}
              onOpenServerSettings={() => setIsServerSettingsOpen(true)}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              canManageServer={canManageServer()}
              isMobile={true}
              onBackToServers={() => setMobileView('servers')}
            />
          </div>
          
          <div className={`${mobileView === 'chat' ? 'block' : 'hidden'} h-full`}>
            <ChatArea
              channelName={activeChannel?.name || 'general'}
              messages={messages}
              onSendMessage={handleSendMessage}
              isMobile={true}
              onBackToChannels={() => {
                setMobileView('channels')
                setShowMobileNav(true)
              }}
              serverName={activeServer.name}
              serverId={activeServerId}
              channelId={activeChannelId}
              onShowMobileNav={() => setShowMobileNav(true)}
              onHideMobileNav={() => setShowMobileNav(false)}
              onToggleMemberList={handleToggleMemberList}
              onUserClick={handleUserClick}
              currentUserId={currentUser?.uid || ''}
              canManageMessages={canManageMessages()}
              canSendMessages={canSendMessages}
              sendMessageError={sendMessageError}
            />
          </div>
        </div>
      )
    }
    
    return (
      <div className="flex-1 flex">
        <ChannelSidebar
          serverName={activeServer.name}
          serverId={activeServerId!}
          channels={activeServer.channels.filter(ch => {
            const viewPermCheck = permissionService.hasChannelPermission(
              userRoles,
              ch,
              'view_channel',
              isOwner()
            )
            return viewPermCheck.allowed
          })}
          categories={activeServer.categories}
          activeChannelId={activeChannelId}
          onChannelSelect={handleChannelSelect}
          onLeaveServer={handleLeaveServer}
          onOpenServerSettings={() => setIsServerSettingsOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          canManageServer={canManageServer()}
          isMobile={false}
        />

        <ChatArea
          channelName={activeChannel?.name || 'general'}
          messages={messages}
          onSendMessage={handleSendMessage}
          isMobile={false}
          serverName={activeServer.name}
          serverId={activeServerId}
          channelId={activeChannelId}
          onToggleMemberList={handleToggleMemberList}
          onUserClick={handleUserClick}
          currentUserId={currentUser?.uid || ''}
          canManageMessages={canManageMessages()}
          canSendMessages={canSendMessages}
          sendMessageError={sendMessageError}
        />

        {showMemberList && (
          <MemberList
            serverId={activeServerId!}
            serverMembers={activeServer.members}
            isOpen={showMemberList}
            onClose={() => {
              setShowMemberList(false)
              localStorage.setItem('dogicord-memberlist-open', 'false')
            }}
            isMobile={false}
            onUserClick={handleUserClick}
            displayRolesSeparately={activeServer.displayRolesSeparately}
            refreshTrigger={refreshTrigger}
          />
        )}
      </div>
    )
  }

  const serverList = servers.map(server => ({
    id: server.id,
    name: server.name,
    initial: server.name.charAt(0).toUpperCase(),
    icon: server.icon
  }))

  return (
    <div className="h-screen flex bg-gray-900 overflow-hidden">
      {!isMobile && (
        <ServerSidebar
          servers={serverList}
          activeServerId={activeServerId}
          onServerSelect={handleServerSelect}
          onAddServerClick={() => setIsModalOpen(true)}
          isMobile={false}
        />
      )}

      {renderMainContent()}
      {renderMobileNavigation()}

      {error && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-center space-x-2">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-white hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {roleChangeNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Roles Updated: {roleChangeNotification}</span>
          </div>
        </div>
      )}

      <ServerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setError('')
        }}
        onCreateServer={handleCreateServer}
        onJoinServer={handleJoinServer}
        error={error}
      />

      {activeServer && (
        <ServerSettingsModal
          isOpen={isServerSettingsOpen}
          onClose={() => setIsServerSettingsOpen(false)}
          server={activeServer}
          userRoles={userRoles}
          onUpdateServer={handleUpdateServer}
          currentUserId={currentUser?.uid || ''}
        />
      )}

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdateProfile={async (updates: { username?: string, avatar?: File }) => {
          try {
            await updateUserProfile(updates)
          } catch (error) {
            console.error('Failed to update profile:', error)
            throw error
          }
        }}
      />

      {showMobileMemberList && activeServer && (
        <MemberList
          serverId={activeServerId!}
          serverMembers={activeServer.members}
          isOpen={showMobileMemberList}
          onClose={() => setShowMobileMemberList(false)}
          isMobile={true}
          onUserClick={handleUserClick}
          displayRolesSeparately={activeServer.displayRolesSeparately}
          refreshTrigger={refreshTrigger}
        />
      )}

      {showUserProfile && selectedUserId && activeServerId && (
        <UserProfileModal
          isOpen={showUserProfile}
          onClose={() => {
            setShowUserProfile(false)
            setSelectedUserId(null)
          }}
          userId={selectedUserId}
          serverId={activeServerId}
          isMobile={isMobile}
          currentUserId={currentUser?.uid}
          currentUserRoles={userRoles}
          isOwner={isOwner()}
          onRoleUpdate={handleRoleUpdate}
        />
      )}
    </div>
  )
}