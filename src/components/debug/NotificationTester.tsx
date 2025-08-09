import { useState } from 'react'
import { runNotificationDiagnostics, testNotification, printDiagnostics, debugUserTokens } from '../../utils/notificationDiagnostics'
import type { NotificationDiagnostics } from '../../utils/notificationDiagnostics'
import { useAuth } from '../../contexts/AuthContext'

export const NotificationTester = () => {
  const { currentUser } = useAuth()
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null)
  const [loading, setLoading] = useState(false)
  const [configTest, setConfigTest] = useState<any>(null)
  const [tokenDebug, setTokenDebug] = useState<any>(null)

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      const result = await runNotificationDiagnostics()
      setDiagnostics(result)
      printDiagnostics(result)
    } catch (error) {
      console.error('Failed to run diagnostics:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendTestNotification = async () => {
    const success = await testNotification()
    if (success) {
      alert('Test notification sent! Check your notifications.')
    } else {
      alert('Failed to send test notification. Check console for details.')
    }
  }

  const testApiConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/test-config')
      const result = await response.json()
      setConfigTest(result)
      console.log('Firebase Config Test:', result)
    } catch (error) {
      console.error('Config test failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setConfigTest({ error: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      console.log('Notification permission:', permission)
      await runDiagnostics() // Refresh diagnostics
    }
  }

  const debugTokens = async () => {
    if (!currentUser) {
      alert('You need to be logged in to debug tokens')
      return
    }

    setLoading(true)
    try {
      const result = await debugUserTokens(currentUser.uid)
      setTokenDebug(result)
    } catch (error) {
      console.error('Token debug failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (condition: boolean) => condition ? '✅' : '❌'
  const getStatusColor = (condition: boolean) => condition ? 'text-green-600' : 'text-red-600'

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        🔔 Notification System Tester
      </h2>

      <div className="space-y-4">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Diagnostics'}
          </button>
          
          <button
            onClick={sendTestNotification}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Send Test Notification
          </button>
          
          <button
            onClick={testApiConfig}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Test Firebase Config
          </button>
          
          <button
            onClick={requestNotificationPermission}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Request Permission
          </button>
          
          <button
            onClick={debugTokens}
            disabled={loading || !currentUser}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Debug My Tokens
          </button>
        </div>

        {/* Diagnostics results */}
        {diagnostics && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
              Diagnostics Results
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className={`flex items-center gap-2 ${getStatusColor(diagnostics.notificationPermission === 'granted')}`}>
                  {getStatusIcon(diagnostics.notificationPermission === 'granted')}
                  <span>Notification Permission: {diagnostics.notificationPermission}</span>
                </div>
                
                <div className={`flex items-center gap-2 ${getStatusColor(diagnostics.serviceWorkerSupported)}`}>
                  {getStatusIcon(diagnostics.serviceWorkerSupported)}
                  <span>Service Worker Supported</span>
                </div>
                
                <div className={`flex items-center gap-2 ${getStatusColor(diagnostics.serviceWorkerRegistered)}`}>
                  {getStatusIcon(diagnostics.serviceWorkerRegistered)}
                  <span>Service Worker Registered</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className={`flex items-center gap-2 ${getStatusColor(diagnostics.fcmSupported)}`}>
                  {getStatusIcon(diagnostics.fcmSupported)}
                  <span>FCM Supported</span>
                </div>
                
                <div className={`flex items-center gap-2 ${getStatusColor(diagnostics.fcmInitialized)}`}>
                  {getStatusIcon(diagnostics.fcmInitialized)}
                  <span>FCM Initialized</span>
                </div>
                
                <div className={`flex items-center gap-2 ${getStatusColor(diagnostics.hasToken)}`}>
                  {getStatusIcon(diagnostics.hasToken)}
                  <span>Has FCM Token</span>
                </div>
              </div>
            </div>

            {diagnostics.tokenPreview && (
              <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-600 rounded text-sm">
                <strong>Token Preview:</strong> {diagnostics.tokenPreview}
              </div>
            )}

            {diagnostics.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-red-600 dark:text-red-400">Errors:</h4>
                <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
                  {diagnostics.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {diagnostics.suggestions.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-amber-600 dark:text-amber-400">Suggestions:</h4>
                <ul className="list-disc list-inside text-sm text-amber-600 dark:text-amber-400">
                  {diagnostics.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Config test results */}
        {configTest && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
              Firebase Configuration Test
            </h3>
            
            <div className={`text-lg font-semibold ${getStatusColor(configTest.success)}`}>
              Status: {configTest.status || 'ERROR'}
            </div>
            
            {configTest.configuration && (
              <div className="mt-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Environment Variables: {configTest.configuration.presentVars}/{configTest.configuration.requiredVars} present
                </div>
                
                {configTest.configuration.missing.length > 0 && (
                  <div className="mt-2">
                    <span className="text-red-600">Missing: </span>
                    <span className="text-sm">{configTest.configuration.missing.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {configTest.firebase && (
              <div className="mt-3">
                <div className={`flex items-center gap-2 ${getStatusColor(configTest.firebase.adminInitialized)}`}>
                  {getStatusIcon(configTest.firebase.adminInitialized)}
                  <span>Firebase Admin Initialized</span>
                </div>
                
                {configTest.firebase.adminError && (
                  <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-sm">
                    <strong>Error:</strong> {configTest.firebase.adminError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Token debug results */}
        {tokenDebug && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
              FCM Token Debug Results
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{tokenDebug.totalTokens}</div>
                <div className="text-sm text-gray-600">Total Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{tokenDebug.activeTokens}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{tokenDebug.validTokens}</div>
                <div className="text-sm text-gray-600">Valid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{tokenDebug.invalidTokens}</div>
                <div className="text-sm text-gray-600">Invalid</div>
              </div>
            </div>

            {tokenDebug.tokens?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Token Preview</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Valid</th>
                      <th className="text-left p-2">Error</th>
                      <th className="text-left p-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenDebug.tokens.map((token: any, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-mono text-xs">{token.tokenPreview}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${token.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {token.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-2">
                          {token.isValid === true && '✅ Valid'}
                          {token.isValid === false && '❌ Invalid'}
                          {token.isValid === null && '⏳ Not tested'}
                        </td>
                        <td className="p-2 text-xs text-red-600">{token.validationError || '-'}</td>
                        <td className="p-2 text-xs">{new Date(token.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Quick commands */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded">
          <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">
            Debug Commands (Browser Console)
          </h3>
          <div className="space-y-1 text-sm font-mono text-blue-700 dark:text-blue-300">
            <div>window.fcmStatus() - Quick FCM status</div>
            <div>window.testFCMNotification() - Test local notification</div>
            <div>window.checkFCMToken() - Check FCM token in database</div>
            <div>window.debugMyTokens() - Debug all my tokens</div>
            <div>window.printNotificationDiagnostics() - Full diagnostics</div>
          </div>
        </div>
      </div>
    </div>
  )
}
