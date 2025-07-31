import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/authService'
import Register from '../../components/credentials/Register'

interface RegisterPageProps {
  onSwitchToLogin: () => void
}

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const { register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (email: string, username: string, password: string) => {
    setLoading(true)
    setError('')
    
    try {
      await register(email, username, password)
    } catch (err: any) {
      setError(getErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleCheckUsername = async (username: string): Promise<boolean> => {
    try {
      return await authService.checkUsernameAvailability(username)
    } catch (error) {
      return false
    }
  }

  const getErrorMessage = (firebaseError: string): string => {
    if (firebaseError.includes('email-already-in-use')) {
      return 'An account with this email already exists.'
    }
    if (firebaseError.includes('weak-password')) {
      return 'Password should be at least 6 characters long.'
    }
    if (firebaseError.includes('invalid-email')) {
      return 'Please enter a valid email address.'
    }
    if (firebaseError.includes('operation-not-allowed')) {
      return 'Account creation is currently disabled.'
    }
    if (firebaseError.includes('Username is already taken')) {
      return 'This username is already taken. Please choose another one.'
    }
    return 'Failed to create account. Please try again.'
  }

  return (
    <Register
      onSubmit={handleRegister}
      onSwitchToLogin={onSwitchToLogin}
      onCheckUsername={handleCheckUsername}
      loading={loading}
      error={error}
    />
  )
}