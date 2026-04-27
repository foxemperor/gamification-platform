import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/auth'

export type Theme = 'aurora' | 'obsidian' | 'ivory'

export const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'aurora',   label: 'Aurora Cyan',   icon: '🩵' },
  { id: 'obsidian', label: 'Obsidian Gold',  icon: '🖤' },
  { id: 'ivory',    label: 'Ivory Bloom',    icon: '☀️' },
]

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme, syncToServer?: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'aurora',

      setTheme: (theme, syncToServer = true) => {
        // 1. Apply CSS tokens immediately — no flash
        document.documentElement.setAttribute('data-theme', theme)
        // 2. Update Zustand + localStorage (via persist)
        set({ theme })
        // 3. Fire-and-forget sync to server (only when logged in)
        if (syncToServer) {
          authApi.updatePreferences(theme).catch(() => {
            // silently ignore if not authenticated yet
          })
        }
      },
    }),
    {
      name: 'gp-theme',
      // On rehydration — apply theme to DOM
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.setAttribute('data-theme', state.theme)
        }
      },
    },
  ),
)
