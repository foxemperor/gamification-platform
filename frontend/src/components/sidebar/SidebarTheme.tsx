import { useThemeStore } from '../../store/themeStore'
import styles from './SidebarTheme.module.css'

const THEMES = [
  { id: 'aurora',   color: '#22D3EE', title: 'Aurora Cyan'  },
  { id: 'obsidian', color: '#EAB308', title: 'Obsidian Gold' },
  { id: 'ivory',    color: '#B4A078', title: 'Ivory Bloom'   },
] as const

type ThemeId = typeof THEMES[number]['id']

interface Props { mini: boolean }

export function SidebarTheme({ mini }: Props) {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className={[styles.wrap, mini ? styles.mini : ''].filter(Boolean).join(' ')}>
      {!mini && <span className={styles.label}>Тема</span>}
      <div className={styles.dots}>
        {THEMES.map(t => (
          <button
            key={t.id}
            title={t.title}
            className={[styles.dot, theme === t.id ? styles.active : ''].filter(Boolean).join(' ')}
            style={{ background: t.color }}
            onClick={() => setTheme(t.id as ThemeId)}
          />
        ))}
      </div>
    </div>
  )
}
