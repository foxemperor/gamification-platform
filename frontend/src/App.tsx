import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage } from './pages/AuthPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useThemeStore } from './store/themeStore'
import { useEffect } from 'react'

// Placeholder — will be implemented in next PRs
const Dashboard = () => (
  <div style={{ padding: 40, color: 'var(--text)', fontFamily: 'var(--font-b)' }}>
    <h1 style={{ color: 'var(--primary)' }}>🎮 Dashboard — Coming Soon</h1>
  </div>
)

export default function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  )
}
