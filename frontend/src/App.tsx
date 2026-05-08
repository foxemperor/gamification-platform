import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage }         from './pages/AuthPage'
import { OverviewPage }     from './pages/OverviewPage'
import { AdminUsersPage }   from './pages/admin/AdminUsersPage'
import { AppLayout }        from './layouts/AppLayout'
import { ProtectedRoute }   from './components/ProtectedRoute'
import { AdminRoute }       from './components/AdminRoute'
import { ToastContainer }   from './components/ui/Toast'
import { useToast }         from './hooks/useToast'
import { useThemeStore }    from './store/themeStore'
import { useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

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

export default function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ToastProvider>
      <Routes>
        {/* Публичные */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Защищённые */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index             element={<OverviewPage />} />
          <Route path="/quests"       element={<ComingSoon title="Квесты" />} />
          <Route path="/leaderboard"  element={<ComingSoon title="Рейтинг" />} />
          <Route path="/achievements" element={<ComingSoon title="Достижения" />} />
          <Route path="/members"      element={<ComingSoon title="Участники" />} />
          <Route path="/events"       element={<ComingSoon title="События" />} />
          <Route path="/settings"     element={<ComingSoon title="Настройки" />} />

          {/* Админ-панель */}
          <Route path="/admin" element={<AdminRoute><ComingSoon title="Админ: Обзор" /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/quests" element={<AdminRoute><ComingSoon title="Админ: Квесты" /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ padding: '40px 32px', color: 'var(--text)', fontFamily: 'var(--font-b)' }}>
      <h1 style={{ color: 'var(--primary)', fontFamily: 'var(--font-d)', marginBottom: 8 }}>
        {title}
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Страница в разработке.</p>
    </div>
  )
}
