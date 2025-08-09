import { useState } from 'react'

interface UpdateModalProps {
  isOpen: boolean
  onUpdate: () => void
  onDismiss: () => void
  currentVersion?: string
  latestVersion?: string
}

export default function UpdateModal({
  isOpen,
  onUpdate,
  onDismiss,
  currentVersion,
  latestVersion
}: UpdateModalProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  if (!isOpen) return null

  const handleUpdate = async () => {
    setIsUpdating(true)
    // Add a small delay for better UX
    setTimeout(() => {
      onUpdate()
    }, 500)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-700 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <svg 
                className="w-8 h-8 text-white animate-pulse" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              ¡Nueva actualización disponible!
            </h2>
            <p className="text-blue-100 text-sm">
              Una versión mejorada de Dogicord está lista
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center space-x-4 text-sm">
                {currentVersion && (
                  <div className="bg-gray-700 px-3 py-2 rounded-lg">
                    <span className="text-gray-400">Actual:</span>
                    <span className="text-white ml-1 font-mono">{currentVersion}</span>
                  </div>
                )}
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {latestVersion && (
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 px-3 py-2 rounded-lg">
                    <span className="text-white">Nueva:</span>
                    <span className="text-white ml-1 font-mono font-bold">{latestVersion}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-750 rounded-lg p-4 border border-gray-600">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-left space-y-2">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Esta actualización incluye mejoras de rendimiento, nuevas características 
                      y correcciones de seguridad importantes.
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Actualización segura y automática</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                {isUpdating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Actualizando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Actualizar Ahora</span>
                  </>
                )}
              </button>

              <button
                onClick={onDismiss}
                disabled={isUpdating}
                className="sm:w-auto px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-300 hover:text-white disabled:text-gray-500 rounded-xl transition-all duration-200 font-medium border border-gray-600 hover:border-gray-500"
              >
                Recordar más tarde
              </button>
            </div>

            {/* Footer note */}
            <div className="pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400 text-center flex items-center justify-center space-x-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>La página se recargará automáticamente tras la actualización</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
