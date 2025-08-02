import { useState, useEffect } from 'react'
import { serverService } from '../../services/serverService'
import { authService } from '../../services/authService'

interface Member {
  userId: string
  username: string
  avatar?: string
  roles: string[]
  isOnline: boolean
}

interface MemberListProps {
  serverId: string
  serverMembers: string[]
  isOpen: boolean
  onClose?: () => void
  isMobile: boolean
}

export default function MemberList({ serverId, serverMembers, isOpen, onClose, isMobile }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && serverId) {
      loadMembers()
    }
  }, [isOpen, serverId, serverMembers])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const memberProfiles: Member[] = []
      
      for (const memberId of serverMembers) {
        const profile = await authService.getUserProfile(memberId)
        const roles = await serverService.getUserRoles(serverId, memberId)
        
        if (profile) {
          memberProfiles.push({
            userId: profile.uid,
            username: profile.username,
            avatar: (profile as any).avatar,
            roles: roles.map(role => role.name),
            isOnline: true
          })
        }
      }
      
      memberProfiles.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1
        if (!a.isOnline && b.isOnline) return 1
        return a.username.localeCompare(b.username)
      })
      
      setMembers(memberProfiles)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const onlineMembers = members.filter(m => m.isOnline)
  const offlineMembers = members.filter(m => !m.isOnline)

  if (!isOpen) return null

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-gray-800 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Members</h2>
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
              {onlineMembers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Online — {onlineMembers.length}
                  </h3>
                  <div className="space-y-2">
                    {onlineMembers.map((member) => (
                      <div key={member.userId} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors">
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
                              {member.roles.filter(role => role !== '@everyone').join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {offlineMembers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Offline — {offlineMembers.length}
                  </h3>
                  <div className="space-y-2">
                    {offlineMembers.map((member) => (
                      <div key={member.userId} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors opacity-60">
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
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-500 border-2 border-gray-800 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{member.username}</p>
                          {member.roles.length > 0 && (
                            <p className="text-xs text-gray-400 truncate">
                              {member.roles.filter(role => role !== '@everyone').join(', ')}
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
          <h2 className="text-sm font-semibold text-white">Members</h2>
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
            {onlineMembers.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-2">
                  Online — {onlineMembers.length}
                </h3>
                <div className="space-y-1">
                  {onlineMembers.map((member) => (
                    <div key={member.userId} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer">
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
                            {member.roles.filter(role => role !== '@everyone').slice(0, 1).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {offlineMembers.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-2">
                  Offline — {offlineMembers.length}
                </h3>
                <div className="space-y-1">
                  {offlineMembers.map((member) => (
                    <div key={member.userId} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer opacity-50">
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
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-500 border-2 border-gray-800 rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{member.username}</p>
                        {member.roles.length > 0 && (
                          <p className="text-xs text-gray-400 truncate">
                            {member.roles.filter(role => role !== '@everyone').slice(0, 1).join(', ')}
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