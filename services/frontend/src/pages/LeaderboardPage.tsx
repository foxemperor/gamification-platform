import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  leaderboardApi,
  isAbortError,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../api/leaderboard'
import { useAuthStore } from '../store/authStore'
import s from './LeaderboardPage.module.css'

// ─────────────────── helpers ───────────────────

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  weekly: 'Неделя',
  monthly: 'Месяц',
  all_time: 'Всё время',
}

function displayName(e: LeaderboardEntry): string {
  return e.full_name || e.username
}

function initials(e: LeaderboardEntry): string {
  return displayName(e)
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function xpBarWidth(xp: number, maxXp: number): number {
  if (!maxXp) return 0
  return Math.max(4, Math.round((xp / maxXp) * 100))
}

// ─────────────────── podium (top-3) ───────────────────

const MEDAL = ['🥇', '🥈', '🥉']

function PodiumCard({ entry, isSelf }: { entry: LeaderboardEntry; isSelf: boolean }) {
  const visualOrder = entry.rank === 1 ? 'order2' : entry.rank === 2 ? 'order1' : 'order3'
  const rankClass = `podiumRank${entry.rank}` as 'podiumRank1' | 'podiumRank2' | 'podiumRank3'
  const heightClass = entry.rank === 1 ? 'h1' : entry.rank === 2 ? 'h2' : 'h3'
  return (
    <div className={`${s.podiumCard} ${s[visualOrder]} ${s[rankClass]} ${isSelf ? s.podiumSelf : ''}`}>
      <div className={s.podiumAvatar}>{initials(entry)}</div>
      <span className={s.podiumMedal}>{MEDAL[entry.rank - 1]}</span>
      <span className={s.podiumName}>{displayName(entry)}</span>
      <span className={s.podiumLevel}>Ур. {entry.level}</span>
      <span className={s.podiumXP}>{entry.total_xp.toLocaleString()} XP</span>
      <div className={`${s.podiumBase} ${s[heightClass]}`} />
    </div>
  )
}

// ─────────────────── table row ───────────────────

function TableRow({
  entry,
  isSelf,
  maxXp,
}: {
  entry: LeaderboardEntry
  isSelf: boolean
  maxXp: number
}) {
  const width = xpBarWidth(entry.total_xp, maxXp)
  return (
    <tr className={`${s.row} ${isSelf ? s.rowSelf : ''}`}>
      {/* rank */}
      <td className={s.tdRank}>
        {entry.rank <= 3
          ? <span className={s.medal}>{MEDAL[entry.rank - 1]}</span>
          : <span className={s.rankNum}>{entry.rank}</span>}
      </td>

      {/* player */}
      <td>
        <div className={s.playerCell}>
          <div className={s.avatar}>{initials(entry)}</div>
          <div className={s.playerInfo}>
            <span className={s.playerName}>
              {displayName(entry)}
              {isSelf && <span className={s.selfBadge}>Вы</span>}
            </span>
            <span className={s.playerMeta}>
              {entry.quests_completed} квестов · {entry.badges_count} бейджей
            </span>
            {/* Отдел / Проект / Должность */}
            <div className={s.chipRow}>
              {entry.department && (
                <span className={s.chipDept}>{entry.department}</span>
              )}
              {entry.project_name && (
                <span className={s.chipProject}>{entry.project_name}</span>
              )}
              {entry.position && (
                <span className={s.chipPosition}>{entry.position}</span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* level */}
      <td className={s.tdLevel}>
        <span className={s.levelBadge}>{entry.level}</span>
      </td>

      {/* xp */}
      <td className={s.tdXp}>
        <div className={s.xpCell}>
          <span className={s.xpValue}>{entry.total_xp.toLocaleString()}</span>
          <div className={s.xpTrack}>
            <div className={s.xpFill} style={{ width: `${width}%` }} />
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────── skeleton ───────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i} className={s.row}>
          <td className={s.tdRank}><div className={`${s.skel} ${s.skelSm}`} /></td>
          <td>
            <div className={s.playerCell}>
              <div className={`${s.skel} ${s.skelAvatar}`} />
              <div className={s.playerInfo}>
                <div className={`${s.skel} ${s.skelName}`} />
                <div className={`${s.skel} ${s.skelMeta}`} />
              </div>
            </div>
          </td>
          <td className={s.tdLevel}><div className={`${s.skel} ${s.skelSm}`} /></td>
          <td className={s.tdXp}><div className={`${s.skel} ${s.skelBar}`} /></td>
        </tr>
      ))}
    </>
  )
}

