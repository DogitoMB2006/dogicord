import { useState } from 'react'
import type { Role } from '../../types/permissions'

interface RoleAssignmentProps {
  availableRoles: Role[]
  userRoles: Role[]
  targetUserId: string
  targetUsername: string
  currentUserRoles: Role[]
  isOwner: boolean
  onAssignRole: (userId: string, roleId: string) => Promise<void>
  onRemoveRole: (userId: string, roleId: string) => Promise<void>
  onClose: () => void
  isMobile: boolean
}

export default function RoleAssignment({
  availableRoles,
  userRoles,
  targetUserId,
  targetUsername,
  currentUserRoles,
  isOwner,
  onAssignRole,
  onRemoveRole,
  onClose,
  isMobile
}: RoleAssignmentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canManageRole = (role: Role): boolean => {
    if (isOwner) return true
    if (role.name === '@everyone' || role.name === 'Owner') return false
    
    const currentUserHighestPosition = Math.max(...currentUserRoles.map(r => r.position))
    return currentUserHighestPosition > role.position && hasPermission('manage_roles')
  }

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return currentUserRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const handleToggleRole = async (role: Role) => {
    if (!canManageRole(role) || loading) return

    setLoading(true)
    setError('')

    try {
      const hasRole = userRoles.some(r => r.id === role.id)
      
      if (hasRole) {
        await onRemoveRole(targetUserId, role.id)
      } else {
        await onAssignRole(targetUserId, role.id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const assignableRoles = availableRoles
    .filter(role => role.name !== '@everyone')
    .filter(role => canManageRole(role))
    .sort((a, b) => b.position - a.position)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-base' : 'text-lg'}`}>
          Manage Roles for {targetUsername}
        </h3>
        <button
          onClick={onClose}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-white disabled:text-gray-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3">
          {error}
        </div>
      )}

      {assignableRoles.length === 0 ? (
        <div className="text-center py-8">
          <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
            No roles available to assign
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignableRoles.map((role) => {
            const hasRole = userRoles.some(r => r.id === role.id)
            
            return (
              <div
                key={role.id}
                className={`flex items-center justify-between p-3 bg-gray-750 rounded-lg border transition-all ${
                  hasRole ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-white truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {role.name}
                    </h4>
                    <p className={`text-gray-400 truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {role.permissions.length} permissions • Position #{role.position}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleRole(role)}
                  disabled={loading}
                  className={`px-3 py-1 rounded-lg transition-colors flex items-center space-x-1 ${
                    hasRole
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed ${
                    isMobile ? 'text-sm' : 'text-sm'
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {hasRole ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        )}
                      </svg>
                      <span>{hasRole ? 'Remove' : 'Add'}</span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="pt-4 border-t border-gray-700">
        <h4 className={`font-medium text-white mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
          Current Roles
        </h4>
        {userRoles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {userRoles
              .filter(role => role.name !== '@everyone')
              .sort((a, b) => b.position - a.position)
              .map((role) => (
                <div
                  key={role.id}
                  className={`px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}
                  style={{ 
                    backgroundColor: `${role.color}20`,
                    color: role.color,
                    border: `1px solid ${role.color}40`
                  }}
                >
                  {role.name}
                </div>
              ))}
          </div>
        ) : (
          <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
            Only @everyone role
          </p>
        )}
      </div>

      <div className="pt-4">
        <button
          onClick={onClose}
          disabled={loading}
          className={`w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors ${
            isMobile ? 'text-sm' : 'text-base'
          }`}
        >
          Done
        </button>
      </div>
    </div>
  )
}