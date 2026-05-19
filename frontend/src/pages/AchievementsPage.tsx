import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { meApi, type PlayerProfile } from '../api/me'
import s from './AchievementsPage.module.css'

// ────── Типы ──────
interface Badge {
  code: string
  icon: string
  name: string
  description: string
  unlocked: boolean
  xp_reward?: number
}

// ────── Каталог бейджей (синхронизирован с бэкендом) ──────
const BADGE_CATALOG: Omit<Badge, 'unlocked'>[] = [
  { code: 'first_quest',  icon: '🎯', name: 'Первый квест',     description: 'Выполни свой первый квест',        xp_reward: 50  },
  { code: 'week_streak',  icon: '🔥', name: 'Неделя подряд',    description: '7 дней активности без перерыва',    xp_reward: 100 },
  { code: 'top10',        icon: '🏆', name: 'Топ-10',           description: 'Войди в топ-10 рейтинга',          xp_reward: 200 },
  { code: 'coins_1000',   icon: '🪙', name: '1000 монет',       description: 'Накопи 1000 монет',                xp_reward: 75  },
  { code: 'level_10',     icon: '⚡', name: 'Уровень 10',       description: 'Достигни 10-го уровня',            xp_reward: 300 },
  { code: 'quests_50',    icon: '📜', name: '50 квестов',       description: 'Выполни 50 квестов суммарно',       xp_reward: 500 },
  { code: 'streak_30',    icon: '🌟', name: 'Месяц подряд',     description: '30 дней активности без перерыва',   xp_reward: 400 },
  { code: 'quests_10',    icon: '🚀', name: '10 квестов',       description: 'Выполни 10 квестов суммарно',       xp_reward: 150 },
  { code: 'first_badge',  icon: '🎖️', name: 'Коллекционер',    description: 'Получи первый бейдж',              xp_reward: 25  },
  { code: 'top3',         icon: '👑', name: 'Пьедестал',        description: 'Войди в топ-3 рейтинга',           xp_reward: 500 },
  { code: 'coins_5000',   icon: '💰', name: '5000 монет',       description: 'Накопи 5000 монет',                xp_reward: 200 },
  { code: 'level_5',      icon: '🌱', name: 'Уровень 5',        description: 'Достигни 5-го уровня',             xp_reward: 100 },
]

// ────── helpers ──────
function calcXpPct(profile: PlayerProfile): number {
  if (typeof profile.xp_progress_percent === 'number') {
    return Math.min(100, Math.max(2, profile.xp_progress_percent))
  }
  const level = profile.level
  const start = Math.floor(100 * Math.pow(level - 1, 1.5))
  const end   = Math.floor(100 * Math.pow(level, 1.5))
  const range = end - start
  if (range <= 0) return 100
  return Math.min(100, Math.max(2, Math.round(((profile.total_xp - start) / range) * 100)))
}

// ────── BadgeCard ──────
function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div className={`${s.badgeCard} ${badge.unlocked ? s.badgeUnlocked : s.badgeLocked}`}>
      <div className={s.badgeIconWrap}>
        <span className={s.badgeIcon}>{badge.icon}</span>
        {!badge.unlocked && <span className={s.lockOverlay}>🔒</span>}
      </div>
      <div className={s.badgeInfo}>
        <p className={s.badgeName}>{badge.name}</p>
        <p className={s.badgeDesc}>{badge.description}</p>
        {badge.xp_reward != null && (
          <span className={s.badgeReward}>+{badge.xp_reward} XP</span>
        )}
      </div>
      {badge.unlocked && <div className={s.unlockedMark}>✓</div>}
    </div>
  )
}

