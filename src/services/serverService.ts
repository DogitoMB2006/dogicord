// src/services/serverService.ts
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  arrayUnion, 
  updateDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage'
import { db } from '../config/firebase'
import type { Role } from '../types/permissions'
import type { Channel, Category, ChannelPermission } from '../types/channels'
import { DEFAULT_ROLES } from '../types/permissions'

export interface Server {
  id: string
  name: string
  ownerId: string
  members: string[]
  inviteCode: string
  createdAt: Date
  channels: Channel[]
  categories: Category[]
  roles: Role[]
  icon?: string
  displayRolesSeparately?: boolean
}

export interface ServerMember {
  userId: string
  username: string
  joinedAt: Date
  roles: string[]
}

export const serverService = {
  async createServer(name: string, ownerId: string): Promise<Server> {
    try {
      const serverId = `server_${Date.now()}`
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const defaultCategories: Category[] = [
        {
          id: 'text-category',
          name: 'Text Channels',
          position: 0,
          collapsed: false,
          permissions: [],
          createdAt: new Date()
        },
        {
          id: 'voice-category', 
          name: 'Voice Channels',
          position: 1,
          collapsed: false,
          permissions: [],
          createdAt: new Date()
        }
      ]

      const defaultChannels: Channel[] = [
        {
          id: 'general',
          name: 'general',
          type: 'text',
          categoryId: 'text-category',
          description: 'General discussion',
          position: 0,
          permissions: [],
          createdAt: new Date()
        },
        {
          id: 'random',
          name: 'random', 
          type: 'text',
          categoryId: 'text-category',
          description: 'Random conversations',
          position: 1,
          permissions: [],
          createdAt: new Date()
        },
        {
          id: 'general-voice',
          name: 'General',
          type: 'voice',
          categoryId: 'voice-category',
          description: 'General voice chat',
          position: 0,
          permissions: [],
          createdAt: new Date()
        }
      ]

      const defaultRoles: Role[] = [
        {
          id: 'everyone',
          name: DEFAULT_ROLES.EVERYONE,
          color: '#99AAB5',
          permissions: ['view_channels', 'send_messages'],
          position: 0,
          mentionable: false,
          createdAt: new Date()
        },
        {
          id: 'owner',
          name: DEFAULT_ROLES.OWNER,
          color: '#F04747',
          permissions: ['administrator'],
          position: 100,
          mentionable: false,
          createdAt: new Date()
        }
      ]

      const server: Server = {
        id: serverId,
        name,
        ownerId,
        members: [ownerId],
        inviteCode,
        createdAt: new Date(),
        channels: defaultChannels,
        categories: defaultCategories,
        roles: defaultRoles,
        displayRolesSeparately: true
      }

      await setDoc(doc(db, 'servers', serverId), {
        ...server,
        createdAt: serverTimestamp()
      })

      await setDoc(doc(db, 'serverMembers', `${serverId}_${ownerId}`), {
        userId: ownerId,
        serverId: serverId,
        roles: ['owner'],
        joinedAt: serverTimestamp()
      })

      return server
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async updateServer(serverId: string, updates: Partial<Server>): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      await updateDoc(serverRef, updates)
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async uploadServerIcon(file: File, serverId: string): Promise<string> {
    try {
      const storage = getStorage()
      const fileExtension = file.name.split('.').pop()
      const fileName = `${serverId}_${Date.now()}.${fileExtension}`
      const iconRef = ref(storage, `serverIcons/${fileName}`)
      
      const snapshot = await uploadBytes(iconRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return downloadURL
    } catch (error: any) {
      throw new Error('Failed to upload server icon: ' + error.message)
    }
  },

  async deleteServerIcon(iconUrl: string): Promise<void> {
    try {
      const storage = getStorage()
      const iconRef = ref(storage, iconUrl)
      await deleteObject(iconRef)
    } catch (error: any) {
      console.warn('Failed to delete old server icon:', error.message)
    }
  },

  async createChannel(serverId: string, name: string, type: 'text' | 'voice'): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const newChannel: Channel = {
        id: `${type}_${Date.now()}`,
        name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type,
        categoryId: type === 'text' ? 'text-category' : 'voice-category',
        description: undefined,
        position: server.channels.filter(ch => ch.type === type).length,
        permissions: [],
        createdAt: new Date()
      }

      await updateDoc(serverRef, {
        channels: [...server.channels, newChannel]
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async deleteChannel(serverId: string, channelId: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const updatedChannels = server.channels.filter(ch => ch.id !== channelId)

      await updateDoc(serverRef, {
        channels: updatedChannels
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async createRole(serverId: string, name: string, color: string, permissions: string[]): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const maxPosition = Math.max(...server.roles.map(r => r.position))
      
      const newRole: Role = {
        id: `role_${Date.now()}`,
        name,
        color,
        permissions,
        position: maxPosition + 1,
        mentionable: false,
        createdAt: new Date()
      }

      await updateDoc(serverRef, {
        roles: [...server.roles, newRole]
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async updateRole(serverId: string, roleId: string, updates: Partial<Role>): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const updatedRoles = server.roles.map(role => 
        role.id === roleId ? { ...role, ...updates } : role
      )

      await updateDoc(serverRef, {
        roles: updatedRoles
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async deleteRole(serverId: string, roleId: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const role = server.roles.find(r => r.id === roleId)
      
      if (!role) {
        throw new Error('Role not found')
      }

      if (role.name === '@everyone' || role.name === 'Owner') {
        throw new Error('Cannot delete protected roles')
      }

      const updatedRoles = server.roles.filter(r => r.id !== roleId)

      await updateDoc(serverRef, {
        roles: updatedRoles
      })

      const membersQuery = query(
        collection(db, 'serverMembers'),
        where('serverId', '==', serverId)
      )
      
      const membersSnapshot = await getDocs(membersQuery)
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data()
        if (memberData.roles.includes(roleId)) {
          const updatedMemberRoles = memberData.roles.filter((r: string) => r !== roleId)
          await updateDoc(memberDoc.ref, {
            roles: updatedMemberRoles
          })
        }
      }
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async reorderRoles(serverId: string, roles: Role[]): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      await updateDoc(serverRef, {
        roles: roles
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getUserServers(userId: string): Promise<Server[]> {
    try {
      const q = query(
        collection(db, 'servers'),
        where('members', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      const servers: Server[] = []
      
      querySnapshot.forEach((doc) => {
        servers.push({
          id: doc.id,
          ...doc.data()
        } as Server)
      })
      
      return servers
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getServerByInviteCode(inviteCode: string): Promise<Server | null> {
    try {
      const q = query(
        collection(db, 'servers'),
        where('inviteCode', '==', inviteCode)
      )
      
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }
      
      const doc = querySnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data()
      } as Server
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async joinServer(serverId: string, userId: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      
      await updateDoc(serverRef, {
        members: arrayUnion(userId)
      })

      await setDoc(doc(db, 'serverMembers', `${serverId}_${userId}`), {
        userId: userId,
        serverId: serverId,
        roles: ['everyone'],
        joinedAt: serverTimestamp()
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getServer(serverId: string): Promise<Server | null> {
    try {
      const docRef = doc(db, 'servers', serverId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Server
      }
      
      return null
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getUserRoles(serverId: string, userId: string): Promise<Role[]> {
    try {
      const memberDoc = await getDoc(doc(db, 'serverMembers', `${serverId}_${userId}`))
      const serverDoc = await getDoc(doc(db, 'servers', serverId))
      
      if (!memberDoc.exists() || !serverDoc.exists()) {
        return []
      }

      const memberData = memberDoc.data()
      const serverData = serverDoc.data() as Server
      
      return serverData.roles.filter(role => 
        memberData.roles.includes(role.id) || role.id === 'everyone'
      )
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async assignRoleToUser(serverId: string, userId: string, roleId: string): Promise<void> {
    try {
      const memberDocRef = doc(db, 'serverMembers', `${serverId}_${userId}`)
      const memberDoc = await getDoc(memberDocRef)
      
      if (!memberDoc.exists()) {
        throw new Error('Member not found')
      }

      const memberData = memberDoc.data()
      const currentRoles = memberData.roles || []
      
      if (currentRoles.includes(roleId)) {
        throw new Error('User already has this role')
      }

      await updateDoc(memberDocRef, {
        roles: [...currentRoles, roleId]
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async removeRoleFromUser(serverId: string, userId: string, roleId: string): Promise<void> {
    try {
      const memberDocRef = doc(db, 'serverMembers', `${serverId}_${userId}`)
      const memberDoc = await getDoc(memberDocRef)
      
      if (!memberDoc.exists()) {
        throw new Error('Member not found')
      }

      const memberData = memberDoc.data()
      const currentRoles = memberData.roles || []
      
      if (!currentRoles.includes(roleId)) {
        throw new Error('User does not have this role')
      }

      if (roleId === 'everyone') {
        throw new Error('Cannot remove @everyone role')
      }

      const updatedRoles = currentRoles.filter((r: string) => r !== roleId)
      
      await updateDoc(memberDocRef, {
        roles: updatedRoles
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async createChannelWithPermissions(serverId: string, name: string, type: 'text' | 'voice', categoryId: string, permissions: ChannelPermission[]): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const maxPosition = Math.max(...server.channels.filter(ch => ch.categoryId === categoryId).map(ch => ch.position), -1)
      
      const newChannel: Channel = {
        id: `${type}_${Date.now()}`,
        name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type,
        categoryId,
        description: undefined,
        position: maxPosition + 1,
        permissions,
        createdAt: new Date()
      }

      await updateDoc(serverRef, {
        channels: [...server.channels, newChannel]
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async updateChannelWithPermissions(serverId: string, channelId: string, updates: Partial<Channel>): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const updatedChannels = server.channels.map(channel => 
        channel.id === channelId ? { ...channel, ...updates } : channel
      )

      await updateDoc(serverRef, {
        channels: updatedChannels
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async createCategory(serverId: string, name: string, permissions: ChannelPermission[]): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const maxPosition = Math.max(...server.categories.map(cat => cat.position), -1)
      
      const newCategory: Category = {
        id: `category_${Date.now()}`,
        name,
        position: maxPosition + 1,
        collapsed: false,
        permissions,
        createdAt: new Date()
      }

      await updateDoc(serverRef, {
        categories: [...server.categories, newCategory]
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async updateCategory(serverId: string, categoryId: string, updates: Partial<Category>): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const updatedCategories = server.categories.map(category => 
        category.id === categoryId ? { ...category, ...updates } : category
      )

      await updateDoc(serverRef, {
        categories: updatedCategories
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async deleteCategory(serverId: string, categoryId: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      
      const updatedCategories = server.categories.filter(cat => cat.id !== categoryId)
      
      const updatedChannels = server.channels.map(channel => 
        channel.categoryId === categoryId ? { ...channel, categoryId: '' } : channel
      )

      await updateDoc(serverRef, {
        categories: updatedCategories,
        channels: updatedChannels
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async reorderChannelsAndCategories(serverId: string, channels: Channel[], categories: Category[]): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      await updateDoc(serverRef, {
        channels,
        categories
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  }
}