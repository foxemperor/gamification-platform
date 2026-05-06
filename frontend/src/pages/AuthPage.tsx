import { useState } from 'react'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { LoginForm } from '../components/auth/LoginForm'
import { RegisterForm } from '../components/auth/RegisterForm'
import styles from './AuthPage.module.css'

type Tab = 'login' | 'register'

export function AuthPage() {
  const [tab, setTab] = useState<Tab>('login')

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
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
              onClick={() => setTab('login')}
            >
              Войти
            </button>
            <button
              className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
              onClick={() => setTab('register')}
            >
              Регистрация
            </button>
          </div>

          {/* Panels */}
          {tab === 'login' && <LoginForm onSwitchToRegister={() => setTab('register')} />}
          {tab === 'register' && <RegisterForm onSwitchToLogin={() => setTab('login')} />}
        </div>
      </div>
    </div>
  )
}
