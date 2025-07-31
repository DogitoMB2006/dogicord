interface Server {
  id: string
  name: string
  initial: string
}

interface ServerSidebarProps {
  servers: Server[]
  activeServerId?: string
  onServerSelect: (serverId: string) => void
  onAddServerClick: () => void
}

export default function ServerSidebar({ servers, activeServerId, onServerSelect, onAddServerClick }: ServerSidebarProps) {
  const getServerInitial = (name: string): string => {
    return name.charAt(0).toUpperCase()
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
              className={`w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group ${
                activeServerId === server.id
                  ? 'bg-slate-600 rounded-xl'
                  : 'bg-gray-700 hover:bg-slate-600'
              }`}
            >
              <span className="text-white font-bold text-lg">
                {getServerInitial(server.name)}
              </span>
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