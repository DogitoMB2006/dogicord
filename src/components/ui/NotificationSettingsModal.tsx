import { useState, useEffect } from 'react'
import { fcmService } from '../../services/fcmService'

interface NotificationSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  serverId: string
  serverName: string
  currentUserId: string
  isMobile?: boolean
}

export default function NotificationSettingsModal({
  isOpen,
  onClose,
  serverId,
  serverName,
  currentUserId: _currentUserId,
  isMobile = false
}: NotificationSettingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [_onlyMentions, setOnlyMentions] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && serverId) {
      loadNotificationSettings()
    }
  }, [isOpen, serverId])

  const loadNotificationSettings = async () => {
    setLoading(true)
    setError('')
    
    try {
      const settings = await fcmService.getNotificationSettings(serverId)
      setIsMuted(settings?.isMuted ?? false)
      setOnlyMentions(settings?.onlyMentions ?? false)
    } catch (error) {
      console.error('Failed to load notification settings:', error)
      setError('Failed to load notification settings')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleMute = async () => {
    setUpdating(true)
    setError('')
    
    try {
      const newMuteStatus = await fcmService.toggleServerMute(serverId)
      setIsMuted(newMuteStatus)
    } catch (error) {
      console.error('Failed to update mute setting:', error)
      setError('Failed to update notification settings')
    } finally {
      setUpdating(false)
    }
  }

  const handleOnlyMentionsToggle = () => {
    // TODO: Implement when ready
    console.log('Only mentions feature coming soon')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 rounded-2xl shadow-2xl w-full ${
        isMobile ? 'max-w-sm h-auto' : 'max-w-md h-auto'
      } overflow-hidden`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-700">
          <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-white`}>
            Notification Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 md:p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6">
          {/* Server Info */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-1">SERVER</h3>
            <p className="text-white font-medium">{serverName}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-gray-400">Loading settings...</span>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Mute Server Option */}
              <div className="flex items-center justify-between p-4 bg-gray-750 rounded-lg border border-gray-600">
                <div className="flex-1">
                  <h4 className="text-white font-medium mb-1">
                    {isMuted ? 'Unmute Server' : 'Mute Server'}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {isMuted 
                      ? 'You won\'t receive push notifications from this server'
                      : 'Stop receiving push notifications from this server'
                    }
                  </p>
                </div>
                <button
                  onClick={handleToggleMute}
                  disabled={updating}
                  className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isMuted
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'text-sm' : 'text-base'}`}
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    isMuted ? 'Unmute' : 'Mute'
                  )}
                </button>
              </div>

              {/* Only Mentions Option (Future Feature) */}
              <div className="flex items-center justify-between p-4 bg-gray-750/50 rounded-lg border border-gray-600/50 opacity-60">
                <div className="flex-1">
                  <h4 className="text-white font-medium mb-1">Only Mentions</h4>
                  <p className="text-sm text-gray-400">
                    Only receive notifications when you're mentioned
                  </p>
                  <p className="text-xs text-yellow-400 mt-1">
                    Próximamente
                  </p>
                </div>
                <button
                  onClick={handleOnlyMentionsToggle}
                  disabled={true}
                  className="ml-4 px-4 py-2 bg-gray-600 text-gray-400 rounded-lg font-medium cursor-not-allowed text-sm"
                >
                  Coming Soon
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h5 className="text-blue-300 font-medium text-sm mb-1">Push Notifications</h5>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      These settings control push notifications from this server. 
                      You'll need to grant notification permissions for your browser 
                      to receive notifications when the app is closed.
                    </p>
                    <p className="text-blue-200 text-xs leading-relaxed mt-2">
                      <strong>Note:</strong> iOS requires iOS 16.4+ and the app to be 
                      installed as a PWA for background notifications.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
