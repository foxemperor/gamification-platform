import { useEffect, useState, useCallback, useRef } from 'react'
import { leaderboardApi, isAbortError, type LeaderboardEntry, type LeaderboardPeriod } from '../api/leaderboard'
import { useAuthStore } from '../store/authStore'
import s from './LeaderboardPage.module.css'

// ─────────────────── helpers ───────────────────

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  weekly:   'Неделя',
  monthly:  'Месяц',
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

function xpBarWidth(xp: number, maxXp: number): number {
  if (!maxXp) return 0
  return Math.max(4, Math.round((xp / maxXp) * 100))
}

// ─────────────────── podium (top-3) ───────────────────

const MEDAL = ['🥇', '🥈', '🥉']
const PODIUM_HEIGHT = ['h3', 'h1', 'h2'] // CSS modifier: tallest = gold

function PodiumCard({ entry, isSelf }: { entry: LeaderboardEntry; isSelf: boolean }) {
  const order = entry.rank === 1 ? 0 : entry.rank === 2 ? 1 : 2   // visual order: 2-1-3
  const visualOrder = entry.rank === 1 ? 'order2' : entry.rank === 2 ? 'order1' : 'order3'
  return (
    <div
      className={`${s.podiumCard} ${s[`podiumRank${entry.rank}`]} ${s[visualOrder]} ${isSelf ? s.podiumSelf : ''}`}
      aria-label={`${entry.rank} место — ${displayName(entry)}`}
    >
      <div className={s.podiumAvatar}>
        {initials(entry)}
      </div>
      <div className={s.podiumMedal}>{MEDAL[entry.rank - 1]}</div>
      <div className={s.podiumName}>{displayName(entry)}</div>
      <div className={s.podiumLevel}>Ур. {entry.level}</div>
      <div className={s.podiumXP}>{entry.total_xp.toLocaleString()} XP</div>
      <div className={`${s.podiumBase} ${s[PODIUM_HEIGHT[entry.rank - 1]]}`} />
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
  return (
    <tr className={`${s.row} ${isSelf ? s.rowSelf : ''}`}>
      <td className={s.tdRank}>
        {entry.rank <= 3
          ? <span className={s.medal}>{MEDAL[entry.rank - 1]}</span>
          : <span className={s.rankNum}>{entry.rank}</span>}
      </td>
      <td className={s.tdPlayer}>
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
            <div
              className={s.xpFill}
              style={{ width: `${xpBarWidth(entry.total_xp, maxXp)}%` }}
            />
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
          <td><div className={`${s.skel} ${s.skelSm}`} /></td>
          <td>
            <div className={s.playerCell}>
              <div className={`${s.skel} ${s.skelAvatar}`} />
              <div>
                <div className={`${s.skel} ${s.skelName}`} />
                <div className={`${s.skel} ${s.skelMeta}`} />
              </div>
            </div>
          </td>
          <td><div className={`${s.skel} ${s.skelSm}`} /></td>
          <td><div className={`${s.skel} ${s.skelBar}`} /></td>
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
        // при ошибке — просто пустой список, не ломаем страницу
        setEntries([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })

    return ctrl
  }, [])

  useEffect(() => {
    const ctrl = load(period)
    return () => ctrl.abort()
  }, [period, load])

  const top3    = entries.slice(0, 3)
  const rest    = entries.slice(3)
  const maxXp   = entries[0]?.total_xp ?? 1
  const selfRank = entries.find(e => e.user_id === currentUserId)

  const formattedAt = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className={s.page}>
      {/* header */}
      <header className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Рейтинг</h1>
          <p className={s.pageSub}>
            {selfRank
              ? `Ваша позиция: #${selfRank.rank} · ${selfRank.total_xp.toLocaleString()} XP`
              : 'Выполняй квесты, чтобы попасть в топ'}
          </p>
        </div>
        {formattedAt && (
          <span className={s.updatedAt}>обновлено в {formattedAt}</span>
        )}
      </header>

      {/* period switcher */}
      <div className={s.periodSwitcher} role="tablist" aria-label="Период рейтинга">
        {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map(p => (
          <button
            key={p}
            role="tab"
            aria-selected={period === p}
            className={`${s.periodBtn} ${period === p ? s.periodBtnActive : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* podium */}
      {!loading && top3.length >= 3 && (
        <section className={s.podiumSection} aria-label="Тройка лидеров">
          {top3.map(e => (
            <PodiumCard key={e.user_id} entry={e} isSelf={e.user_id === currentUserId} />
          ))}
        </section>
      )}

      {/* table */}
      <section className={s.tableSection}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.thRank}>#</th>
              <th className={s.thPlayer}>Игрок</th>
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
                      maxXp={maxXp}
                    />
                  ))
                : (
                  <tr>
                    <td colSpan={4}>
                      <div className={s.empty}>
                        <span className={s.emptyIcon}>🏆</span>
                        <p className={s.emptyTitle}>Рейтинг пока пуст</p>
                        <p className={s.emptyHint}>Первый выполненный квест поставит тебя на первое место!</p>
                      </div>
                    </td>
                  </tr>
                )
            }
          </tbody>
        </table>
      </section>
    </div>
  )
}
