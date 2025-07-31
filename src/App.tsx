import { AuthProvider } from './contexts/AuthContext'
import { ServerProvider } from './contexts/ServerContext'
import Router from './routes/Router'

function App() {
  return (
    <AuthProvider>
      <ServerProvider>
        <Router />
      </ServerProvider>
    </AuthProvider>
  )
}

export default App