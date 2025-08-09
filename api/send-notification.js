// Simplified Vercel API Route for sending FCM notifications
// Temporary version for debugging

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
    console.log('API called with method:', req.method)
    console.log('Request body:', req.body)

    // Check environment variables
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID', 
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ]

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    const availableVars = Object.keys(process.env).filter(key => key.startsWith('FIREBASE_'))
    
    console.log('Missing vars:', missingVars)
    console.log('Available FIREBASE_ vars:', availableVars)

    if (missingVars.length > 0) {
      return res.status(500).json({
        error: 'Missing Firebase Admin SDK environment variables',
        missingVars,
        availableVars,
        allEnvKeys: Object.keys(process.env).length
      })
    }

    // Check firebase-admin availability
    let admin
    try {
      admin = require('firebase-admin')
      console.log('firebase-admin loaded successfully')
    } catch (error) {
      console.error('Failed to require firebase-admin:', error)
      return res.status(500).json({ 
        error: 'Firebase Admin SDK not available',
        details: error.message
      })
    }

    // For now, just return success without sending actual notifications
    const { message, serverName, channelName } = req.body

    if (!message || !serverName || !channelName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    console.log('All checks passed, would send notification for:', {
      serverId: message.serverId,
      channelId: message.channelId,
      serverName,
      channelName
    })

    return res.status(200).json({
      success: true,
      message: 'Notification API is working (notifications temporarily disabled for debugging)',
      results: [],
      totalRecipients: 0,
      timestamp: new Date().toISOString(),
      debug: {
        hasFirebaseAdmin: !!admin,
        missingVars,
        availableVars
      }
    })

  } catch (error) {
    console.error('Error in send-notification API:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    })
  }
}