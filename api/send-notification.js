// Vercel API Route for sending FCM notifications (ES modules)
// Sends real push notifications via Firebase Admin SDK

export default async function handler(req, res) {
  console.log('🔔 FCM Notification API called:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent']?.substring(0, 100)
  })

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID', 
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ]
    const missingVars = requiredEnvVars.filter(v => !process.env[v])
    if (missingVars.length > 0) {
      console.error('❌ Missing required Firebase environment variables:', missingVars)
      return res.status(500).json({ 
        error: 'Firebase configuration incomplete', 
        missingVars,
        help: 'Check your Vercel environment variables configuration'
      })
    }
    
    console.log('✅ All required Firebase environment variables are present')

    // Import firebase-admin as ES module
    let adminMod = await import('firebase-admin')
    const admin = adminMod.default || adminMod

    // Initialize Admin SDK once
    if (!admin.apps.length) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
          process.env.FIREBASE_DATABASE_URL ||
          `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
      })
    }

    const db = admin.firestore()
    const messaging = admin.messaging()

      const { message, serverName, channelName, authorId } = req.body || {}
  
  console.log('📨 Processing notification request:', {
    hasMessage: !!message,
    serverName,
    channelName,
    messageAuthor: message?.authorName,
    messageAuthorId: message?.authorId,
    messageServerId: message?.serverId,
    messageChannelId: message?.channelId,
    messageContent: message?.content?.substring(0, 50) + '...',
    fullMessage: JSON.stringify(message, null, 2)
  })
  
  if (!message || !serverName || !channelName) {
    console.log('❌ Missing required fields:', { message: !!message, serverName, channelName })
    return res.status(400).json({ error: 'Missing required fields' })
  }

    // Get server members
    const serverDoc = await db.collection('servers').doc(message.serverId).get()
    if (!serverDoc.exists) {
      return res.status(404).json({ error: 'Server not found' })
    }

    const members = Array.isArray(serverDoc.data()?.members)
      ? serverDoc.data().members
      : []

    // Exclude author from notifications
    const recipientIds = members.filter((id) => id && id !== message.authorId)
    
    if (recipientIds.length === 0) {
      console.log('ℹ️ No recipients to notify (only author in server)')
      return res.status(200).json({
        success: true,
        totalRecipients: 0,
        totalSuccess: 0,
        totalFailures: 0,
        message: 'No recipients to notify'
      })
    }
    
    console.log(`📬 Sending notifications to ${recipientIds.length} recipients for message in ${channelName}`)

    // Build notification body
    const isGif = typeof message.content === 'string' && (message.content.includes('.gif') || message.content.includes('giphy.com'))
    const maxLen = 120
    const clipped = (message.content || '').slice(0, maxLen) + ((message.content || '').length > maxLen ? '…' : '')
    const body = isGif ? `${message.authorName} sent a GIF` : `${message.authorName}: ${clipped}`

    const results = []

    for (const userId of recipientIds) {
      // Skip muted users for this server
      const settingsId = `${userId}_${message.serverId}`
      const settingsSnap = await db.collection('notificationSettings').doc(settingsId).get()
      if (settingsSnap.exists && settingsSnap.data()?.isMuted) {
        results.push({ userId, skipped: true, reason: 'muted' })
        continue
      }

      // Fetch active tokens
      const tokensSnap = await db
        .collection('users')
        .doc(userId)
        .collection('fcmTokens')
        .where('isActive', '==', true)
        .get()

      if (tokensSnap.empty) {
        results.push({ userId, skipped: true, reason: 'no_tokens' })
        continue
      }

      const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean)
      if (tokens.length === 0) {
        results.push({ userId, skipped: true, reason: 'no_tokens' })
        continue
      }

      // Optimized payload for faster delivery and better platform support
      const webpush = {
        headers: { 
          Urgency: 'high',
          'Priority': 'high'
        },
        notification: {
          icon: '/vite.svg',
          badge: '/vite.svg',
          requireInteraction: false,
          tag: 'dogicord-message',
          renotify: true,
          silent: false,
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: 'Open', icon: '/vite.svg' }
          ]
        },
        fcmOptions: {
          link: `/?server=${message.serverId}&channel=${message.channelId}`
        }
      }

      // Android-specific optimizations
      const android = {
        priority: 'high',
        ttl: 300000, // 5 minutes TTL in milliseconds
        notification: {
          icon: '/vite.svg',
          color: '#7c3aed',
          tag: 'dogicord-message',
          clickAction: `/?server=${message.serverId}&channel=${message.channelId}`,
          sound: 'default',
          channelId: 'dogicord-messages'
        }
      }

      // iOS-specific optimizations (via APNS)
      const apns = {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 300)
        },
        payload: {
          aps: {
            alert: {
              title: `#${channelName} in ${serverName}`,
              body
            },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
            'content-available': 1
          },
          data: {
            serverId: String(message.serverId || ''),
            channelId: String(message.channelId || ''),
            messageId: String(message.id || '')
          }
        }
      }

      // Use optimized sendEachForMulticast with platform-specific payloads
      console.log(`📤 Sending FCM notifications to ${tokens.length} tokens for user ${userId}`)
      console.log(`📱 Tokens being used:`, tokens.map((t, idx) => `${idx + 1}. ${t.substring(0, 20)}...${t.slice(-10)}`))
      
      const fcmPayload = {
        tokens,
        notification: {
          title: `#${channelName} in ${serverName}`,
          body
        },
        data: {
          serverId: String(message.serverId || ''),
          channelId: String(message.channelId || ''),
          messageId: String(message.id || ''),
          url: `/?server=${message.serverId}&channel=${message.channelId}`,
          timestamp: String(Date.now())
        },
        webpush,
        android,
        apns
      }
      
      console.log(`🔔 Sending to FCM with payload title: "${fcmPayload.notification.title}"`)
      console.log(`🔔 Payload body: "${fcmPayload.notification.body}"`)
      console.log(`🔔 Data keys: ${Object.keys(fcmPayload.data).join(', ')}`)
      
      const sendResp = await messaging.sendEachForMulticast(fcmPayload)
      
      console.log(`📊 FCM send result for user ${userId}:`, {
        success: sendResp.successCount,
        failure: sendResp.failureCount,
        tokens: tokens.length,
        responses: sendResp.responses?.map((resp, idx) => ({
          token: `${tokens[idx]?.substring(0, 15)}...${tokens[idx]?.slice(-8)}`,
          success: resp.success,
          error: resp.error?.code || null,
          errorMessage: resp.error?.message || null,
          messageId: resp.messageId || null
        }))
      })

      // Log detailed errors for failed tokens
      if (sendResp.responses?.length) {
        const failedResponses = sendResp.responses.filter(resp => !resp.success)
        if (failedResponses.length > 0) {
          console.error(`❌ Failed token details for user ${userId}:`)
          failedResponses.forEach((resp, idx) => {
            const tokenIdx = sendResp.responses.findIndex(r => r === resp)
            console.error(`  Token ${tokenIdx + 1}: ${resp.error?.code} - ${resp.error?.message}`)
          })
        }
      }

      // Enhanced error handling with retry mechanism
      if (sendResp.responses?.length) {
        const batch = db.batch()
        const failedTokens = []
        
        sendResp.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const err = resp.error?.code || ''
            const token = tokens[idx]
            
            // Permanent failures - deactivate tokens
            if (err.includes('registration-token-not-registered') || 
                err.includes('invalid-registration-token') ||
                err.includes('invalid-argument')) {
              const tokenRef = db.collection('users').doc(userId).collection('fcmTokens').doc(token)
              batch.set(tokenRef, { 
                isActive: false, 
                deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                deactivationReason: err
              }, { merge: true })
            }
            // Temporary failures - collect for retry
            else if (err.includes('unavailable') || 
                     err.includes('internal') ||
                     err.includes('quota-exceeded')) {
              failedTokens.push({ token, error: err })
            }
          }
        })
        
        await batch.commit()

        // Implement retry for temporary failures
        if (failedTokens.length > 0) {
          console.log(`Retrying ${failedTokens.length} failed notifications for user ${userId}`)
          
          // Retry after 2 seconds
          setTimeout(async () => {
            try {
              const retryTokens = failedTokens.map(f => f.token)
              const retryResp = await messaging.sendEachForMulticast({
                tokens: retryTokens,
                notification: {
                  title: `#${channelName} in ${serverName}`,
                  body
                },
                data: {
                  serverId: String(message.serverId || ''),
                  channelId: String(message.channelId || ''),
                  messageId: String(message.id || ''),
                  url: `/?server=${message.serverId}&channel=${message.channelId}`,
                  timestamp: String(Date.now()),
                  retry: 'true'
                },
                webpush,
                android,
                apns
              })
              
              console.log(`Retry result for user ${userId}:`, {
                success: retryResp.successCount,
                failure: retryResp.failureCount
              })
            } catch (retryError) {
              console.error(`Retry failed for user ${userId}:`, retryError)
            }
          }, 2000)
        }
      }

      results.push({ userId, successCount: sendResp.successCount, failureCount: sendResp.failureCount })
    }

    const totalRecipients = results.filter(r => !r.skipped).length
    const totalSuccess = results.reduce((sum, r) => sum + (r.successCount || 0), 0)
    const totalFailures = results.reduce((sum, r) => sum + (r.failureCount || 0), 0)
    
    console.log('✅ Notification processing complete:', {
      totalRecipients,
      totalSuccess,
      totalFailures,
      skipped: results.filter(r => r.skipped).length
    })
    
    return res.status(200).json({
      success: true,
      totalRecipients,
      totalSuccess,
      totalFailures,
      results
    })
  } catch (error) {
    console.error('send-notification error:', error)
    return res.status(500).json({ error: 'Internal error', details: String(error?.message || error) })
  }
}