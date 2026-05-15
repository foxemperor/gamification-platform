import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage }         from './pages/AuthPage'
import { OverviewPage }     from './pages/OverviewPage'
import { QuestsPage }       from './pages/QuestsPage'
import { AdminUsersPage }   from './pages/admin/AdminUsersPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminQuestsPage }  from './pages/admin/AdminQuestsPage'
import { AdminBadgesPage }  from './pages/admin/AdminBadgesPage'
import { AdminXPPage }      from './pages/admin/AdminXPPage'
import { AdminMonitoringPage } from './pages/admin/AdminMonitoringPage'
import { AppLayout }        from './layouts/AppLayout'
import { ProtectedRoute }   from './components/ProtectedRoute'
import { AdminRoute }       from './components/AdminRoute'
import { ToastContainer }   from './components/ui/Toast'
import { useToast }         from './hooks/useToast'
import { useThemeStore }    from './store/themeStore'
import { useAuthStore }     from './store/authStore'
import { authApi }          from './api/auth'
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
  const accessToken = useAuthStore((s) => s.accessToken)
  const setUser    = useAuthStore((s) => s.setUser)
  const logout     = useAuthStore((s) => s.logout)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    authApi
      .getMe()
      .then((u) => {
        if (cancelled) return
        setUser({
          id:           u.id,
          username:     u.username,
          email:        u.email,
          full_name:    u.full_name,
          role:         u.role,
          department:   null,
          project:      null,
          position:     null,
          xp:           u.xp,
          level:        u.level,
          coins:        u.coins,
          is_active:    u.is_active,
          is_verified:  u.is_verified,
          is_superuser: u.is_superuser,
        })
      })
      .catch(() => {
        if (cancelled) return
        logout()
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ToastProvider>
      <Routes>
        {/* Публичные */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Защищённые */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index              element={<OverviewPage />} />
          <Route path="/quests"     element={<QuestsPage />} />
          <Route path="/leaderboard"  element={<ComingSoon title="Рейтинг" />} />
          <Route path="/achievements" element={<ComingSoon title="Достижения" />} />
          <Route path="/members"      element={<ComingSoon title="Участники" />} />
          <Route path="/events"       element={<ComingSoon title="События" />} />
          <Route path="/settings"     element={<ComingSoon title="Настройки" />} />

          {/* Админ-панель */}
          <Route path="/admin" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/quests" element={<AdminRoute><AdminQuestsPage /></AdminRoute>} />
          <Route path="/admin/badges" element={<AdminRoute><AdminBadgesPage /></AdminRoute>} />
          <Route path="/admin/xp" element={<AdminRoute><AdminXPPage /></AdminRoute>} />
          <Route path="/admin/monitoring" element={<AdminRoute><AdminMonitoringPage /></AdminRoute>} />
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
