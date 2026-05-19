import { useEffect, useState, useCallback } from 'react'
import { leaderboardApi, isAbortError, type LeaderboardEntry, type LeaderboardPeriod } from '../api/leaderboard'
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
  const name = displayName(e)
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function levelThreshold(level: number): number {
  return 100 * (level - 1) * level / 2
}

function xpBarWidth(totalXp: number, level: number): number {
  const start = levelThreshold(level)
  const end   = levelThreshold(level + 1)
  const range = end - start
  if (range <= 0) return 100
  const progress = totalXp - start
  return Math.min(100, Math.max(4, Math.round((progress / range) * 100)))
}

// ─────────────────── podium ───────────────────

const MEDAL = ['🥇', '🥈', '🥉']

/**
 * Визуальный порядок карточек: 2-е место — лево, 1-е — центр, 3-е — право.
 * Если игроков меньше 3 — все карточки отображаются центрированно.
 */
function podiumVisualOrder(rank: number, total: number): string {
  if (total === 1) return s.order2  // единственный — центр
  if (total === 2) {
    return rank === 1 ? s.order2 : s.order1  // 1-е в центре, 2-е слева
  }
  // стандартный 3-местный пьедестал
  if (rank === 1) return s.order2
  if (rank === 2) return s.order1
  return s.order3
}

function podiumRankClass(rank: number): string {
  if (rank === 1) return s.podiumRank1
  if (rank === 2) return s.podiumRank2
  return s.podiumRank3
}

function PodiumCard({
  entry,
  isSelf,
  total,
}: {
  entry: LeaderboardEntry
  isSelf: boolean
  total: number
}) {
  return (
    <div
      className={[
        s.podiumCard,
        podiumVisualOrder(entry.rank, total),
        podiumRankClass(entry.rank),
        isSelf ? s.podiumSelf : '',
      ].join(' ')}
    >
      <div className={s.podiumAvatar}>{initials(entry)}</div>
      <div className={s.podiumMedal}>{MEDAL[entry.rank - 1]}</div>
      <div className={s.podiumName}>{displayName(entry)}</div>
      <div className={s.podiumLevel}>Ур. {entry.level}</div>
      <div className={s.podiumXP}>{entry.total_xp.toLocaleString()} XP</div>
      <div
        className={[
          s.podiumBase,
          entry.rank === 1 ? s.h1 : entry.rank === 2 ? s.h2 : s.h3,
        ].join(' ')}
      />
    </div>
  )
}

// ─────────────────── chips ───────────────────

function PlayerChips({ entry }: { entry: LeaderboardEntry }) {
  const dept    = entry.department
  const project = entry.project_name
  if (!dept && !project) return null
  return (
    <div className={s.chipRow}>
      {dept    && <span className={s.chip}><span className={s.chipIcon}>🏢</span>{dept}</span>}
      {project && <span className={s.chip}><span className={s.chipIcon}>📁</span>{project}</span>}
    </div>
  )
}

// ─────────────────── table row ───────────────────

function TableRow({ entry, isSelf }: { entry: LeaderboardEntry; isSelf: boolean }) {
  const barWidth = xpBarWidth(entry.total_xp, entry.level)

  return (
    <tr className={[s.row, isSelf ? s.rowSelf : ''].join(' ')}>
      <td className={s.tdRank}>
        {entry.rank <= 3
          ? <span className={s.medal}>{MEDAL[entry.rank - 1]}</span>
          : <span className={s.rankNum}>{entry.rank}</span>}
      </td>
      <td>
        <div className={s.playerCell}>
          <div className={s.avatar}>{initials(entry)}</div>
          <div className={s.playerInfo}>
            <div className={s.playerName}>
              {displayName(entry)}
              {isSelf && <span className={s.selfBadge}>Вы</span>}
              {entry.position && (
                <span className={s.positionLabel}>{entry.position}</span>
              )}
            </div>
            <PlayerChips entry={entry} />
            <div className={s.playerMeta}>
              {entry.quests_completed} квестов · {entry.badges_count} бейджей
            </div>
          </div>
        </div>
      </td>
      <td className={s.tdLevel}>
        <span className={s.levelBadge}>{entry.level}</span>
      </td>
      <td className={s.tdXP}>
        <div className={s.xpCell}>
          <span className={s.xpValue}>{entry.total_xp.toLocaleString()}</span>
          <div className={s.xpTrack}>
            <div className={s.xpFill} style={{ width: `${barWidth}%` }} />
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
          <td className={s.tdRank}><div className={[s.skel, s.skelSm].join(' ')} /></td>
          <td>
            <div className={s.playerCell}>
              <div className={[s.skel, s.skelAvatar].join(' ')} />
              <div>
                <div className={[s.skel, s.skelName].join(' ')} />
                <div className={[s.skel, s.skelMeta].join(' ')} />
              </div>
            </div>
          </td>
          <td><div className={[s.skel, s.skelSm].join(' ')} /></td>
          <td><div className={[s.skel, s.skelBar].join(' ')} /></td>
        </tr>
      ))}
    </>
  )
}

// ─────────────────── page ───────────────────

export function LeaderboardPage() {
  const currentUserId = useAuthStore(s => s.user?.id)

  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback((p: LeaderboardPeriod) => {
    setLoading(true)
    const ctrl = new AbortController()

    leaderboardApi
      .getXP(p, 50, ctrl.signal)
      .then(res => {
        if (ctrl.signal.aborted) return
        setEntries(res.entries)
        setUpdatedAt(res.updated_at)
      })
      .catch(err => {
        if (isAbortError(err) || ctrl.signal.aborted) return
        setEntries([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })

    return ctrl
  }, [])

  useEffect(() => {
    const ctrl = load(period)
    return () => ctrl.abort()
  }, [period, load])

  // Топ-3 или меньше — пьедестал отображается при любом количестве игроков ≥ 1
  const top3     = entries.slice(0, 3)
  const selfRank = entries.find(e => e.user_id === currentUserId)

  const formattedAt = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className={s.page}>
      {/* header */}
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

      {/* period switcher */}
      <div className={s.periodSwitcher}>
        {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map(p => (
          <button
            key={p}
            className={[s.periodBtn, period === p ? s.periodBtnActive : ''].join(' ')}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* podium: показывается при любом количестве игроков >= 1 */}
      {!loading && top3.length >= 1 && (
        <div className={s.podiumSection}>
          {top3.map(e => (
            <PodiumCard
              key={e.user_id}
              entry={e}
              isSelf={e.user_id === currentUserId}
              total={top3.length}
            />
          ))}
        </div>
      )}

      {/* table */}
      <div className={s.tableSection}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.thRank}>#</th>
              <th>Игрок</th>
              <th className={s.thLevel}>Ур.</th>
              <th className={s.thXP}>XP</th>
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
                  />
                ))
              : (
                <tr>
                  <td colSpan={4}>
                    <div className={s.empty}>
                      <div className={s.emptyIcon}>🏆</div>
                      <div className={s.emptyTitle}>Рейтинг пока пуст</div>
                      <div className={s.emptyHint}>
                        Первый выполненный квест поставит тебя на первое место!
                      </div>
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
