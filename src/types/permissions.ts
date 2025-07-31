export interface Permission {
  id: string
  name: string
  description: string
  category: 'general' | 'channels' | 'members'
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
  '#11806A'  
]