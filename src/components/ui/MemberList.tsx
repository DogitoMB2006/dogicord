// src/components/ui/MemberList.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { serverService } from '../../services/serverService'
import { authService } from '../../services/authService'
import { roleSyncService } from '../../services/roleSyncService'
import { presenceService } from '../../services/presenceService'
import type { Role } from '../../types/permissions'
import type { UserPresence } from '../../services/presenceService'

interface Member {
  userId: string
  username: string
  avatar?: string
  roles: Role[]
  isOnline: boolean
  lastSeen: Date
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
  refreshTrigger?: number
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
  const [loading, setLoading] = useState(true)

  const organizeByRoles = useCallback((memberList: Member[]): RoleGroup[] => {
    const roleMap = new Map<string, RoleGroup>()
    const onlineMembers: Member[] = []
    const offlineMembers: Member[] = []
    
    memberList.forEach(member => {
      if (member.isOnline) {
        onlineMembers.push(member)
      } else {
        offlineMembers.push(member)
      }
    })
    
    onlineMembers.forEach(member => {
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
    
    if (offlineMembers.length > 0) {
      sortedGroups.push({
        role: {
          id: 'offline',
          name: 'Offline',
          color: '#747F8D',
          permissions: [],
          position: -1,
          mentionable: false,
          createdAt: new Date()
        },
        members: offlineMembers.sort((a, b) => a.username.localeCompare(b.username))
      })
    }
    
    sortedGroups.forEach(group => {
      if (group.role.name !== 'Offline') {
        group.members.sort((a, b) => a.username.localeCompare(b.username))
      }
    })
    
    return sortedGroups
  }, [])

  const roleGroups = useMemo(() => {
    if (!displayRolesSeparately) return []
    return organizeByRoles(members)
  }, [members, displayRolesSeparately, organizeByRoles])

  const loadMembersData = useCallback(async () => {
    if (!serverId || !serverMembers.length) return
    
    setLoading(true)
    try {
      const memberProfiles: Member[] = []
      const batchSize = 10
      
      for (let i = 0; i < serverMembers.length; i += batchSize) {
        const batch = serverMembers.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (memberId) => {
          try {
            const [profile, userRoles, presence] = await Promise.all([
              authService.getUserProfile(memberId),
              serverService.getUserRoles(serverId, memberId),
              presenceService.getUserPresence(memberId)
            ])
            
            if (profile) {
              const member: Member = {
                userId: profile.uid,
                username: profile.username,
                avatar: (profile as any).avatar,
                roles: userRoles,
                isOnline: presence?.isOnline || false,
                lastSeen: presence?.lastSeen || new Date()
              }
              return member
            }
          } catch (error) {
            console.error(`Failed to load member ${memberId}:`, error)
          }
          return null
        })
        
        const batchResults = await Promise.all(batchPromises)
        const validMembers = batchResults.filter(member => member !== null) as Member[]
        memberProfiles.push(...validMembers)
      }
      
      setMembers(memberProfiles)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }, [serverId, serverMembers])

  useEffect(() => {
    if (isOpen && serverId && serverMembers.length > 0) {
      loadMembersData()
    }
  }, [isOpen, serverId, serverMembers.length, refreshTrigger, loadMembersData])

  useEffect(() => {
    if (!serverId || !isOpen) return

    const unsubscribeRoleUpdates = roleSyncService.onRoleUpdate((update) => {
      if (update.serverId === serverId) {
        setMembers(prevMembers => 
          prevMembers.map(member => 
            member.userId === update.userId 
              ? { ...member, roles: update.roles }
              : member
          )
        )
      }
    })

    const unsubscribePresence = presenceService.subscribeToMultipleUsersPresence(
      serverMembers,
      (presences) => {
        setMembers(prevMembers => 
          prevMembers.map(member => {
            const presence = presences.get(member.userId)
            return presence 
              ? { 
                  ...member, 
                  isOnline: presence.isOnline,
                  lastSeen: presence.lastSeen
                }
              : { ...member, isOnline: false, lastSeen: new Date() }
          })
        )
      }
    )

    return () => {
      unsubscribeRoleUpdates()
      unsubscribePresence()
    }
  }, [serverId, isOpen, serverMembers])

  const loadMembers = useCallback(async () => {
    if (!serverId || !serverMembers.length) return
    
    setLoading(true)
    try {
      const memberProfiles: Member[] = []
      const batchSize = 10
      
      for (let i = 0; i < serverMembers.length; i += batchSize) {
  const batch = serverMembers.slice(i, i + batchSize)
  const batchPromises = batch.map(async (memberId) => {
    try {
      const [profile, userRoles, presence] = await Promise.all([
        authService.getUserProfile(memberId),
        serverService.getUserRoles(serverId, memberId),
        presenceService.getUserPresence(memberId)
      ])

      if (profile) {
        return {
          userId: profile.uid,
          username: profile.username,
          avatar: (profile as any).avatar,
          roles: userRoles,
          isOnline: presence?.isOnline || false,
          lastSeen: presence?.lastSeen || new Date()
        }
      }
    } catch (error) {
      console.error(`Failed to load member ${memberId}:`, error)
    }
    return null
  })


  const batchResults = await Promise.allSettled(batchPromises)

  batchResults.forEach((result: PromiseSettledResult<Member | null>) => {
    if (result.status === 'fulfilled' && result.value) {
      memberProfiles.push(result.value)
    }
  })
}

      
      setMembers(memberProfiles)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }, [serverId, serverMembers])

  const getHighestRole = useCallback((roles: Role[]): Role => {
    const nonEveryoneRoles = roles.filter(role => role.name !== '@everyone')
    if (nonEveryoneRoles.length === 0) {
      return roles.find(role => role.name === '@everyone') || roles[0]
    }
    
    return nonEveryoneRoles.reduce((highest, current) => 
      current.position > highest.position ? current : highest
    )
  }, [])

  const getMemberCount = useMemo(() => {
    if (displayRolesSeparately) {
      const onlineCount = roleGroups
        .filter(group => group.role.name !== 'Offline')
        .reduce((total, group) => total + group.members.length, 0)
      const offlineCount = roleGroups
        .find(group => group.role.name === 'Offline')?.members.length || 0
      return { online: onlineCount, offline: offlineCount, total: onlineCount + offlineCount }
    }
    return { 
      online: members.filter(m => m.isOnline).length, 
      offline: members.filter(m => !m.isOnline).length,
      total: members.length 
    }
  }, [displayRolesSeparately, roleGroups, members])

  const formatLastSeen = useCallback((lastSeen: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - lastSeen.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return lastSeen.toLocaleDateString()
  }, [])

  const renderMemberItem = useCallback((member: Member) => {
    const highestRole = getHighestRole(member.roles)
    const memberColor = member.isOnline ? (highestRole.color || '#99AAB5') : '#747F8D'
    const statusColor = member.isOnline ? 'bg-green-500' : 'bg-gray-500'
    
    return (
      <div 
        key={member.userId} 
        onClick={() => onUserClick(member.userId)}
        className={`flex items-center space-x-3 ${isMobile ? 'p-2' : 'p-2'} rounded-lg hover:bg-gray-700 transition-colors cursor-pointer group`}
      >
        <div className="relative">
          <div className={`${isMobile ? 'w-10 h-10' : 'w-8 h-8'} bg-slate-600 rounded-full flex items-center justify-center overflow-hidden ring-2 transition-all`}
               style={{ '--tw-ring-color': memberColor } as React.CSSProperties}>
            {member.avatar ? (
              <img 
                src={member.avatar} 
                alt={member.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={`text-white font-medium ${isMobile ? 'text-sm' : 'text-xs'}`}>
                {member.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className={`absolute ${isMobile ? '-bottom-1 -right-1 w-4 h-4' : '-bottom-0.5 -right-0.5 w-3 h-3'} ${statusColor} border-2 border-gray-800 rounded-full`}></div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isMobile ? 'text-base' : 'text-sm'}`}
             style={{ color: memberColor }}>
            {member.username}
          </p>
          {!member.isOnline && (
            <p className={`text-gray-500 truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>
              Last seen {formatLastSeen(member.lastSeen)}
            </p>
          )}
          {!displayRolesSeparately && member.roles.length > 0 && member.isOnline && (
            <p className={`text-gray-400 truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>
              {member.roles
                .filter(role => role.name !== '@everyone')
                .slice(0, 1)
                .map(role => role.name)
                .join(', ')}
            </p>
          )}
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    )
  }, [isMobile, onUserClick, getHighestRole, formatLastSeen, displayRolesSeparately])

  if (!isOpen) return null

  const memberCount = getMemberCount

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-gray-800 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <span>Members — {memberCount.total}</span>
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
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
                      {group.members.map(renderMemberItem)}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Online — {memberCount.online}
                    </h3>
                    <div className="space-y-2">
                      {members
                        .filter(m => m.isOnline)
                        .sort((a, b) => a.username.localeCompare(b.username))
                        .map(renderMemberItem)}
                    </div>
                  </div>
                  {memberCount.offline > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Offline — {memberCount.offline}
                      </h3>
                      <div className="space-y-2">
                        {members
                          .filter(m => !m.isOnline)
                          .sort((a, b) => a.username.localeCompare(b.username))
                          .map(renderMemberItem)}
                      </div>
                    </div>
                  )}
                </>
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
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
            <span>Members — {memberCount.total}</span>
            {loading && (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
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
                    {group.members.map(renderMemberItem)}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-2">
                    Online — {memberCount.online}
                  </h3>
                  <div className="space-y-1">
                    {members
                      .filter(m => m.isOnline)
                      .sort((a, b) => a.username.localeCompare(b.username))
                      .map(renderMemberItem)}
                  </div>
                </div>
                {memberCount.offline > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-2">
                      Offline — {memberCount.offline}
                    </h3>
                    <div className="space-y-1">
                      {members
                        .filter(m => !m.isOnline)
                        .sort((a, b) => a.username.localeCompare(b.username))
                        .map(renderMemberItem)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!loading && members.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm text-center px-4">
            No members found
          </p>
        </div>
      )}
    </div>
  )
}