import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { meApi, type PlayerProfile } from '../api/me'
import { questsApi, type UserQuest } from '../api/quests'
import s from './OverviewPage.module.css'

// ──────────────── helpers ────────────────

function levelThreshold(level: number): number {
  return Math.floor(100 * Math.pow(level - 1, 1.5))
}

function calcXpBar(totalXp: number, level: number, xpToNext: number, percent: number | null) {
  if (percent !== null) return Math.min(100, Math.max(2, percent))
  const start = levelThreshold(level)
  const end   = start + xpToNext
  const range = end - start
  if (range <= 0) return 100
  return Math.min(100, Math.max(2, Math.round(((totalXp - start) / range) * 100)))
}

// ──────────────── StatCard ────────────────

function StatCard({
  icon, label, value, sub, accent = false,
}: {
  icon: string
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`${s.statCard} ${accent ? s.statCardAccent : ''}`}>
      <div className={s.statIcon}>{icon}</div>
      <div className={s.statBody}>
        <span className={s.statLabel}>{label}</span>
        <span className={s.statValue}>{value}</span>
        {sub && <span className={s.statSub}>{sub}</span>}
      </div>
    </div>
  )
}

// ──────────────── XPBar ────────────────

function XPBar({ profile }: { profile: PlayerProfile }) {
  const percent = calcXpBar(
    profile.total_xp,
    profile.level,
    profile.xp_to_next_level,
    profile.xp_progress_percent,
  )
  const nextLvl = profile.level + 1

  return (
    <div className={s.xpSection}>
      <div className={s.xpHeader}>
        <span className={s.xpTitle}>Прогресс до уровня {nextLvl}</span>
        <span className={s.xpPct}>{percent.toFixed(0)}%</span>
      </div>
      <div className={s.xpTrack} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={s.xpFill} style={{ width: `${percent}%` }} />
      </div>
      <div className={s.xpFooter}>
        <span>{profile.total_xp.toLocaleString()} XP</span>
        <span>ещё {profile.xp_to_next_level.toLocaleString()} XP</span>
      </div>
    </div>
  )
}

// ──────────────── QuestCard ────────────────

const DIFF_LABEL: Record<string, string> = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' }
const DIFF_CLASS: Record<string, string> = {
  easy:   s.diffEasy,
  medium: s.diffMedium,
  hard:   s.diffHard,
}

