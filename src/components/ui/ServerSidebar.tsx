import { useState, useEffect } from 'react'
import { notificationService } from '../../services/notificationService'
import '../../styles/glow.css'

interface Server {
  id: string
  name: string
  initial: string
  icon?: string
}

interface ServerSidebarProps {
  servers: Server[]
  activeServerId?: string
  onServerSelect: (serverId: string) => void
  onAddServerClick: () => void
  isMobile: boolean
}

export default function ServerSidebar({ 
  servers, 
  activeServerId, 
  onServerSelect, 
  onAddServerClick,
  isMobile 
}: ServerSidebarProps) {
  const [, setForceUpdate] = useState(0)

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(() => {
      setForceUpdate(prev => prev + 1)
    })
    return unsubscribe
  }, [])

  const getServerInitial = (name: string): string => {
    return name.charAt(0).toUpperCase()
  }

  const hasUnreadMessages = (serverId: string): boolean => {
    return notificationService.hasUnreadInServer(serverId)
  }

  if (isMobile) {
    return (
      <div className="w-full bg-gray-900 flex flex-col h-full">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-white font-bold text-lg">Servers</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group mx-auto">
              <span className="text-white font-bold text-xl">D</span>
            </div>
            <p className="text-center text-gray-400 text-xs mt-2">Dogicord</p>
          </div>

            <div className="grid grid-cols-3 gap-4">
            {servers.map((server) => (
              <div key={server.id} className="relative flex flex-col items-center">
                <div
                  onClick={() => onServerSelect(server.id)}
                  className={`relative w-16 h-16 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group overflow-hidden ${
                    activeServerId === server.id
                      ? 'bg-slate-600 rounded-xl ring-2 ring-slate-500'
                      : 'bg-gray-700 hover:bg-slate-600'
                  }`}
                >
                  {servers.find(s => s.id === server.id)?.icon ? (
                    <img 
                      src={servers.find(s => s.id === server.id)?.icon} 
                      alt={server.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {getServerInitial(server.name)}
                    </span>
                  )}
                  {hasUnreadMessages(server.id) && activeServerId !== server.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-gray-900 white-dot-glow"></div>
                  )}
                </div>
                <p className="text-center text-gray-400 text-xs mt-1 truncate w-full">
                  {server.name}
                </p>
              </div>
            ))}
            
            <div className="flex flex-col items-center">
              <button
                onClick={onAddServerClick}
                className="w-16 h-16 bg-gray-700 hover:bg-green-600 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group"
              >
                <svg className="w-8 h-8 text-green-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <p className="text-center text-gray-400 text-xs mt-1">Add Server</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-2">
      <div className="w-12 h-12 bg-slate-700 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group">
        <span className="text-white font-bold text-lg">D</span>
      </div>

      <div className="w-8 h-0.5 bg-gray-700 rounded-full"></div>

      <div className="flex flex-col space-y-2 flex-1">
        {servers.map((server) => (
          <div key={server.id} className="relative">
            <div
              onClick={() => onServerSelect(server.id)}
              className={`relative w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group overflow-hidden ${
                activeServerId === server.id
                  ? 'bg-slate-600 rounded-xl'
                  : 'bg-gray-700 hover:bg-slate-600'
              }`}
            >
              {servers.find(s => s.id === server.id)?.icon ? (
                <img 
                  src={servers.find(s => s.id === server.id)?.icon} 
                  alt={server.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {getServerInitial(server.name)}
                </span>
              )}
              {hasUnreadMessages(server.id) && activeServerId !== server.id && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-gray-900 white-dot-glow"></div>
              )}
            </div>
            
            {activeServerId === server.id && (
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1 h-8 bg-white rounded-r-lg"></div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onAddServerClick}
        className="w-12 h-12 bg-gray-700 hover:bg-green-600 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group"
      >
        <svg className="w-6 h-6 text-green-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}