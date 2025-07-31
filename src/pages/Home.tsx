
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

export default function Home() {
  const { currentUser, userProfile } = useAuth()
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
  
  const [activeChannelId, setActiveChannelId] = useState<string>('general')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState('')
  const [userRoles, setUserRoles] = useState<Role[]>([])

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
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleJoinServer = async (inviteCode: string) => {
    try {
      setError('')
      await joinServerByCode(inviteCode)
      setIsModalOpen(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleServerSelect = (serverId: string) => {
    selectServer(serverId)
  }

  const handleChannelSelect = (channelId: string) => {
    setActiveChannelId(channelId)
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

  const handleCreateChannel = async (name: string, type: 'text' | 'voice') => {
    if (!activeServerId) return
    
    try {
      await serverService.createChannel(activeServerId, name, type)
      await refreshServers()
    } catch (error) {
      console.error('Failed to create channel:', error)
      throw error
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (!activeServerId) return
    
    try {
      await serverService.deleteChannel(activeServerId, channelId)
      await refreshServers()
      
      if (activeChannelId === channelId) {
        setActiveChannelId('general')
      }
    } catch (error) {
      console.error('Failed to delete channel:', error)
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
        <div className="flex-1 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No servers yet</h2>
            <p className="text-gray-400 mb-6">Create your first server or join one to get started!</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Add a Server
            </button>
          </div>
        </div>
      )
    }

    if (!activeServer) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-2">Select a server</h3>
            <p className="text-gray-400">Choose a server from the sidebar to start chatting.</p>
          </div>
        </div>
      )
    }

    const activeChannel = activeServer.channels.find(ch => ch.id === activeChannelId)
    
    return (
      <div className="flex-1 flex">
        <ChannelSidebar
          serverName={activeServer.name}
          categories={getChannelCategories()}
          activeChannelId={activeChannelId}
          onChannelSelect={handleChannelSelect}
          onLeaveServer={() => {}}
          onOpenServerSettings={() => setIsServerSettingsOpen(true)}
          canManageServer={hasPermission('manage_server') || activeServer.ownerId === currentUser?.uid}
        />

        <ChatArea
          channelName={activeChannel?.name || 'general'}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>
    )
  }

  const serverList = servers.map(server => ({
    id: server.id,
    name: server.name,
    initial: server.name.charAt(0).toUpperCase()
  }))

  return (
    <div className="h-screen flex bg-gray-900">
      <ServerSidebar
        servers={serverList}
        activeServerId={activeServerId}
        onServerSelect={handleServerSelect}
        onAddServerClick={() => setIsModalOpen(true)}
      />

      {renderMainContent()}

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
          onCreateChannel={handleCreateChannel}
          onDeleteChannel={handleDeleteChannel}
        />
      )}
    </div>
  )
}