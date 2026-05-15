import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { meApi, type PlayerProfile } from '../api/me'
import { questsApi, type UserQuest } from '../api/quests'
import s from './OverviewPage.module.css'

// ──────────────── вспомогательные компоненты ────────────────

function StatCard({ label, value, sub, accent = false }: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`${s.statCard} ${accent ? s.statCardAccent : ''}`}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{value}</span>
      {sub && <span className={s.statSub}>{sub}</span>}
    </div>
  )
}

function XPBar({ percent, current, toNext }: {
  percent: number
  current: number
  toNext: number
}) {
  return (
    <div className={s.xpBarWrapper}>
      <div className={s.xpBarLabels}>
        <span>{current.toLocaleString()} XP</span>
        <span>{toNext.toLocaleString()} XP до след. уровня</span>
      </div>
      <div
        className={s.xpBarTrack}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={s.xpBarFill} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className={s.xpBarPercent}>{percent.toFixed(1)}%</div>
    </div>
  )
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
}

const DIFFICULTY_CLASS: Record<string, string> = {
  easy: s.diffEasy,
  medium: s.diffMedium,
  hard: s.diffHard,
}

function QuestCard({ quest }: { quest: UserQuest }) {
  return (
    <div className={s.questCard}>
      <div className={s.questCardHeader}>
        <span className={s.questTitle}>{quest.quest_title}</span>
        <span className={`${s.diffBadge} ${DIFFICULTY_CLASS[quest.difficulty] ?? ''}`}>
          {DIFFICULTY_LABEL[quest.difficulty] ?? quest.difficulty}
        </span>
      </div>
      <div className={s.questProgress}>
        <div className={s.questProgressTrack}>
          <div
            className={s.questProgressFill}
            style={{ width: `${Math.min(quest.progress_percent, 100)}%` }}
          />
        </div>
        <span className={s.questProgressLabel}>
          {quest.progress}/{quest.target} · {quest.progress_percent.toFixed(0)}%
        </span>
      </div>
      <div className={s.questRewards}>
        <span className={s.rewardXp}>+{quest.xp_reward} XP</span>
        <span className={s.rewardCoins}>+{quest.coins_reward} 🪙</span>
        {quest.deadline_at && (
          <span className={s.deadline}>
            до {new Date(quest.deadline_at).toLocaleDateString('ru-RU')}
          </span>
        )}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return <div className={`${s.statCard} ${s.skeleton}`} style={{ height: 96 }} />
}

// ──────────────── основная страница ────────────────

export function OverviewPage() {
  const user = useAuthStore(st => st.user)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [myQuests, setMyQuests] = useState<UserQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    setLoading(true)
    Promise.all([
      meApi.getProfile(user.id),
      questsApi.getMy(),
    ])
      .then(([prof, quests]) => {
        setProfile(prof)
        setMyQuests(quests.filter(q => q.status === 'in_progress').slice(0, 4))
      })
      .catch(() => setError('Не удалось загрузить данные. Проверьте соединение.'))
      .finally(() => setLoading(false))
  }, [user?.id])

  const displayName = profile?.full_name ?? user?.username ?? '—'
  const level = profile?.level ?? user?.level ?? 1

  return (
    <div className={s.page}>
      {/* Приветствие */}
      <header className={s.pageHeader}>
        <div>
          <h1 className={s.greeting}>Привет, {displayName} 👋</h1>
          <p className={s.greetingSub}>Уровень {level} · Продолжай в том же духе!</p>
        </div>
      </header>

      {/* Статистика */}
      <section className={s.statsGrid}>
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : profile ? (
          <>
            <StatCard label="Уровень" value={profile.level} sub="игрока" accent />
            <StatCard
              label="Всего XP"
              value={profile.total_xp.toLocaleString()}
              sub={`${profile.quests_completed} квестов выполнено`}
            />
            <StatCard
              label="Монеты"
              value={profile.total_coins.toLocaleString()}
              sub="🪙 на балансе"
            />
            <StatCard
              label="Бейджи"
              value={profile.badges_count}
              sub={
                profile.rank_weekly
                  ? `#${profile.rank_weekly} в недельном рейтинге`
                  : 'Нет позиции в рейтинге'
              }
            />
          </>
        ) : null}
      </section>

      {/* XP-прогресс */}
      {profile && !loading && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Прогресс до уровня {profile.level + 1}</h2>
          <XPBar
            percent={profile.xp_progress_percent}
            current={profile.total_xp}
            toNext={profile.xp_to_next_level}
          />
        </section>
      )}

      {/* Активные квесты */}
      <section className={s.section}>
        <div className={s.sectionRow}>
          <h2 className={s.sectionTitle}>Активные квесты</h2>
          <a href="/quests" className={s.sectionLink}>Все квесты →</a>
        </div>

        {error && <p className={s.errorMsg}>{error}</p>}

        {loading ? (
          <div className={s.questsGrid}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`${s.questCard} ${s.skeleton}`} style={{ height: 110 }} />
            ))}
          </div>
        ) : myQuests.length > 0 ? (
          <div className={s.questsGrid}>
            {myQuests.map(q => <QuestCard key={q.id} quest={q} />)}
          </div>
        ) : (
          <div className={s.emptyState}>
            <span className={s.emptyIcon}>🎯</span>
            <p className={s.emptyTitle}>Нет активных квестов</p>
            <p className={s.emptyHint}>Перейди на страницу квестов и прими первый вызов!</p>
            <a href="/quests" className={s.emptyAction}>Найти квесты</a>
          </div>
        )}
      </section>
    </div>
  )
}
