import type { Role } from '../types/permissions'
import type { Channel, ChannelPermissionType } from '../types/channels'
import { hasPermission as hasGlobalPermission } from '../types/permissions'

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export const permissionService = {
  hasServerPermission(userRoles: Role[], permission: string, isOwner: boolean = false): boolean {
    return hasGlobalPermission(userRoles, permission, isOwner)
  },

  hasChannelPermission(
    userRoles: Role[], 
    channel: Channel, 
    permission: ChannelPermissionType, 
    isOwner: boolean = false
  ): PermissionCheckResult {
    if (isOwner) {
      return { allowed: true }
    }

    const hasAdmin = userRoles.some(role => role.permissions.includes('administrator'))
    if (hasAdmin) {
      return { allowed: true }
    }

    // First check if user can view the channel at all
    if (permission !== 'view_channel') {
      const canViewChannel = this.hasChannelPermission(userRoles, channel, 'view_channel', isOwner)
      if (!canViewChannel.allowed) {
        return { 
          allowed: false, 
          reason: 'Cannot access channel' 
        }
      }
    }

    // Check for explicit denies first (highest priority)
    for (const role of userRoles) {
      const channelOverride = channel.permissions?.find(p => p.roleId === role.id)
      if (channelOverride && channelOverride.deny.includes(permission)) {
        return { 
          allowed: false, 
          reason: `Permission explicitly denied for role ${role.name}` 
        }
      }
    }

    // Then check for explicit allows
    for (const role of userRoles) {
      const channelOverride = channel.permissions?.find(p => p.roleId === role.id)
      if (channelOverride && channelOverride.allow.includes(permission)) {
        return { allowed: true }
      }
    }

    // Finally check server-level permissions as fallback
    const serverPermissionMap: Record<ChannelPermissionType, string[]> = {
      'view_channel': ['view_channels'],
      'send_messages': ['send_messages'],
      'manage_messages': ['manage_messages'],
      'read_message_history': ['read_message_history'],
      'use_voice_activity': ['use_voice_activity'],
      'speak': ['speak'],
      'mute_members': ['mute_members'],
      'deafen_members': ['deafen_members'],
      'move_members': ['move_members']
    }
    
    const requiredServerPerms = serverPermissionMap[permission] || []
    
    for (const role of userRoles) {
      for (const serverPerm of requiredServerPerms) {
        if (role.permissions.includes(serverPerm)) {
          return { allowed: true }
        }
      }
    }

    // Special case for view_channel: if no explicit permissions are set, 
    // check if @everyone has been explicitly denied
    if (permission === 'view_channel') {
      const everyoneRole = userRoles.find(role => role.name === '@everyone')
      if (everyoneRole) {
        const everyoneOverride = channel.permissions?.find(p => p.roleId === everyoneRole.id)
        if (everyoneOverride && everyoneOverride.deny.includes('view_channel')) {
          // @everyone is denied, check if user has any other roles that explicitly allow
          const nonEveryoneRoles = userRoles.filter(role => role.name !== '@everyone')
          for (const role of nonEveryoneRoles) {
            const roleOverride = channel.permissions?.find(p => p.roleId === role.id)
            if (roleOverride && roleOverride.allow.includes('view_channel')) {
              return { allowed: true }
            }
          }
          return { 
            allowed: false, 
            reason: 'Channel is private and user does not have access' 
          }
        }
      }
      
      // Default: if no explicit permissions, allow view access
      return { allowed: true }
    }

    return { 
      allowed: false, 
      reason: `No permission found for ${permission}` 
    }
  },

  // New method to check if a user can see a channel at all
  canUserSeeChannel(userRoles: Role[], channel: Channel, isOwner: boolean = false): boolean {
    const result = this.hasChannelPermission(userRoles, channel, 'view_channel', isOwner)
    return result.allowed
  },

  // New method to filter channels based on user permissions
  getVisibleChannels(userRoles: Role[], channels: Channel[], isOwner: boolean = false): Channel[] {
    return channels.filter(channel => this.canUserSeeChannel(userRoles, channel, isOwner))
  },

  canAccessServerSettings(userRoles: Role[], isOwner: boolean = false): {
    canAccess: boolean
    availableTabs: string[]
  } {
    if (isOwner) {
      return {
        canAccess: true,
        availableTabs: ['general', 'channels', 'roles', 'members', 'integrations', 'safety']
      }
    }

    const availableTabs: string[] = []
    let canAccess = false

    if (this.hasServerPermission(userRoles, 'manage_server')) {
      availableTabs.push('general')
      canAccess = true
    }

    if (this.hasServerPermission(userRoles, 'manage_channels')) {
      availableTabs.push('channels')
      canAccess = true
    }

    if (this.hasServerPermission(userRoles, 'manage_roles')) {
      availableTabs.push('roles')
      canAccess = true
    }

    if (this.hasServerPermission(userRoles, 'kick_members') || 
        this.hasServerPermission(userRoles, 'ban_members') ||
        this.hasServerPermission(userRoles, 'moderate_members')) {
      availableTabs.push('members')
      canAccess = true
    }

    if (this.hasServerPermission(userRoles, 'manage_webhooks')) {
      availableTabs.push('integrations')
      canAccess = true
    }

    if (this.hasServerPermission(userRoles, 'view_audit_log') ||
        this.hasServerPermission(userRoles, 'moderate_members')) {
      availableTabs.push('safety')
      canAccess = true
    }

    return { canAccess, availableTabs }
  },

  canManageMessage(
    userRoles: Role[], 
    messageAuthorId: string, 
    currentUserId: string, 
    isOwner: boolean = false
  ): PermissionCheckResult {
    if (isOwner) {
      return { allowed: true }
    }

    if (messageAuthorId === currentUserId) {
      return { allowed: true, reason: 'Own message' }
    }

    if (this.hasServerPermission(userRoles, 'manage_messages')) {
      return { allowed: true, reason: 'Has manage_messages permission' }
    }

    return { 
      allowed: false, 
      reason: 'Cannot manage messages from other users' 
    }
  },

  canMentionEveryone(userRoles: Role[], isOwner: boolean = false): boolean {
    return this.hasServerPermission(userRoles, 'mention_everyone', isOwner)
  },

  canCreateInvite(userRoles: Role[], isOwner: boolean = false): boolean {
    return this.hasServerPermission(userRoles, 'create_instant_invite', isOwner)
  },

  canKickMember(userRoles: Role[], targetRoles: Role[], isOwner: boolean = false): PermissionCheckResult {
    if (isOwner) {
      return { allowed: true }
    }

    if (!this.hasServerPermission(userRoles, 'kick_members')) {
      return { allowed: false, reason: 'No kick_members permission' }
    }

    const userHighestPosition = Math.max(...userRoles.map(r => r.position), 0)
    const targetHighestPosition = Math.max(...targetRoles.map(r => r.position), 0)

    if (userHighestPosition <= targetHighestPosition) {
      return { 
        allowed: false, 
        reason: 'Cannot kick members with equal or higher role position' 
      }
    }

    return { allowed: true }
  },

  canBanMember(userRoles: Role[], targetRoles: Role[], isOwner: boolean = false): PermissionCheckResult {
    if (isOwner) {
      return { allowed: true }
    }

    if (!this.hasServerPermission(userRoles, 'ban_members')) {
      return { allowed: false, reason: 'No ban_members permission' }
    }

    const userHighestPosition = Math.max(...userRoles.map(r => r.position), 0)
    const targetHighestPosition = Math.max(...targetRoles.map(r => r.position), 0)

    if (userHighestPosition <= targetHighestPosition) {
      return { 
        allowed: false, 
        reason: 'Cannot ban members with equal or higher role position' 
      }
    }

    return { allowed: true }
  },

  canTimeoutMember(userRoles: Role[], targetRoles: Role[], isOwner: boolean = false): PermissionCheckResult {
    if (isOwner) {
      return { allowed: true }
    }

    if (!this.hasServerPermission(userRoles, 'timeout_members') && 
        !this.hasServerPermission(userRoles, 'moderate_members')) {
      return { allowed: false, reason: 'No timeout permission' }
    }

    const userHighestPosition = Math.max(...userRoles.map(r => r.position), 0)
    const targetHighestPosition = Math.max(...targetRoles.map(r => r.position), 0)

    if (userHighestPosition <= targetHighestPosition) {
      return { 
        allowed: false, 
        reason: 'Cannot timeout members with equal or higher role position' 
      }
    }

    return { allowed: true }
  },

  canManageNickname(userRoles: Role[], targetUserId: string, currentUserId: string, isOwner: boolean = false): PermissionCheckResult {
    if (isOwner) {
      return { allowed: true }
    }

    if (targetUserId === currentUserId && this.hasServerPermission(userRoles, 'change_nickname')) {
      return { allowed: true, reason: 'Can change own nickname' }
    }

    if (this.hasServerPermission(userRoles, 'manage_nicknames')) {
      return { allowed: true, reason: 'Has manage_nicknames permission' }
    }

    return { allowed: false, reason: 'No nickname management permission' }
  },

  getEffectivePermissions(userRoles: Role[], channel?: Channel): string[] {
    const permissions = new Set<string>()

    const hasAdmin = userRoles.some(role => role.permissions.includes('administrator'))
    if (hasAdmin) {
      return ['administrator']
    }

    userRoles.forEach(role => {
      role.permissions.forEach(perm => permissions.add(perm))
    })

    if (channel) {
      userRoles.forEach(role => {
        const channelOverride = channel.permissions?.find(p => p.roleId === role.id)
        if (channelOverride) {
          channelOverride.allow.forEach(perm => permissions.add(perm))
          channelOverride.deny.forEach(perm => permissions.delete(perm))
        }
      })
    }

    return Array.from(permissions)
  },

  validateRolePermissions(userRoles: Role[], requestedPermissions: string[], isOwner: boolean = false): {
    valid: boolean
    invalidPermissions: string[]
  } {
    if (isOwner) {
      return { valid: true, invalidPermissions: [] }
    }

    const hasAdmin = userRoles.some(role => role.permissions.includes('administrator'))
    if (hasAdmin) {
      return { valid: true, invalidPermissions: [] }
    }

    const userPermissions = new Set<string>()
    userRoles.forEach(role => {
      role.permissions.forEach(perm => userPermissions.add(perm))
    })

    const invalidPermissions: string[] = []
    requestedPermissions.forEach(perm => {
      if (!userPermissions.has(perm) && perm !== 'administrator') {
        invalidPermissions.push(perm)
      }
    })

    return {
      valid: invalidPermissions.length === 0,
      invalidPermissions
    }
  }
}