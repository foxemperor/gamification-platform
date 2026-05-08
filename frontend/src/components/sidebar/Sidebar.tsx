import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { SidebarUser } from './SidebarUser'
import { SidebarXP } from './SidebarXP'
import { SidebarTheme } from './SidebarTheme'
import styles from './Sidebar.module.css'

const STORAGE_KEY = 'sidebar:mini'

interface NavItemDef {
  to: string
  icon: string
  label: string
  badge?: number
  badgeVariant?: 'primary' | 'warn'
}

const NAV_MAIN: NavItemDef[] = [
  { to: '/',            icon: '📊', label: 'Обзор' },
  { to: '/quests',      icon: '⚡', label: 'Квесты',      badge: 3, badgeVariant: 'warn' },
  { to: '/leaderboard', icon: '🏆', label: 'Рейтинг' },
  { to: '/achievements',icon: '🎖️', label: 'Достижения',  badge: 2 },
]

const NAV_TEAM: NavItemDef[] = [
  { to: '/members', icon: '👥', label: 'Участники' },
  { to: '/events',  icon: '📅', label: 'События' },
]

const NAV_ACCOUNT: NavItemDef[] = [
  { to: '/settings', icon: '⚙️', label: 'Настройки' },
]

export function Sidebar() {
  const [mini, setMini] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(mini)) } catch {}
  }, [mini])

  const cls = [styles.sidebar, mini ? styles.mini : ''].filter(Boolean).join(' ')

  return (
    <aside className={cls}>

      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🎮</span>
        <span className={styles.logoText}>GameQuest</span>
      </div>

      {/* User — сверху */}
      <SidebarUser mini={mini} />

      {/* XP — под юзером */}
      <SidebarXP mini={mini} />

      {/* Nav */}
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
      </nav>

      {/* Theme switcher */}
      <SidebarTheme mini={mini} />

      {/* Collapse button */}
      <div className={styles.collapseWrap}>
        <button className={styles.collapseBtn} onClick={() => setMini(p => !p)}>
          <span className={styles.navIcon}>{mini ? '▶' : '◀'}</span>
          {!mini && <span className={styles.navLabel}>Свернуть</span>}
        </button>
      </div>
    </aside>
  )
}

// ── NavSection ──────────────────────────────────────────────────
function NavSection({ label, mini, children }: { label: string; mini: boolean; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      {!mini && <span className={styles.sectionLabel}>{label}</span>}
      {children}
    </div>
  )
}

// ── NavItem ─────────────────────────────────────────────────────
function NavItem({ to, icon, label, badge, badgeVariant = 'primary', mini }: NavItemDef & { mini: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.active : ''].filter(Boolean).join(' ')
      }
    >
      <span className={styles.navIcon}>{icon}</span>
      {!mini && <span className={styles.navLabel}>{label}</span>}
      {badge !== undefined && (
        <span className={[
          styles.badge,
          badgeVariant === 'warn' ? styles.badgeWarn : ''
        ].filter(Boolean).join(' ')}>
          {badge}
        </span>
      )}
      {/* Тултип только в mini-режиме */}
      {mini && <span className={styles.tooltip}>{label}</span>}
    </NavLink>
  )
}
