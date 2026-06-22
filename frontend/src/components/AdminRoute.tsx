import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { ReactNode } from 'react'

/**
 * Защищает админ-маршруты:
 * если не авторизован → /auth, если не admin/superuser → /
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  if (!user?.is_superuser && user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
