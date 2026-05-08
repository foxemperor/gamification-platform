import { useAuthStore } from '../../store/authStore'
import styles from './SidebarUser.module.css'

interface Props { mini: boolean }

export function SidebarUser({ mini }: Props) {
  const user = useAuthStore(s => s.user)

  const displayName = user?.full_name ?? user?.username ?? 'Пользователь'
  // Показываем только первое слово + первую букву второго (если есть)
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

  return (
    <div className={[styles.user, mini ? styles.mini : ''].filter(Boolean).join(' ')}>
      <div className={styles.avatar} title={displayName}>
        {initials || '👤'}
      </div>
      {!mini && (
        <>
          <div className={styles.info}>
            <span className={styles.name}>{shortName}</span>
            <span className={styles.coins}>🪙 {user?.coins ?? 0} монет</span>
          </div>
          <span className={styles.dots}>⋯</span>
        </>
      )}
    </div>
  )
}
