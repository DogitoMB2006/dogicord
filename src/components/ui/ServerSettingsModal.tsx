import { useState, useRef } from 'react'
import type { Server } from '../../services/serverService'
import type { Role } from '../../types/permissions'
import type { Channel, Category, ChannelPermission } from '../../types/channels'
import { serverService } from '../../services/serverService'
import { permissionService } from '../../services/permissionService'
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

type SettingsTab = 'general' | 'channels' | 'roles' | 'members' | 'integrations' | 'safety'

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
  const { canAccess, availableTabs } = permissionService.canAccessServerSettings(userRoles, isOwner)

  if (!canAccess) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-4">You don't have permission to access server settings.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!availableTabs.includes(activeTab)) {
    setActiveTab(availableTabs[0] as SettingsTab)
  }

  const handleUpdateServerName = async () => {
    if (serverName.trim() !== server.name && permissionService.hasServerPermission(userRoles, 'manage_server', isOwner)) {
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
    if (selectedIcon && permissionService.hasServerPermission(userRoles, 'manage_server', isOwner)) {
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
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleUpdateChannel = async (channelId: string, updates: Partial<Channel>) => {
    try {
      await serverService.updateChannelWithPermissions(server.id, channelId, updates)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleDeleteChannelAdvanced = async (channelId: string) => {
    try {
      await serverService.deleteChannel(server.id, channelId)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleCreateCategory = async (name: string, permissions: ChannelPermission[]) => {
    try {
      await serverService.createCategory(server.id, name, permissions)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleUpdateCategory = async (categoryId: string, updates: Partial<Category>) => {
    try {
      await serverService.updateCategory(server.id, categoryId, updates)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await serverService.deleteCategory(server.id, categoryId)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleCreateRole = async (name: string, color: string, permissions: string[]) => {
    try {
      const validation = permissionService.validateRolePermissions(userRoles, permissions, isOwner)
      if (!validation.valid) {
        throw new Error(`You cannot assign these permissions: ${validation.invalidPermissions.join(', ')}`)
      }
      
      await serverService.createRole(server.id, name, color, permissions)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleUpdateRole = async (roleId: string, updates: Partial<Role>) => {
    try {
      if (updates.permissions) {
        const validation = permissionService.validateRolePermissions(userRoles, updates.permissions, isOwner)
        if (!validation.valid) {
          throw new Error(`You cannot assign these permissions: ${validation.invalidPermissions.join(', ')}`)
        }
      }
      
      await serverService.updateRole(server.id, roleId, updates)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    try {
      await serverService.deleteRole(server.id, roleId)
      // Real-time listener will automatically update the state
    } catch (error: any) {
      throw error
    }
  }

  const handleReorderRoles = async (roles: Role[]) => {
    try {
      await serverService.reorderRoles(server.id, roles)
      // Real-time listener will automatically update the state
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
                disabled={!permissionService.hasServerPermission(userRoles, 'manage_server', isOwner) || loading}
                className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-800 disabled:cursor-not-allowed text-sm md:text-base"
                maxLength={50}
              />
              <button
                onClick={handleUpdateServerName}
                disabled={serverName.trim() === server.name && !selectedIcon || !permissionService.hasServerPermission(userRoles, 'manage_server', isOwner) || loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
            {!permissionService.hasServerPermission(userRoles, 'manage_server', isOwner) && (
              <p className="text-xs text-yellow-400 mt-1">You don't have permission to manage server settings</p>
            )}
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
                  disabled={!permissionService.hasServerPermission(userRoles, 'manage_server', isOwner) || loading}
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
                disabled={!permissionService.canCreateInvite(userRoles, isOwner)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                Copy
              </button>
            </div>
            {!permissionService.canCreateInvite(userRoles, isOwner) && (
              <p className="text-xs text-yellow-400 mt-1">You don't have permission to create invites</p>
            )}
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Server Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Owner</p>
                <p className="text-white">{isOwner ? 'You' : 'Another user'}</p>
              </div>
              <div>
                <p className="text-gray-400">Members</p>
                <p className="text-white">{server.members.length}</p>
              </div>
              <div>
                <p className="text-gray-400">Channels</p>
                <p className="text-white">{server.channels.length}</p>
              </div>
              <div>
                <p className="text-gray-400">Roles</p>
                <p className="text-white">{server.roles.length}</p>
              </div>
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
              disabled={!permissionService.hasServerPermission(userRoles, 'manage_server', isOwner)}
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

  const renderMembersSettings = () => (
    <div className="space-y-4">
      <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
        Member Management
      </h3>
      
      <div className="grid gap-4">
        <div className="p-4 bg-gray-750 rounded-lg border border-gray-600">
          <h4 className="font-medium text-white mb-2">Your Permissions</h4>
          <div className="space-y-1 text-sm">
            {permissionService.hasServerPermission(userRoles, 'kick_members', isOwner) && (
              <p className="text-green-400">✓ Can kick members</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'ban_members', isOwner) && (
              <p className="text-green-400">✓ Can ban members</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'timeout_members', isOwner) && (
              <p className="text-green-400">✓ Can timeout members</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'moderate_members', isOwner) && (
              <p className="text-green-400">✓ Can moderate members</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'manage_nicknames', isOwner) && (
              <p className="text-green-400">✓ Can manage nicknames</p>
            )}
            {!permissionService.hasServerPermission(userRoles, 'kick_members', isOwner) &&
             !permissionService.hasServerPermission(userRoles, 'ban_members', isOwner) &&
             !permissionService.hasServerPermission(userRoles, 'timeout_members', isOwner) &&
             !permissionService.hasServerPermission(userRoles, 'moderate_members', isOwner) &&
             !permissionService.hasServerPermission(userRoles, 'manage_nicknames', isOwner) && (
              <p className="text-gray-400">No member management permissions</p>
            )}
          </div>
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-400">Advanced member management coming soon...</p>
        </div>
      </div>
    </div>
  )

  const renderIntegrationsSettings = () => (
    <div className="space-y-4">
      <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
        Integrations
      </h3>
      
      <div className="grid gap-4">
        <div className="p-4 bg-gray-750 rounded-lg border border-gray-600">
          <h4 className="font-medium text-white mb-2">Webhook Management</h4>
          {permissionService.hasServerPermission(userRoles, 'manage_webhooks', isOwner) ? (
            <p className="text-green-400 text-sm">✓ You can manage webhooks</p>
          ) : (
            <p className="text-red-400 text-sm">✗ You cannot manage webhooks</p>
          )}
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-400">Webhooks and integrations coming soon...</p>
        </div>
      </div>
    </div>
  )

  const renderSafetySettings = () => (
    <div className="space-y-4">
      <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
        Safety Setup
      </h3>
      
      <div className="grid gap-4">
        <div className="p-4 bg-gray-750 rounded-lg border border-gray-600">
          <h4 className="font-medium text-white mb-2">Audit Log Access</h4>
          {permissionService.hasServerPermission(userRoles, 'view_audit_log', isOwner) ? (
            <p className="text-green-400 text-sm">✓ You can view server audit logs</p>
          ) : (
            <p className="text-red-400 text-sm">✗ You cannot view server audit logs</p>
          )}
        </div>

        <div className="p-4 bg-gray-750 rounded-lg border border-gray-600">
          <h4 className="font-medium text-white mb-2">Moderation Tools</h4>
          <div className="space-y-1 text-sm">
            {permissionService.hasServerPermission(userRoles, 'moderate_members', isOwner) && (
              <p className="text-green-400">✓ Full moderation access</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'kick_members', isOwner) && (
              <p className="text-green-400">✓ Can kick members</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'ban_members', isOwner) && (
              <p className="text-green-400">✓ Can ban members</p>
            )}
            {permissionService.hasServerPermission(userRoles, 'timeout_members', isOwner) && (
              <p className="text-green-400">✓ Can timeout members</p>
            )}
          </div>
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-400">Advanced safety features coming soon...</p>
        </div>
      </div>
    </div>
  )

  const renderMobileNav = () => {
    if (!isMobile) return null

    return (
      <div className="flex border-b border-gray-700 bg-gray-750 overflow-x-auto">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as SettingsTab)}
            className={`flex-shrink-0 py-3 px-4 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'text-white border-b-2 border-slate-500 bg-gray-800'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
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
          {availableTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as SettingsTab)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-slate-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
        return renderMembersSettings()
      case 'integrations':
        return renderIntegrationsSettings()
      case 'safety':
        return renderSafetySettings()
      default:
        return <div className="text-gray-400 text-center py-8">This section is coming soon...</div>
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