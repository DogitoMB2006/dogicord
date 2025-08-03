export interface Permission {
  id: string
  name: string
  description: string
  category: 'general' | 'channels' | 'members' | 'voice' | 'advanced'
}

export interface Role {
  id: string
  name: string
  color: string
  permissions: string[]
  position: number
  mentionable: boolean
  createdAt: Date
}

export interface ServerMember {
  userId: string
  username: string
  roles: string[]
  joinedAt: Date
}

export const PERMISSIONS: Permission[] = [
  {
    id: 'administrator',
    name: 'Administrator',
    description: 'All permissions. This overrides all other permissions.',
    category: 'general'
  },
  {
    id: 'manage_server',
    name: 'Manage Server',
    description: 'Allows members to change server name and upload server icon.',
    category: 'general'
  },
  {
    id: 'manage_roles',
    name: 'Manage Roles',
    description: 'Allows members to create, edit, and delete roles.',
    category: 'general'
  },
  {
    id: 'view_audit_log',
    name: 'View Audit Log',
    description: 'Allows members to view the server audit log.',
    category: 'general'
  },
  {
    id: 'view_server_insights',
    name: 'View Server Insights',
    description: 'Allows members to view server analytics and insights.',
    category: 'general'
  },
  {
    id: 'manage_webhooks',
    name: 'Manage Webhooks',
    description: 'Allows members to create, edit, and delete webhooks.',
    category: 'general'
  },
  {
    id: 'manage_server_settings',
    name: 'Manage Server Settings',
    description: 'Allows members to access and modify server settings.',
    category: 'general'
  },
  {
    id: 'manage_channels',
    name: 'Manage Channels',
    description: 'Allows members to create, edit, and delete channels.',
    category: 'channels'
  },
  {
    id: 'view_channels',
    name: 'View Channels',
    description: 'Allows members to view channels.',
    category: 'channels'
  },
  {
    id: 'send_messages',
    name: 'Send Messages',
    description: 'Allows members to send messages in text channels.',
    category: 'channels'
  },
  {
    id: 'manage_messages',
    name: 'Manage Messages',
    description: 'Allows members to delete messages by other members.',
    category: 'channels'
  },
  {
    id: 'embed_links',
    name: 'Embed Links',
    description: 'Allows members to post links that auto-embed in chat.',
    category: 'channels'
  },
  {
    id: 'attach_files',
    name: 'Attach Files',
    description: 'Allows members to upload files and media.',
    category: 'channels'
  },
  {
    id: 'read_message_history',
    name: 'Read Message History',
    description: 'Allows members to read messages sent before they joined.',
    category: 'channels'
  },
  {
    id: 'mention_everyone',
    name: 'Mention @everyone',
    description: 'Allows members to use @everyone and @here mentions.',
    category: 'channels'
  },
  {
    id: 'use_external_emojis',
    name: 'Use External Emojis',
    description: 'Allows members to use emojis from other servers.',
    category: 'channels'
  },
  {
    id: 'add_reactions',
    name: 'Add Reactions',
    description: 'Allows members to add new reactions to messages.',
    category: 'channels'
  },
  {
    id: 'use_slash_commands',
    name: 'Use Slash Commands',
    description: 'Allows members to use slash commands in chat.',
    category: 'channels'
  },
  {
    id: 'create_instant_invite',
    name: 'Create Instant Invite',
    description: 'Allows members to create invite links.',
    category: 'general'
  },
  {
    id: 'kick_members',
    name: 'Kick Members',
    description: 'Allows members to remove other members from the server.',
    category: 'members'
  },
  {
    id: 'ban_members',
    name: 'Ban Members',
    description: 'Allows members to ban other members from the server.',
    category: 'members'
  },
  {
    id: 'manage_nicknames',
    name: 'Manage Nicknames',
    description: 'Allows members to change nicknames of other members.',
    category: 'members'
  },
  {
    id: 'change_nickname',
    name: 'Change Nickname',
    description: 'Allows members to change their own nickname.',
    category: 'members'
  },
  {
    id: 'timeout_members',
    name: 'Timeout Members',
    description: 'Allows members to timeout other members.',
    category: 'members'
  },
  {
    id: 'view_member_list',
    name: 'View Member List',
    description: 'Allows members to view the server member list.',
    category: 'members'
  },
  {
    id: 'connect',
    name: 'Connect',
    description: 'Allows members to connect to voice channels.',
    category: 'voice'
  },
  {
    id: 'speak',
    name: 'Speak',
    description: 'Allows members to speak in voice channels.',
    category: 'voice'
  },
  {
    id: 'stream',
    name: 'Video',
    description: 'Allows members to share their camera in voice channels.',
    category: 'voice'
  },
  {
    id: 'use_voice_activity',
    name: 'Use Voice Activity',
    description: 'Allows members to use voice activation instead of push-to-talk.',
    category: 'voice'
  },
  {
    id: 'priority_speaker',
    name: 'Priority Speaker',
    description: 'Allows members to be more easily heard when speaking.',
    category: 'voice'
  },
  {
    id: 'mute_members',
    name: 'Mute Members',
    description: 'Allows members to mute other members in voice channels.',
    category: 'voice'
  },
  {
    id: 'deafen_members',
    name: 'Deafen Members',
    description: 'Allows members to deafen other members in voice channels.',
    category: 'voice'
  },
  {
    id: 'move_members',
    name: 'Move Members',
    description: 'Allows members to move other members between voice channels.',
    category: 'voice'
  },
  {
    id: 'use_soundboard',
    name: 'Use Soundboard',
    description: 'Allows members to use soundboard in voice channels.',
    category: 'voice'
  },
  {
    id: 'manage_events',
    name: 'Manage Events',
    description: 'Allows members to create, edit, and cancel server events.',
    category: 'advanced'
  },
  {
    id: 'manage_threads',
    name: 'Manage Threads',
    description: 'Allows members to manage and moderate threads.',
    category: 'advanced'
  },
  {
    id: 'create_public_threads',
    name: 'Create Public Threads',
    description: 'Allows members to create public threads.',
    category: 'advanced'
  },
  {
    id: 'create_private_threads',
    name: 'Create Private Threads',
    description: 'Allows members to create private threads.',
    category: 'advanced'
  },
  {
    id: 'send_messages_in_threads',
    name: 'Send Messages in Threads',
    description: 'Allows members to send messages in threads.',
    category: 'advanced'
  },
  {
    id: 'use_application_commands',
    name: 'Use Application Commands',
    description: 'Allows members to use application commands.',
    category: 'advanced'
  },
  {
    id: 'moderate_members',
    name: 'Moderate Members',
    description: 'Allows timeout, view audit log, and other moderation actions.',
    category: 'members'
  }
]

