import { create } from 'zustand'
import { useThemeStore, type Theme } from './themeStore'

export interface User {
  id: string
  username: string
  email: string
  full_name: string | null
  role: string
  department: string | null
  project: string | null
  xp: number
  level: number
  coins: number
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  // оставляем для обратной совместимости — может отсутствовать
  theme_preference?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken, isAuthenticated: true })
  },

  setUser: (user) => {
    set({ user })
    if (user.theme_preference) {
      useThemeStore.getState().setTheme(user.theme_preference as Theme, false)
    }
  },

  logout: () => {
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },
}))
