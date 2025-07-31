import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import LoginPage from '../pages/credentials/LoginPage'
import RegisterPage from '../pages/credentials/RegisterPage'
import Home from '../pages/Home'

type AuthView = 'login' | 'register'

export default function Router() {
  const { currentUser } = useAuth()
  const [currentView, setCurrentView] = useState<AuthView>('login')

  const switchToRegister = () => {
    setCurrentView('register')
  }

  const switchToLogin = () => {
    setCurrentView('login')
  }

  if (currentUser) {
    return <Home />
  }

  if (currentView === 'register') {
    return <RegisterPage onSwitchToLogin={switchToLogin} />
  }

  return <LoginPage onSwitchToRegister={switchToRegister} />
}