export const DEFAULT_ROLES = {
  EVERYONE: '@everyone',
  OWNER: 'Owner'
}

export const ROLE_COLORS = [
  '#99AAB5', 
  '#F04747', 
  '#FAA61A',
  '#FDCB58', 
  '#43B581', 
  '#5865F2', 
  '#9B59B6', 
  '#E91E63', 
  '#11806A',
  '#206694',
  '#71368A',
  '#AD1457',
  '#C27C0E',
  '#A84300',
  '#992D22',
  '#979C9F',
  '#546E7A'
]

export const getPermissionsByCategory = (category: string): Permission[] => {
  return PERMISSIONS.filter(perm => perm.category === category)
}

export const hasPermission = (userRoles: Role[], permission: string, isOwner: boolean = false): boolean => {
  if (isOwner) return true
  
  return userRoles.some(role => 
    role.permissions.includes('administrator') || 
    role.permissions.includes(permission)
  )
}

export const canManageRole = (userRoles: Role[], targetRole: Role, isOwner: boolean = false): boolean => {
  if (isOwner) return true
  if (targetRole.name === '@everyone' || targetRole.name === 'Owner') return false
  
  const userHighestPosition = Math.max(...userRoles.map(r => r.position), 0)
  return userHighestPosition > targetRole.position && hasPermission(userRoles, 'manage_roles')
}

export const getAvailablePermissions = (userRoles: Role[], isOwner: boolean = false): string[] => {
  if (isOwner) return PERMISSIONS.map(p => p.id)
  
  const userPermissions = new Set<string>()
  
  userRoles.forEach(role => {
    if (role.permissions.includes('administrator')) {
      PERMISSIONS.forEach(p => userPermissions.add(p.id))
    } else {
      role.permissions.forEach(p => userPermissions.add(p))
    }
  })
  
  return Array.from(userPermissions)
}