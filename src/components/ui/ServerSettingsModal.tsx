import { useState } from 'react'
import type { Server } from '../../services/serverService'
import type { Role } from '../../types/permissions'

interface ServerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  server: Server
  userRoles: Role[]
  onUpdateServer: (updates: Partial<Server>) => Promise<void>
  onCreateChannel: (name: string, type: 'text' | 'voice') => Promise<void>
  onDeleteChannel: (channelId: string) => Promise<void>
}

type SettingsTab = 'general' | 'channels' | 'roles' | 'members'

export default function ServerSettingsModal({ 
  isOpen, 
  onClose, 
  server, 
  userRoles,
  onUpdateServer,
  onCreateChannel,
  onDeleteChannel 
}: ServerSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [serverName, setServerName] = useState(server.name)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text')
  const [loading, setLoading] = useState(false)
  const [isMobile] = useState(window.innerWidth < 768)

  if (!isOpen) return null

  const hasPermission = (permission: string): boolean => {
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const handleUpdateServerName = async () => {
    if (serverName.trim() !== server.name && hasPermission('manage_server')) {
      setLoading(true)
      try {
        await onUpdateServer({ name: serverName.trim() })
      } catch (error) {
        console.error('Failed to update server name:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleCreateChannel = async () => {
    if (newChannelName.trim() && hasPermission('manage_channels')) {
      setLoading(true)
      try {
        await onCreateChannel(newChannelName.trim(), newChannelType)
        setNewChannelName('')
      } catch (error) {
        console.error('Failed to create channel:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (hasPermission('manage_channels')) {
      if (confirm('Are you sure you want to delete this channel?')) {
        try {
          await onDeleteChannel(channelId)
        } catch (error) {
          console.error('Failed to delete channel:', error)
        }
      }
    }
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(server.inviteCode)
  }

  const renderGeneralSettings = () => (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className={`${isMobile ? 'text-lg' : 'text-lg'} font-semibold text-white mb-3 md:mb-4`}>Server Overview</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SERVER NAME
            </label>
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                disabled={!hasPermission('manage_server') || loading}
                className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-800 disabled:cursor-not-allowed text-sm md:text-base"
                maxLength={50}
              />
              <button
                onClick={handleUpdateServerName}
                disabled={serverName.trim() === server.name || !hasPermission('manage_server') || loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SERVER ICON
            </label>
            <div className="flex items-center space-x-4">
              <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-slate-600 rounded-2xl flex items-center justify-center`}>
                <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>
                  {server.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                disabled={!hasPermission('manage_server')}
                className="px-3 py-2 md:px-4 md:py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                Upload Image
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Recommended size: 512x512px
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              INVITE CODE
            </label>
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
              <input
                type="text"
                value={server.inviteCode}
                readOnly
                className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 cursor-not-allowed text-sm md:text-base"
              />
              <button 
                onClick={copyInviteCode}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm md:text-base"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderChannelSettings = () => (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className={`${isMobile ? 'text-lg' : 'text-lg'} font-semibold text-white mb-3 md:mb-4`}>Channels</h3>
        
        {hasPermission('manage_channels') && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-750 rounded-lg">
            <h4 className="text-white font-medium mb-3 text-sm md:text-base">Create Channel</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                className="w-full px-3 py-2 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm md:text-base"
              />
              <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="channelType"
                    value="text"
                    checked={newChannelType === 'text'}
                    onChange={(e) => setNewChannelType(e.target.value as 'text')}
                    className="mr-2"
                  />
                  <span className="text-gray-300 text-sm md:text-base"># Text Channel</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="channelType"
                    value="voice"
                    checked={newChannelType === 'voice'}
                    onChange={(e) => setNewChannelType(e.target.value as 'voice')}
                    className="mr-2"
                  />
                  <span className="text-gray-300 text-sm md:text-base">🔊 Voice Channel</span>
                </label>
              </div>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim() || loading}
                className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                {loading ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {server.channels.map((channel) => (
            <div key={channel.id} className="flex items-center justify-between p-3 bg-gray-750 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-gray-400 flex-shrink-0">
                  {channel.type === 'text' ? '#' : '🔊'}
                </span>
                <span className="text-white truncate text-sm md:text-base">{channel.name}</span>
                <span className="text-xs text-gray-500 uppercase flex-shrink-0">
                  {channel.type}
                </span>
              </div>
              
              {hasPermission('manage_channels') && channel.name !== 'general' && (
                <button
                  onClick={() => handleDeleteChannel(channel.id)}
                  className="p-1 md:p-2 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderMobileNav = () => {
    if (!isMobile) return null

    return (
      <div className="flex border-b border-gray-700 bg-gray-750">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-3 px-2 text-xs font-medium transition-colors ${
            activeTab === 'general'
              ? 'text-white border-b-2 border-slate-500 bg-gray-800'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          General
        </button>
        
        {hasPermission('manage_channels') && (
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex-1 py-3 px-2 text-xs font-medium transition-colors ${
              activeTab === 'channels'
                ? 'text-white border-b-2 border-slate-500 bg-gray-800'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Channels
          </button>
        )}
        
        {hasPermission('manage_roles') && (
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex-1 py-3 px-2 text-xs font-medium transition-colors ${
              activeTab === 'roles'
                ? 'text-white border-b-2 border-slate-500 bg-gray-800'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Roles
          </button>
        )}
        
        {(hasPermission('kick_members') || hasPermission('ban_members')) && (
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 px-2 text-xs font-medium transition-colors ${
              activeTab === 'members'
                ? 'text-white border-b-2 border-slate-500 bg-gray-800'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Members
          </button>
        )}
      </div>
    )
  }

  const renderDesktopNav = () => {
    if (isMobile) return null

    return (
      <div className="w-64 bg-gray-750 rounded-l-2xl p-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">{server.name}</h2>
          <p className="text-sm text-gray-400">Server Settings</p>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'general'
                ? 'bg-slate-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            General
          </button>
          
          {hasPermission('manage_channels') && (
            <button
              onClick={() => setActiveTab('channels')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'channels'
                  ? 'bg-slate-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              Channels
            </button>
          )}
          
          {hasPermission('manage_roles') && (
            <button
              onClick={() => setActiveTab('roles')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'roles'
                  ? 'bg-slate-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              Roles
            </button>
          )}
          
          {(hasPermission('kick_members') || hasPermission('ban_members')) && (
            <button
              onClick={() => setActiveTab('members')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'members'
                  ? 'bg-slate-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              Members
            </button>
          )}
        </nav>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings()
      case 'channels':
        return renderChannelSettings()
      case 'roles':
        return <div className="text-gray-400 text-center py-8">Roles management coming soon...</div>
      case 'members':
        return <div className="text-gray-400 text-center py-8">Member management coming soon...</div>
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
      <div className={`bg-gray-800 rounded-2xl shadow-2xl w-full ${
        isMobile 
          ? 'h-[95vh] max-w-sm' 
          : 'max-w-4xl h-[80vh]'
      } flex flex-col md:flex-row overflow-hidden`}>
        
        {renderDesktopNav()}
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-700">
            <h3 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-white capitalize`}>
              {isMobile ? server.name : activeTab}
            </h3>
            <button
              onClick={onClose}
              className="p-1 md:p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {renderMobileNav()}

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}