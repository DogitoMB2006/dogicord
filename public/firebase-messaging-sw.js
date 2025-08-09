// Firebase Cloud Messaging Service Worker
// This file handles background push notifications when the app is closed

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Initialize Firebase in service worker
// Using the same config as the main app
const firebaseConfig = {
  apiKey: "AIzaSyA8KxZlAYOUDf2wT8sIsUjCUmYbaNR0tyQ",
  authDomain: "chatroom-6b928.firebaseapp.com", 
  databaseURL: "https://chatroom-6b928-default-rtdb.firebaseio.com",
  projectId: "chatroom-6b928",
  storageBucket: "chatroom-6b928.appspot.com",
  messagingSenderId: "709627572679",
  appId: "709627572679:web:348575b839909fc80f29e2"
}

firebase.initializeApp(firebaseConfig)

// Initialize messaging
const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload)
  
  // Extract notification data
  const notificationTitle = payload.notification?.title || 'New message'
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/vite.svg', // App icon
    badge: '/vite.svg', // Small badge icon
    tag: 'dogicord-message', // Prevents duplicate notifications
    requireInteraction: false, // Auto-dismiss after timeout
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/vite.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/vite.svg'
      }
    ],
    data: {
      serverId: payload.data?.serverId,
      channelId: payload.data?.channelId,
      messageId: payload.data?.messageId,
      url: payload.data?.url || '/'
    }
  }

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received:', event)
  
  event.notification.close()
  
  // Handle action clicks
  if (event.action === 'close') {
    return
  }
  
  // Open or focus the app
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      
      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event)
})

// iOS compatibility note:
// PWA notifications on iOS require iOS 16.4+ and proper PWA installation
// Users should add the app to home screen for full notification support
