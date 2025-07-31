// src/components/credentials/Login.tsx
import { useState } from 'react'

interface LoginProps {
  onSubmit: (usernameOrEmail: string, password: string) => void
  onSwitchToRegister: () => void
  loading?: boolean
  error?: string
}

export default function Login({ onSubmit, onSwitchToRegister, loading, error }: LoginProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(usernameOrEmail, password)
  }

  const getPlaceholder = () => {
    return usernameOrEmail.includes('@') ? 'Enter your email' : 'Enter email or username'
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-gray-900/30 to-zinc-900/50"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-slate-600/8 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-600/8 rounded-full blur-3xl"></div>
      
      <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-2xl mb-6 shadow-xl border border-slate-600/30">
            <span className="text-2xl font-bold text-white">D</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Welcome back</h1>
          <p className="text-gray-400 text-sm">Sign in to continue to Dogicord</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="usernameOrEmail" className="block text-sm font-semibold text-gray-200 mb-2">
              EMAIL OR USERNAME <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="usernameOrEmail"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all duration-200"
              placeholder={getPlaceholder()}
              required
            />
            {usernameOrEmail && !usernameOrEmail.includes('@') && (
              <p className="text-xs text-gray-400 mt-1">You can also use your email address</p>
            )}
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
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors duration-200"
          >
            Forgot your password?
          </button>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-xl p-3 backdrop-blur-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-slate-500/20"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center">
            <span className="text-sm text-gray-400">Don't have an account? </span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-sm text-slate-300 hover:text-white transition-colors duration-200 font-medium"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}