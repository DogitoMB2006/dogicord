// Vercel API Route for managing FCM tokens
// POST: Save/update FCM token for a user
// DELETE: Remove/deactivate FCM token

const admin = require('firebase-admin')

// Initialize Firebase Admin SDK if not already done
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

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'POST') {
      // Save/update FCM token
      const { userId, token, userAgent } = req.body

      if (!userId || !token) {
        return res.status(400).json({ error: 'Missing userId or token' })
      }

      // Validate token format (basic check)
      if (typeof token !== 'string' || token.length < 50) {
        return res.status(400).json({ error: 'Invalid token format' })
      }

      const tokenData = {
        token,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsed: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: userAgent || 'Unknown',
        isActive: true
      }

      // Use token as document ID for easy retrieval and deduplication
      await db.collection('users').doc(userId).collection('fcmTokens').doc(token).set(tokenData, { merge: true })

      // Clean up old inactive tokens for this user (keep only last 10)
      await cleanupOldTokens(userId)

      return res.status(200).json({
        success: true,
        message: 'FCM token saved successfully',
        tokenId: token.substring(0, 20) + '...'
      })
    }

    if (req.method === 'DELETE') {
      // Deactivate FCM token
      const { userId, token } = req.body

      if (!userId || !token) {
        return res.status(400).json({ error: 'Missing userId or token' })
      }

      // Mark token as inactive instead of deleting (for audit purposes)
      await db.collection('users').doc(userId).collection('fcmTokens').doc(token).update({
        isActive: false,
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
      })

      return res.status(200).json({
        success: true,
        message: 'FCM token deactivated successfully'
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in fcm-tokens API:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

async function cleanupOldTokens(userId) {
  try {
    const tokensSnapshot = await db.collection('users').doc(userId).collection('fcmTokens')
      .where('isActive', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(50) // Get up to 50 inactive tokens
      .get()

    // Delete tokens older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const batch = db.batch()
    let deleteCount = 0

    tokensSnapshot.forEach(doc => {
      const tokenData = doc.data()
      const createdAt = tokenData.createdAt?.toDate?.() || new Date(tokenData.createdAt)
      
      if (createdAt < thirtyDaysAgo) {
        batch.delete(doc.ref)
        deleteCount++
      }
    })

    if (deleteCount > 0) {
      await batch.commit()
      console.log(`Cleaned up ${deleteCount} old FCM tokens for user ${userId}`)
    }
  } catch (error) {
    console.error('Error cleaning up old tokens:', error)
  }
}
