import type { Role } from './permissions'

export interface Member {
  userId: string
  username: string
  avatar?: string
  roles: Role[]
  isOnline: boolean
  lastSeen: Date
}

export interface RoleGroup {
  role: Role
  members: Member[]
}

export interface MemberListProps {
  serverId: string
  serverMembers: string[]
  isOpen: boolean
  onClose?: () => void
  isMobile: boolean
  onUserClick: (userId: string) => void
  displayRolesSeparately?: boolean
  refreshTrigger?: number
}