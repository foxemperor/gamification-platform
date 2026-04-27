import { useState, useEffect, useRef } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { IconMail, IconLock, IconEye, IconEyeOff } from '../ui/FeatherIcons'
import { useLogin } from '../../hooks/useAuth'
import styles from './AuthForm.module.css'

interface Props {
  onSwitchToRegister?: () => void
}

interface Fields {
  username: string
  password: string
}

export function LoginForm(_props: Props) {
  const [fields, setFields] = useState<Fields>({ username: '', password: '' })
  const [errors, setErrors] = useState<Partial<Fields>>({})
  const [showPass, setShowPass] = useState(false)
  const { login, loading, error } = useLogin()

  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => { return () => { abortRef.current?.abort() } }, [])

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
        iconNode={<IconMail size={15} />}
        placeholder="email или логин"
        value={fields.username}
        error={errors.username}
        onChange={setField('username')}
      />

      <Input
        label="Пароль"
        iconNode={<IconLock size={15} />}
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
            {showPass ? <IconEyeOff /> : <IconEye />}
          </button>
        }
      />

      <div className={styles.forgotRow}>
        <a href="#">Забыли пароль?</a>
      </div>

      {error && <p className={styles.apiError}>{error}</p>}

      <Button type="submit" loading={loading}>Войти в систему</Button>

      <div className={styles.orRow}><span>или</span></div>

      <div className={styles.socialRow}>
        <button type="button" className={styles.socialBtn}>Microsoft</button>
        <button type="button" className={styles.socialBtn}>SSO</button>
      </div>
    </form>
  )
}
