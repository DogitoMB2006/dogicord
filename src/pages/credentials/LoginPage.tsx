
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Login from '../../components/credentials/Login'

interface LoginPageProps {
  onSwitchToRegister: () => void
}

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (usernameOrEmail: string, password: string) => {
    setLoading(true)
    setError('')
    
    try {
      await login(usernameOrEmail, password)
    } catch (err: any) {
      setError(getErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (firebaseError: string): string => {
    if (firebaseError.includes('user-not-found')) {
      return 'No account found with this email or username.'
    }
    if (firebaseError.includes('wrong-password')) {
      return 'Incorrect password. Please try again.'
    }
    if (firebaseError.includes('invalid-email')) {
      return 'Please enter a valid email address or username.'
    }
    if (firebaseError.includes('too-many-requests')) {
      return 'Too many failed attempts. Please try again later.'
    }
    if (firebaseError.includes('invalid-credential')) {
      return 'Invalid credentials. Please check your email/username and password.'
    }
    return 'Login failed. Please check your credentials and try again.'
  }

  return (
    <Login
      onSubmit={handleLogin}
      onSwitchToRegister={onSwitchToRegister}
      loading={loading}
      error={error}
    />
  )
}   