// ─────────────────── page ───────────────────

export function LeaderboardPage() {
  const currentUserId = useAuthStore(st => st.user?.id)

  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  // Список уникальных проектов из полученных данных (all_time, без фильтра)
  const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([])

  const projects = useMemo(() => {
    const set = new Set<string>()
    allEntries.forEach(e => { if (e.project_name) set.add(e.project_name) })
    return Array.from(set).sort()
  }, [allEntries])

  const load = useCallback((p: LeaderboardPeriod, proj: string) => {
    setLoading(true)
    const ctrl = new AbortController()
    leaderboardApi
      .getXP(p, 50, ctrl.signal, proj || undefined)
      .then(res => {
        if (ctrl.signal.aborted) return
        setEntries(res.entries)
        setUpdatedAt(res.updated_at)
        // Кешируем «полный» список для построения списка проектов
        if (!proj) setAllEntries(res.entries)
      })
      .catch(err => {
        if (isAbortError(err) || ctrl.signal.aborted) return
        setEntries([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return ctrl
  }, [])

  useEffect(() => {
    const ctrl = load(period, projectFilter)
    return () => ctrl.abort()
  }, [period, projectFilter, load])

  const top3 = entries.slice(0, 3)
  const maxXp = entries[0]?.total_xp ?? 1
  const selfRank = entries.find(e => e.user_id === currentUserId)

  const formattedAt = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className={s.page}>
      {/* ── header ── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Рейтинг</h1>
          {selfRank && (
            <p className={s.pageSub}>
              Ваша позиция: #{selfRank.rank} · {selfRank.total_xp.toLocaleString()} XP
            </p>
          )}
        </div>
        {formattedAt && (
          <span className={s.updatedAt}>обновлено в {formattedAt}</span>
        )}
      </div>

      {/* ── controls row: period + project filter ── */}
      <div className={s.controlsRow}>
        <div className={s.periodSwitcher}>
          {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map(p => (
            <button
              key={p}
              className={`${s.periodBtn} ${period === p ? s.periodBtnActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Project filter — отображается только если есть >1 проекта */}
        {projects.length > 0 && (
          <div className={s.projectFilterWrap}>
            <label className={s.projectFilterLabel} htmlFor="lb-project-filter">
              Проект
            </label>
            <select
              id="lb-project-filter"
              className={s.projectSelect}
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
            >
              <option value="">Все проекты</option>
              {projects.map(pr => (
                <option key={pr} value={pr}>{pr}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── podium ── */}
      {!loading && top3.length >= 3 && (
        <div className={s.podiumSection}>
          {top3.map(e => (
            <PodiumCard key={e.user_id} entry={e} isSelf={e.user_id === currentUserId} />
          ))}
        </div>
      )}

      {/* ── table ── */}
      <div className={s.tableSection}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.thRank}>#</th>
              <th>Игрок</th>
              <th className={s.thLevel}>Ур.</th>
              <th className={s.thXp}>XP</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <SkeletonRows />
              : entries.length > 0
                ? entries.map(e => (
                    <TableRow
                      key={e.user_id}
                      entry={e}
                      isSelf={e.user_id === currentUserId}
                      maxXp={maxXp}
                    />
                  ))
                : (
                    <tr>
                      <td colSpan={4}>
                        <div className={s.empty}>
                          <span className={s.emptyIcon}>🏆</span>
                          <p className={s.emptyTitle}>Рейтинг пока пуст</p>
                          <p className={s.emptyHint}>
                            {projectFilter
                              ? `В проекте «${projectFilter}» ещё никто не набрал XP`
                              : 'Первый выполненный квест поставит тебя на первое место!'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
