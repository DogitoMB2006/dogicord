import { doc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage'
import { updateProfile } from 'firebase/auth'
import { db, auth } from '../config/firebase'

export const profileService = {
  async checkUsernameAvailability(username: string, currentUserId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', username)
      )
      
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) return true
      
      const existingUser = querySnapshot.docs[0]
      return existingUser.id === currentUserId
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async uploadAvatar(file: File, userId: string): Promise<string> {
    try {
      const storage = getStorage()
      const fileExtension = file.name.split('.').pop()
      const fileName = `${userId}_${Date.now()}.${fileExtension}`
      const avatarRef = ref(storage, `avatars/${fileName}`)
      
      const snapshot = await uploadBytes(avatarRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return downloadURL
    } catch (error: any) {
      throw new Error('Failed to upload avatar: ' + error.message)
    }
  },

  async deleteAvatar(avatarUrl: string): Promise<void> {
    try {
      const storage = getStorage()
      const avatarRef = ref(storage, avatarUrl)
      await deleteObject(avatarRef)
    } catch (error: any) {
      console.warn('Failed to delete old avatar:', error.message)
    }
  },

  async updateUserProfile(userId: string, updates: {
    username?: string
    avatar?: string
    displayName?: string
  }): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId)
      
      const updateData: any = {}
      if (updates.username) updateData.username = updates.username
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar
      if (updates.displayName) updateData.displayName = updates.displayName
      
      await updateDoc(userRef, updateData)
      
      if (auth.currentUser && updates.displayName) {
        await updateProfile(auth.currentUser, {
          displayName: updates.displayName
        })
      }
    } catch (error: any) {
      throw new Error('Failed to update profile: ' + error.message)
    }
  }
}