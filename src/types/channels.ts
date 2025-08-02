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