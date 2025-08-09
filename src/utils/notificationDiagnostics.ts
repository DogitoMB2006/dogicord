export interface NotificationDiagnostics {
  notificationPermission: NotificationPermission
  serviceWorkerSupported: boolean
  serviceWorkerRegistered: boolean
  fcmSupported: boolean
  fcmInitialized: boolean
  hasToken: boolean
  tokenPreview?: string
  swState?: string
  pushSubscription?: boolean
  errors: string[]
  suggestions: string[]
}

export const runNotificationDiagnostics = async (): Promise<NotificationDiagnostics> => {
  const diagnostics: NotificationDiagnostics = {
    notificationPermission: 'default',
    serviceWorkerSupported: false,
    serviceWorkerRegistered: false,
    fcmSupported: false,
    fcmInitialized: false,
    hasToken: false,
    errors: [],
    suggestions: []
  }

  try {
    // Check notification permission
    if ('Notification' in window) {
      diagnostics.notificationPermission = Notification.permission
    } else {
      diagnostics.errors.push('Notifications not supported in this browser')
      diagnostics.suggestions.push('Use a modern browser like Chrome, Firefox, or Safari')
    }

    // Check service worker support
    if ('serviceWorker' in navigator) {
      diagnostics.serviceWorkerSupported = true
      
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          diagnostics.serviceWorkerRegistered = true
          diagnostics.swState = registration.active?.state || registration.installing?.state || registration.waiting?.state
          
          // Check if it's our FCM service worker
          if (registration.scope.includes(window.location.origin)) {
            console.log('✅ FCM Service Worker is registered:', registration.scope)
          }
        } else {
          diagnostics.errors.push('Service Worker not registered')
          diagnostics.suggestions.push('Service Worker should auto-register when you log in')
        }
      } catch (error) {
        diagnostics.errors.push(`Service Worker error: ${error}`)
      }
    } else {
      diagnostics.errors.push('Service Workers not supported')
      diagnostics.suggestions.push('Use a modern browser that supports Service Workers')
    }

    // Check FCM support
    try {
      const { isSupported } = await import('firebase/messaging')
      diagnostics.fcmSupported = await isSupported()
      
      if (!diagnostics.fcmSupported) {
        diagnostics.errors.push('FCM not supported in this browser')
        diagnostics.suggestions.push('FCM requires a modern browser with Service Worker support')
      }
    } catch (error) {
      diagnostics.errors.push(`FCM support check failed: ${error}`)
    }

    // Check FCM service status
    try {
      const { fcmService } = await import('../services/fcmService')
      diagnostics.fcmInitialized = fcmService.isServiceInitialized()
      diagnostics.hasToken = !!fcmService.getCurrentToken()
      
      if (diagnostics.hasToken) {
        const token = fcmService.getCurrentToken()
        diagnostics.tokenPreview = token ? token.substring(0, 20) + '...' : undefined
      } else {
        diagnostics.errors.push('No FCM token available')
        diagnostics.suggestions.push('Token should be generated automatically when you log in')
      }
    } catch (error) {
      diagnostics.errors.push(`FCM service check failed: ${error}`)
    }

    // Check push subscription
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        const subscription = await registration.pushManager.getSubscription()
        diagnostics.pushSubscription = !!subscription
        
        if (!subscription) {
          diagnostics.suggestions.push('Push subscription not found - this may be normal for FCM')
        }
      }
    } catch (error) {
      // Push subscription errors are not critical for FCM
      console.warn('Push subscription check failed:', error)
    }

    // Permission-specific suggestions
    if (diagnostics.notificationPermission === 'denied') {
      diagnostics.errors.push('Notification permission denied')
      diagnostics.suggestions.push('Enable notifications in your browser settings for this site')
      diagnostics.suggestions.push('Look for a notification icon in your browser address bar')
    } else if (diagnostics.notificationPermission === 'default') {
      diagnostics.suggestions.push('Grant notification permission when prompted')
    }

    // Overall health check
    if (diagnostics.notificationPermission === 'granted' && 
        diagnostics.serviceWorkerRegistered && 
        diagnostics.fcmInitialized && 
        diagnostics.hasToken) {
      console.log('✅ Notification system appears to be working correctly')
    } else {
      console.warn('⚠️ Notification system has issues that need attention')
    }

  } catch (error) {
    diagnostics.errors.push(`Diagnostics failed: ${error}`)
  }

  return diagnostics
}

export const printDiagnostics = (diagnostics: NotificationDiagnostics): void => {
  console.group('🔔 Notification Diagnostics')
  
  console.log('📋 Status:')
  console.log(`  Notification Permission: ${diagnostics.notificationPermission}`)
  console.log(`  Service Worker Supported: ${diagnostics.serviceWorkerSupported}`)
  console.log(`  Service Worker Registered: ${diagnostics.serviceWorkerRegistered}`)
  console.log(`  FCM Supported: ${diagnostics.fcmSupported}`)
  console.log(`  FCM Initialized: ${diagnostics.fcmInitialized}`)
  console.log(`  Has FCM Token: ${diagnostics.hasToken}`)
  
  if (diagnostics.tokenPreview) {
    console.log(`  Token Preview: ${diagnostics.tokenPreview}`)
  }
  
  if (diagnostics.swState) {
    console.log(`  Service Worker State: ${diagnostics.swState}`)
  }

  if (diagnostics.errors.length > 0) {
    console.group('❌ Errors:')
    diagnostics.errors.forEach(error => console.log(`  • ${error}`))
    console.groupEnd()
  }

  if (diagnostics.suggestions.length > 0) {
    console.group('💡 Suggestions:')
    diagnostics.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`))
    console.groupEnd()
  }

  console.groupEnd()
}

export const testNotification = async (): Promise<boolean> => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🔔 Test Notification', {
        body: 'If you see this, notifications are working!',
        icon: '/vite.svg',
        tag: 'test-notification'
      })

      setTimeout(() => notification.close(), 5000)
      
      console.log('✅ Test notification sent')
      return true
    } else {
      console.warn('❌ Cannot send test notification: permission not granted')
      return false
    }
  } catch (error) {
    console.error('❌ Test notification failed:', error)
    return false
  }
}

// Make functions globally available for debugging
if (typeof window !== 'undefined') {
  (window as any).runNotificationDiagnostics = runNotificationDiagnostics;
  (window as any).printNotificationDiagnostics = async () => {
    const diagnostics = await runNotificationDiagnostics()
    printDiagnostics(diagnostics)
    return diagnostics
  };
  (window as any).testNotification = testNotification
}
