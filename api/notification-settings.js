// Vercel API Route for managing notification settings
// GET: Retrieve notification settings for a user and server
// POST: Update notification settings

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Import and initialize Firebase Admin SDK
    const adminModule = await import('firebase-admin')
    const admin = adminModule.default || adminModule
    
    // Initialize if not already done
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
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
      })
    }

    const db = admin.firestore()
    
    const { userId, serverId } = req.query

    if (!userId || !serverId) {
      return res.status(400).json({ error: 'Missing userId or serverId' })
    }

    const settingId = `${userId}_${serverId}`

    if (req.method === 'GET') {
      // Get notification settings
      const settingsDoc = await db.collection('notificationSettings').doc(settingId).get()
      
      if (settingsDoc.exists) {
        const settings = settingsDoc.data()
        return res.status(200).json({
          success: true,
          settings: {
            userId: settings.userId,
            serverId: settings.serverId,
            isMuted: settings.isMuted || false,
            onlyMentions: settings.onlyMentions || false,
            createdAt: settings.createdAt?.toDate?.() || settings.createdAt,
            updatedAt: settings.updatedAt?.toDate?.() || settings.updatedAt
          }
        })
      } else {
        // Return default settings if none exist
        return res.status(200).json({
          success: true,
          settings: {
            userId,
            serverId,
            isMuted: false,
            onlyMentions: false,
            createdAt: null,
            updatedAt: null
          }
        })
      }
    }

    if (req.method === 'POST') {
      // Update notification settings
      const { isMuted, onlyMentions } = req.body

      const settingsData = {
        userId,
        serverId,
        isMuted: isMuted !== undefined ? isMuted : false,
        onlyMentions: onlyMentions !== undefined ? onlyMentions : false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      // Add createdAt only if document doesn't exist
      const settingsDoc = await db.collection('notificationSettings').doc(settingId).get()
      if (!settingsDoc.exists) {
        settingsData.createdAt = admin.firestore.FieldValue.serverTimestamp()
      }

      await db.collection('notificationSettings').doc(settingId).set(settingsData, { merge: true })

      return res.status(200).json({
        success: true,
        message: 'Notification settings updated',
        settings: {
          userId,
          serverId,
          isMuted: settingsData.isMuted,
          onlyMentions: settingsData.onlyMentions
        }
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in notification-settings API:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
