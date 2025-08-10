import { useState, useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { ServerProvider } from './contexts/ServerContext'
import Router from './routes/Router'
import LoadingScreen from './components/ui/LoadingScreen'
import { useAppReady } from './hooks/useAppReady'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const isAppReady = useAppReady()

  useEffect(() => {
    if (isAppReady) {
      const timer = setTimeout(() => {
        setIsExiting(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isAppReady])

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isExiting])

  if (isLoading) {
    return <LoadingScreen isExiting={isExiting} />
  }

  return (
    <AuthProvider>
      <ServerProvider>
        <Router />
      </ServerProvider>
    </AuthProvider>
  )
}

export default App