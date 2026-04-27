import { useState, useEffect, useRef } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useLogin } from '../../hooks/useAuth'
import styles from './AuthForm.module.css'

interface Props {
  onSwitchToRegister?: () => void
}

interface Fields {
  username: string
  password: string
}

// SVG eye icons — no emoji dependency
const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.1 10.1 0 0 1 12 20C5 20 1 12 1 12a18.1 18.1 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export function LoginForm(_props: Props) {
  const [fields, setFields] = useState<Fields>({ username: '', password: '' })
  const [errors, setErrors] = useState<Partial<Fields>>({})
  const [showPass, setShowPass] = useState(false)
  const { login, loading, error } = useLogin()

  // AbortController — cancel in-flight requests on unmount
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const validate = (): boolean => {
    const e: Partial<Fields> = {}
    if (!fields.username.trim()) e.username = 'Введите email или логин'
    if (!fields.password)        e.password = 'Введите пароль'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    abortRef.current = new AbortController()
    login({ username: fields.username, password: fields.password })
  }

  const setField = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: undefined }))
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.heading}>
        <h2 className={styles.title}>С возвращением! 👋</h2>
        <p className={styles.sub}>Войдите, чтобы продолжить выполнять квесты</p>
      </div>

      <Input
        label="Email или логин"
        icon="✉️"
        placeholder="email или логин"
        value={fields.username}
        error={errors.username}
        onChange={setField('username')}
      />

      <Input
        label="Пароль"
        icon="🔒"
        type={showPass ? 'text' : 'password'}
        placeholder="Введите пароль"
        value={fields.password}
        error={errors.password}
        onChange={setField('password')}
        rightSlot={
          <button
            type="button"
            className={styles.eyeBtn}
            aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
            onClick={() => setShowPass(v => !v)}
          >
            {showPass ? <EyeOff /> : <EyeOpen />}
          </button>
        }
      />

      <div className={styles.forgotRow}>
        <a href="#">Забыли пароль?</a>
      </div>

      {error && <p className={styles.apiError}>{error}</p>}

      <Button type="submit" loading={loading}>Войти в систему →</Button>

      <div className={styles.orRow}><span>или</span></div>

      <div className={styles.socialRow}>
        <button type="button" className={styles.socialBtn}>🔷 Microsoft</button>
        <button type="button" className={styles.socialBtn}>🔗 SSO</button>
      </div>
    </form>
  )
}
