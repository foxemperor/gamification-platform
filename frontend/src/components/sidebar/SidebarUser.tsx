import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import styles from './SidebarUser.module.css'

interface Props { mini: boolean }

export function SidebarUser({ mini }: Props) {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const displayName = user?.full_name ?? user?.username ?? 'Пользователь'
  const shortName = (() => {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts[1][0]}.`
  })()
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('')

  // Закрываем dropdown по клику вне компонента
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div
      ref={ref}
      className={[styles.user, mini ? styles.mini : ''].filter(Boolean).join(' ')}
      style={{ position: 'relative' }}
    >
      <div className={styles.avatar} title={displayName} style={{ overflow: 'hidden' }}>
        {user?.avatar_url
          ? <img
              src={user.avatar_url}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          : (initials || '👤')}
      </div>
      {!mini && (
        <>
          <div className={styles.info}>
            <span className={styles.name}>{shortName}</span>
            <span className={styles.coins}>🪙 {user?.coins ?? 0} монет</span>
          </div>
          <span
            className={styles.dots}
            onClick={() => setOpen(p => !p)}
            title="Действия с аккаунтом"
            style={{ cursor: 'pointer', userSelect: 'none', padding: '0 4px' }}
            role="button"
            aria-haspopup="true"
            aria-expanded={open}
          >
            ⋯
          </span>

          {open && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--surface, #1e1e2e)',
                border: '1px solid var(--border, #333)',
                borderRadius: 8,
                padding: '4px 0',
                minWidth: 180,
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                zIndex: 200,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--text, #fff)',
                  fontSize: 14,
                  borderRadius: 6,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.07))')
                }
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                🚪 Выйти из аккаунта
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
