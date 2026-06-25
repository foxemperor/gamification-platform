import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { ReactNode } from 'react'

/**
 * Защищает админ-маршруты:
 * если не авторизован → /auth
 * если не admin / superuser / manager → /
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  const role = user?.role?.toLowerCase()
  const allowed = user?.is_superuser || role === 'admin' || role === 'manager'
  if (!allowed) return <Navigate to="/" replace />
  return <>{children}</>
}
