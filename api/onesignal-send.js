// OneSignal notification sender API
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

    // OneSignal REST API configuration
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return res.status(500).json({ 
        error: 'OneSignal not configured',
        help: 'Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY environment variables'
      })
    }

    // Prepare OneSignal notification payload
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: [targetUserId],
      headings: { en: notification.title },
      contents: { en: notification.body },
      url: notification.url || '/',
      chrome_web_icon: notification.icon || '/vite.svg',
      firefox_icon: notification.icon || '/vite.svg',
      data: notification.data || {}
    }

    console.log('📤 Sending OneSignal notification:', {
      targetUserId,
      title: notification.title,
      body: notification.body
    })

    // Send to OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (response.ok && result.id) {
      console.log('✅ OneSignal notification sent:', result.id)
      return res.status(200).json({
        success: true,
        notificationId: result.id,
        recipients: result.recipients || 0
      })
    } else {
      console.error('❌ OneSignal API error:', result)
      return res.status(400).json({
        success: false,
        error: result.errors?.[0] || 'Unknown OneSignal error',
        details: result
      })
    }

  } catch (error) {
    console.error('OneSignal send error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}
