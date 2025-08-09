// Firebase Cloud Messaging Service Worker - OPTIMIZED
// This file handles background push notifications with improved performance

// Use latest Firebase version for better performance
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js')

// Cache Firebase config to avoid repeated initialization
let firebaseApp = null
let messaging = null

// Initialize Firebase in service worker with performance optimizations
const firebaseConfig = {
  apiKey: "AIzaSyA8KxZlAYOUDf2wT8sIsUjCUmYbaNR0tyQ",
  authDomain: "chatroom-6b928.firebaseapp.com", 
  databaseURL: "https://chatroom-6b928-default-rtdb.firebaseio.com",
  projectId: "chatroom-6b928",
  storageBucket: "chatroom-6b928.appspot.com",
  messagingSenderId: "709627572679",
  appId: "709627572679:web:348575b839909fc80f29e2"
}

// Initialize only once
if (!firebaseApp) {
  firebaseApp = firebase.initializeApp(firebaseConfig)
  messaging = firebase.messaging()
  console.log('🔥 Firebase initialized in Service Worker at:', new Date().toISOString())
}

// Ensure clicks open/focus the correct client
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // If already open, just focus
        if ('focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// Handle background messages with performance optimizations
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 [SW] FCM Background message received at:', new Date().toISOString())
  console.log('🔔 [SW] Full payload:', JSON.stringify(payload, null, 2))
  console.log('🔔 [SW] Notification data:', payload.notification)
  console.log('🔔 [SW] Custom data:', payload.data)
  
  // Fast notification processing
  const notificationTitle = payload.notification?.title || 'Dogicord'
  const notificationOptions = {
    body: payload.notification?.body || 'New message',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: `dogicord-${Date.now()}`, // Unique tag to ensure all notifications show
    requireInteraction: false,
    renotify: true, // Always show even if tag exists
    silent: false, // Ensure sound/vibration
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    timestamp: Date.now(),
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/vite.svg'
      }
    ],
    data: {
      serverId: payload.data?.serverId,
      channelId: payload.data?.channelId,
      messageId: payload.data?.messageId,
      url: payload.data?.url || '/',
      timestamp: Date.now()
    }
  }

  console.log('🔔 [SW] Showing notification with options:', notificationOptions)

  // Force notification display with error handling
  const notificationPromise = self.registration.showNotification(notificationTitle, notificationOptions)
    .then(() => {
      console.log('✅ [SW] Background notification shown successfully at:', new Date().toISOString())
      return true
    })
    .catch((error) => {
      console.error('❌ [SW] Failed to show background notification:', error)
      
      // Fallback: Try with minimal options
      return self.registration.showNotification(notificationTitle, {
        body: notificationOptions.body,
        icon: '/vite.svg',
        tag: `dogicord-fallback-${Date.now()}`
      }).then(() => {
        console.log('✅ [SW] Fallback notification shown')
        return true
      }).catch((fallbackError) => {
        console.error('❌ [SW] Even fallback notification failed:', fallbackError)
        return false
      })
    })

  // Always return the promise to prevent SW from terminating
  return notificationPromise
})

// Optimized notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received:', event)
  
  event.notification.close()
  
  // Skip close action
  if (event.action === 'close') {
    return
  }
  
  // Get target URL with fast resolution
  const targetUrl = event.notification.data?.url || '/'
  
  event.waitUntil(
    // Fast client matching with better performance
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Prioritize existing clients
      for (const client of clientList) {
        if (client.url && (client.url.includes('dogicord') || client.url.includes(location.origin))) {
          if ('focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data
            })
            return client.focus()
          }
        }
      }
      
      // Open new window if no existing client found
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    }).catch((error) => {
      console.error('Error handling notification click:', error)
      // Fallback: always try to open window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event)
})

// Background Sync handler for queued notifications
self.addEventListener('sync', (event) => {
  console.log('[firebase-messaging-sw.js] Background sync triggered:', event.tag)
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(processQueuedNotifications())
  }
})

// Process queued notifications during background sync
async function processQueuedNotifications() {
  try {
    // Get queued notifications from IndexedDB or localStorage
    const queuedNotifications = await getQueuedNotifications()
    
    if (queuedNotifications.length === 0) {
      console.log('No queued notifications to process')
      return
    }

    console.log(`Processing ${queuedNotifications.length} queued notifications`)

    // Process each notification
    for (const notification of queuedNotifications) {
      try {
        // Send notification via background fetch
        await sendQueuedNotification(notification)
        
        // Remove from queue on success
        await removeQueuedNotification(notification.id)
        
        // Notify main app
        const clients = await self.clients.matchAll()
        clients.forEach(client => {
          client.postMessage({
            type: 'NOTIFICATION_PROCESSED',
            notificationId: notification.id
          })
        })
      } catch (error) {
        console.error('Failed to process queued notification:', error)
        
        // Increment retry count
        notification.retryCount = (notification.retryCount || 0) + 1
        
        if (notification.retryCount >= 3) {
          // Remove after max retries
          await removeQueuedNotification(notification.id)
        } else {
          // Update retry count
          await updateQueuedNotification(notification)
        }
      }
    }
  } catch (error) {
    console.error('Background sync processing error:', error)
  }
}

// Get queued notifications from storage
async function getQueuedNotifications() {
  try {
    // Try IndexedDB first, fallback to localStorage
    return await getFromIndexedDB('notifications') || []
  } catch (error) {
    console.error('Failed to get queued notifications:', error)
    return []
  }
}

// Remove queued notification
async function removeQueuedNotification(notificationId) {
  try {
    await removeFromIndexedDB('notifications', notificationId)
  } catch (error) {
    console.error('Failed to remove queued notification:', error)
  }
}

// Update queued notification
async function updateQueuedNotification(notification) {
  try {
    await saveToIndexedDB('notifications', notification)
  } catch (error) {
    console.error('Failed to update queued notification:', error)
  }
}

// Send queued notification
async function sendQueuedNotification(notification) {
  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        id: notification.messageId,
        serverId: notification.serverId,
        channelId: notification.channelId,
        authorId: notification.userId,
        authorName: notification.authorName || 'User',
        content: notification.body
      },
      serverName: notification.serverName || 'Server',
      channelName: notification.channelName || 'Channel'
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Simple IndexedDB helpers
async function getFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DogicordDB', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const getRequest = store.getAll()
      
      getRequest.onsuccess = () => resolve(getRequest.result)
      getRequest.onerror = () => reject(getRequest.error)
    }
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' })
      }
    }
  })
}

async function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DogicordDB', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const putRequest = store.put(data)
      
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }
  })
}

async function removeFromIndexedDB(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DogicordDB', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const deleteRequest = store.delete(id)
      
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => reject(deleteRequest.error)
    }
  })
}

// iOS/Android compatibility optimizations:
// - PWA installation required for iOS 16.4+ notifications
// - Background processing requires service worker registration
// - Notification channels supported on Android 8.0+
