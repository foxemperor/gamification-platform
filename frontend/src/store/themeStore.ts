import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

      // syncToServer is accepted for backwards compat; backend has no theme field yet,
      // so we keep it client-side only.
      setTheme: (theme, _syncToServer = true) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
    }),
    {
      name: 'gp-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.setAttribute('data-theme', state.theme)
        }
      },
    },
  ),
)
