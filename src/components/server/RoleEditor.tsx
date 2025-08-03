import { useState } from 'react'
import type { Role, Permission } from '../../types/permissions'
import { PERMISSIONS, ROLE_COLORS, canManageRole } from '../../types/permissions'
import { permissionService } from '../../services/permissionService'

interface RoleEditorProps {
  role: Role | null
  userRoles: Role[]
  isOwner: boolean
  onSave: (nameOrUpdates: string | Partial<Role>, color?: string, permissions?: string[]) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  isMobile: boolean
}

export default function RoleEditor({
  role,
  userRoles,
  isOwner,
  onSave,
  onCancel,
  onDelete,
  isMobile
}: RoleEditorProps) {
  const [name, setName] = useState(role?.name || '')
  const [color, setColor] = useState(role?.color || ROLE_COLORS[0])
  const [permissions, setPermissions] = useState<string[]>(role?.permissions || [])
  const [mentionable, setMentionable] = useState(role?.mentionable || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']))

  const isEditing = role !== null
  const isProtectedRole = role?.name === '@everyone' || role?.name === 'Owner'

  const canEditRole = (): boolean => {
    if (isOwner) return true
    if (!role) return permissionService.hasServerPermission(userRoles, 'manage_roles')
    return canManageRole(userRoles, role, isOwner)
  }

  const canEditPermission = (permission: string): boolean => {
    if (isOwner) return true
    if (permission === 'administrator') return isOwner
    
    return permissionService.hasServerPermission(userRoles, permission) || 
           permissionService.hasServerPermission(userRoles, 'administrator')
  }

  const groupedPermissions = PERMISSIONS.reduce((groups, permission) => {
    if (!groups[permission.category]) {
      groups[permission.category] = []
    }
    groups[permission.category].push(permission)
    return groups
  }, {} as Record<string, Permission[]>)

  const handlePermissionToggle = (permissionId: string) => {
    if (!canEditPermission(permissionId)) return

    if (permissionId === 'administrator') {
      if (permissions.includes('administrator')) {
        setPermissions([])
      } else {
        setPermissions(['administrator'])
      }
    } else {
      if (permissions.includes('administrator')) return

      setPermissions(prev => 
        prev.includes(permissionId)
          ? prev.filter(p => p !== permissionId)
          : [...prev, permissionId]
      )
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Role name is required')
      return
    }

    if (name.trim().length > 32) {
      setError('Role name must be 32 characters or less')
      return
    }

    if (!canEditRole()) {
      setError('You do not have permission to manage this role')
      return
    }

    const validation = permissionService.validateRolePermissions(userRoles, permissions, isOwner)
    if (!validation.valid) {
      setError(`You cannot assign these permissions: ${validation.invalidPermissions.join(', ')}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isEditing) {
        const updates: Partial<Role> = {}
        if (!isProtectedRole) {
          updates.name = name.trim()
          updates.color = color
          updates.permissions = permissions
          updates.mentionable = mentionable
        } else if (role.name === '@everyone') {
          updates.permissions = permissions
        }
        await onSave(updates)
      } else {
        await onSave(name.trim(), color, permissions)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || isProtectedRole) return
    
    if (!canEditRole()) {
      setError('You do not have permission to delete this role')
      return
    }
    
    if (confirm(`Are you sure you want to delete the "${role?.name}" role?`)) {
      setLoading(true)
      try {
        await onDelete()
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const getPermissionIcon = (permissionId: string) => {
    const hasPermission = permissions.includes(permissionId)
    const canEdit = canEditPermission(permissionId)
    const isAdminOverride = permissions.includes('administrator') && permissionId !== 'administrator'
    
    if (isAdminOverride) {
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
        </div>
      )
    }
    
    if (hasPermission) {
      return (
        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    }
    
    if (!canEdit) {
      return (
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
        </svg>
      )
    }
    
    return (
      <div className="w-5 h-5 border-2 border-gray-400 rounded"></div>
    )
  }

  const getPermissionTooltip = (permissionId: string): string => {
    const canEdit = canEditPermission(permissionId)
    const isAdminOverride = permissions.includes('administrator') && permissionId !== 'administrator'
    
    if (isAdminOverride) {
      return 'Granted by Administrator permission'
    }
    
    if (!canEdit) {
      return 'You do not have this permission to grant'
    }
    
    return ''
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      general: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      channels: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
      members: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
      voice: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
      advanced: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    }
    
    return icons[category] || icons.general
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'text-blue-400',
      channels: 'text-green-400',
      members: 'text-purple-400',
      voice: 'text-orange-400',
      advanced: 'text-red-400'
    }
    
    return colors[category] || colors.general
  }

  const getPermissionCount = (category: string) => {
    const categoryPermissions = groupedPermissions[category] || []
    const enabledCount = categoryPermissions.filter(perm => 
      permissions.includes(perm.id) || 
      (permissions.includes('administrator') && perm.id !== 'administrator')
    ).length
    
    return `${enabledCount}/${categoryPermissions.length}`
  }

  if (!canEditRole() && isEditing) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
          <p className="text-gray-400 mb-4">You cannot manage this role due to role hierarchy restrictions.</p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
            {isEditing ? `Edit Role: ${role.name}` : 'Create Role'}
          </h3>
          {isEditing && (
            <p className="text-gray-400 text-sm mt-1">
              Position #{role.position} • Created {role.createdAt instanceof Date ? role.createdAt.toLocaleDateString() : new Date(role.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
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

      {!permissionService.hasServerPermission(userRoles, 'manage_roles', isOwner) && (
        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-300 text-sm">
              You don't have permission to manage roles. Only viewing is allowed.
            </p>
          </div>
        </div>
      )}

      {!isProtectedRole && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              ROLE NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || !canEditRole()}
              className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${
                isMobile ? 'text-sm' : 'text-base'
              }`}
              placeholder="Enter role name"
              maxLength={32}
            />
            <div className="flex justify-between items-center mt-1">
              <p className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                {name.length}/32
              </p>
              {name.length > 20 && (
                <p className="text-yellow-400 text-xs">Consider a shorter name</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              ROLE COLOR
            </label>
            <div className={`grid gap-2 ${isMobile ? 'grid-cols-6' : 'grid-cols-9'}`}>
              {ROLE_COLORS.map((roleColor) => (
                <button
                  key={roleColor}
                  type="button"
                  onClick={() => setColor(roleColor)}
                  disabled={loading || !canEditRole()}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === roleColor ? 'border-white scale-110 ring-2 ring-white/30' : 'border-gray-600 hover:border-gray-400'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ backgroundColor: roleColor }}
                  title={roleColor}
                />
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Selected: {color}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="mentionable"
              checked={mentionable}
              onChange={(e) => setMentionable(e.target.checked)}
              disabled={loading || !canEditRole()}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50"
            />
            <label htmlFor="mentionable" className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
              Allow anyone to @mention this role
            </label>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`font-medium text-white ${isMobile ? 'text-base' : 'text-lg'}`}>
            Permissions
          </h4>
          <div className="text-xs text-gray-400">
            {permissions.filter(p => p !== 'administrator').length + (permissions.includes('administrator') ? PERMISSIONS.length : 0)} permissions enabled
          </div>
        </div>
        
        {permissions.includes('administrator') && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className={`text-yellow-300 ${isMobile ? 'text-sm' : 'text-sm'}`}>
                This role has Administrator permission, which grants all permissions automatically.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
            <div key={category} className="border border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <svg className={`w-5 h-5 ${getCategoryColor(category)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getCategoryIcon(category)} />
                  </svg>
                  <h5 className={`font-medium text-white uppercase tracking-wide ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    {category.replace('_', ' ')} Permissions
                  </h5>
                  <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                    {getPermissionCount(category)}
                  </span>
                </div>
                
                <svg 
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedCategories.has(category) ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedCategories.has(category) && (
                <div className="bg-gray-800 border-t border-gray-600">
                  <div className="p-3 space-y-2">
                    {categoryPermissions.map((permission) => {
                      const canEdit = canEditPermission(permission.id)
                      const isAdminOverride = permissions.includes('administrator') && permission.id !== 'administrator'
                      const tooltip = getPermissionTooltip(permission.id)
                      
                      return (
                        <div
                          key={permission.id}
                          className={`flex items-start space-x-3 p-3 bg-gray-750 rounded-lg transition-all ${
                            canEdit && canEditRole() ? 'hover:bg-gray-700 cursor-pointer' : 'opacity-75'
                          }`}
                          onClick={() => canEdit && canEditRole() && handlePermissionToggle(permission.id)}
                          title={tooltip}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {getPermissionIcon(permission.id)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <label 
                                className={`font-medium text-white cursor-pointer ${
                                  isMobile ? 'text-sm' : 'text-base'
                                } ${!canEdit ? 'opacity-60' : ''}`}
                              >
                                {permission.name}
                              </label>
                              {permission.id === 'administrator' && (
                                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-medium">
                                  DANGEROUS
                                </span>
                              )}
                              {permission.id === 'manage_server' && (
                                <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded font-medium">
                                  ELEVATED
                                </span>
                              )}
                            </div>
                            <p className={`text-gray-400 mt-1 ${isMobile ? 'text-xs' : 'text-sm'} ${!canEdit ? 'opacity-60' : ''}`}>
                              {permission.description}
                            </p>
                            {!canEdit && (
                              <p className="text-yellow-400 text-xs mt-1 flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6V7m0 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>You don't have this permission to grant</span>
                              </p>
                            )}
                            {isAdminOverride && (
                              <p className="text-yellow-400 text-xs mt-1 flex items-center space-x-1">
                                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                                <span>Automatically granted by Administrator</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
          <h5 className={`font-medium text-blue-300 mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
            Permission Guidelines
          </h5>
          <ul className={`text-blue-200 space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <li>• You can only grant permissions that you have</li>
            <li>• Administrator permission overrides all other permissions</li>
            <li>• Role hierarchy determines which roles can manage others</li>
            <li>• Protected roles (@everyone, Owner) have limited editing</li>
            <li>• Higher position roles can manage lower position roles</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row space-x-3'} pt-4 border-t border-gray-700`}>
        {onDelete && !isProtectedRole && canEditRole() && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className={`${isMobile ? 'w-full' : 'flex-1'} py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Role
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
          disabled={loading || !name.trim() || !canEditRole()}
          className={`${isMobile ? 'w-full' : 'flex-1'} py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center ${
            isMobile ? 'text-sm' : 'text-base'
          }`}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isEditing ? 'Save Changes' : 'Create Role'}
            </>
          )}
        </button>
      </div>
    </div>
  )}