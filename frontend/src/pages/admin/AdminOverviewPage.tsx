import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminApi, adminQuestsApi, adminBadgesApi } from '../../api/admin'
import styles from './AdminTools.module.css'

export function AdminOverviewPage() {
  const usersQ = useQuery({
    queryKey: ['admin-users-count'],
    queryFn: () => adminApi.listUsers(1, 1, '').then(r => r.data.total),
  })
  const questsQ = useQuery({
    queryKey: ['admin-quests-count'],
    queryFn: () => adminQuestsApi.list({ page: 1, per_page: 1 }).then(r => r.data.total),
  })
  const badgesQ = useQuery({
    queryKey: ['admin-badges-count'],
    queryFn: () => adminBadgesApi.list({ page: 1, per_page: 1 }).then(r => r.data.total),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Админ-панель</h1>
          <p className={styles.subtitle}>Управление пользователями, квестами, бейджами и XP</p>
        </div>
      </div>

      <div className={styles.statCards}>
        <Card label="Пользователей" value={usersQ.data} link="/admin/users" />
        <Card label="Квестов" value={questsQ.data} link="/admin/quests" />
        <Card label="Бейджей" value={badgesQ.data} link="/admin/badges" />
        <Card label="XP инструменты" value={undefined} link="/admin/xp" hint="Журнал и ручное начисление" />
        <Card label="Мониторинг" value={undefined} link="/admin/monitoring" hint="Статус сервисов в реальном времени" />
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  link,
  hint,
}: {
  label: string
  value?: number
  link: string
  hint?: string
}) {
  return (
    <Link to={link} className={styles.statCard} style={{ textDecoration: 'none' }}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value ?? (hint ? '→' : '…')}</p>
      {hint && <p className={styles.subtitle}>{hint}</p>}
    </Link>
  )
}
