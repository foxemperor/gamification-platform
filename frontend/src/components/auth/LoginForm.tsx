import { useState } from 'react'
import { useForm } from '../../../node_modules/react-hook-form/dist/index.esm'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useLogin } from '../../hooks/useAuth'
import styles from './AuthForm.module.css'

// Note: react-hook-form not in package.json yet — using simple state
interface LoginFormProps {
  onSwitchToRegister: () => void
}

interface Fields {
  username: string
  password: string
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [fields, setFields] = useState<Fields>({ username: '', password: '' })
  const [errors, setErrors] = useState<Partial<Fields>>({})
  const [showPass, setShowPass] = useState(false)
  const { login, loading, error } = useLogin()

  const validate = (): boolean => {
    const e: Partial<Fields> = {}
    if (!fields.username.trim()) e.username = 'Введите email или логин'
    if (!fields.password) e.password = 'Введите пароль'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (validate()) login({ username: fields.username, password: fields.password })
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
        placeholder="dmitry@company.com"
        value={fields.username}
        error={errors.username}
        onChange={(e) => { setFields(f => ({ ...f, username: e.target.value })); setErrors(er => ({ ...er, username: undefined })) }}
      />

      <Input
        label="Пароль"
        icon="🔒"
        type={showPass ? 'text' : 'password'}
        placeholder="••••••••"
        value={fields.password}
        error={errors.password}
        onChange={(e) => { setFields(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: undefined })) }}
        rightSlot={
          <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(v => !v)}>
            {showPass ? '🙈' : '👁️'}
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

      <p className={styles.switchLink}>
        Нет аккаунта?{' '}
        <button type="button" onClick={onSwitchToRegister}>Зарегистрироваться</button>
      </p>
    </form>
  )
}