// ────── ProgressBar ──────
function ProgressBar({ label, value, max, color = 'var(--accent)' }: {
  label: string; value: number; max: number; color?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={s.progressItem}>
      <div className={s.progressHeader}>
        <span className={s.progressLabel}>{label}</span>
        <span className={s.progressValue}>{value} / {max}</span>
      </div>
      <div className={s.progressTrack}>
        <div className={s.progressFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ────── StatItem ──────
function StatItem({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className={s.statItem}>
      <span className={s.statIcon}>{icon}</span>
      <div className={s.statBody}>
        <span className={s.statValue}>{value}</span>
        <span className={s.statLabel}>{label}</span>
      </div>
    </div>
  )
}

// ────── Page ──────
export function AchievementsPage() {
  const user = useAuthStore(st => st.user)

  const [profile, setProfile]   = useState<PlayerProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filter,  setFilter]    = useState<'all' | 'unlocked' | 'locked'>('all')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user?.id) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    meApi
      .getProfile(user.id)
      .then(p => { if (!ac.signal.aborted) setProfile(p) })
      .catch(() => {})
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })

    return () => ac.abort()
  }, [user?.id])

  const unlockedCount = profile?.badges_count ?? 0
  const totalCount    = BADGE_CATALOG.length
  const xpPct         = profile ? calcXpPct(profile) : 0

  // Первые unlockedCount бейджей считаем разблокированными
  const badges: Badge[] = BADGE_CATALOG.map((b, i) => ({
    ...b,
    unlocked: i < unlockedCount,
  }))

  const filtered = badges.filter(b => {
    if (filter === 'unlocked') return b.unlocked
    if (filter === 'locked')   return !b.unlocked
    return true
  })

  return (
    <div className={s.page}>

      {/* Header */}
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Достижения</h1>
          <p className={s.subtitle}>Собирай бейджи, прокачивай персонажа и покоряй рейтинг</p>
        </div>
        {!loading && profile && (
          <div className={s.headerBadge}>
            <span className={s.headerBadgeCount}>{unlockedCount}</span>
            <span className={s.headerBadgeLabel}>из {totalCount} открыто</span>
          </div>
        )}
      </header>

      {loading ? (
        <div className={s.skelGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`${s.badgeCard} ${s.skel}`} />
          ))}
        </div>
      ) : (
        <>
          {/* Общая статистика */}
          {profile && (
            <div className={s.statsRow}>
              <StatItem icon="🏅" label="Бейджей получено"   value={unlockedCount} />
              <StatItem icon="⚡" label="Уровень"            value={profile.level} />
              <StatItem icon="🔮" label="Всего XP"           value={profile.total_xp.toLocaleString()} />
              <StatItem icon="🎯" label="Квестов выполнено"  value={profile.quests_completed} />
              <StatItem icon="🔥" label="Стрик (дней)"       value={profile.streak_days ?? 0} />
              <StatItem icon="🪙" label="Монеты"             value={profile.total_coins.toLocaleString()} />
            </div>
          )}

          {/* Прогресс-бары */}
          {profile && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Прогресс</h2>
              <div className={s.progressList}>
                <ProgressBar
                  label="До следующего уровня"
                  value={profile.total_xp}
                  max={profile.total_xp + profile.xp_to_next_level}
                  color="var(--accent)"
                />
                <ProgressBar
                  label="Бейджи"
                  value={unlockedCount}
                  max={totalCount}
                  color="#f59e0b"
                />
                <ProgressBar
                  label="Квесты выполнено"
                  value={profile.quests_completed}
                  max={Math.max(50, profile.quests_completed)}
                  color="#10b981"
                />
                <ProgressBar
                  label="Стрик (цель: 30 дней)"
                  value={profile.streak_days ?? 0}
                  max={30}
                  color="#ef4444"
                />
              </div>
            </section>
          )}

          {/* XP-бар уровня */}
          {profile && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Уровень {profile.level} → {profile.level + 1}</h2>
              <div className={s.xpBarWrap}>
                <div
                  className={s.xpBar}
                  role="progressbar"
                  aria-valuenow={xpPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={s.xpBarFill} style={{ width: `${xpPct}%` }} />
                </div>
                <div className={s.xpBarLabels}>
                  <span>{profile.total_xp.toLocaleString()} XP</span>
                  <span className={s.xpPct}>{xpPct.toFixed(0)}%</span>
                  <span>ещё {profile.xp_to_next_level.toLocaleString()} XP</span>
                </div>
              </div>
            </section>
          )}

          {/* Фильтр */}
          <div className={s.filterRow}>
            {(['all', 'unlocked', 'locked'] as const).map(f => (
              <button
                key={f}
                className={`${s.filterBtn} ${filter === f ? s.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all'      && `Все (${totalCount})`}
                {f === 'unlocked' && `Получены (${unlockedCount})`}
                {f === 'locked'   && `Заблокированы (${totalCount - unlockedCount})`}
              </button>
            ))}
          </div>

          {/* Сетка бейджей */}
          <section className={s.section}>
            <h2 className={s.sectionTitle}>Бейджи</h2>
            {filtered.length === 0 ? (
              <div className={s.empty}>
                <span className={s.emptyIcon}>🎖️</span>
                <p>Нет бейджей в этой категории</p>
              </div>
            ) : (
              <div className={s.badgesGrid}>
                {filtered.map(b => <BadgeCard key={b.code} badge={b} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
