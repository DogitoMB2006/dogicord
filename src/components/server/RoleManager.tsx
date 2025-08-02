import { useState, useRef } from 'react'
import type { Role } from '../../types/permissions'
import RoleEditor from './RoleEditor'

interface RoleManagerProps {
  roles: Role[]
  userRoles: Role[]
  onCreateRole: (name: string, color: string, permissions: string[]) => Promise<void>
  onUpdateRole: (roleId: string, updates: Partial<Role>) => Promise<void>
  onDeleteRole: (roleId: string) => Promise<void>
  onReorderRoles: (roles: Role[]) => Promise<void>
  isMobile: boolean
  isOwner: boolean
}

export default function RoleManager({
  roles,
  userRoles,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onReorderRoles,
  isMobile,
  isOwner
}: RoleManagerProps) {
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [draggedRole, setDraggedRole] = useState<Role | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1)
  const dragItemRef = useRef<HTMLDivElement>(null)

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const canManageRole = (role: Role): boolean => {
    if (isOwner) return true
    if (role.name === '@everyone' || role.name === 'Owner') return false
    
    const userHighestPosition = Math.max(...userRoles.map(r => r.position))
    return userHighestPosition > role.position && hasPermission('manage_roles')
  }

  const sortedRoles = [...roles].sort((a, b) => b.position - a.position)

  const handleDragStart = (e: React.DragEvent, role: Role) => {
    if (!canManageRole(role)) return
    setDraggedRole(role)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (!draggedRole) return
    setDragOverIndex(index)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (!draggedRole || !canManageRole(draggedRole)) return

    const newRoles = [...sortedRoles]
    const dragIndex = newRoles.findIndex(r => r.id === draggedRole.id)
    
    if (dragIndex === dropIndex) return

    newRoles.splice(dragIndex, 1)
    newRoles.splice(dropIndex, 0, draggedRole)

    const updatedRoles = newRoles.map((role, index) => ({
      ...role,
      position: newRoles.length - index
    }))

    try {
      await onReorderRoles(updatedRoles)
    } catch (error) {
      console.error('Failed to reorder roles:', error)
    }

    setDraggedRole(null)
    setDragOverIndex(-1)
  }

  const handleCreateRole = async (nameOrUpdates: string | Partial<Role>, color?: string, permissions?: string[]) => {
    if (typeof nameOrUpdates === 'string' && color && permissions) {
      try {
        await onCreateRole(nameOrUpdates, color, permissions)
        setShowCreateForm(false)
      } catch (error) {
        throw error
      }
    }
  }

  const handleUpdateRole = async (nameOrUpdates: string | Partial<Role>) => {
    if (!editingRole) return
    if (typeof nameOrUpdates === 'object') {
      try {
        await onUpdateRole(editingRole.id, nameOrUpdates)
        setEditingRole(null)
      } catch (error) {
        throw error
      }
    }
  }

  const handleDeleteRole = async () => {
    if (!editingRole) return
    try {
      await onDeleteRole(editingRole.id)
      setEditingRole(null)
    } catch (error) {
      throw error
    }
  }

  if (editingRole) {
    return (
      <RoleEditor
        role={editingRole}
        userRoles={userRoles}
        isOwner={isOwner}
        onSave={handleUpdateRole}
        onCancel={() => setEditingRole(null)}
        onDelete={handleDeleteRole}
        isMobile={isMobile}
      />
    )
  }

  if (showCreateForm) {
    return (
      <RoleEditor
        role={null}
        userRoles={userRoles}
        isOwner={isOwner}
        onSave={handleCreateRole}
        onCancel={() => setShowCreateForm(false)}
        isMobile={isMobile}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
          Roles
        </h3>
        {hasPermission('manage_roles') && (
          <button
            onClick={() => setShowCreateForm(true)}
            className={`px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ${
              isMobile ? 'text-sm' : 'text-sm'
            }`}
          >
            Create Role
          </button>
        )}
      </div>

      {!hasPermission('manage_roles') && (
        <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <p className={`text-yellow-300 ${isMobile ? 'text-sm' : 'text-sm'}`}>
            You don't have permission to manage roles
          </p>
        </div>
      )}

      <div className="space-y-2">
        {sortedRoles.map((role, index) => (
          <div
            key={role.id}
            ref={draggedRole?.id === role.id ? dragItemRef : null}
            draggable={canManageRole(role)}
            onDragStart={(e) => handleDragStart(e, role)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={`p-3 bg-gray-750 rounded-lg border transition-all ${
              dragOverIndex === index ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600'
            } ${
              canManageRole(role) ? 'cursor-move hover:bg-gray-700' : 'cursor-default'
            } ${
              draggedRole?.id === role.id ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {canManageRole(role) && (
                  <div className="text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </div>
                )}
                
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: role.color }}
                />
                
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-white truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                    {role.name}
                  </h4>
                  <p className={`text-gray-400 truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {role.permissions.length} permissions
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  #{role.position}
                </span>
                
                {canManageRole(role) && (
                  <button
                    onClick={() => setEditingRole(role)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sortedRoles.length === 0 && (
        <div className="text-center py-8">
          <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
            No roles found
          </p>
        </div>
      )}
    </div>
  )
}