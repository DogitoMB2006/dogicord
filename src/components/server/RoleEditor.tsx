
import { useState } from 'react'
import type { Role, Permission } from '../../types/permissions'
import { PERMISSIONS, ROLE_COLORS } from '../../types/permissions'

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

  const isEditing = role !== null
  const isProtectedRole = role?.name === '@everyone' || role?.name === 'Owner'

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return userRoles.some(userRole => 
      userRole.permissions.includes('administrator') || 
      userRole.permissions.includes(permission)
    )
  }

  const canEditPermission = (permission: string): boolean => {
    if (isOwner) return true
    if (permission === 'administrator') return false
    return hasPermission(permission)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
          {isEditing ? `Edit Role: ${role.name}` : 'Create Role'}
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
              disabled={loading}
              className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${
                isMobile ? 'text-sm' : 'text-base'
              }`}
              placeholder="Enter role name"
              maxLength={32}
            />
            <p className={`text-gray-500 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>
              {name.length}/32
            </p>
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
                  disabled={loading}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === roleColor ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: roleColor }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="mentionable"
              checked={mentionable}
              onChange={(e) => setMentionable(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="mentionable" className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
              Allow anyone to @mention this role
            </label>
          </div>
        </div>
      )}

      <div>
        <h4 className={`font-medium text-white mb-3 ${isMobile ? 'text-base' : 'text-lg'}`}>
          Permissions
        </h4>
        
        {permissions.includes('administrator') && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <p className={`text-yellow-300 ${isMobile ? 'text-sm' : 'text-sm'}`}>
              This role has Administrator permission, which grants all permissions.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
            <div key={category} className="space-y-2">
              <h5 className={`font-medium text-gray-300 uppercase tracking-wide ${
                isMobile ? 'text-xs' : 'text-sm'
              }`}>
                {category.replace('_', ' ')} Permissions
              </h5>
              
              <div className="space-y-2">
                {categoryPermissions.map((permission) => {
                  const isChecked = permissions.includes(permission.id)
                  const isDisabled = !canEditPermission(permission.id) || 
                    (permissions.includes('administrator') && permission.id !== 'administrator')
                  
                  return (
                    <div
                      key={permission.id}
                      className={`flex items-start space-x-3 p-3 bg-gray-750 rounded-lg ${
                        isDisabled ? 'opacity-50' : 'hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={permission.id}
                        checked={isChecked}
                        onChange={() => handlePermissionToggle(permission.id)}
                        disabled={loading || isDisabled}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <label 
                          htmlFor={permission.id} 
                          className={`font-medium text-white cursor-pointer ${
                            isMobile ? 'text-sm' : 'text-base'
                          }`}
                        >
                          {permission.name}
                        </label>
                        <p className={`text-gray-400 mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {permission.description}
                        </p>
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
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row space-x-3'} pt-4 border-t border-gray-700`}>
        {onDelete && !isProtectedRole && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className={`${isMobile ? 'w-full' : 'flex-1'} py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors ${
              isMobile ? 'text-sm' : 'text-base'
            }`}
          >
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
          disabled={loading || !name.trim()}
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
            isEditing ? 'Save Changes' : 'Create Role'
          )}
        </button>
      </div>
    </div>
  )
}