// src/components/credentials/Register.tsx
import { useState, useEffect } from 'react'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

interface RegisterProps {
  onSubmit: (email: string, username: string, password: string) => void
  onSwitchToLogin: () => void
  onCheckUsername: (username: string) => Promise<boolean>
  loading?: boolean
  error?: string
}

export default function Register({ onSubmit, onSwitchToLogin, onCheckUsername, loading, error }: RegisterProps) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [checkingTimeout, setCheckingTimeout] = useState<NodeJS.Timeout | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    if (usernameStatus !== 'available') {
      return
    }
    
    setPasswordError('')
    onSubmit(email, username, password)
  }

  const validateUsername = (value: string): boolean => {
    if (value.length < 3) return false
    if (value.length > 20) return false
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) return false
    return true
  }

  const checkUsername = async (value: string) => {
    if (!validateUsername(value)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')
    
    try {
      const isAvailable = await onCheckUsername(value)
      setUsernameStatus(isAvailable ? 'available' : 'taken')
    } catch (error) {
      setUsernameStatus('idle')
    }
  }

  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus('idle')
      return
    }

    if (checkingTimeout) {
      clearTimeout(checkingTimeout)
    }

    const timeout = setTimeout(() => {
      checkUsername(username)
    }, 500)

    setCheckingTimeout(timeout)

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [username])

  const getUsernameIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )
      case 'available':
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'taken':
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      case 'invalid':
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
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
        return 'border-gray-700/50 focus:border-slate-500/50 focus:ring-slate-500/50'
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-gray-900/30 to-zinc-900/50"></div>
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-slate-600/8 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-gray-600/8 rounded-full blur-3xl"></div>
      
      <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-2xl mb-6 shadow-xl border border-slate-600/30">
            <span className="text-2xl font-bold text-white">D</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Create your account</h1>
          <p className="text-gray-400 text-sm">Join Dogicord today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-200 mb-2">
              EMAIL <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all duration-200"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-gray-200 mb-2">
              USERNAME <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className={`w-full px-4 py-3 bg-gray-950/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 ${getUsernameBorderColor()}`}
                placeholder="Choose a username"
                required
              />
              {getUsernameIcon()}
            </div>
            {getUsernameMessage()}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-200 mb-2">
              PASSWORD <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all duration-200"
              placeholder="Create a password"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-200 mb-2">
              CONFIRM PASSWORD <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all duration-200"
              placeholder="Confirm your password"
              required
            />
          </div>

          {(passwordError || error) && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3 backdrop-blur-sm">
              {passwordError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || usernameStatus !== 'available'}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-slate-500/20"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <div className="text-xs text-gray-500 text-center">
            By creating an account, you agree to our{' '}
            <button type="button" className="text-slate-300 hover:text-white transition-colors">
              Terms of Service
            </button>{' '}
            and{' '}
            <button type="button" className="text-slate-300 hover:text-white transition-colors">
              Privacy Policy
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-400">Already have an account? </span>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-sm text-slate-300 hover:text-white transition-colors duration-200 font-medium"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}