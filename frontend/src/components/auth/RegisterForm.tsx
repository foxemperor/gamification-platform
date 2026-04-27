import { useState, useEffect, useRef } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useRegister } from '../../hooks/useAuth'
import styles from './AuthForm.module.css'
import { useNavigate } from 'react-router-dom'

interface Fields {
  first_name: string
  last_name:  string
  email:      string
  username:   string
  password:   string
}
type FieldErrors = Partial<Fields & { agree: string }>

// SVG eye icons
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

function getStrength(p: string): number {
  let s = 0
  if (p.length >= 8)          s++
  if (/[A-Z]/.test(p))        s++
  if (/[0-9]/.test(p))        s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}

const STRENGTH_COLORS = ['#EF4444', '#F59E0B', '#22D3EE', '#10B981']
const STRENGTH_LABELS = ['Очень слабый', 'Слабый', 'Хороший', 'Надёжный']

interface Props { onSwitchToLogin?: () => void }

export function RegisterForm(_props: Props) {
  const [fields, setFields] = useState<Fields>({
    first_name: '', last_name: '', email: '', username: '', password: '',
  })
  const [agree,    setAgree]    = useState(false)
  const [errors,   setErrors]   = useState<FieldErrors>({})
  const [showPass, setShowPass] = useState(false)
  const { register, loading, error, success } = useRegister()
  const navigate = useNavigate()
  const strength = getStrength(fields.password)

  // AbortController — cancel in-flight requests on unmount
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: undefined }))
  }

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!fields.first_name.trim())    e.first_name = 'Введите имя'
    if (!fields.last_name.trim())     e.last_name  = 'Введите фамилию'
    if (!fields.email.includes('@'))  e.email      = 'Введите корректный email'
    if (fields.username.length < 3)   e.username   = 'Мин. 3 символа'
    if (fields.password.length < 8)   e.password   = 'Мин. 8 символов'
    if (!agree)                       e.agree      = 'Необходимо принять условия'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    abortRef.current = new AbortController()
    // role всегда 'employee' — менять может только admin/manager
    register({ ...fields, role: 'employee' })
  }

  if (success) return (
    <div className={styles.success}>
      <span className={styles.successIco}>🎉</span>
      <h3 className={styles.successTitle}>Аккаунт создан!</h3>
      <p className={styles.successSub}>
        Добро пожаловать! Вам начислено{' '}
        <strong style={{ color: 'var(--primary)' }}>+100 XP</strong>{' '}и{' '}
        <strong style={{ color: 'var(--reward)' }}>🪙 50 монет</strong>
      </p>
      <Button onClick={() => navigate('/dashboard')}>Перейти на Dashboard →</Button>
    </div>
  )

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.heading}>
        <h2 className={styles.title}>Создать аккаунт 🚀</h2>
        <p className={styles.sub}>Начните выполнять квесты и зарабатывать XP</p>
      </div>

      <div className={styles.row2}>
        <Input
          label="Имя"
          icon="👤"
          placeholder="Ваше имя"
          value={fields.first_name}
          error={errors.first_name}
          onChange={set('first_name')}
        />
        <Input
          label="Фамилия"
          icon="👤"
          placeholder="Ваша фамилия"
          value={fields.last_name}
          error={errors.last_name}
          onChange={set('last_name')}
        />
      </div>

      <Input
        label="Email"
        icon="✉️"
        type="email"
        placeholder="your@company.com"
        value={fields.email}
        error={errors.email}
        onChange={set('email')}
      />

      <Input
        label="Логин"
        icon="🎮"
        placeholder="Придумайте логин"
        value={fields.username}
        error={errors.username}
        onChange={set('username')}
      />

      <Input
        label="Пароль"
        icon="🔒"
        type={showPass ? 'text' : 'password'}
        placeholder="Минимум 8 символов"
        value={fields.password}
        error={errors.password}
        onChange={set('password')}
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

      {fields.password && (
        <div className={styles.strengthWrap}>
          <div className={styles.strengthSegs}>
            {[0,1,2,3].map(i => (
              <div key={i} className={styles.seg}
                style={{
                  background: i < strength
                    ? STRENGTH_COLORS[strength - 1]
                    : 'var(--surface-high)',
                }}
              />
            ))}
          </div>
          <span className={styles.strengthLbl}
            style={{ color: STRENGTH_COLORS[strength - 1] ?? 'var(--text-faint)' }}
          >
            {STRENGTH_LABELS[strength - 1] ?? 'Очень слабый'}
          </span>
        </div>
      )}

      {/* XP hint */}
      <div className={styles.xpHint}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          За регистрацию —{' '}
          <strong style={{ color: 'var(--primary)' }}>+100 XP</strong>{' '}и{' '}
          <strong style={{ color: 'var(--reward)' }}>🪙 50 монет</strong>!
        </div>
      </div>

      {/* Agree */}
      <label className={styles.agreeRow}>
        <input
          type="checkbox"
          checked={agree}
          onChange={e => {
            setAgree(e.target.checked)
            setErrors(er => ({ ...er, agree: undefined }))
          }}
        />
        <span>
          Принимаю{' '}
          <a href="#">Условия использования</a>{' '}и{' '}
          <a href="#">Политику конфиденциальности</a>
        </span>
      </label>
      {errors.agree && <p className={styles.apiError}>{errors.agree}</p>}

      {error && <p className={styles.apiError}>{error}</p>}

      <Button type="submit" loading={loading}>Создать аккаунт →</Button>
    </form>
  )
}
