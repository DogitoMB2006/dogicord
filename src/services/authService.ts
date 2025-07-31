
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

export interface UserProfile {
  uid: string
  email: string
  username: string
  displayName: string
  createdAt: Date
  lastActive: Date
}

export const authService = {
  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const q = query(collection(db, 'users'), where('username', '==', username))
      const querySnapshot = await getDocs(q)
      return querySnapshot.empty
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getUserByUsernameOrEmail(usernameOrEmail: string): Promise<UserProfile | null> {
    try {
      // Check if it's an email format
      const isEmail = usernameOrEmail.includes('@')
      
      if (isEmail) {
        const q = query(collection(db, 'users'), where('email', '==', usernameOrEmail))
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data() as UserProfile
        }
      } else {
        const q = query(collection(db, 'users'), where('username', '==', usernameOrEmail))
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data() as UserProfile
        }
      }
      
      return null
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async register(email: string, username: string, password: string): Promise<User> {
    try {
      const isUsernameAvailable = await this.checkUsernameAvailability(username)
      if (!isUsernameAvailable) {
        throw new Error('Username is already taken')
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      await updateProfile(user, {
        displayName: username
      })
      
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        username: username,
        displayName: username,
        createdAt: new Date(),
        lastActive: new Date()
      }
      
      await setDoc(doc(db, 'users', user.uid), userProfile)
      
      return user
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async login(usernameOrEmail: string, password: string): Promise<User> {
    try {
      let email = usernameOrEmail
  
      if (!usernameOrEmail.includes('@')) {
        const userProfile = await this.getUserByUsernameOrEmail(usernameOrEmail)
        if (!userProfile) {
          throw new Error('auth/user-not-found')
        }
        email = userProfile.email
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      await setDoc(doc(db, 'users', user.uid), {
        lastActive: new Date()
      }, { merge: true })
      
      return user
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async logout(): Promise<void> {
    try {
      await signOut(auth)
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', uid)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile
      }
      return null
    } catch (error: any) {
      throw new Error(error.message)
    }
  },

  getCurrentUser(): User | null {
    return auth.currentUser
  }
}