function QuestCard({ q }: { q: UserQuest }) {
  const pct = Math.min(100, Math.max(0, q.progress_percent ?? 0))

  return (
    <div className={s.questCard}>
      <div className={s.questTop}>
        <span className={s.questName}>{q.quest_title}</span>
        <span className={`${s.diffBadge} ${DIFF_CLASS[q.difficulty] ?? ''}`}>
          {DIFF_LABEL[q.difficulty] ?? q.difficulty}
        </span>
      </div>

      <div className={s.questBar}>
        <div className={s.questBarFill} style={{ width: `${pct}%` }} />
      </div>

      <div className={s.questBottom}>
        <span className={s.questProg}>{q.progress}/{q.target}</span>
        <span className={s.questReward}>+{q.xp_reward} XP</span>
        {q.deadline_at && (
          <span className={s.questDeadline}>
            до {new Date(q.deadline_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ──────────────── Skeleton ────────────────

function StatSkeleton() {
  return (
    <div className={s.statsRow}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`${s.statCard} ${s.skel}`} style={{ minHeight: 88 }} />
      ))}
    </div>
  )
}

// ──────────────── Page ────────────────

export function OverviewPage() {
  const user = useAuthStore(st => st.user)

  const [profile,        setProfile]        = useState<PlayerProfile | null>(null)
  const [myQuests,       setMyQuests]        = useState<UserQuest[]>([])
  const [profileLoading, setProfileLoading]  = useState(true)
  const [questsLoading,  setQuestsLoading]   = useState(true)
  const [questsErr,      setQuestsErr]       = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    // ── профиль ──
    setProfileLoading(true)
    meApi.getProfile(user.id)
      .then(p  => { if (!cancelled) setProfile(p) })
      .catch(() => {/* показываем fallback из authStore */})
      .finally(() => { if (!cancelled) setProfileLoading(false) })

    // ── квесты ──
    setQuestsLoading(true)
    questsApi.getMy()
      .then((raw: unknown) => {
        if (cancelled) return
        // Бэкенд может вернуть как массив, так и { items: [...] }
        const list: UserQuest[] =
          Array.isArray(raw)
            ? (raw as UserQuest[])
            : Array.isArray((raw as { items?: UserQuest[] }).items)
              ? (raw as { items: UserQuest[] }).items
              : []
        setMyQuests(list.filter(q => q.status === 'in_progress').slice(0, 4))
        setQuestsErr(false)
      })
      .catch(() => { if (!cancelled) setQuestsErr(true) })
      .finally(() => { if (!cancelled) setQuestsLoading(false) })

    return () => { cancelled = true }
  }, [user?.id])

  const displayName = profile?.full_name ?? user?.username ?? '—'
  const level       = profile?.level ?? user?.level ?? 1
  const rank        = profile?.rank_all_time ?? null

  return (
    <div className={s.page}>

      {/* ── Приветствие ── */}
      <header className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.avatar}>
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className={s.greeting}>Привет, {displayName} 👋</h1>
            <p className={s.greetingSub}>
              Уровень {level}
              {rank && <> · <span className={s.rankBadge}>#{rank} в рейтинге</span></>}
            </p>
          </div>
        </div>
      </header>

      {/* ── Статистика ── */}
      {profileLoading ? (
        <StatSkeleton />
      ) : profile ? (
        <div className={s.statsRow}>
          <StatCard icon="⚡" label="Уровень" value={profile.level} sub={`${profile.quests_completed} квестов`} accent />
          <StatCard icon="🔮" label="Всего XP" value={profile.total_xp.toLocaleString()} sub={`${profile.quests_in_progress} в процессе`} />
          <StatCard icon="🪙" label="Монеты" value={profile.total_coins.toLocaleString()} sub="на балансе" />
          <StatCard
            icon="🏅"
            label="Бейджи"
            value={profile.badges_count}
            sub={rank ? `#${rank} в рейтинге` : 'нет позиции'}
          />
        </div>
      ) : (
        <div className={s.statsRow}>
          <StatCard icon="⚡" label="Уровень" value={user?.level ?? 1} sub="игрока" accent />
          <StatCard icon="🔮" label="Всего XP" value={(user?.xp ?? 0).toLocaleString()} />
          <StatCard icon="🪙" label="Монеты" value={(user?.coins ?? 0).toLocaleString()} sub="на балансе" />
          <StatCard icon="🏅" label="Бейджи" value="—" sub="нет данных" />
        </div>
      )}

      {/* ── XP Bar ── */}
      {profile && !profileLoading && (
        <XPBar profile={profile} />
      )}

      {/* ── Активные квесты ── */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>Активные квесты</h2>
          <Link to="/quests" className={s.sectionLink}>Все квесты →</Link>
        </div>

        {questsLoading ? (
          <div className={s.questsGrid}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`${s.questCard} ${s.skel}`} style={{ minHeight: 100 }} />
            ))}
          </div>
        ) : questsErr ? (
          <div className={s.inlineHint}>
            ⚠️ Не удалось загрузить квесты —{' '}
            <button className={s.retryBtn} onClick={() => window.location.reload()}>повторить</button>
          </div>
        ) : myQuests.length > 0 ? (
          <div className={s.questsGrid}>
            {myQuests.map(q => <QuestCard key={q.id} q={q} />)}
          </div>
        ) : (
          <div className={s.emptyQuests}>
            <span className={s.emptyIcon}>🎯</span>
            <div>
              <p className={s.emptyTitle}>Нет активных квестов</p>
              <p className={s.emptyHint}>Прими первый вызов — и начнётся игра!</p>
            </div>
            <Link to="/quests" className={s.emptyBtn}>Найти квесты</Link>
          </div>
        )}
      </section>
    </div>
  )
}
