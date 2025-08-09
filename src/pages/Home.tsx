import { useState, useEffect, useCallback } from 'react'
import { useServer } from '../contexts/ServerContext'
import { useAuth } from '../contexts/AuthContext'
import { messageService } from '../services/messageService'
import { serverService } from '../services/serverService'
import { permissionService } from '../services/permissionService'
import { roleSyncService } from '../services/roleSyncService'
import { notificationService } from '../services/notificationService'
import { globalMessageListener } from '../services/globalMessageListener'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useReadTracker } from '../hooks/useReadTracker'
import { fcmService } from '../services/fcmService'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { Server } from '../services/serverService'
import ServerSidebar from '../components/ui/ServerSidebar'
import ServerModal from '../components/ui/ServerModal'
import ChannelSidebar from '../components/ui/ChannelSidebar'
import ChatArea from '../components/ui/ChatArea'
import ServerSettingsModal from '../components/ui/ServerSettingsModal'
import ProfileModal from '../components/ui/ProfileModal'
import MemberList from '../components/ui/MemberList'
import UserProfileModal from '../components/ui/UserProfileModal'
import UpdateModal from '../components/ui/UpdateModal'
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
  const { 
    currentVersion, 
    latestVersion, 
    isModalOpen: isUpdateModalOpen, 
    applyUpdate, 
    dismissUpdate,
    simulateUpdate,
    forceCheckForUpdates
  } = useAppUpdate()
  
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
  
  // Auto-mark messages as read when viewing channel
  const { markAsReadNow } = useReadTracker({
    serverId: activeServerId || '',
    channelId: activeChannelId,
    isActive: Boolean(activeServerId && activeChannelId && mobileView === 'chat'),
    messages,
    currentUserId: currentUser?.uid
  })
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

    // Add debugging functions to window object (only once)
    if (process.env.NODE_ENV === 'development' && !(window as any).dogicordDebug) {
      (window as any).dogicordDebug = {
        simulateUpdate,
        forceCheckForUpdates,
        currentVersion,
        latestVersion,
        isUpdateModalOpen,
        // FCM Debug functions
        async fcmStatus() {
          const status = await fcmService.getDebugInfo()
          console.log('FCM Debug Status:', status)
          return status
        },
        async testNotification() {
          console.log('🧪 Testing FCM notification system...')
          
          // Test 1: Direct browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            console.log('🔔 Testing direct browser notification...')
            const testNotif = new Notification('Test Notification', {
              body: 'This is a test from Dogicord debug',
              icon: '/vite.svg',
              tag: 'dogicord-test'
            })
            
            setTimeout(() => testNotif.close(), 3000)
            console.log('✅ Direct notification sent')
          } else {
            console.log('❌ Notification permission not granted or not supported')
            console.log('🔧 Current permission:', Notification.permission)
            
            if (Notification.permission === 'default') {
              console.log('🔧 Requesting notification permission...')
              const permission = await Notification.requestPermission()
              console.log('🔧 Permission result:', permission)
            }
          }
          
          // Test 2: FCM status
          const fcmStatus = await fcmService.getDebugInfo()
          console.log('🔧 FCM Status:', fcmStatus)
          
          // Test 3: Manual FCM message simulation (development only)
          if (import.meta.env.DEV) {
            console.log('🧪 Development mode: Simulating FCM message...')
            
            // Simulate a foreground FCM message
            const mockPayload = {
              notification: {
                title: `#${activeChannelId || 'test'} in ${activeServer?.name || 'Test Server'}`,
                body: 'Debug Tester: This is a test notification from debug console'
              },
              data: {
                serverId: activeServerId || 'test-server',
                channelId: activeChannelId || 'test-channel',
                messageId: 'test-' + Date.now(),
                url: `/?server=${activeServerId}&channel=${activeChannelId}`
              }
            }
            
            // Trigger the foreground notification handler directly
            try {
              console.log('🔔 Triggering mock FCM payload:', mockPayload)
              
              // Show the notification using the same logic as FCM
              if ('Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification(mockPayload.notification.title, {
                  body: mockPayload.notification.body,
                  icon: '/vite.svg',
                  badge: '/vite.svg',
                  tag: 'dogicord-test-fcm'
                })
                
                setTimeout(() => notification.close(), 5000)
                console.log('✅ Mock FCM notification displayed')
              }
              
              return { success: true, payload: mockPayload, fcmStatus }
            } catch (error) {
              console.error('❌ Mock FCM notification failed:', error)
              return { error: (error as Error).message, fcmStatus }
            }
          } else {
            console.log('📦 Production mode: FCM notifications handled by server')
            return { 
              message: 'Production mode - notifications handled by server',
              fcmStatus 
            }
          }
        },
        async checkServiceWorker() {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations()
            const fcmSW = registrations.find(reg => 
              reg.scope.includes('/') && 
              reg.active?.scriptURL.includes('firebase-messaging-sw.js')
            )
            
            const status = {
              totalRegistrations: registrations.length,
              fcmServiceWorker: {
                found: !!fcmSW,
                state: fcmSW?.active?.state,
                scope: fcmSW?.scope,
                scriptURL: fcmSW?.active?.scriptURL
              },
              controller: !!navigator.serviceWorker.controller
            }
            
            console.log('🔧 Service Worker Status:', status)
            return status
          } catch (error) {
            console.error('❌ Service Worker check failed:', error)
            return { error: (error as Error).message }
          }
        },
        async sendTestMessage() {
          if (activeServerId && activeChannelId && currentUser && userProfile) {
            try {
              console.log('🧪 Sending real test message (will trigger notifications)...')
              
              await messageService.sendMessage(
                'This is a test message to verify notifications are working! 🔔',
                currentUser.uid,
                userProfile.username,
                (userProfile as any).avatar || null,
                activeServerId,
                activeChannelId
              )
              
              console.log('✅ Test message sent successfully')
              return { success: true, message: 'Test message sent' }
            } catch (error) {
              console.error('❌ Failed to send test message:', error)
              return { error: (error as Error).message }
            }
          } else {
            return { error: 'Missing required data' }
          }
        },
        async debugFCMTokens() {
          console.log('🔍 Debugging FCM tokens and registration...')
          
          try {
            const fcmStatus = await fcmService.getDebugInfo()
            console.log('📱 Local FCM Status:', fcmStatus)
            
            if (currentUser) {
              // Check tokens in Firestore
              const tokensRef = collection(db, 'users', currentUser.uid, 'fcmTokens')
              const tokensSnapshot = await getDocs(tokensRef)
              
              console.log('🔧 Firestore FCM Tokens:', {
                totalTokens: tokensSnapshot.size,
                tokens: tokensSnapshot.docs.map(doc => ({
                  id: doc.id,
                  data: {
                    ...doc.data(),
                    token: doc.data().token?.substring(0, 20) + '...'
                  }
                }))
              })
              
              // Check if current browser token exists in DB
              const currentToken = fcmService.getCurrentToken()
              if (currentToken) {
                const currentTokenExists = tokensSnapshot.docs.some(doc => 
                  doc.data().token === currentToken
                )
                console.log('🔍 Current browser token exists in DB:', currentTokenExists)
              }
              
              return {
                fcmStatus,
                tokensInDB: tokensSnapshot.size,
                currentTokenInDB: currentToken ? tokensSnapshot.docs.some(doc => 
                  doc.data().token === currentToken
                ) : false
              }
            }
            
            return { fcmStatus, error: 'No current user' }
          } catch (error) {
            console.error('❌ FCM tokens debug failed:', error)
            return { error: (error as Error).message }
          }
        },
        currentChannel: { serverId: activeServerId, channelId: activeChannelId },
        userInfo: { id: currentUser?.uid, username: userProfile?.username }
      }
      console.log('🔧 Debug functions available at window.dogicordDebug')
      console.log('📋 Available commands: fcmStatus(), testNotification(), checkServiceWorker(), sendTestMessage(), debugFCMTokens()')
    }

    return () => window.removeEventListener('resize', checkMobile)
  }, [simulateUpdate, forceCheckForUpdates, currentVersion, latestVersion, isUpdateModalOpen])

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
      const currentChannelExists = activeServer.channels.find(ch => ch.id === activeChannelId)
      
      if (!currentChannelExists) {
        const defaultChannel = activeServer.channels.find(ch => ch.name === 'general')
        if (defaultChannel) {
          setActiveChannelId(defaultChannel.id)
          localStorage.setItem('dogicord-active-channel', defaultChannel.id)
        } else if (activeServer.channels.length > 0) {
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

      // Mark previous channel as read when switching away
      if (activeChannelId && channelId !== activeChannelId) {
        markAsReadNow()
      }

      // Mark new channel as read
      notificationService.markChannelAsRead(activeServer.id, channelId)

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

  const handleSendMessage = async (content: string, replyTo?: { messageId: string; authorName: string; content: string }) => {
    if (!activeServerId || !activeChannelId || !currentUser || !userProfile) {
      setError('Missing required information to send message')
      return
    }

    if (!canSendMessages) {
      setError(sendMessageError || 'You cannot send messages in this channel')
      return
    }

    try {
      console.log('Sending message:', { content, activeServerId, activeChannelId, replyTo })
      
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
        activeChannelId,
        replyTo
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 flex z-40 transition-transform duration-300 mobile-nav-bar">
        <button
          onClick={() => {
            setMobileView('servers')
            setShowMobileNav(true)
          }}
          className={`flex-1 flex flex-col items-center mobile-nav-button mobile-touch-feedback ${
            mobileView === 'servers' ? 'text-white bg-gray-800' : 'text-gray-400'
          }`}
        >
          <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-2H5" />
          </svg>
          <span className="mobile-nav-text">Servers</span>
        </button>
        
        <button
          onClick={() => {
            setMobileView('channels')
            setShowMobileNav(true)
          }}
          className={`flex-1 flex flex-col items-center mobile-nav-button mobile-touch-feedback ${
            mobileView === 'channels' ? 'text-white bg-gray-800' : 'text-gray-400'
          }`}
        >
          <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="mobile-nav-text">Channels</span>
        </button>
        
        <button
          onClick={() => {
            setMobileView('chat')
            setShowMobileNav(false)
          }}
          className={`flex-1 flex flex-col items-center mobile-nav-button mobile-touch-feedback ${
            mobileView === 'chat' ? 'text-white bg-gray-800' : 'text-gray-400'
          }`}
        >
          <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="mobile-nav-text">Chat</span>
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
              channels={activeServer.channels}
              categories={activeServer.categories}
              userRoles={userRoles}
              isOwner={isOwner()}
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
          channels={activeServer.channels}
          categories={activeServer.categories}
          userRoles={userRoles}
          isOwner={isOwner()}
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

      {/* Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onUpdate={applyUpdate}
        onDismiss={dismissUpdate}
        currentVersion={currentVersion || undefined}
        latestVersion={latestVersion || undefined}
      />
    </div>
  )
}