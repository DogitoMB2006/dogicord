
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from './AuthContext'
import { serverService } from '../services/serverService'
import type { Server } from '../services/serverService'

interface ServerContextType {
  servers: Server[]
  activeServerId?: string
  activeServer?: Server
  loading: boolean
  createServer: (name: string) => Promise<void>
  joinServerByCode: (inviteCode: string) => Promise<void>
  selectServer: (serverId: string) => void
  refreshServers: () => Promise<void>
  updateServerRealtime: (serverId: string, updates: Partial<Server>) => Promise<void>
}

const ServerContext = createContext<ServerContextType | undefined>(undefined)

export const useServer = () => {
  const context = useContext(ServerContext)
  if (context === undefined) {
    throw new Error('useServer must be used within a ServerProvider')
  }
  return context
}

interface ServerProviderProps {
  children: ReactNode
}

export const ServerProvider = ({ children }: ServerProviderProps) => {
  const { currentUser } = useAuth()
  const [servers, setServers] = useState<Server[]>([])
  const [activeServerId, setActiveServerId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [serverListeners, setServerListeners] = useState<Map<string, () => void>>(new Map())

  const activeServer = servers.find(s => s.id === activeServerId)

  const loadUserServers = async () => {
    if (!currentUser) {
      setServers([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const userServers = await serverService.getUserServers(currentUser.uid)
      setServers(userServers)
      
      if (userServers.length > 0 && !activeServerId) {
        setActiveServerId(userServers[0].id)
      }
    } catch (error) {
      console.error('Error loading servers:', error)
    } finally {
      setLoading(false)
    }
  }

  const createServer = async (name: string) => {
    if (!currentUser) throw new Error('Must be logged in to create server')
    
    try {
      const newServer = await serverService.createServer(name, currentUser.uid)
      setServers(prev => [newServer, ...prev])
      setActiveServerId(newServer.id)
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  const joinServerByCode = async (inviteCode: string) => {
    if (!currentUser) throw new Error('Must be logged in to join server')
    
    try {
      const server = await serverService.getServerByInviteCode(inviteCode)
      if (!server) {
        throw new Error('Invalid invite code')
      }
      
      if (server.members.includes(currentUser.uid)) {
        setActiveServerId(server.id)
        return
      }
      
      await serverService.joinServer(server.id, currentUser.uid)
      await loadUserServers()
      setActiveServerId(server.id)
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  const selectServer = (serverId: string) => {
    setActiveServerId(serverId)
  }

  const refreshServers = async () => {
    await loadUserServers()
  }

  const updateServerRealtime = async (serverId: string, updates: Partial<Server>) => {
    try {
      await serverService.updateServer(serverId, updates)
      // The real-time listener will automatically update the state
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  const setupServerListener = (serverId: string) => {
    // Don't set up duplicate listeners
    if (serverListeners.has(serverId)) {
      return
    }

    const serverRef = doc(db, 'servers', serverId)
    const unsubscribe = onSnapshot(serverRef, (doc) => {
      if (doc.exists()) {
        const serverData = { id: doc.id, ...doc.data() } as Server
        setServers(prev => {
          const existingIndex = prev.findIndex(s => s.id === serverId)
          if (existingIndex >= 0) {
            // Only update if the data has actually changed to prevent unnecessary re-renders
            const existingServer = prev[existingIndex]
            const hasChanges = JSON.stringify(existingServer) !== JSON.stringify(serverData)
            if (hasChanges) {
              const updated = [...prev]
              updated[existingIndex] = serverData
              return updated
            }
            return prev
          } else {
            return [...prev, serverData]
          }
        })
      } else {
        // Server was deleted, remove from state
        setServers(prev => prev.filter(s => s.id !== serverId))
        // Clean up the listener
        setServerListeners(prev => {
          const updated = new Map(prev)
          updated.delete(serverId)
          return updated
        })
      }
    }, (error) => {
      console.error(`Error listening to server ${serverId}:`, error)
      // Remove the failed listener
      setServerListeners(prev => {
        const updated = new Map(prev)
        updated.delete(serverId)
        return updated
      })
    })

    setServerListeners(prev => new Map(prev.set(serverId, unsubscribe)))
    return unsubscribe
  }

  const cleanupServerListeners = () => {
    serverListeners.forEach(unsubscribe => unsubscribe())
    setServerListeners(new Map())
  }

  useEffect(() => {
    loadUserServers()
    
    return () => {
      cleanupServerListeners()
    }
  }, [currentUser])

  // Setup real-time listeners for user's servers (optimized to avoid redundant listeners)
  useEffect(() => {
    if (servers.length > 0 && currentUser) {
      const currentServerIds = Array.from(serverListeners.keys())
      const newServerIds = servers.map(s => s.id)
      
      // Remove listeners for servers that are no longer in the user's server list
      currentServerIds.forEach(serverId => {
        if (!newServerIds.includes(serverId)) {
          const unsubscribe = serverListeners.get(serverId)
          if (unsubscribe) {
            unsubscribe()
            setServerListeners(prev => {
              const updated = new Map(prev)
              updated.delete(serverId)
              return updated
            })
          }
        }
      })
      
      // Add listeners for new servers only
      newServerIds.forEach(serverId => {
        if (!serverListeners.has(serverId)) {
          setupServerListener(serverId)
        }
      })
    }

    return () => {
      // Cleanup will happen in the main useEffect
    }
  }, [servers.map(s => s.id).join(','), currentUser])

  const value: ServerContextType = {
    servers,
    activeServerId,
    activeServer,
    loading,
    createServer,
    joinServerByCode,
    selectServer,
    refreshServers,
    updateServerRealtime
  }

  return (
    <ServerContext.Provider value={value}>
      {children}
    </ServerContext.Provider>
  )
}