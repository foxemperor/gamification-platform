import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { meApi, type PlayerProfile } from '../api/me'
import { questsApi, type UserQuest } from '../api/quests'
import { leaderboardApi, type LeaderboardEntry } from '../api/leaderboard'
import s from './OverviewPage.module.css'

// ──────────────── helpers ────────────────

function levelThreshold(level: number): number {
  return Math.floor(100 * Math.pow(level - 1, 1.5))
}

function calcXpBar(
  totalXp: number,
  level: number,
  xpToNext: number,
  percent: number | null,
): number {
  if (percent !== null) return Math.min(100, Math.max(2, percent))
  const start = levelThreshold(level)
  const end = start + xpToNext
  const range = end - start
  if (range <= 0) return 100
  return Math.min(100, Math.max(2, Math.round(((totalXp - start) / range) * 100)))
}

// ──────────────── CharacterCard ────────────────

function CharacterCard({ profile, displayName }: { profile: PlayerProfile; displayName: string }) {
  const xpPct = calcXpBar(
    profile.total_xp,
    profile.level,
    profile.xp_to_next_level,
    profile.xp_progress_percent ?? null,
  )

  const stats = [
    { label: 'Квесты',     value: profile.quests_completed },
    { label: 'Монеты',     value: profile.total_coins.toLocaleString() },
    { label: 'Бейджи',     value: profile.badges_count },
    { label: 'В процессе', value: profile.quests_in_progress },
    { label: 'Стрик',      value: `${profile.streak_days ?? 0} д.` },
  ] as const

  const initials = displayName.trim().slice(0, 2).toUpperCase() || '??'

  return (
    <div className={s.characterCard}>
      {/* banner */}
      <div className={s.charBanner}>
        <span className={s.charLevelBadge}>LVL {profile.level}</span>
        {profile.rank_all_time != null && (
          <span className={s.charRankBadge}>#{profile.rank_all_time}</span>
        )}
      </div>

      {/* avatar */}
      <div className={s.charAvatarWrap}>
        <div className={s.charAvatar}>{initials}</div>
      </div>

      {/* name */}
      <p className={s.charName}>{displayName}</p>
      {profile.position && <p className={s.charPosition}>{profile.position}</p>}

      {/* XP bar */}
      <div className={s.charXpWrap}>
        <div className={s.charXpLabels}>
          <span>{profile.total_xp.toLocaleString()} XP</span>
          <span>LVL {profile.level + 1}</span>
        </div>
        <div className={s.charXpTrack}>
          <div className={s.charXpFill} style={{ width: `${xpPct}%` }} />
        </div>
        <p className={s.charXpHint}>ещё {profile.xp_to_next_level.toLocaleString()} XP до следующего уровня</p>
      </div>

      {/* stats grid */}
      <div className={s.charStats}>
        {stats.map(st => (
          <div key={st.label} className={s.charStat}>
            <span className={s.charStatVal}>{st.value}</span>
            <span className={s.charStatLabel}>{st.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────── StatCard ────────────────

function StatCard({
  icon, label, value, sub, accent = false,
}: {
  icon: string; label: string; value: string | number; sub?: string; accent?: boolean
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

// ──────────────── XPBar (standalone) ────────────────

function XPBar({ profile }: { profile: PlayerProfile }) {
  const percent = calcXpBar(
    profile.total_xp,
    profile.level,
    profile.xp_to_next_level,
    profile.xp_progress_percent ?? null,
  )
  return (
    <div className={s.xpSection}>
      <div className={s.xpHeader}>
        <span className={s.xpTitle}>Прогресс до уровня {profile.level + 1}</span>
        <span className={s.xpPct}>{percent.toFixed(0)}%</span>
      </div>
      <div
        className={s.xpTrack}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
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

// ──────────────── StreakCard ────────────────

function StreakCard({ days }: { days: number }) {
  const active = Math.min(days, 7)
  return (
    <div className={s.streakCard}>
      <div className={s.streakHeader}>
        <span className={s.streakFire}>🔥</span>
        <div>
          <p className={s.streakDays}>{days} <span className={s.streakUnit}>дней</span></p>
          <p className={s.streakLabel}>Стрик активности</p>
        </div>
      </div>
      <div className={s.streakDots}>
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={`${s.streakDot} ${i < active ? s.streakDotActive : ''}`}
            title={`День ${i + 1}`}
          />
        ))}
      </div>
      <p className={s.streakHint}>
        {days >= 7
          ? '🏆 7 дней подряд — отлично!'
          : `Ещё ${7 - days} ${7 - days === 1 ? 'день' : 'дня'} до недельного рекорда`}
      </p>
    </div>
  )
}

// ──────────────── MiniLeaderboard ────────────────

const MEDALS = ['🥇', '🥈', '🥉']

function MiniLeaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[]
  currentUserId?: string
}) {
  return (
    <div className={s.miniLb}>
      {entries.map((e, i) => {
        const isMe = e.user_id === currentUserId
        const name = e.full_name ?? e.username
        return (
          <div key={e.user_id} className={`${s.miniLbRow} ${isMe ? s.miniLbRowMe : ''}`}>
            <span className={s.miniLbRank}>{MEDALS[i] ?? `#${e.rank}`}</span>
            <div className={s.miniLbAvatar}>{name.slice(0, 2).toUpperCase()}</div>
            <span className={s.miniLbName}>
              {name}
              {isMe && <span className={s.miniLbYou}> (ты)</span>}
            </span>
            <span className={s.miniLbXp}>{e.total_xp.toLocaleString()} XP</span>
            <span className={s.miniLbLvl}>LVL {e.level}</span>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────── BadgesGrid ────────────────

const BADGE_ICONS: Record<string, string> = {
  first_quest: '🎯',
  week_streak: '🔥',
  top10:       '🏆',
  coins_1000:  '🪙',
  level_10:    '⚡',
  quests_50:   '📜',
}
const BADGE_NAMES: Record<string, string> = {
  first_quest: 'Первый квест',
  week_streak: 'Неделя подряд',
  top10:       'Топ-10',
  coins_1000:  '1000 монет',
  level_10:    'Уровень 10',
  quests_50:   '50 квестов',
}

function BadgesGrid({ count }: { count: number }) {
  const codes = Object.keys(BADGE_ICONS)
  return (
    <div className={s.badgesGrid}>
      {codes.map((code, i) => {
        const unlocked = i < count
        return (
          <div
            key={code}
            className={`${s.badgeItem} ${unlocked ? '' : s.badgeLocked}`}
            title={BADGE_NAMES[code]}
          >
            <span className={s.badgeIcon}>{BADGE_ICONS[code]}</span>
            <span className={s.badgeName}>{BADGE_NAMES[code]}</span>
            {!unlocked && <span className={s.badgeLockIcon}>🔒</span>}
          </div>
        )
      })}
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
  const [lbEntries,      setLbEntries]       = useState<LeaderboardEntry[]>([])
  const [profileLoading, setProfileLoading]  = useState(true)
  const [questsLoading,  setQuestsLoading]   = useState(true)
  const [questsErr,      setQuestsErr]       = useState(false)
  const [lbLoading,      setLbLoading]       = useState(true)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user?.id) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const sig = ac.signal

    // профиль
    setProfileLoading(true)
    meApi.getProfile(user.id)
      .then(p  => { if (!sig.aborted) setProfile(p) })
      .catch(() => {})
      .finally(() => { if (!sig.aborted) setProfileLoading(false) })

    // квесты
    setQuestsLoading(true)
    questsApi.getMy()
      .then((raw: unknown) => {
        if (sig.aborted) return
        const list: UserQuest[] =
          Array.isArray(raw)
            ? (raw as UserQuest[])
            : Array.isArray((raw as { items?: UserQuest[] }).items)
              ? (raw as { items: UserQuest[] }).items
              : []
        setMyQuests(list.filter(q => q.status === 'in_progress').slice(0, 4))
        setQuestsErr(false)
      })
      .catch(() => { if (!sig.aborted) setQuestsErr(true) })
      .finally(() => { if (!sig.aborted) setQuestsLoading(false) })

    // лидерборд (топ-5)
    setLbLoading(true)
    leaderboardApi.getXP('all_time', 5, sig)
      .then(res => { if (!sig.aborted) setLbEntries(res.entries) })
      .catch(() => {})
      .finally(() => { if (!sig.aborted) setLbLoading(false) })

    return () => ac.abort()
  }, [user?.id])

  const displayName = profile?.full_name ?? profile?.username ?? user?.username ?? '—'
  const level       = profile?.level ?? user?.level ?? 1
  const rank        = profile?.rank_all_time ?? null
  const streakDays  = profile?.streak_days ?? 0

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
              {rank != null && <> · <span className={s.rankBadge}>#{rank} в рейтинге</span></>}
            </p>
          </div>
        </div>
      </header>

      {/* ── Главная сетка: CharacterCard + правая колонка ── */}
      <div className={s.mainGrid}>

        {/* CharacterCard */}
        {profileLoading ? (
          <div className={`${s.characterCard} ${s.skel}`} style={{ minHeight: 380 }} />
        ) : profile != null ? (
          <CharacterCard profile={profile} displayName={displayName} />
        ) : (
          /* fallback — если профиль не загрузился, показываем заглушку */
          <div className={s.characterCard}>
            <div className={s.charBanner} />
            <div className={s.charAvatarWrap}>
              <div className={s.charAvatar}>{displayName.slice(0, 2).toUpperCase()}</div>
            </div>
            <p className={s.charName}>{displayName}</p>
            <div className={s.charXpWrap}>
              <div className={s.charXpTrack}>
                <div className={s.charXpFill} style={{ width: '0%' }} />
              </div>
            </div>
            <div className={s.charStats}>
              {(['Квесты','Монеты','Бейджи','В процессе','Стрик'] as const).map(l => (
                <div key={l} className={s.charStat}>
                  <span className={s.charStatVal}>—</span>
                  <span className={s.charStatLabel}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* правая колонка */}
        <div className={s.rightCol}>

          {/* Статистика */}
          {profileLoading ? (
            <StatSkeleton />
          ) : profile != null ? (
            <div className={s.statsRow}>
              <StatCard icon="⚡" label="Уровень"  value={profile.level}                         sub={`${profile.quests_completed} квестов`} accent />
              <StatCard icon="🔮" label="Всего XP" value={profile.total_xp.toLocaleString()}    sub={`${profile.quests_in_progress} в процессе`} />
              <StatCard icon="🪙" label="Монеты"   value={profile.total_coins.toLocaleString()}  sub="на балансе" />
              <StatCard icon="🏅" label="Бейджи"   value={profile.badges_count}                  sub={rank != null ? `#${rank} в рейтинге` : 'нет позиции'} />
            </div>
          ) : (
            <div className={s.statsRow}>
              <StatCard icon="⚡" label="Уровень"  value={user?.level ?? 1}              sub="игрока" accent />
              <StatCard icon="🔮" label="Всего XP" value={(user?.xp ?? 0).toLocaleString()} />
              <StatCard icon="🪙" label="Монеты"   value={(user?.coins ?? 0).toLocaleString()} sub="на балансе" />
              <StatCard icon="🏅" label="Бейджи"   value="—" sub="нет данных" />
            </div>
          )}

          {/* XP Bar */}
          {profile != null && !profileLoading && <XPBar profile={profile} />}

          {/* Активные квесты */}
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

          {/* Стрик + Мини-лидерборд */}
          <div className={s.bottomGrid}>
            {!profileLoading && (
              <section className={s.section}>
                <div className={s.sectionHead}>
                  <h2 className={s.sectionTitle}>Стрик</h2>
                </div>
                <StreakCard days={streakDays} />
              </section>
            )}

            <section className={s.section}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>Топ игроков</h2>
                <Link to="/leaderboard" className={s.sectionLink}>Весь рейтинг →</Link>
              </div>
              {lbLoading ? (
                <div className={s.miniLb}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`${s.miniLbRow} ${s.skel}`} style={{ height: 44 }} />
                  ))}
                </div>
              ) : lbEntries.length > 0 ? (
                <MiniLeaderboard entries={lbEntries} currentUserId={user?.id} />
              ) : (
                <div className={s.inlineHint}>Рейтинг пока недоступен</div>
              )}
            </section>
          </div>

          {/* Достижения */}
          {profile != null && !profileLoading && (
            <section className={s.section}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>Достижения</h2>
              </div>
              <BadgesGrid count={profile.badges_count} />
            </section>
          )}

        </div>{/* /rightCol */}
      </div>{/* /mainGrid */}

    </div>
  )
}
