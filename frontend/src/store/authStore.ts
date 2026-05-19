import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  full_name: string | null
  role: string
  department: string | null
  project: string | null
  position: string | null
  xp: number
  level: number
  coins: number
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  rememberMe: boolean

  setTokens: (accessToken: string, refreshToken: string, rememberMe: boolean) => void
  setUser: (user: User) => void
  logout: () => void
}

/**
 * Динамическое хранилище:
 * - rememberMe=true  → localStorage  (сессия переживает закрытие браузера)
 * - rememberMe=false → sessionStorage (сессия сбрасывается при закрытии браузера)
 *
 * Zustand persist не поддерживает смену storage на лету,
 * поэтому мы храним сам флаг в localStorage и при старте
 * читаем токены из нужного хранилища вручную.
 */

const STORAGE_KEY = 'gp-auth'
const REMEMBER_KEY = 'gp-remember'

function readPersistedAuth(): Partial<AuthState> {
  try {
    const remember = localStorage.getItem(REMEMBER_KEY) === 'true'
    const raw = remember
      ? localStorage.getItem(STORAGE_KEY)
      : sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)?.state ?? {}
  } catch {
    return {}
  }
}

function persistAuth(state: Partial<AuthState>) {
  try {
    const remember = state.rememberMe ?? false
    const payload = JSON.stringify({ state })
    if (remember) {
      localStorage.setItem(STORAGE_KEY, payload)
      localStorage.setItem(REMEMBER_KEY, 'true')
      sessionStorage.removeItem(STORAGE_KEY)
    } else {
      sessionStorage.setItem(STORAGE_KEY, payload)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(REMEMBER_KEY, 'false')
    }
  } catch { /* ignore */ }
}

function clearPersistedAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

const initial = readPersistedAuth()

export const useAuthStore = create<AuthState>()((set) => ({
  user:            initial.user            ?? null,
  accessToken:     initial.accessToken     ?? null,
  refreshToken:    initial.refreshToken    ?? null,
  isAuthenticated: initial.isAuthenticated ?? false,
  rememberMe:      initial.rememberMe      ?? false,

  setTokens: (accessToken, refreshToken, rememberMe) => {
    const next = { accessToken, refreshToken, isAuthenticated: true, rememberMe }
    set(next)
    persistAuth(next)
  },

  setUser: (user) => {
    set((s) => {
      const next = { ...s, user }
      persistAuth(next)
      return { user }
    })
  },

  logout: () => {
    clearPersistedAuth()
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, rememberMe: false })
  },
}))
