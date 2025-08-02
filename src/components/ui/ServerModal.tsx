import { useState } from 'react'

interface ServerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateServer: (serverName: string) => Promise<void>
  onJoinServer: (serverCode: string) => Promise<void>
  error?: string
}

type ModalView = 'main' | 'create' | 'join'

export default function ServerModal({ isOpen, onClose, onCreateServer, onJoinServer, error }: ServerModalProps) {
  const [currentView, setCurrentView] = useState<ModalView>('main')
  const [serverName, setServerName] = useState('')
  const [serverCode, setServerCode] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleCreateServer = async () => {
    if (serverName.trim() && !loading) {
      setLoading(true)
      try {
        await onCreateServer(serverName.trim())
        setServerName('')
        setCurrentView('main')
      } catch (error) {
        
      } finally {
        setLoading(false)
      }
    }
  }

  const handleJoinServer = async () => {
    if (serverCode.trim() && !loading) {
      setLoading(true)
      try {
        await onJoinServer(serverCode.trim())
        setServerCode('')
        setCurrentView('main')
      } catch (error) {
        
      } finally {
        setLoading(false)
      }
    }
  }

  const handleClose = () => {
    if (!loading) {
      setCurrentView('main')
      setServerName('')
      setServerCode('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        
        {currentView === 'main' && (
          <div className="p-4 md:p-6">
            <div className="text-center mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Add a Server</h2>
              <p className="text-gray-400 text-sm">Your server is where you and your friends hang out.</p>
            </div>

            {error && (
              <div className="mb-4 text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3 backdrop-blur-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => setCurrentView('create')}
                disabled={loading}
                className="w-full p-3 md:p-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm md:text-base">Create My Own</h3>
                    <p className="text-gray-400 text-xs md:text-sm">Create a new server from scratch</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentView('join')}
                disabled={loading}
                className="w-full p-3 md:p-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm md:text-base">Join a Server</h3>
                    <p className="text-gray-400 text-xs md:text-sm">Enter an invite code to join</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 md:mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={handleClose}
                disabled={loading}
                className="w-full py-2 text-gray-400 hover:text-white disabled:text-gray-500 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {currentView === 'create' && (
          <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
              <button
                onClick={() => setCurrentView('main')}
                disabled={loading}
                className="text-slate-400 hover:text-white disabled:text-gray-500 mb-4 flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Create Your Server</h2>
              <p className="text-gray-400 text-sm">Give your server a personality with a name.</p>
            </div>

            {error && (
              <div className="mb-4 text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3 backdrop-blur-sm">
                {error}
              </div>
            )}

            <div className="mb-4 md:mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SERVER NAME <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter server name"
                disabled={loading}
                className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm md:text-base"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">{serverName.length}/50</p>
            </div>

            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
              <button
                onClick={() => setCurrentView('main')}
                disabled={loading}
                className="flex-1 py-2 md:py-3 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                Back
              </button>
              <button
                onClick={handleCreateServer}
                disabled={!serverName.trim() || loading}
                className="flex-1 py-2 md:py-3 px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center text-sm md:text-base"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        )}

        {currentView === 'join' && (
          <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
              <button
                onClick={() => setCurrentView('main')}
                disabled={loading}
                className="text-slate-400 hover:text-white disabled:text-gray-500 mb-4 flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Join a Server</h2>
              <p className="text-gray-400 text-sm">Enter an invite code to join an existing server.</p>
            </div>

            {error && (
              <div className="mb-4 text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3 backdrop-blur-sm">
                {error}
              </div>
            )}

            <div className="mb-4 md:mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                INVITE CODE <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={serverCode}
                onChange={(e) => setServerCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                disabled={loading}
                className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm md:text-base"
              />
            </div>

            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
              <button
                onClick={() => setCurrentView('main')}
                disabled={loading}
                className="flex-1 py-2 md:py-3 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm md:text-base"
              >
                Back
              </button>
              <button
                onClick={handleJoinServer}
                disabled={!serverCode.trim() || loading}
                className="flex-1 py-2 md:py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center text-sm md:text-base"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Join Server'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}