// src/components/ui/ServerSettingsModal.tsx
import { useState, useRef } from 'react'
import type { Server } from '../../services/serverService'
import type { Role } from '../../types/permissions'
import type { Channel, Category, ChannelPermission } from '../../types/channels'
import { serverService } from '../../services/serverService'
import RoleManager from '../server/RoleManager'
import ChannelManager from '../server/ChannelManager'

interface ServerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  server: Server
  userRoles: Role[]
  onUpdateServer: (updates: Partial<Server>) => Promise<void>
  currentUserId: string
}

type SettingsTab = 'general' | 'channels' | 'roles' | 'members'

export default function ServerSettingsModal({ 
  isOpen, 
  onClose, 
  server, 
  userRoles,
  onUpdateServer,
  currentUserId
}: ServerSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [serverName, setServerName] = useState(server.name)
  const [loading, setLoading] = useState(false)
  const [isMobile] = useState(window.innerWidth < 768)
  const [selectedIcon, setSelectedIcon] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [iconError, setIconError] = useState('')
  const [displayRolesSeparately, setDisplayRolesSeparately] = useState(server.displayRolesSeparately ?? true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const isOwner = server.ownerId === currentUserId

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const handleUpdateServerName = async () => {
    if (serverName.trim() !== server.name && hasPermission('manage_server')) {
      setLoading(true)
      try {
        const updates: Partial<Server> = { name: serverName.trim() }
        
        if (selectedIcon) {
          if (server.icon) {
            await serverService.deleteServerIcon(server.icon)
          }
          
          const iconUrl = await serverService.uploadServerIcon(selectedIcon, server.id)
          updates.icon = iconUrl
        }
        
        await onUpdateServer(updates)
        setSelectedIcon(null)
        setPreviewUrl(null)
        setIconError('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error: any) {
        setIconError(error.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleUpdateServerIcon = async () => {
    if (selectedIcon && hasPermission('manage_server')) {
      setLoading(true)
      try {
        if (server.icon) {
          await serverService.deleteServerIcon(server.icon)
        }
        
        const iconUrl = await serverService.uploadServerIcon(selectedIcon, server.id)
        await onUpdateServer({ icon: iconUrl })
        
        setSelectedIcon(null)
        setPreviewUrl(null)
        setIconError('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error: any) {
        setIconError(error.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setIconError('Image must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      setIconError('File must be an image')
      return
    }

    setSelectedIcon(file)
    setIconError('')
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveIcon = () => {
    setSelectedIcon(null)
    setPreviewUrl(null)
    setIconError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCreateChannelWithPermissions = async (name: string, type: 'text' | 'voice', categoryId: string, permissions: ChannelPermission[]) => {
    try {
      await serverService.createChannelWithPermissions(server.id, name, type, categoryId, permissions)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleUpdateChannel = async (channelId: string, updates: Partial<Channel>) => {
    try {
      await serverService.updateChannelWithPermissions(server.id, channelId, updates)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleDeleteChannelAdvanced = async (channelId: string) => {
    try {
      await serverService.deleteChannel(server.id, channelId)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleCreateCategory = async (name: string, permissions: ChannelPermission[]) => {
    try {
      await serverService.createCategory(server.id, name, permissions)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleUpdateCategory = async (categoryId: string, updates: Partial<Category>) => {
    try {
      await serverService.updateCategory(server.id, categoryId, updates)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await serverService.deleteCategory(server.id, categoryId)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleCreateRole = async (name: string, color: string, permissions: string[]) => {
    try {
      await serverService.createRole(server.id, name, color, permissions)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleUpdateRole = async (roleId: string, updates: Partial<Role>) => {
    try {
      await serverService.updateRole(server.id, roleId, updates)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    try {
      await serverService.deleteRole(server.id, roleId)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleReorderRoles = async (roles: Role[]) => {
    try {
      await serverService.reorderRoles(server.id, roles)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  const handleToggleDisplayRoles = async () => {
    const newValue = !displayRolesSeparately
    setDisplayRolesSeparately(newValue)
    try {
      await onUpdateServer({ displayRolesSeparately: newValue })
    } catch (error) {
      console.error('Failed to update display roles setting:', error)
      setDisplayRolesSeparately(!newValue)
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
                disabled={serverName.trim() === server.name && !selectedIcon || !hasPermission('manage_server') || loading}
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
              <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-slate-600 rounded-2xl flex items-center justify-center overflow-hidden relative`}>
                {previewUrl || server.icon ? (
                  <img 
                    src={previewUrl || server.icon} 
                    alt="Server Icon" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>
                    {server.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!hasPermission('manage_server') || loading}
                  className="px-3 py-2 md:px-4 md:py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
                >
                  Upload Image
                </button>
                {selectedIcon && (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdateServerIcon}
                      disabled={loading}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-xs"
                    >
                      Save Icon
                    </button>
                    <button
                      onClick={handleRemoveIcon}
                      disabled={loading}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded text-xs"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconSelect}
                disabled={loading}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Recommended size: 512x512px, max 5MB
            </p>
            {iconError && (
              <p className="text-xs text-red-400 mt-1">{iconError}</p>
            )}
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
        <h3 className={`${isMobile ? 'text-lg' : 'text-lg'} font-semibold text-white mb-3 md:mb-4`}>Channel Management</h3>
        
        <ChannelManager
          channels={server.channels}
          categories={server.categories}
          roles={server.roles}
          userRoles={userRoles}
          isOwner={isOwner}
          onCreateChannel={handleCreateChannelWithPermissions}
          onUpdateChannel={handleUpdateChannel}
          onDeleteChannel={handleDeleteChannelAdvanced}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          isMobile={isMobile}
        />
      </div>
    </div>
  )

  const renderRolesSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
          Role Management
        </h3>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={displayRolesSeparately}
              onChange={handleToggleDisplayRoles}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
              Display roles separately from online members
            </span>
          </label>
        </div>
      </div>

      <RoleManager
        roles={server.roles}
        userRoles={userRoles}
        onCreateRole={handleCreateRole}
        onUpdateRole={handleUpdateRole}
        onDeleteRole={handleDeleteRole}
        onReorderRoles={handleReorderRoles}
        isMobile={isMobile}
        isOwner={isOwner}
      />
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
        return renderRolesSettings()
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