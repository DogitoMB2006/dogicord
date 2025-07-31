
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
}

interface ChannelCategory {
  name: string
  channels: Channel[]
}

interface ChannelSidebarProps {
  serverName: string
  categories: ChannelCategory[]
  activeChannelId?: string
  onChannelSelect: (channelId: string) => void
  onLeaveServer: () => void
  onOpenServerSettings: () => void
  canManageServer: boolean
}

export default function ChannelSidebar({ 
  serverName, 
  categories, 
  activeChannelId, 
  onChannelSelect,
  onLeaveServer,
  onOpenServerSettings,
  canManageServer
}: ChannelSidebarProps) {
  const { userProfile, logout } = useAuth()
  const [showServerDropdown, setShowServerDropdown] = useState(false)

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      <div className="relative">
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

        {showServerDropdown && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowServerDropdown(false)}
            />
            <div className="absolute top-12 left-4 right-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20 py-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/invite/' + serverName)
                  setShowServerDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-indigo-400 hover:bg-gray-800 transition-colors"
              >
                Invite People
              </button>
              
              {canManageServer && (
                <button
                  onClick={() => {
                    onOpenServerSettings()
                    setShowServerDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Server Settings
                </button>
              )}
              
              <div className="h-px bg-gray-700 my-2" />
              
              <button
                onClick={() => {
                  onLeaveServer()
                  setShowServerDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 transition-colors"
              >
                Leave Server
              </button>
            </div>
          </>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {categories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-300 cursor-pointer">
              <span>{category.name}</span>
              {canManageServer && category.name === 'Text Channels' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
            
            <div className="mt-1 space-y-0.5">
              {category.channels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  className={`flex items-center px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    activeChannelId === channel.id
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className="text-gray-400 mr-2">
                    {channel.type === 'text' ? '#' : '🔊'}
                  </span>
                  <span className="text-sm truncate">{channel.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="h-14 bg-gray-850 flex items-center px-2 space-x-2">
        <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-medium text-sm">
            {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {userProfile?.username || 'User'}
          </div>
          <div className="text-xs text-gray-400">Online</div>
        </div>

        <div className="flex space-x-1">
          <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button 
            onClick={logout}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}