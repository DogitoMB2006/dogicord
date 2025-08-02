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
import { DEFAULT_ROLES } from '../types/permissions'

export interface Server {
  id: string
  name: string
  ownerId: string
  members: string[]
  inviteCode: string
  createdAt: Date
  channels: Channel[]
  roles: Role[]
  icon?: string
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  category: string
  createdAt: Date
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
      
      const defaultChannels: Channel[] = [
        {
          id: 'general',
          name: 'general',
          type: 'text',
          category: 'Text Channels',
          createdAt: new Date()
        },
        {
          id: 'random',
          name: 'random', 
          type: 'text',
          category: 'Text Channels',
          createdAt: new Date()
        },
        {
          id: 'general-voice',
          name: 'General',
          type: 'voice',
          category: 'Voice Channels',
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
        roles: defaultRoles
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
        category: type === 'text' ? 'Text Channels' : 'Voice Channels',
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
  }
}