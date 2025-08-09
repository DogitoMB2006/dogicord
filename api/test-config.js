// Test API endpoint to verify Firebase configuration
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
    console.log('🔧 Firebase Configuration Test')
    
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ]

    const config = {}
    const missing = []
    const present = []

    requiredEnvVars.forEach(varName => {
      if (process.env[varName]) {
        present.push(varName)
        // Only show first/last few chars for security
        if (varName === 'FIREBASE_PRIVATE_KEY') {
          config[varName] = `${process.env[varName].substring(0, 20)}...${process.env[varName].slice(-20)}`
        } else {
          config[varName] = varName === 'FIREBASE_CLIENT_EMAIL' 
            ? process.env[varName] 
            : `${process.env[varName].substring(0, 10)}...`
        }
      } else {
        missing.push(varName)
      }
    })

    // Test Firebase Admin initialization
    let adminInitialized = false
    let adminError = null

    try {
      const adminModule = await import('firebase-admin')
      const admin = adminModule.default || adminModule

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

        console.log('✅ Firebase Admin initialized successfully')
      }

      // Test Firestore connection
      const db = admin.firestore()
      await db.collection('test').limit(1).get()
      
      // Test Messaging service
      const messaging = admin.messaging()
      
      adminInitialized = true
      console.log('✅ Firebase services accessible')
      
    } catch (error) {
      adminError = error.message
      console.error('❌ Firebase Admin initialization failed:', error)
    }

    const result = {
      success: missing.length === 0 && adminInitialized,
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform
      },
      configuration: {
        requiredVars: requiredEnvVars.length,
        presentVars: present.length,
        missingVars: missing.length,
        present,
        missing
      },
      firebase: {
        adminInitialized,
        adminError,
        configSample: missing.length === 0 ? config : null
      },
      status: missing.length === 0 && adminInitialized ? 'READY' : 'NEEDS_SETUP'
    }

    const statusCode = result.success ? 200 : 500

    console.log(`🔧 Configuration test result: ${result.status}`)
    
    return res.status(statusCode).json(result)

  } catch (error) {
    console.error('Configuration test error:', error)
    return res.status(500).json({
      success: false,
      error: 'Configuration test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}