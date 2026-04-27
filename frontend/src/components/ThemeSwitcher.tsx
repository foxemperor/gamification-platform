import { THEMES, useThemeStore } from '../store/themeStore'
import styles from './ThemeSwitcher.module.css'

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Тема</span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`${styles.btn} ${theme === t.id ? styles.active : ''}`}
          title={t.label}
          onClick={() => setTheme(t.id)}
          aria-pressed={theme === t.id}
        >
          {t.icon}
        </button>
      ))}
    </div>
  )
}
