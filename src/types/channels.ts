// src/types/channels.ts
export interface ChannelPermission {
  roleId: string
  allow: string[]
  deny: string[]
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  categoryId: string
  description?: string
  position: number
  permissions: ChannelPermission[]
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  position: number
  collapsed: boolean
  permissions: ChannelPermission[]
  createdAt: Date
}

export const CHANNEL_PERMISSIONS = [
  'view_channel',
  'send_messages',
  'manage_messages',
  'read_message_history',
  'use_voice_activity',
  'speak',
  'mute_members',
  'deafen_members',
  'move_members'
] as const

export type ChannelPermissionType = typeof CHANNEL_PERMISSIONS[number]

export interface ChannelPermissionInfo {
  id: ChannelPermissionType
  name: string
  description: string
}

export const CHANNEL_PERMISSION_INFO: ChannelPermissionInfo[] = [
  {
    id: 'view_channel',
    name: 'View Channel',
    description: 'Allows members to view this channel'
  },
  {
    id: 'send_messages',
    name: 'Send Messages',
    description: 'Allows members to send messages in this channel'
  },
  {
    id: 'manage_messages',
    name: 'Manage Messages',
    description: 'Allows members to delete messages by other members'
  },
  {
    id: 'read_message_history',
    name: 'Read Message History',
    description: 'Allows members to read messages sent before they joined'
  },
  {
    id: 'use_voice_activity',
    name: 'Use Voice Activity',
    description: 'Allows members to use voice activation in voice channels'
  },
  {
    id: 'speak',
    name: 'Speak',
    description: 'Allows members to speak in voice channels'
  },
  {
    id: 'mute_members',
    name: 'Mute Members',
    description: 'Allows members to mute other members in voice channels'
  },
  {
    id: 'deafen_members',
    name: 'Deafen Members',
    description: 'Allows members to deafen other members in voice channels'
  },
  {
    id: 'move_members',
    name: 'Move Members',
    description: 'Allows members to move other members between voice channels'
  }
]