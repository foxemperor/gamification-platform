import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { LoginForm } from '../components/auth/LoginForm'
import styles from './AuthPage.module.css'

export function AuthPage() {
  return (
    <div className={styles.page}>
      <ThemeSwitcher />

      <div className={styles.wrap}>
        {/* Logo */}
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>🎮</div>
          <span className={styles.logoText}>GameQuest</span>
        </div>

        {/* Card */}
        <div className={styles.card}>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
