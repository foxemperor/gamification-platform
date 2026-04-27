import { create } from 'zustand'
import { useThemeStore, type Theme } from './themeStore'

interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  theme_preference: string
  xp: number
  level: number
  coins: number
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
    // Tokens stored in memory only — more secure than localStorage
    set({ accessToken, refreshToken, isAuthenticated: true })
  },

  setUser: (user) => {
    set({ user })
    // Sync server theme_preference → override localStorage
    if (user.theme_preference) {
      useThemeStore.getState().setTheme(
        user.theme_preference as Theme,
        false, // already from server, no need to re-sync
      )
    }
  },

  logout: () => {
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },
}))
