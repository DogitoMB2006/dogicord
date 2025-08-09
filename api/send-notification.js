// Vercel API Route for sending FCM notifications
// This replaces the client-side fcmBackendService for production

const admin = require('firebase-admin')

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
  })
}

const db = admin.firestore()
const messaging = admin.messaging()

module.exports = async function handler(req, res) {
  // Enable CORS for client requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, serverName, channelName } = req.body

    if (!message || !serverName || !channelName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get server members
    const serverDoc = await db.collection('servers').doc(message.serverId).get()
    if (!serverDoc.exists) {
      return res.status(404).json({ error: 'Server not found' })
    }

    const serverData = serverDoc.data()
    const members = serverData.members || []
    
    // Filter out the message author
    const recipientIds = members.filter(memberId => memberId !== message.authorId)
    
    const results = []
    
    // Send notifications to each recipient
    for (const userId of recipientIds) {
      try {
        const result = await sendNotificationToUser(userId, message, serverName, channelName)
        results.push({ userId, success: true, result })
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error)
        results.push({ userId, success: false, error: error.message })
      }
    }

    return res.status(200).json({
      success: true,
      results,
      totalRecipients: recipientIds.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in send-notification API:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

async function sendNotificationToUser(userId, message, serverName, channelName) {
  // Check if server is muted for this user
  const settingsDoc = await db.collection('notificationSettings').doc(`${userId}_${message.serverId}`).get()
  if (settingsDoc.exists) {
    const settings = settingsDoc.data()
    if (settings.isMuted) {
      return { skipped: true, reason: 'Server muted' }
    }
  }

  // Get user's active FCM tokens
  const tokensSnapshot = await db.collection('users').doc(userId).collection('fcmTokens')
    .where('isActive', '==', true)
    .get()

  if (tokensSnapshot.empty) {
    return { skipped: true, reason: 'No active tokens' }
  }

  const tokens = []
  tokensSnapshot.forEach(doc => {
    tokens.push(doc.data().token)
  })

  // Create notification payload
  const payload = createNotificationPayload(message, serverName, channelName)
  
  // Send to all user's tokens
  const results = []
  for (const token of tokens) {
    try {
      const result = await sendToToken(token, payload)
      results.push({ token: token.substring(0, 20) + '...', success: true, messageId: result })
    } catch (error) {
      console.error(`Failed to send to token ${token}:`, error)
      results.push({ token: token.substring(0, 20) + '...', success: false, error: error.message })
      
      // Mark token as inactive if it's invalid
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        await markTokenAsInactive(userId, token)
      }
    }
  }

  return { tokens: results }
}

function createNotificationPayload(message, serverName, channelName) {
  // Truncate message content for notification
  const maxLength = 100
  const messageContent = message.content.length > maxLength
    ? message.content.substring(0, maxLength) + '...'
    : message.content

  // Handle GIF messages
  const isGifMessage = message.content.includes('giphy.com') || message.content.includes('.gif')
  const notificationBody = isGifMessage 
    ? `${message.authorName} sent a GIF`
    : `${message.authorName}: ${messageContent}`

  return {
    notification: {
      title: `#${channelName} in ${serverName}`,
      body: notificationBody,
      icon: '/vite.svg'
    },
    data: {
      serverId: message.serverId,
      channelId: message.channelId,
      messageId: message.id,
      url: `/?server=${message.serverId}&channel=${message.channelId}`,
      click_action: `/?server=${message.serverId}&channel=${message.channelId}`
    },
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        requireInteraction: false,
        badge: '/vite.svg',
        tag: 'dogicord-message',
        renotify: true,
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
        ]
      }
    }
  }
}

async function sendToToken(token, payload) {
  const message = {
    token,
    notification: payload.notification,
    data: payload.data,
    webpush: payload.webpush
  }

  const response = await messaging.send(message)
  return response
}

async function markTokenAsInactive(userId, token) {
  try {
    const tokenDoc = await db.collection('users').doc(userId).collection('fcmTokens').doc(token).get()
    if (tokenDoc.exists) {
      await tokenDoc.ref.update({ isActive: false })
      console.log(`Marked token as inactive: ${token.substring(0, 20)}...`)
    }
  } catch (error) {
    console.error('Failed to mark token as inactive:', error)
  }
}
