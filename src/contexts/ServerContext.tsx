
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
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

  useEffect(() => {
    loadUserServers()
  }, [currentUser])

  const value: ServerContextType = {
    servers,
    activeServerId,
    activeServer,
    loading,
    createServer,
    joinServerByCode,
    selectServer,
    refreshServers
  }

  return (
    <ServerContext.Provider value={value}>
      {children}
    </ServerContext.Provider>
  )
}