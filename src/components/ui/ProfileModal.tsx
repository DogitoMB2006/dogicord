
import { useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdateProfile: (updates: { username?: string, avatar?: File }) => Promise<void>
}

export default function ProfileModal({ isOpen, onClose, onUpdateProfile }: ProfileModalProps) {
  const { userProfile } = useAuth()
  const [username, setUsername] = useState(userProfile?.username || '')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen || !userProfile) return null

  const validateUsername = (value: string): boolean => {
    if (value.length < 3) return false
    if (value.length > 20) return false
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) return false
    return true
  }

  const handleUsernameChange = (value: string) => {
    setUsername(value)
    
    if (value === userProfile.username) {
      setUsernameStatus('idle')
      return
    }

    if (!validateUsername(value)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('available')
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('File must be an image')
      return
    }

    setSelectedImage(file)
    setError('')
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (loading) return

    const updates: { username?: string, avatar?: File } = {}
    
    if (username !== userProfile.username && usernameStatus === 'available') {
      updates.username = username
    }
    
    if (selectedImage) {
      updates.avatar = selectedImage
    }

    if (Object.keys(updates).length === 0) {
      onClose()
      return
    }

    setLoading(true)
    try {
      await onUpdateProfile(updates)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getUsernameIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
        )
      case 'available':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'taken':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'invalid':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      default:
        return null
    }
  }

  const getUsernameMessage = () => {
    switch (usernameStatus) {
      case 'available':
        return <p className="text-xs text-green-400 mt-1">Username is available!</p>
      case 'taken':
        return <p className="text-xs text-red-400 mt-1">Username is already taken</p>
      case 'invalid':
        return <p className="text-xs text-yellow-400 mt-1">3-20 characters, letters, numbers, _ and - only</p>
      default:
        return null
    }
  }

  const getUsernameBorderColor = () => {
    switch (usernameStatus) {
      case 'available':
        return 'border-green-500/50 focus:border-green-500/50 focus:ring-green-500/50'
      case 'taken':
        return 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50'
      case 'invalid':
        return 'border-yellow-500/50 focus:border-yellow-500/50 focus:ring-yellow-500/50'
      default:
        return 'border-gray-600 focus:border-slate-500 focus:ring-slate-500'
    }
  }

  const currentAvatar = previewUrl || (userProfile as any).avatar

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-slate-600 rounded-full flex items-center justify-center overflow-hidden">
                  {currentAvatar ? (
                    <img 
                      src={currentAvatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {userProfile.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-600 hover:bg-slate-700 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {selectedImage && (
                <button
                  onClick={handleRemoveImage}
                  className="block mx-auto mt-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove image
                </button>
              )}
              
              <p className="text-xs text-gray-400 mt-2">
                Click to upload a new avatar (max 5MB)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                USERNAME
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 ${getUsernameBorderColor()}`}
                  placeholder="Enter username"
                  maxLength={20}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {getUsernameIcon()}
                </div>
              </div>
              {getUsernameMessage()}
              <p className="text-xs text-gray-500 mt-1">{username.length}/20</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                EMAIL
              </label>
              <input
                type="email"
                value={userProfile.email}
                disabled
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3">
                {error}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || (username === userProfile.username && !selectedImage) || usernameStatus === 'invalid' || usernameStatus === 'taken'}
                className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}