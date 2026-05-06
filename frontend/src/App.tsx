import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage } from './pages/AuthPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastContainer } from './components/ui/Toast'
import { useToast } from './hooks/useToast'
import { useThemeStore } from './store/themeStore'
import { useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

// ----------------------------------------------------------------
// Global Toast context — any component can call useAppToast()
// ----------------------------------------------------------------
type ToastFn = (msg: string, variant?: 'info' | 'warning' | 'success' | 'error') => void

const ToastCtx = createContext<ToastFn>(() => {})
export const useAppToast = () => useContext(ToastCtx)

function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, show, close } = useToast()
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <ToastContainer toasts={toasts} onClose={close} />
    </ToastCtx.Provider>
  )
}

// ----------------------------------------------------------------
// Placeholder Dashboard — will be replaced in next PR
// ----------------------------------------------------------------
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
    <ToastProvider>
      <Routes>
        <Route path="/auth"      element={<AuthPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </ToastProvider>
  )
}
