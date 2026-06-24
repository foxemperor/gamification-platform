import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SidebarUser } from './SidebarUser'
import { SidebarXP } from './SidebarXP'
import { SidebarTheme } from './SidebarTheme'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../api/axios'
import styles from './Sidebar.module.css'

const STORAGE_KEY = 'sidebar:mini'

interface NavItemDef {
  to: string
  icon: string
  label: string
  badge?: number
  badgeVariant?: 'primary' | 'warn'
}

const NAV_TEAM: NavItemDef[] = [
  { to: '/members', icon: '👥', label: 'Участники' },
  { to: '/events',  icon: '📅', label: 'События' },
]

const NAV_ACCOUNT: NavItemDef[] = [
  { to: '/settings', icon: '⚙️', label: 'Настройки' },
]

const NAV_ADMIN: NavItemDef[] = [
  { to: '/admin',            icon: '🛡️', label: 'Обзор' },
  { to: '/admin/users',      icon: '👤', label: 'Пользователи' },
  { to: '/admin/quests',     icon: '📜', label: 'Квесты' },
  { to: '/admin/badges',     icon: '🏅', label: 'Бейджи' },
  { to: '/admin/xp',         icon: '✨', label: 'XP' },
  { to: '/admin/monitoring', icon: '📡', label: 'Мониторинг' },
]

export function Sidebar() {
  const [mini, setMini] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.is_superuser || user?.role === 'admin'

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(mini)) } catch {}
  }, [mini])

  // Динамические badge-счётчики: только непрочитанные квесты
  // Достижения намеренно убраны из badge — там никогда не должно быть шарика
  const { data: notif } = useQuery({
    queryKey: ['sidebar-notifications'],
    queryFn: () =>
      api.get<{ unread_quests: number; unread_badges: number }>(
        '/me/notifications/unread-counts'
      ).then(r => r.data),
    refetchInterval: 30_000,
    enabled: !!user,
    staleTime: 10_000,
  })

  const NAV_MAIN: NavItemDef[] = [
    { to: '/',             icon: '📊', label: 'Обзор' },
    {
      to: '/quests',
      icon: '⚡',
      label: 'Квесты',
      badge: notif?.unread_quests || undefined,
      badgeVariant: 'warn',
    },
    { to: '/leaderboard',  icon: '🏆', label: 'Рейтинг' },
    // Достижения — без badge намеренно (badge убран по требованию дизайна)
    { to: '/achievements', icon: '🎖️', label: 'Достижения' },
    { to: '/inventory',    icon: '🎒', label: 'Инвентарь' },
  ]

  const cls = [styles.sidebar, mini ? styles.mini : ''].filter(Boolean).join(' ')

  return (
    <aside className={cls}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🎮</span>
        <span className={styles.logoText}>GameQuest</span>
      </div>

      <SidebarUser mini={mini} />
      <SidebarXP mini={mini} />

      <nav className={styles.nav}>
        <NavSection label="Главное" mini={mini}>
          {NAV_MAIN.map(item => <NavItem key={item.to} {...item} mini={mini} />)}
        </NavSection>
        <NavSection label="Команда" mini={mini}>
          {NAV_TEAM.map(item => <NavItem key={item.to} {...item} mini={mini} />)}
        </NavSection>
        <NavSection label="Аккаунт" mini={mini}>
          {NAV_ACCOUNT.map(item => <NavItem key={item.to} {...item} mini={mini} />)}
        </NavSection>

        {/* Админ-раздел — виден только admin/superuser */}
        {isAdmin && (
          <NavSection label="Админ" mini={mini}>
            {NAV_ADMIN.map(item => <NavItem key={item.to} {...item} mini={mini} />)}
          </NavSection>
        )}
      </nav>

      <SidebarTheme mini={mini} />

      <div className={styles.collapseWrap}>
        <button className={styles.collapseBtn} onClick={() => setMini(p => !p)}>
          <span className={styles.navIcon}>{mini ? '▶' : '◀'}</span>
          {!mini && <span className={styles.navLabel}>Свернуть</span>}
        </button>
      </div>
    </aside>
  )
}

function NavSection({ label, mini, children }: { label: string; mini: boolean; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      {!mini && <span className={styles.sectionLabel}>{label}</span>}
      {children}
    </div>
  )
}

function NavItem({ to, icon, label, badge, badgeVariant = 'primary', mini }: NavItemDef & { mini: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/' || to === '/admin'}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.active : ''].filter(Boolean).join(' ')
      }
    >
      <span className={styles.navIcon}>{icon}</span>
      {!mini && <span className={styles.navLabel}>{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span className={[
          styles.badge,
          badgeVariant === 'warn' ? styles.badgeWarn : ''
        ].filter(Boolean).join(' ')}>
          {badge}
        </span>
      )}
      {mini && <span className={styles.tooltip}>{label}</span>}
    </NavLink>
  )
}
