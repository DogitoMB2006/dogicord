
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log('Test config API called')
    
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID', 
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ]

    const envStatus = {}
    requiredVars.forEach(varName => {
      envStatus[varName] = {
        exists: !!process.env[varName],
        length: process.env[varName] ? process.env[varName].length : 0
      }
    })

    const missingVars = requiredVars.filter(varName => !process.env[varName])
    const allFirebaseVars = Object.keys(process.env).filter(key => key.startsWith('FIREBASE_'))
    
    console.log('Environment check:', { missingVars, allFirebaseVars })

    if (missingVars.length > 0) {
      return res.status(500).json({
        error: 'Missing environment variables',
        missingVars,
        envStatus,
        allFirebaseVars,
        message: 'Please add the missing Firebase Admin SDK environment variables in Vercel Dashboard'
      })
    }

    const hasValidPrivateKey = process.env.FIREBASE_PRIVATE_KEY && 
                               process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')
    
    let hasFirebaseAdmin = false
    try {
      await import('firebase-admin')
      hasFirebaseAdmin = true
    } catch (error) {
      console.error('firebase-admin not available:', error)
    }
    
    return res.status(200).json({
      success: true,
      message: 'Configuration test completed',
      config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        hasValidPrivateKey,
        hasFirebaseAdmin,
        databaseUrl: process.env.FIREBASE_DATABASE_URL || 'Not set (optional)',
        envStatus,
        allFirebaseVars
      }
    })

  } catch (error) {
    console.error('Configuration test error:', error)
    return res.status(500).json({
      error: 'Configuration test failed',
      details: error.message,
      stack: error.stack
    })
  }
}
