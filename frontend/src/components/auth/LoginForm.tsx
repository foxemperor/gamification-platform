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
  email:    string
  password: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function LoginForm(_props: Props) {
  const [fields,   setFields]   = useState<Fields>({ email: '', password: '' })
  const [errors,   setErrors]   = useState<Partial<Fields>>({})
  const [showPass, setShowPass] = useState(false)
  const { login, loading, error } = useLogin()
  const toast    = useAppToast()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { return () => { abortRef.current?.abort() } }, [])

  useEffect(() => { if (error) toast(error, 'error') }, [error, toast])

  const validate = (): boolean => {
    const e: Partial<Fields> = {}
    if (!EMAIL_RE.test(fields.email)) e.email    = 'Введите корректный email'
    if (!fields.password)             e.password = 'Введите пароль'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    login({ email: fields.email, password: fields.password }, abortRef.current.signal)
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
        label="Email"
        iconNode={<IconMail size={15} />}
        type="email"
        placeholder="your@company.com"
        value={fields.email}
        error={errors.email}
        onChange={setField('email')}
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
        <button type="button" className={styles.socialBtn}
          onClick={() => toast('🔷 Авторизация через Microsoft — в разработке', 'info')}
        >Microsoft</button>
        <button type="button" className={styles.socialBtn}
          onClick={() => toast('🔗 SSO-авторизация — в разработке', 'info')}
        >SSO</button>
      </div>
    </form>
  )
}
