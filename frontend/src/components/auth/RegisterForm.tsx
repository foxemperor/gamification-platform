import { useState, useEffect, useRef } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { IconUser, IconMail, IconLock, IconGamepad, IconEye, IconEyeOff } from '../ui/FeatherIcons'
import { useRegister } from '../../hooks/useAuth'
import { useAppToast } from '../../App'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function getStrength(p: string): number {
  let s = 0
  if (p.length >= 8)    s++
  if (/[A-Z]/.test(p))  s++
  if (/[0-9]/.test(p))  s++
  if (/[^\w]/.test(p))  s++
  return s
}

const STRENGTH_COLORS = ['#EF4444', '#F59E0B', '#22D3EE', '#10B981']
const STRENGTH_LABELS = ['Очень слабый', 'Слабый', 'Хороший', 'Надёжный']

interface Props { onSwitchToLogin?: () => void }

export function RegisterForm(_props: Props) {
  const [fields,   setFields]   = useState<Fields>({
    first_name: '', last_name: '', email: '', username: '', password: '',
  })
  const [agree,    setAgree]    = useState(false)
  const [errors,   setErrors]   = useState<FieldErrors>({})
  const [showPass, setShowPass] = useState(false)
  const { register, loading, error, success } = useRegister()
  const navigate  = useNavigate()
  const toast     = useAppToast()
  const strength  = getStrength(fields.password)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Show API error via toast
  useEffect(() => {
    if (error) toast(error, 'error')
  }, [error, toast])

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: undefined }))
  }

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!fields.first_name.trim())     e.first_name = 'Введите имя'
    if (!fields.last_name.trim())      e.last_name  = 'Введите фамилию'
    if (!EMAIL_RE.test(fields.email))  e.email      = 'Введите корректный email'
    if (fields.username.length < 3)    e.username   = 'Мин. 3 символа'
    if (fields.password.length < 8)    e.password   = 'Мин. 8 символов'
    if (!agree)                        e.agree      = 'Необходимо принять условия'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    // —— TEMPORARY: backend register endpoint not yet updated ——
    toast('🛠️ Регистрация в разработке. Бэкенд ещё не готов.', 'warning')
    // TODO: uncomment when Auth Service is updated
    // abortRef.current?.abort()
    // abortRef.current = new AbortController()
    // register({ ...fields, role: 'employee' }, abortRef.current.signal)
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
      <Button onClick={() => navigate('/dashboard')}>Перейти на Dashboard</Button>
    </div>
  )

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.heading}>
        <h2 className={styles.title}>Создать аккаунт 🚀</h2>
        <p className={styles.sub}>Начните выполнять квесты и зарабатывать XP</p>
      </div>

      <div className={styles.row2}>
        <Input label="Имя"     iconNode={<IconUser size={15} />} placeholder="Ваше имя"     value={fields.first_name} error={errors.first_name} onChange={set('first_name')} />
        <Input label="Фамилия" iconNode={<IconUser size={15} />} placeholder="Ваша фамилия" value={fields.last_name}  error={errors.last_name}  onChange={set('last_name')} />
      </div>

      <Input label="Email"   iconNode={<IconMail    size={15} />} type="email"    placeholder="your@company.com"    value={fields.email}    error={errors.email}    onChange={set('email')} />
      <Input label="Логин"   iconNode={<IconGamepad size={15} />}               placeholder="Придумайте логин"    value={fields.username} error={errors.username} onChange={set('username')} />

      <Input
        label="Пароль"
        iconNode={<IconLock size={15} />}
        type={showPass ? 'text' : 'password'}
        placeholder="Минимум 8 символов"
        value={fields.password}
        error={errors.password}
        onChange={set('password')}
        rightSlot={
          <button type="button" className={styles.eyeBtn}
            aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
            onClick={() => setShowPass(v => !v)}
          >
            {showPass ? <IconEyeOff /> : <IconEye />}
          </button>
        }
      />

      {fields.password && (
        <div className={styles.strengthWrap}>
          <div className={styles.strengthSegs}>
            {[0,1,2,3].map(i => (
              <div key={i} className={styles.seg}
                style={{ background: i < strength ? STRENGTH_COLORS[strength-1] : 'var(--surface-high)' }}
              />
            ))}
          </div>
          <span className={styles.strengthLbl} style={{ color: STRENGTH_COLORS[strength-1] ?? 'var(--text-faint)' }}>
            {STRENGTH_LABELS[strength-1] ?? 'Очень слабый'}
          </span>
        </div>
      )}

      <div className={styles.xpHint}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>За регистрацию —{' '}
          <strong style={{ color: 'var(--primary)' }}>+100 XP</strong>{' '}и{' '}
          <strong style={{ color: 'var(--reward)' }}>🪙 50 монет</strong>!
        </div>
      </div>

      <label className={styles.agreeRow}>
        <input type="checkbox" checked={agree}
          onChange={e => { setAgree(e.target.checked); setErrors(er => ({ ...er, agree: undefined })) }}
        />
        <span>Принимаю{' '}<a href="#">Условия</a>{' '}и{' '}<a href="#">Политику конфиденциальности</a></span>
      </label>
      {errors.agree && <p className={styles.apiError}>{errors.agree}</p>}

      <Button type="submit" loading={loading}>Создать аккаунт</Button>
    </form>
  )
}
