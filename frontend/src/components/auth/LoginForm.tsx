import { useState, useEffect, useRef } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { IconMail, IconLock, IconEye, IconEyeOff } from '../ui/FeatherIcons'
import { useLogin } from '../../hooks/useAuth'
import { useAppToast } from '../../App'
import styles from './AuthForm.module.css'

interface Props {
  onSwitchToRegister?: () => void
}

interface Fields {
  username: string
  password: string
}

export function LoginForm(_props: Props) {
  const [fields,   setFields]   = useState<Fields>({ username: '', password: '' })
  const [errors,   setErrors]   = useState<Partial<Fields>>({})
  const [showPass, setShowPass] = useState(false)
  const { login, loading, error } = useLogin()
  const toast    = useAppToast()
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
    // —— TEMPORARY: backend auth endpoint not yet updated ——
    toast('🛠️ Авторизация в разработке. Бэкенд ещё не готов.', 'warning')
    // TODO: uncomment when Auth Service is updated
    // abortRef.current?.abort()
    // abortRef.current = new AbortController()
    // login({ username: fields.username, password: fields.password }, abortRef.current.signal)
  }

  const setField = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: undefined }))
  }

  // Show API error via toast too (for when login is enabled)
  useEffect(() => {
    if (error) toast(error, 'error')
  }, [error, toast])

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

      <Button type="submit" loading={loading}>Войти в систему</Button>

      <div className={styles.orRow}><span>или</span></div>

      <div className={styles.socialRow}>
        <button
          type="button"
          className={styles.socialBtn}
          onClick={() => toast('🔷 Авторизация через Microsoft — в разработке', 'info')}
        >
          Microsoft
        </button>
        <button
          type="button"
          className={styles.socialBtn}
          onClick={() => toast('🔗 SSO-авторизация — в разработке', 'info')}
        >
          SSO
        </button>
      </div>
    </form>
  )
}
