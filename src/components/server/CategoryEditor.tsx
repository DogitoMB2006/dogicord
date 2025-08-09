import { useState } from 'react'
import type { Category, ChannelPermission, ChannelPermissionType } from '../../types/channels'
import type { Role } from '../../types/permissions'
import { CHANNEL_PERMISSION_INFO } from '../../types/channels'

interface CategoryEditorProps {
  category: Category | null
  roles: Role[]
  userRoles: Role[]
  isOwner: boolean
  onSave: (updates: Partial<Category>) => Promise<void>
  onCreate: (name: string, permissions: ChannelPermission[]) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  isMobile: boolean
}

export default function CategoryEditor({
  category,
  roles,
  userRoles,
  isOwner,
  onSave,
  onCreate,
  onCancel,
  onDelete,
  isMobile
}: CategoryEditorProps) {
  const [name, setName] = useState(category?.name || '')
  const [permissions, setPermissions] = useState<ChannelPermission[]>(category?.permissions || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEditing = category !== null

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Category name is required')
      return
    }

    if (name.trim().length > 100) {
      setError('Category name must be 100 characters or less')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isEditing) {
        const updates: Partial<Category> = {
          name: name.trim(),
          permissions
        }
        await onSave(updates)
      } else {
        await onCreate(name.trim(), permissions)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !isEditing) return
    
    if (confirm(`Are you sure you want to delete the "${category?.name}" category? All channels in this category will become uncategorized.`)) {
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



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
          {isEditing ? `Edit Category: ${category.name}` : 'Create Category'}
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
            CATEGORY NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
            placeholder="Enter category name"
            maxLength={100}
          />
          <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>
            {name.length}/100
          </p>
        </div>

        <div>
          <h4 className={`font-medium text-white mb-3 ${isMobile ? 'text-base' : 'text-lg'}`}>
            Default Permissions
          </h4>
          <p className={`text-gray-400 mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}>
            These permissions will be applied to all channels in this category by default.
          </p>
          
          <div className="space-y-4">
            {roles
              .sort((a, b) => b.position - a.position)
              .map((role) => (
                <div key={role.id} className="border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <h5 className={`font-medium text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {role.name}
                    </h5>
                  </div>

                  <div className="space-y-2">
                    {CHANNEL_PERMISSION_INFO.map((permInfo) => {
                      const currentState = getRolePermission(role.id, permInfo.id)
                      const canEdit = hasPermission('manage_channels')
                      
                      return (
                        <div key={permInfo.id} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className={`text-white font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                              {permInfo.name}
                            </p>
                            <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                              {permInfo.description}
                            </p>
                          </div>

                          <div className="flex space-x-1">
                            <button
                              onClick={() => updateRolePermission(role.id, permInfo.id, 'allow')}
                              disabled={!canEdit}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                currentState === 'allow'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-green-600 disabled:opacity-50'
                              }`}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => updateRolePermission(role.id, permInfo.id, 'inherit')}
                              disabled={!canEdit}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                currentState === 'inherit'
                                  ? 'bg-gray-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                              }`}
                            >
                              /
                            </button>
                            <button
                              onClick={() => updateRolePermission(role.id, permInfo.id, 'deny')}
                              disabled={!canEdit}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                currentState === 'deny'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-red-600 disabled:opacity-50'
                              }`}
                            >
                              ✗
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg">
            <h5 className={`font-medium text-purple-300 mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
              Category Permissions
            </h5>
            <p className={`text-purple-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              These permissions will be inherited by all channels created in this category. Individual channels can override these settings.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row space-x-3'} pt-4 border-t border-gray-700`}>
        {onDelete && isEditing && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className={`${isMobile ? 'w-full' : 'flex-1'} py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
          >
            Delete Category
          </button>
        )}
        
        <button
          onClick={onCancel}
          disabled={loading}
          className={`${isMobile ? 'w-full' : 'flex-1'} py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors ${
            isMobile ? 'text-sm' : 'text-base'
          }`}
        >
          Cancel
        </button>
        
        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className={`${isMobile ? 'w-full' : 'flex-1'} py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center ${
            isMobile ? 'text-sm' : 'text-base'
          }`}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : (
            isEditing ? 'Save Changes' : 'Create Category'
          )}
        </button>
      </div>
    </div>
  )
}