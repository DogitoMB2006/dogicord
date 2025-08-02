// src/pages/Home.tsx
import { useState, useEffect } from 'react'
import { useServer } from '../contexts/ServerContext'
import { useAuth } from '../contexts/AuthContext'
import { messageService } from '../services/messageService'
import { serverService } from '../services/serverService'
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

interface ChannelCategory {
  name: string
  channels: Array<{
    id: string
    name: string
    type: 'text' | 'voice'
  }>
}

type MobileView = 'servers' | 'channels' | 'chat'

export default function Home() {
  const { currentUser, userProfile, updateUserProfile } = useAuth()
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

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!activeServerId || !activeChannelId) {
      setMessages([])
      return
    }

    const unsubscribe = messageService.subscribeToMessages(
      activeServerId,
      activeChannelId,
      (newMessages) => {
        setMessages(newMessages)
      }
    )

    return unsubscribe
  }, [activeServerId, activeChannelId])

  useEffect(() => {
    if (activeServer) {
      const defaultChannel = activeServer.channels.find(ch => ch.name === 'general')
      if (defaultChannel) {
        setActiveChannelId(defaultChannel.id)
      }
    }
  }, [activeServer])

  useEffect(() => {
    if (activeServerId && currentUser) {
      loadUserRoles()
    }
  }, [activeServerId, currentUser])

  const loadUserRoles = async () => {
    if (!activeServerId || !currentUser) return
    
    try {
      const roles = await serverService.getUserRoles(activeServerId, currentUser.uid)
      setUserRoles(roles)
    } catch (error) {
      console.error('Failed to load user roles:', error)
    }
  }

  const hasPermission = (permission: string): boolean => {
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
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
    if (isMobile) setMobileView('channels')
  }

  const handleChannelSelect = (channelId: string) => {
    setActiveChannelId(channelId)
    localStorage.setItem('dogicord-active-channel', channelId)
    if (isMobile) {
      setMobileView('chat')
      setShowMobileNav(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!activeServerId || !activeChannelId || !currentUser || !userProfile) {
      return
    }

    try {
      await messageService.sendMessage(
        content,
        currentUser.uid,
        userProfile.username,
        (userProfile as any).avatar || null,
        activeServerId,
        activeChannelId
      )
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleUpdateServer = async (updates: Partial<Server>) => {
    if (!activeServerId) return
    
    try {
      await serverService.updateServer(activeServerId, updates)
      await refreshServers()
    } catch (error) {
      console.error('Failed to update server:', error)
      throw error
    }
  }

  const getChannelCategories = (): ChannelCategory[] => {
    if (!activeServer) return []

    const textChannels = activeServer.channels.filter(ch => ch.type === 'text')
    const voiceChannels = activeServer.channels.filter(ch => ch.type === 'voice')

    return [
      {
        name: 'Text Channels',
        channels: textChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type
        }))
      },
      {
        name: 'Voice Channels',
        channels: voiceChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type
        }))
      }
    ]
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
      await loadUserRoles()
    }
    await refreshServers()
    setRefreshTrigger(prev => prev + 1)
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
              categories={getChannelCategories()}
              activeChannelId={activeChannelId}
              onChannelSelect={handleChannelSelect}
              onLeaveServer={() => {}}
              onOpenServerSettings={() => setIsServerSettingsOpen(true)}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              canManageServer={hasPermission('manage_server') || activeServer.ownerId === currentUser?.uid}
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
              onShowMobileNav={() => setShowMobileNav(true)}
              onHideMobileNav={() => setShowMobileNav(false)}
              onToggleMemberList={handleToggleMemberList}
              onUserClick={handleUserClick}
              currentUserId={currentUser?.uid || ''}
              canManageMessages={hasPermission('manage_messages')}
            />
          </div>
        </div>
      )
    }
    
    return (
      <div className="flex-1 flex">
        <ChannelSidebar
          serverName={activeServer.name}
          categories={getChannelCategories()}
          activeChannelId={activeChannelId}
          onChannelSelect={handleChannelSelect}
          onLeaveServer={() => {}}
          onOpenServerSettings={() => setIsServerSettingsOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          canManageServer={hasPermission('manage_server') || activeServer.ownerId === currentUser?.uid}
          isMobile={false}
        />

        <ChatArea
          channelName={activeChannel?.name || 'general'}
          messages={messages}
          onSendMessage={handleSendMessage}
          isMobile={false}
          serverName={activeServer.name}
          onToggleMemberList={handleToggleMemberList}
          onUserClick={handleUserClick}
          currentUserId={currentUser?.uid || ''}
          canManageMessages={hasPermission('manage_messages')}
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
          isOwner={activeServer?.ownerId === currentUser?.uid}
          onRoleUpdate={handleRoleUpdate}
        />
      )}
    </div>
  )
}