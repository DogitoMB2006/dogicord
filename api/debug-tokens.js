// Debug API endpoint to check FCM tokens for a user
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'userId parameter required' })
    }

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
    const messaging = admin.messaging()

    // Get all tokens for the user
    const tokensSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('fcmTokens')
      .get()

    if (tokensSnapshot.empty) {
      return res.status(200).json({
        success: true,
        userId,
        totalTokens: 0,
        activeTokens: 0,
        tokens: [],
        message: 'No FCM tokens found for this user'
      })
    }

    const tokens = []
    let activeCount = 0

    // Process each token
    for (const doc of tokensSnapshot.docs) {
      const tokenData = doc.data()
      const isActive = tokenData.isActive === true
      
      if (isActive) activeCount++

      // Test token validity
      let tokenValid = null
      let validationError = null

      if (isActive && tokenData.token) {
        try {
          // Try to send a dry-run message to validate the token
          await messaging.send({
            token: tokenData.token,
            notification: {
              title: 'Test',
              body: 'Test'
            }
          }, true) // dry-run = true
          
          tokenValid = true
        } catch (error) {
          tokenValid = false
          validationError = error.code || error.message
          console.log(`Token validation failed for ${tokenData.token.substring(0, 20)}...: ${validationError}`)
        }
      }

      tokens.push({
        id: doc.id,
        isActive,
        tokenPreview: tokenData.token ? `${tokenData.token.substring(0, 20)}...${tokenData.token.slice(-10)}` : 'No token',
        userAgent: tokenData.userAgent,
        createdAt: tokenData.createdAt?.toDate?.()?.toISOString() || 'Unknown',
        lastUsed: tokenData.lastUsed?.toDate?.()?.toISOString() || 'Unknown',
        deactivatedAt: tokenData.deactivatedAt?.toDate?.()?.toISOString() || null,
        deactivationReason: tokenData.deactivationReason || null,
        isValid: tokenValid,
        validationError
      })
    }

    // Sort tokens by creation date (newest first)
    tokens.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const result = {
      success: true,
      userId,
      totalTokens: tokens.length,
      activeTokens: activeCount,
      validTokens: tokens.filter(t => t.isValid === true).length,
      invalidTokens: tokens.filter(t => t.isValid === false).length,
      untestedTokens: tokens.filter(t => t.isValid === null).length,
      tokens,
      timestamp: new Date().toISOString()
    }

    console.log(`📊 Token debug for user ${userId}:`, {
      total: result.totalTokens,
      active: result.activeTokens,
      valid: result.validTokens,
      invalid: result.invalidTokens
    })

    return res.status(200).json(result)

  } catch (error) {
    console.error('Debug tokens error:', error)
    return res.status(500).json({
      success: false,
      error: 'Debug tokens failed',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
