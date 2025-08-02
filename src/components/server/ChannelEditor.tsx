import { useState } from 'react'
import type { Channel, Category, ChannelPermission, ChannelPermissionType } from '../../types/channels'
import type { Role } from '../../types/permissions'
import { CHANNEL_PERMISSION_INFO } from '../../types/channels'

interface ChannelEditorProps {
  channel: Channel | null
  categories: Category[]
  roles: Role[]
  userRoles: Role[]
  isOwner: boolean
  selectedCategoryId?: string
  onSave: (updates: Partial<Channel>) => Promise<void>
  onCreate: (name: string, type: 'text' | 'voice', categoryId: string, permissions: ChannelPermission[]) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  isMobile: boolean
}

export default function ChannelEditor({
  channel,
  categories,
  roles,
  userRoles,
  isOwner,
  selectedCategoryId = '',
  onSave,
  onCreate,
  onCancel,
  onDelete,
  isMobile
}: ChannelEditorProps) {
  const [name, setName] = useState(channel?.name || '')
  const [description, setDescription] = useState(channel?.description || '')
  const [type, setType] = useState<'text' | 'voice'>(channel?.type || 'text')
  const [categoryId, setCategoryId] = useState(channel?.categoryId || selectedCategoryId)
  const [permissions, setPermissions] = useState<ChannelPermission[]>(channel?.permissions || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEditing = channel !== null

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Channel name is required')
      return
    }

    if (name.trim().length > 100) {
      setError('Channel name must be 100 characters or less')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isEditing) {
        const updates: Partial<Channel> = {
          name: name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: description.trim() || undefined,
          categoryId,
          permissions
        }
        await onSave(updates)
      } else {
        await onCreate(
          name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'), 
          type, 
          categoryId, 
          permissions
        )
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !isEditing) return
    
    if (confirm(`Are you sure you want to delete the "${channel?.name}" channel?`)) {
      setLoading(true)
      try {
        await onDelete()
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }
  }

  const updateRolePermission = (roleId: string, permission: ChannelPermissionType, action: 'allow' | 'deny' | 'inherit') => {
    setPermissions(prev => {
      const existing = prev.find(p => p.roleId === roleId)
      
      if (action === 'inherit') {
        return prev.filter(p => p.roleId !== roleId)
      }

      if (existing) {
        return prev.map(p => {
          if (p.roleId === roleId) {
            const newAllow = p.allow.filter(perm => perm !== permission)
            const newDeny = p.deny.filter(perm => perm !== permission)
            
            if (action === 'allow') {
              newAllow.push(permission)
            } else {
              newDeny.push(permission)
            }

            return {
              ...p,
              allow: newAllow,
              deny: newDeny
            }
          }
          return p
        })
      } else {
        return [...prev, {
          roleId,
          allow: action === 'allow' ? [permission] : [],
          deny: action === 'deny' ? [permission] : []
        }]
      }
    })
  }

  const getRolePermission = (roleId: string, permission: ChannelPermissionType): 'allow' | 'deny' | 'inherit' => {
    const rolePerms = permissions.find(p => p.roleId === roleId)
    if (!rolePerms) return 'inherit'
    
    if (rolePerms.allow.includes(permission)) return 'allow'
    if (rolePerms.deny.includes(permission)) return 'deny'
    return 'inherit'
  }

  const getPermissionInfo = (permission: ChannelPermissionType) => {
    return CHANNEL_PERMISSION_INFO.find(p => p.id === permission)
  }

  const textPermissions: ChannelPermissionType[] = ['view_channel', 'send_messages', 'manage_messages', 'read_message_history']
  const voicePermissions: ChannelPermissionType[] = ['view_channel', 'use_voice_activity', 'speak', 'mute_members', 'deafen_members', 'move_members']
  const relevantPermissions = type === 'text' ? textPermissions : voicePermissions

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
          {isEditing ? `Edit Channel: ${channel.name}` : 'Create Channel'}
        </h3>
        <button
          onClick={onCancel}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-white disabled:text-gray-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            CHANNEL NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
            placeholder="Enter channel name"
            maxLength={100}
          />
          <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>
            {name.length}/100 • Lowercase letters, numbers, and dashes only
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            DESCRIPTION (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
            placeholder="What's this channel about?"
            rows={3}
            maxLength={1024}
          />
          <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>
            {description.length}/1024
          </p>
        </div>

        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CHANNEL TYPE
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="channelType"
                  value="text"
                  checked={type === 'text'}
                  onChange={(e) => setType(e.target.value as 'text')}
                  disabled={loading}
                  className="mr-2"
                />
                <span className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
                  # Text Channel
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="channelType"
                  value="voice"
                  checked={type === 'voice'}
                  onChange={(e) => setType(e.target.value as 'voice')}
                  disabled={loading}
                  className="mr-2"
                />
                <span className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
                  🔊 Voice Channel
                </span>
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            CATEGORY
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loading}
            className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
          >
            <option value="">No Category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">
            PERMISSIONS
          </h4>
          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="border border-gray-600 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className={`font-medium text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {role.name}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {relevantPermissions.map((permission) => {
                    const currentValue = getRolePermission(role.id, permission)
                    const permInfo = getPermissionInfo(permission)
                    const canEdit = hasPermission('manage_channels')
                    
                    return (
                      <div key={permission} className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
                            {permInfo?.name || permission}
                          </span>
                          <p className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                            {permInfo?.description || ''}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => updateRolePermission(role.id, permission, 'allow')}
                            disabled={loading || !canEdit}
                            className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                              currentValue === 'allow'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-green-600 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => updateRolePermission(role.id, permission, 'inherit')}
                            disabled={loading || !canEdit}
                            className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                              currentValue === 'inherit'
                                ? 'bg-gray-500 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            /
                          </button>
                          <button
                            onClick={() => updateRolePermission(role.id, permission, 'deny')}
                            disabled={loading || !canEdit}
                            className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                              currentValue === 'deny'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-red-600 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            X
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className={`flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className={`flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              isEditing ? 'Save Changes' : 'Create Channel'
            )}
          </button>
          {isEditing && onDelete && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className={`py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors ${
                isMobile ? 'text-sm' : 'text-base'
              }`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}