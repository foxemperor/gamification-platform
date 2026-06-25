import { useEffect, useState, useRef } from 'react'
import {
  membersApi,
  isAbortError,
  type MemberEntry,
  type MemberScope,
} from '../api/members'
import { useAuthStore } from '../store/authStore'
import s from './MembersPage.module.css'

// ─── Константы ───────────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<MemberScope, string> = {
  all:        'Все',
  project:    'Проект',
  department: 'Отдел',
  team:       'Команда',
}

const SCOPE_HINTS: Record<MemberScope, string> = {
  all:        'Все пользователи сервиса',
  project:    'Участники вашего проекта',
  department: 'Сотрудники вашего отдела',
  team:       'Ваша команда (один менеджер)',
}

// Порядок ролей для сортировки: меньшее значение = выше в списке
const ROLE_ORDER: Record<string, number> = {
  admin:    0,
  manager:  1,
  employee: 2,
  user:     3,
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function displayName(m: MemberEntry): string {
  return m.full_name || m.username
}

function initials(m: MemberEntry): string {
  return displayName(m)
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function roleLabel(role: string | null): string {
  if (!role) return ''
  const map: Record<string, string> = {
    admin:     'Администратор',
    manager:   'Менеджер',
    employee:  'Сотрудник',
    user:      'Пользователь',
  }
  return map[role.toLowerCase()] ?? role
}

function levelColor(level: number): string {
  if (level >= 30) return s.levelGold
  if (level >= 15) return s.levelSilver
  return s.levelDefault
}

function roleOrder(role: string | null): number {
  if (!role) return 99
  return ROLE_ORDER[role.toLowerCase()] ?? 99
}

/**
 * Клиентская фильтрация по scope.
 */
function applyScope(items: MemberEntry[], scope: MemberScope): MemberEntry[] {
  if (scope === 'all') return items
  const self = items.find(m => m.is_self)
  if (!self) return items

  if (scope === 'project') {
    if (!self.project_name) return items
    return items.filter(m => m.project_name === self.project_name)
  }
  if (scope === 'department') {
    if (!self.department) return items
    return items.filter(m => m.department === self.department)
  }
  if (scope === 'team') {
    const myManagerId = self.manager_id
    if (!myManagerId) return [self]
    return items.filter(
      m => m.manager_id === myManagerId || m.user_id === myManagerId
    )
  }
  return items
}

/**
 * Клиентская фильтрация по поисковой строке.
 */
function applySearch(items: MemberEntry[], q: string): MemberEntry[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return items
  return items.filter(m => {
    const haystack = [
      m.full_name ?? '',
      m.username,
      m.project_name ?? '',
      m.department ?? '',
    ].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

/**
 * Сортировка по роли (manager первый), затем по имени.
 */
function sortByRole(items: MemberEntry[]): MemberEntry[] {
  return [...items].sort((a, b) => {
    const dr = roleOrder(a.role) - roleOrder(b.role)
    if (dr !== 0) return dr
    return displayName(a).localeCompare(displayName(b), 'ru')
  })
}

// ─── Аватар ──────────────────────────────────────────────────────────────────

function Avatar({ member, className }: { member: MemberEntry; className: string }) {
  return (
    <div className={className} style={{ overflow: 'hidden' }}>
      {member.avatar_url
        ? <img
            src={member.avatar_url}
            alt={displayName(member)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        : initials(member)}
    </div>
  )
}

// ─── Скелетон ────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <div key={i} className={s.card}>
          <div className={[s.skel, s.skelAvatar].join(' ')} />
          <div className={s.cardBody} style={{ gap: '12px' }}>
            <div className={[s.skel, s.skelName].join(' ')} />
            <div className={[s.skel, s.skelMeta].join(' ')} />
            <div className={[s.skel, s.skelMeta].join(' ')} style={{ width: '100px' }} />
          </div>
        </div>
      ))}
    </>
  )
}

// ─── Строка участника ─────────────────────────────────────────────────────

function MemberRow({ member }: { member: MemberEntry }) {
  const role = roleLabel(member.role)
  return (
    <div className={[s.card, member.is_self ? s.cardSelf : ''].join(' ')}>
      <div className={s.cardAvatarWrap}>
        <Avatar member={member} className={s.cardAvatar} />
        <span className={[s.levelBadge, levelColor(member.level)].join(' ')}>
          {member.level}
        </span>
      </div>

      <div className={s.cardBody}>
        <div className={s.cardName}>
          {displayName(member)}
          {member.is_self && <span className={s.selfTag}>Вы</span>}
        </div>

        {role && (
          <div className={s.cardRole}>
            <span className={s.roleIcon}>👤</span>
            {role}
          </div>
        )}

        <div className={s.cardChips}>
          {member.project_name && (
            <span className={s.chip}>
              <span className={s.chipIcon}>📁</span>
              {member.project_name}
            </span>
          )}
          {member.department && (
            <span className={s.chip}>
              <span className={s.chipIcon}>🏢</span>
              {member.department}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Пустое состояние ─────────────────────────────────────────────────────────

function EmptyState({ scope, hasSearch }: { scope: MemberScope; hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className={s.empty}>
        <div className={s.emptyIcon}>🔍</div>
        <div className={s.emptyTitle}>Никого не найдено</div>
        <div className={s.emptyHint}>Попробуйте изменить запрос или сбросить фильтры</div>
      </div>
    )
  }
  const msgs: Record<MemberScope, { icon: string; title: string; hint: string }> = {
    all:        { icon: '👥', title: 'Участников пока нет',         hint: 'Пригласите коллег — они появятся здесь' },
    project:    { icon: '📁', title: 'В проекте пока никого нет',   hint: 'Участники проекта появятся здесь после назначения' },
    department: { icon: '🏢', title: 'Отдел пока пустой',           hint: 'Сотрудники вашего отдела появятся здесь' },
    team:       { icon: '🤝', title: 'Команда не сформирована',     hint: 'Участники команды привязываются к менеджеру' },
  }
  const m = msgs[scope]
  return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>{m.icon}</div>
      <div className={s.emptyTitle}>{m.title}</div>
      <div className={s.emptyHint}>{m.hint}</div>
    </div>
  )
}

// ─── Список с разделителями групп ────────────────────────────────────────────

interface GroupedListProps {
  members: MemberEntry[]
  showGroups: boolean
}

const ROLE_GROUP_LABELS: Record<string, string> = {
  admin:    'Администраторы',
  manager:  'Менеджеры',
  employee: 'Сотрудники',
  user:     'Пользователи',
}

function GroupedList({ members, showGroups }: GroupedListProps) {
  if (!showGroups) {
    return <>{members.map(m => <MemberRow key={m.user_id} member={m} />)}</>
  }

  // Группируем по роли, сохраняя порядок сортировки
  const groups: { key: string; label: string; items: MemberEntry[] }[] = []
  for (const m of members) {
    const key = (m.role ?? 'user').toLowerCase()
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.items.push(m)
    } else {
      groups.push({ key, label: ROLE_GROUP_LABELS[key] ?? key, items: [m] })
    }
  }

  return (
    <>
      {groups.map(g => (
        // key на Fragment — React корректно отслеживает группы
        <React.Fragment key={g.key}>
          <div className={s.groupDivider}>
            {g.label} &middot; {g.items.length}
          </div>
          {g.items.map(m => <MemberRow key={m.user_id} member={m} />)}
        </React.Fragment>
      ))}
    </>
  )
}

// ─── Страница ────────────────────────────────────────────────────────────────

import React from 'react'

export function MembersPage() {
  const currentUserId = useAuthStore(st => st.user?.id)

  const [scope, setScope]                     = useState<MemberScope>('all')
  const [search, setSearch]                   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [allMembers, setAllMembers]           = useState<MemberEntry[]>([])
  const [loading, setLoading]                 = useState(true)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 300)
  }

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    setLoading(true)
    membersApi
      .getMembers('all', '', 500, ctrl.signal)
      .then(res => {
        if (cancelled) return
        const items = res.items.map(m => ({ ...m, is_self: m.user_id === currentUserId }))
        setAllMembers(items)
      })
      .catch(err => { if (!isAbortError(err) && !cancelled) setAllMembers([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; ctrl.abort() }
  }, [currentUserId])

  const scopedMembers  = applyScope(allMembers, scope)
  const sortedMembers  = scope === 'team' ? sortByRole(scopedMembers) : scopedMembers
  const visibleMembers = applySearch(sortedMembers, debouncedSearch)
  const total          = visibleMembers.length
  const hasSearch      = debouncedSearch.trim().length > 0

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Участники</h1>
          {!loading && (
            <p className={s.pageSub}>
              {total}{' '}
              {total === 1 ? 'участник' : total >= 2 && total <= 4 ? 'участника' : 'участников'}
              {scope !== 'all' && ` · ${SCOPE_HINTS[scope]}`}
            </p>
          )}
        </div>
      </div>

      <div className={s.toolbar}>
        <div className={s.tabs}>
          {(Object.keys(SCOPE_LABELS) as MemberScope[]).map(sc => (
            <button
              key={sc}
              className={[s.tab, scope === sc ? s.tabActive : ''].join(' ')}
              onClick={() => setScope(sc)}
              title={SCOPE_HINTS[sc]}
            >
              {SCOPE_LABELS[sc]}
            </button>
          ))}
        </div>

        <div className={s.searchWrap}>
          <span className={s.searchIcon}>🔍</span>
          <input
            className={s.searchInput}
            type="text"
            placeholder="Поиск по ФИО, проекту, отделу…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            aria-label="Поиск участников"
          />
          {search && (
            <button
              className={s.searchClear}
              onClick={() => { setSearch(''); setDebouncedSearch('') }}
              aria-label="Сбросить поиск"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={s.grid}>
        {loading ? (
          <SkeletonCards />
        ) : visibleMembers.length > 0 ? (
          <GroupedList
            members={visibleMembers}
            showGroups={scope === 'team' && !hasSearch}
          />
        ) : (
          <div className={s.emptyWrap}>
            <EmptyState scope={scope} hasSearch={hasSearch} />
          </div>
        )}
      </div>
    </div>
  )
}
