import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: "https://chatroom-6b928-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: "G-QP66H024GT"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// FCM Configuration
let messaging: any = null
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app)
  }
})
export { messaging }

// VAPID Key for FCM Web Push
export const vapidKey = 'BAZgSdgsooq2tH0d0ZAFx7PfdMK0G3etNJO-UxJlyoFuXkGtzSl7POzbcIHQQ3eqkngMNfYe_xSTtwl7lDADfDQ'

export default app