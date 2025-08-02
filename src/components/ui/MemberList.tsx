// src/components/ui/MemberList.tsx
import { useState, useEffect } from 'react'
import { serverService } from '../../services/serverService'
import { authService } from '../../services/authService'
import type { Role } from '../../types/permissions'

interface Member {
  userId: string
  username: string
  avatar?: string
  roles: Role[]
  isOnline: boolean
}

interface RoleGroup {
  role: Role
  members: Member[]
}

interface MemberListProps {
  serverId: string
  serverMembers: string[]
  isOpen: boolean
  onClose?: () => void
  isMobile: boolean
  onUserClick: (userId: string) => void
  displayRolesSeparately?: boolean
  refreshTrigger?: number // Nueva prop para forzar actualización
}

export default function MemberList({ 
  serverId, 
  serverMembers, 
  isOpen, 
  onClose, 
  isMobile, 
  onUserClick,
  displayRolesSeparately = true,
  refreshTrigger
}: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && serverId) {
      loadMembers()
    }
  }, [isOpen, serverId, serverMembers, displayRolesSeparately, refreshTrigger])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const memberProfiles: Member[] = []
      
      for (const memberId of serverMembers) {
        const profile = await authService.getUserProfile(memberId)
        const userRoles = await serverService.getUserRoles(serverId, memberId)
        
        if (profile) {
          memberProfiles.push({
            userId: profile.uid,
            username: profile.username,
            avatar: (profile as any).avatar,
            roles: userRoles,
            isOnline: true
          })
        }
      }
      
      setMembers(memberProfiles)
      
      if (displayRolesSeparately) {
        organizeByRoles(memberProfiles)
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const organizeByRoles = (memberList: Member[]) => {
    const roleMap = new Map<string, RoleGroup>()
    
    memberList.forEach(member => {
      const highestRole = getHighestRole(member.roles)
      const roleId = highestRole.id
      
      if (!roleMap.has(roleId)) {
        roleMap.set(roleId, {
          role: highestRole,
          members: []
        })
      }
      
      roleMap.get(roleId)!.members.push(member)
    })
    
    const sortedGroups = Array.from(roleMap.values())
      .filter(group => group.role.name !== '@everyone')
      .sort((a, b) => b.role.position - a.role.position)
    
    const everyoneGroup = roleMap.get('everyone')
    if (everyoneGroup && everyoneGroup.members.length > 0) {
      sortedGroups.push({
        role: { ...everyoneGroup.role, name: 'Online' },
        members: everyoneGroup.members
      })
    }
    
    sortedGroups.forEach(group => {
      group.members.sort((a, b) => a.username.localeCompare(b.username))
    })
    
    setRoleGroups(sortedGroups)
  }

  const getHighestRole = (roles: Role[]): Role => {
    const nonEveryoneRoles = roles.filter(role => role.name !== '@everyone')
    if (nonEveryoneRoles.length === 0) {
      return roles.find(role => role.name === '@everyone') || roles[0]
    }
    
    return nonEveryoneRoles.reduce((highest, current) => 
      current.position > highest.position ? current : highest
    )
  }

  const getMemberCount = () => {
    if (displayRolesSeparately) {
      return roleGroups.reduce((total, group) => total + group.members.length, 0)
    }
    return members.filter(m => m.isOnline).length
  }

  if (!isOpen) return null

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-gray-800 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Members — {getMemberCount()}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayRolesSeparately ? (
                roleGroups.map((group, index) => (
                  <div key={`${group.role.id}-${index}`}>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: group.role.color }}
                      />
                      {group.role.name} — {group.members.length}
                    </h3>
                    <div className="space-y-2">
                      {group.members.map((member) => (
                        <div 
                          key={member.userId} 
                          onClick={() => onUserClick(member.userId)}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center overflow-hidden">
                              {member.avatar ? (
                                <img 
                                  src={member.avatar} 
                                  alt={member.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-white font-medium text-sm">
                                  {member.username.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{member.username}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Online — {members.filter(m => m.isOnline).length}
                  </h3>
                  <div className="space-y-2">
                    {members
                      .filter(m => m.isOnline)
                      .sort((a, b) => a.username.localeCompare(b.username))
                      .map((member) => (
                        <div 
                          key={member.userId} 
                          onClick={() => onUserClick(member.userId)}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center overflow-hidden">
                              {member.avatar ? (
                                <img 
                                  src={member.avatar} 
                                  alt={member.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-white font-medium text-sm">
                                  {member.username.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{member.username}</p>
                            {member.roles.length > 0 && (
                              <p className="text-xs text-gray-400 truncate">
                                {member.roles
                                  .filter(role => role.name !== '@everyone')
                                  .slice(0, 1)
                                  .map(role => role.name)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-60 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Members — {getMemberCount()}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {displayRolesSeparately ? (
              roleGroups.map((group, index) => (
                <div key={`${group.role.id}-${index}`}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-2 flex items-center">
                    <div 
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: group.role.color }}
                    />
                    {group.role.name} — {group.members.length}
                  </h3>
                  <div className="space-y-1">
                    {group.members.map((member) => (
                      <div 
                        key={member.userId} 
                        onClick={() => onUserClick(member.userId)}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <div className="relative">
                          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center overflow-hidden">
                            {member.avatar ? (
                              <img 
                                src={member.avatar} 
                                alt={member.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-medium text-xs">
                                {member.username.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{member.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-2">
                  Online — {members.filter(m => m.isOnline).length}
                </h3>
                <div className="space-y-1">
                  {members
                    .filter(m => m.isOnline)
                    .sort((a, b) => a.username.localeCompare(b.username))
                    .map((member) => (
                      <div 
                        key={member.userId} 
                        onClick={() => onUserClick(member.userId)}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <div className="relative">
                          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center overflow-hidden">
                            {member.avatar ? (
                              <img 
                                src={member.avatar} 
                                alt={member.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-medium text-xs">
                                {member.username.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{member.username}</p>
                          {member.roles.length > 0 && (
                            <p className="text-xs text-gray-400 truncate">
                              {member.roles
                                .filter(role => role.name !== '@everyone')
                                .slice(0, 1)
                                .map(role => role.name)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}