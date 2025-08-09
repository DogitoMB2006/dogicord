// Simple notification broadcaster API
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { targetUserId, notification } = req.body

    if (!targetUserId || !notification) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    console.log('📤 Broadcasting notification:', {
      targetUserId,
      title: notification.title,
      body: notification.body
    })

    // Store notification in database for real-time pickup
    // Import Firebase Admin
    const adminModule = await import('firebase-admin')
    const admin = adminModule.default || adminModule

    // Initialize if not already done
    if (!admin.apps.length) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
      })
    }

    const db = admin.firestore()

    // Store notification for real-time pickup by client
    const notificationData = {
      id: admin.firestore.FieldValue.serverTimestamp(),
      targetUserId,
      title: notification.title,
      body: notification.body,
      url: notification.url || '/',
      icon: notification.icon || '/vite.svg',
      data: notification.data || {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      delivered: false
    }

    // Store in user's notification queue
    await db.collection('users').doc(targetUserId).collection('notifications').add(notificationData)

    console.log('✅ Notification stored for real-time delivery')

    return res.status(200).json({
      success: true,
      message: 'Notification queued for delivery'
    })

  } catch (error) {
    console.error('Web push send error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}
