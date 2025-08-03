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
  serverTimestamp,
  addDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage'
import { db } from '../config/firebase'
import { roleSyncService } from './roleSyncService'
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

export interface AuditLogEntry {
  id: string
  serverId: string
  userId: string
  username: string
  action: string
  targetId?: string
  targetName?: string
  details?: any
  timestamp: Date
}

const cleanForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore)
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value)
      }
    }
    return cleaned
  }
  
  return obj
}

export const serverService = {
  async createAuditLog(
    serverId: string,
    userId: string,
    username: string,
    action: string,
    targetId?: string,
    targetName?: string,
    details?: any
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        serverId,
        userId,
        username,
        action,
        targetId,
        targetName,
        details: details || null,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      console.error('Failed to create audit log:', error)
    }
  },

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
          permissions: ['view_channels', 'send_messages', 'view_member_list', 'connect', 'speak'],
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

      const cleanedServer = cleanForFirestore({
        ...server,
        createdAt: serverTimestamp()
      })

      await setDoc(doc(db, 'servers', serverId), cleanedServer)

      await setDoc(doc(db, 'serverMembers', `${serverId}_${ownerId}`), {
        userId: ownerId,
        serverId: serverId,
        roles: ['owner', 'everyone'],
        joinedAt: serverTimestamp()
      })

      await this.createAuditLog(
        serverId,
        ownerId,
        'Server Owner',
        'SERVER_CREATED',
        serverId,
        name
      )

      return server
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async updateServer(serverId: string, updates: Partial<Server>): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const cleanedUpdates = cleanForFirestore(updates)
      await updateDoc(serverRef, cleanedUpdates)
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
      const channels = server.channels || []
      const newChannel: Channel = {
        id: `${type}_${Date.now()}`,
        name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type,
        categoryId: type === 'text' ? 'text-category' : 'voice-category',
        description: 'Channel description',
        position: channels.filter(ch => ch.type === type).length,
        permissions: [],
        createdAt: new Date()
      }

      const cleanedChannel = cleanForFirestore(newChannel)
      await updateDoc(serverRef, {
        channels: [...channels, cleanedChannel]
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
      const channels = server.channels || []
      const updatedChannels = channels.filter(ch => ch.id !== channelId)

      await updateDoc(serverRef, {
        channels: updatedChannels
      })
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async createRole(serverId: string, name: string, color: string, permissions: string[], createdBy?: string, createdByName?: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const roles = server.roles || []
      const maxPosition = Math.max(...roles.map(r => r.position), 0)
      
      const newRole: Role = {
        id: `role_${Date.now()}`,
        name,
        color,
        permissions,
        position: maxPosition + 1,
        mentionable: false,
        createdAt: new Date()
      }

      const cleanedRole = cleanForFirestore(newRole)
      await updateDoc(serverRef, {
        roles: [...roles, cleanedRole]
      })

      if (createdBy && createdByName) {
        await this.createAuditLog(
          serverId,
          createdBy,
          createdByName,
          'ROLE_CREATED',
          newRole.id,
          name,
          { permissions, color }
        )
      }
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async updateRole(serverId: string, roleId: string, updates: Partial<Role>, updatedBy?: string, updatedByName?: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const roles = server.roles || []
      const oldRole = roles.find(r => r.id === roleId)
      
      if (!oldRole) {
        throw new Error('Role not found')
      }

      const updatedRoles = roles.map(role => 
        role.id === roleId ? cleanForFirestore({ ...role, ...updates }) : role
      )

      await updateDoc(serverRef, {
        roles: updatedRoles
      })

      if (updatedBy && updatedByName) {
        await this.createAuditLog(
          serverId,
          updatedBy,
          updatedByName,
          'ROLE_UPDATED',
          roleId,
          oldRole.name,
          { oldRole, updates }
        )
      }

      const membersWithRole = await this.getMembersWithRole(serverId, roleId)
      membersWithRole.forEach(userId => {
        roleSyncService.forceRefreshUserPermissions(userId, serverId)
          .catch(error => console.error('Failed to refresh user permissions:', error))
      })

    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async deleteRole(serverId: string, roleId: string, deletedBy?: string, deletedByName?: string): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        throw new Error('Server not found')
      }

      const server = serverDoc.data() as Server
      const roles = server.roles || []
      const role = roles.find(r => r.id === roleId)
      
      if (!role) {
        throw new Error('Role not found')
      }

      if (role.name === '@everyone' || role.name === 'Owner') {
        throw new Error('Cannot delete protected roles')
      }

      const updatedRoles = roles.filter(r => r.id !== roleId)

      await updateDoc(serverRef, {
        roles: updatedRoles
      })

      const membersQuery = query(
        collection(db, 'serverMembers'),
        where('serverId', '==', serverId)
      )
      
      const membersSnapshot = await getDocs(membersQuery)
      const affectedMembers: string[] = []
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data()
        if (memberData.roles && memberData.roles.includes(roleId)) {
          const updatedMemberRoles = memberData.roles.filter((r: string) => r !== roleId)
          await updateDoc(memberDoc.ref, {
            roles: updatedMemberRoles
          })
          affectedMembers.push(memberData.userId)
        }
      }

      if (deletedBy && deletedByName) {
        await this.createAuditLog(
          serverId,
          deletedBy,
          deletedByName,
          'ROLE_DELETED',
          roleId,
          role.name,
          { affectedMembers: affectedMembers.length }
        )
      }

      affectedMembers.forEach(userId => {
        roleSyncService.forceRefreshUserPermissions(userId, serverId)
          .catch(error => console.error('Failed to refresh user permissions:', error))
      })

    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async reorderRoles(serverId: string, roles: Role[]): Promise<void> {
    try {
      const serverRef = doc(db, 'servers', serverId)
      const cleanedRoles = cleanForFirestore(roles)
      await updateDoc(serverRef, {
        roles: cleanedRoles
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
        const data = doc.data()
        servers.push({
          id: doc.id,
          ...data,
          channels: data.channels || [],
          categories: data.categories || [],
          roles: data.roles || []
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
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        channels: data.channels || [],
        categories: data.categories || [],
        roles: data.roles || []
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
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ...data,
          channels: data.channels || [],
          categories: data.categories || [],
          roles: data.roles || []
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
      const roles = serverData.roles || []
      const memberRoles = memberData.roles || []
      
      return roles.filter(role => 
        memberRoles.includes(role.id) || role.id === 'everyone'
      )
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async assignRoleToUser(serverId: string, userId: string, roleId: string, assignedBy?: string, assignedByName?: string): Promise<void> {
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

      const updatedRoles = [...currentRoles, roleId]

      await updateDoc(memberDocRef, {
        roles: updatedRoles
      })

      const server = await this.getServer(serverId)
      const role = server?.roles.find(r => r.id === roleId)

      if (assignedBy && assignedByName && role) {
        await this.createAuditLog(
          serverId,
          assignedBy,
          assignedByName,
          'ROLE_ASSIGNED',
          userId,
          memberData.username || 'Unknown User',
          { roleName: role.name, roleId }
        )
      }

      roleSyncService.forceRefreshUserPermissions(userId, serverId)
        .catch(error => console.error('Failed to refresh user permissions:', error))

    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async removeRoleFromUser(serverId: string, userId: string, roleId: string, removedBy?: string, removedByName?: string): Promise<void> {
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

      const server = await this.getServer(serverId)
      const role = server?.roles.find(r => r.id === roleId)

      if (removedBy && removedByName && role) {
        await this.createAuditLog(
          serverId,
          removedBy,
          removedByName,
          'ROLE_REMOVED',
          userId,
          memberData.username || 'Unknown User',
          { roleName: role.name, roleId }
        )
      }

      roleSyncService.forceRefreshUserPermissions(userId, serverId)
        .catch(error => console.error('Failed to refresh user permissions:', error))

    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getMembersWithRole(serverId: string, roleId: string): Promise<string[]> {
    try {
      const membersQuery = query(
        collection(db, 'serverMembers'),
        where('serverId', '==', serverId)
      )
      
      const membersSnapshot = await getDocs(membersQuery)
      const membersWithRole: string[] = []
      
      membersSnapshot.forEach((doc) => {
        const memberData = doc.data()
        if (memberData.roles && memberData.roles.includes(roleId)) {
          membersWithRole.push(memberData.userId)
        }
      })
      
      return membersWithRole
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
      const channels = server.channels || []
      const maxPosition = Math.max(...channels.filter(ch => ch.categoryId === categoryId).map(ch => ch.position), -1)
      
      const newChannel: Channel = {
        id: `${type}_${Date.now()}`,
        name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type,
        categoryId: categoryId || '',
        description: 'Channel description',
        position: maxPosition + 1,
        permissions: permissions || [],
        createdAt: new Date()
      }

      const cleanedChannel = cleanForFirestore(newChannel)
      await updateDoc(serverRef, {
        channels: [...channels, cleanedChannel]
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
      const channels = server.channels || []
      const updatedChannels = channels.map(channel => 
        channel.id === channelId ? cleanForFirestore({ ...channel, ...updates }) : channel
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
      const categories = server.categories || []
      const maxPosition = Math.max(...categories.map(cat => cat.position), -1)
      
      const newCategory: Category = {
        id: `category_${Date.now()}`,
        name,
        position: maxPosition + 1,
        collapsed: false,
        permissions: permissions || [],
        createdAt: new Date()
      }

      const cleanedCategory = cleanForFirestore(newCategory)
      await updateDoc(serverRef, {
        categories: [...categories, cleanedCategory]
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
      const categories = server.categories || []
      const updatedCategories = categories.map(category => 
        category.id === categoryId ? cleanForFirestore({ ...category, ...updates }) : category
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
      const categories = server.categories || []
      const channels = server.channels || []
      
      const updatedCategories = categories.filter(cat => cat.id !== categoryId)
      
      const updatedChannels = channels.map(channel => 
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
      const cleanedData = cleanForFirestore({
        channels,
        categories
      })
      await updateDoc(serverRef, cleanedData)
    } catch (error: any) {
      throw new Error(error.message)
    }
  }
}