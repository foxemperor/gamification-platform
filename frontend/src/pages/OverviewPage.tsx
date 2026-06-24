import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'
import { meApi, type PlayerProfile, type Character } from '../api/me'
import { questsApi, type UserQuest } from '../api/quests'
import { leaderboardApi, type LeaderboardEntry } from '../api/leaderboard'
import { CharacterRenderer, type EquipSlot } from '../components/CharacterRenderer'
import {
  badgesApi, type Badge,
  describeBadgeCondition, badgeIcon, RARITY_RING,
} from '../api/badges'
import { useAppToast } from '../App'
import s from './OverviewPage.module.css'

// ────── helpers ──────
function calcXpPct(profile: PlayerProfile): number {
  if (typeof profile.xp_progress_percent === 'number') {
    return Math.min(100, Math.max(2, profile.xp_progress_percent))
  }
  const level = profile.level
  const start = Math.floor(100 * Math.pow(level - 1, 1.5))
  const end   = Math.floor(100 * Math.pow(level,     1.5))
  const range = end - start
  if (range <= 0) return 100
  return Math.min(100, Math.max(2, Math.round(((profile.total_xp - start) / range) * 100)))
}

function nonEmpty(v: string | null | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined
}

function resolveDisplayName(
  profile: PlayerProfile | null,
  user: { username?: string; email?: string } | null,
): string {
  return (
    nonEmpty(profile?.full_name) ??
    nonEmpty(profile?.username) ??
    nonEmpty(user?.username) ??
    nonEmpty(user?.email?.split('@')[0]) ??
    '—'
  )
}

function resolveInitials(displayName: string, email?: string | null): string {
  if (displayName && displayName !== '—') {
    return displayName.trim().slice(0, 2).toUpperCase()
  }
  return (email?.slice(0, 2) ?? '??').toUpperCase()
}

function formatBirthday(iso: string): { text: string; isToday: boolean } {
  const date = new Date(iso)
  const now = new Date()
  const isToday =
    date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  const text = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return { text, isToday }
}

// ────── CharacterCard ──────
const ARCHETYPE_LABEL: Record<string, string> = {
  warrior: '⚔️ Воин', mage: '🔮 Маг', rogue: '🗡️ Разбойник', engineer: '🛠️ Инженер',
}

const SLOT_ICON: Record<string, string> = {
  hair: '💇', head: '🎩', head_accessory: '👓', eyes: '👁️',
  face_expression: '😀', torso: '👕', torso_accessory: '🎀',
  legs: '👖', weapon_main: '🗡️', weapon_secondary: '🛡️',
}

const EQUIP_SLOTS = [
  'hair', 'head', 'head_accessory', 'eyes',
  'torso', 'torso_accessory', 'weapon_main', 'weapon_secondary',
]

function CharacterCard({ character }: { character: Character | null }) {
  const equippedBySlot = new Map<string, Character['equipment'][number]>()
  for (const eq of character?.equipment ?? []) equippedBySlot.set(eq.slot, eq)
  const hasEquipment = (character?.equipment?.length ?? 0) > 0

  const rendererEquipment: EquipSlot[] = (character?.equipment ?? []).map(eq => ({
    slot: eq.slot,
    name: eq.cosmetic_item.name,
    rarity: (eq.cosmetic_item.rarity as EquipSlot['rarity']) ?? 'common',
  }))

  return (
    <div className={`${s.characterCard} ${s.charCardPad}`}>
      {character ? (
        <>
          <div className={s.charHeaderRow}>
            <span className={s.charArchetype}>
              {ARCHETYPE_LABEL[character.character_type.slug] ?? character.character_type.name}
            </span>
            <span className={s.charLevelBadge}>LVL {character.level}</span>
          </div>

          <div className={s.charSprite}>
            <CharacterRenderer
              className={s.charSpriteBody}
              slug={character.character_type.slug}
              skinColor={character.skin_color}
              hairColor={character.hair_color}
              eyesColor={character.eyes_color}
              equipment={rendererEquipment}
              size={220}
            />
          </div>
          {character.character_type.bonus_description && (
            <p className={s.charBonus}>{character.character_type.bonus_description}</p>
          )}
          <div className={s.charMultipliers}>
            <div className={s.charMult}>
              <span className={s.charMultVal}>×{character.xp_multiplier.toFixed(2)}</span>
              <span className={s.charMultLabel}>XP бонус</span>
            </div>
            <div className={s.charMult}>
              <span className={s.charMultVal}>×{character.coin_multiplier.toFixed(2)}</span>
              <span className={s.charMultLabel}>Монеты</span>
            </div>
          </div>

          <div className={s.inventoryBlock}>
            <div className={s.inventoryHead}>
              <span className={s.inventoryTitle}>Активный инвентарь</span>
              <Link
                to="/inventory"
                className={s.inventoryBtn}
                title="Открыть инвентарь"
                aria-label="Открыть инвентарь"
              >
                🔧
              </Link>
            </div>
            {hasEquipment ? (
              <div className={s.equipGrid}>
                {EQUIP_SLOTS.map(slot => {
                  const eq = equippedBySlot.get(slot)
                  return (
                    <div
                      key={slot}
                      className={`${s.equipSlot} ${eq ? s.equipSlotFilled : ''}`}
                      title={eq ? eq.cosmetic_item.name : 'Слот пуст'}
                    >
                      <span className={s.equipIcon}>{SLOT_ICON[slot] ?? '▫️'}</span>
                      {eq && <span className={s.equipName}>{eq.cosmetic_item.name}</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={s.inventoryEmpty}>
                <span className={s.inventoryEmptyIcon}>🎒</span>
                <p className={s.inventoryEmptyText}>Инвентарь пуст</p>
                <Link to="/inventory" className={s.inventoryEmptyBtn}>
                  Выбрать предметы 🔧
                </Link>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={s.charCreateHint}>
          <p className={s.charCreateText}>
            🎭 У вас ещё нет персонажа. Создайте героя, чтобы получить бонусы к XP и монетам.
          </p>
          <Link to="/settings" className={s.charCreateBtn}>Создать персонажа</Link>
        </div>
      )}
    </div>
  )
}

// ────── FallbackCharacterCard ──────
function FallbackCharacterCard({
  user, displayName,
}: {
  user: { username?: string; email?: string; xp?: number; level?: number } | null
  displayName: string
}) {
  const initials = resolveInitials(displayName, user?.email)
  const labels = ['Квесты', 'Монеты', 'Бейджи', 'В процессе', 'Стрик']
  return (
    <div className={s.characterCard}>
      <div className={s.charBanner} />
      <div className={s.charAvatarWrap}>
        <div className={s.charAvatar}>{initials}</div>
      </div>
      <p className={s.charName}>{displayName !== '—' ? displayName : (user?.username ?? '—')}</p>
      <div className={s.charXpWrap}>
        <div className={s.charXpLabels}>
          <span>{(user?.xp ?? 0).toLocaleString()} XP</span>
          <span>LVL {(user?.level ?? 1) + 1}</span>
        </div>
        <div className={s.charXpTrack}>
          <div className={s.charXpFill} style={{ width: '2%' }} />
        </div>
        <p className={s.charXpHint}>данные недоступны</p>
      </div>
      <div className={s.charStats}>
        {labels.map(l => (
          <div key={l} className={s.charStat}>
            <span className={s.charStatVal}>—</span>
            <span className={s.charStatLabel}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────── StatCard ──────
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

// ────── XPBar ──────
function XPBar({ profile }: { profile: PlayerProfile }) {
  const percent = calcXpPct(profile)
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

// ────── QuestCard ──────
const DIFF_LABEL: Record<string, string> = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' }
const DIFF_CLASS: Record<string, string> = {
  easy:   s.diffEasy,
  medium: s.diffMedium,
  hard:   s.diffHard,
}

function QuestCard({ q }: { q: UserQuest }) {
  const questData  = q.quest
  const pct        = Math.min(100, Math.max(0, q.progress_percent ?? 0))
  const title      = questData?.title      ?? '—'
  const difficulty = questData?.difficulty ?? 'medium'
  const xpReward   = questData?.xp_reward  ?? 0
  return (
    <div className={s.questCard}>
      <div className={s.questTop}>
        <span className={s.questName}>{title}</span>
        <span className={`${s.diffBadge} ${DIFF_CLASS[difficulty] ?? ''}`}>
          {DIFF_LABEL[difficulty] ?? difficulty}
        </span>
      </div>
      <div className={s.questBar}>
        <div className={s.questBarFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={s.questBottom}>
        <span className={s.questProg}>{q.progress}/{q.target}</span>
        <span className={s.questReward}>+{xpReward} XP</span>
        {q.deadline_at && (
          <span className={s.questDeadline}>
            до {new Date(q.deadline_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ────── StreakCard ──────
function StreakCard({ days }: { days: number }) {
  const active = Math.min(days, 7)
  return (
    <div className={s.streakCard}>
      <div className={s.streakHeader}>
        <span className={s.streakFire}>🔥</span>
        <div>
          <p className={s.streakDays}>
            {days} <span className={s.streakUnit}>дней</span>
          </p>
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

// ────── MiniLeaderboard ──────
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
        const name = e.full_name || e.username
        return (
          <div key={e.user_id} className={`${s.miniLbRow} ${isMe ? s.miniLbRowMe : ''}`}>
            <span className={s.miniLbRank}>{MEDALS[i] ?? `#${e.rank}`}</span>
            <div className={s.miniLbAvatar} style={{ overflow: 'hidden' }}>
              {e.avatar_url
                ? <img src={e.avatar_url} alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : name.slice(0, 2).toUpperCase()}
            </div>
            <span className={s.miniLbName}>
              {name}{isMe && <span className={s.miniLbYou}> (ты)</span>}
            </span>
            <span className={s.miniLbXp}>{e.total_xp.toLocaleString()} XP</span>
            <span className={s.miniLbLvl}>LVL {e.level}</span>
          </div>
        )
      })}
    </div>
  )
}

// ────── BadgesGrid ──────
function BadgesGrid({ catalog, earnedIds }: { catalog: Badge[]; earnedIds: Set<string> }) {
  if (catalog.length === 0) {
    return <div className={s.inlineHint}>Каталог достижений пуст</div>
  }
  return (
    <div className={s.badgesGrid}>
      {catalog.map(b => {
        const earned = earnedIds.has(b.id)
        const ringColor = RARITY_RING[b.rarity] ?? RARITY_RING.common
        return (
          <div
            key={b.id}
            className={`${s.badgeItem} ${earned ? '' : s.badgeLocked}`}
            style={earned ? { outline: `2px solid ${ringColor}`, outlineOffset: '2px' } : undefined}
            title={`${b.name}\n${describeBadgeCondition(b)}`}
          >
            <span className={s.badgeIcon}>{badgeIcon(b)}</span>
            <span className={s.badgeName}>{b.name}</span>
            {!earned && <span className={s.badgeLockIcon}>🔒</span>}
          </div>
        )
      })}
    </div>
  )
}

// ────── BioCard — inline-редактирование ──────
function BioCard({ initialBio }: { initialBio: string }) {
  const updateUser = useAuthStore(st => st.updateUser)
  const toast = useAppToast()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(initialBio)
  const [bio, setBio]         = useState(initialBio)
  const [saving, setSaving]   = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Синх с внешними изменениями (напр.из Settings)
  useEffect(() => {
    setBio(initialBio)
    if (!editing) setDraft(initialBio)
  }, [initialBio])

  function startEdit() {
    setDraft(bio)
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setDraft(bio)
    setEditing(false)
  }

  async function saveBio() {
    setSaving(true)
    try {
      const updated = await authApi.updateMe({ bio: draft.trim() })
      const saved = (updated as any).bio ?? draft.trim()
      setBio(saved)
      updateUser({ bio: saved } as any)
      setEditing(false)
      toast('Био сохранено', 'success')
    } catch {
      toast('Не удалось сохранить', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.bioCard}>
      <div className={s.bioHeader}>
        <h2 className={s.sectionTitle}>📝 О себе</h2>
        {!editing && (
          <button className={s.bioEditBtn} onClick={startEdit} title="Редактировать">
            ✏️ Редактировать
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            className={s.bioTextarea}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="Расскажите немного о себе, своих интересах или навыках…"
          />
          <div className={s.bioActions}>
            <span className={s.bioCounter}>{draft.length}/300</span>
            <button className={s.bioCancelBtn} onClick={cancelEdit} disabled={saving}>Отмена</button>
            <button className={s.bioSaveBtn} onClick={saveBio} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </>
      ) : (
        <p className={s.bioText}>
          {bio.trim()
            ? bio
            : <span className={s.bioPlaceholder}>Нажмите «Редактировать», чтобы рассказать о себе…</span>}
        </p>
      )}
    </div>
  )
}

// ────── OverviewPage ──────
export function OverviewPage() {
  const { user } = useAuthStore()

  const [profile,    setProfile]    = useState<PlayerProfile | null>(null)
  const [quests,     setQuests]     = useState<UserQuest[]>([])
  const [lbEntries,  setLbEntries]  = useState<LeaderboardEntry[]>([])
  const [badgeCatalog, setBadgeCatalog] = useState<Badge[]>([])
  const [earnedIds,  setEarnedIds]  = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user?.id) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)

    Promise.all([
      meApi.getProfile(user.id),
      questsApi.getMy({ status: 'in_progress', limit: 6 }, ac.signal).catch(() => ({ items: [] as UserQuest[] })),
      leaderboardApi.getTop({ limit: 5 }).catch(() => []),
      badgesApi.getCatalog(ac.signal).catch(() => [] as Badge[]),
      badgesApi.getMy(ac.signal).catch(() => [] as Badge[]),
    ]).then(([prof, questsRes, lb, catalog, earned]) => {
      if (ac.signal.aborted) return
      setProfile(prof)
      setQuests(Array.isArray(questsRes) ? questsRes : (questsRes?.items ?? []))
      setLbEntries(Array.isArray(lb) ? lb : [])
      setBadgeCatalog(Array.isArray(catalog) ? catalog : [])
      setEarnedIds(new Set((Array.isArray(earned) ? earned : []).map((b: Badge) => b.id)))
    }).catch(err => {
      if (ac.signal.aborted) return
      setError(err?.message ?? 'Ошибка загрузки')
    }).finally(() => {
      if (!ac.signal.aborted) setLoading(false)
    })

    return () => ac.abort()
  }, [user?.id])

  const displayName = resolveDisplayName(profile, user)
  const initials    = resolveInitials(displayName, user?.email)
  const currentBio  = (profile as any)?.bio ?? (user as any)?.bio ?? ''

  const birthdayInfo = profile?.birthday ? formatBirthday(profile.birthday) : null

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.skel} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={s.page}>
        <p className={s.inlineHint}>
          ⚠️ {error}.{' '}
          <button className={s.retryBtn} onClick={() => window.location.reload()}>Повторить</button>
        </p>
      </div>
    )
  }

  return (
    <div className={s.page}>
      {/* ── Шапка ── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.avatar}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={displayName} className={s.charAvatarImg} />
              : initials
            }
          </div>
          <div>
            <p className={s.greeting}>
              {birthdayInfo?.isToday ? '🎂 С днём рождения, ' : 'Привет, '}{displayName}!
            </p>
            <div className={s.greetingSub}>
              {profile?.position && <span>{profile.position}</span>}
              {profile?.rank_all_time != null && (
                <span className={s.rankBadge}>#{profile.rank_all_time} в топе</span>
              )}
              {birthdayInfo && (
                <span className={s.birthdayChip}>
                  {birthdayInfo.isToday ? '🎂 Сегодня ДР!' : `🎂 ${birthdayInfo.text}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Основная сетка ── */}
      <div className={s.mainGrid}>
        {profile?.character
          ? <CharacterCard character={profile.character} />
          : <FallbackCharacterCard user={user} displayName={displayName} />
        }

        <div className={s.rightCol}>
          {profile && (
            <>
              <div className={s.statsRow}>
                <StatCard icon="⭐" label="Уровень" value={`LVL ${profile.level}`} accent />
                <StatCard icon="✨" label="Всего XP" value={profile.total_xp.toLocaleString()} />
                <StatCard icon="🪙" label="Монеты" value={profile.total_coins.toLocaleString()} />
                <StatCard icon="🏅" label="Бейджи" value={profile.badges_count} />
              </div>
              <XPBar profile={profile} />
            </>
          )}

          <div className={s.section}>
            <div className={s.sectionHead}>
              <h2 className={s.sectionTitle}>📋 Активные квесты</h2>
              <Link to="/quests" className={s.sectionLink}>Все квесты →</Link>
            </div>
            {quests.length > 0 ? (
              <div className={s.questsGrid}>
                {quests.map(q => <QuestCard key={q.id} q={q} />)}
              </div>
            ) : (
              <div className={s.emptyQuests}>
                <span className={s.emptyIcon}>📋</span>
                <div>
                  <p className={s.emptyTitle}>Нет активных квестов</p>
                  <p className={s.emptyHint}>Возьмите новый квест, чтобы зарабатывать XP</p>
                </div>
                <Link to="/quests" className={s.emptyBtn}>Найти квест</Link>
              </div>
            )}
          </div>

          <div className={s.bottomGrid}>
            <StreakCard days={profile?.streak_days ?? 0} />
            <div className={s.section}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>🏆 Топ игроков</h2>
                <Link to="/leaderboard" className={s.sectionLink}>Весь рейтинг →</Link>
              </div>
              {lbEntries.length > 0
                ? <MiniLeaderboard entries={lbEntries} currentUserId={user?.id} />
                : <div className={s.inlineHint}>Данные рейтинга недоступны</div>
              }
            </div>
          </div>

          {/* ── Достижения ── */}
          <div className={s.section}>
            <div className={s.sectionHead}>
              <h2 className={s.sectionTitle}>🎖️ Достижения</h2>
              <Link to="/achievements" className={s.sectionLink}>Все достижения →</Link>
            </div>
            <BadgesGrid catalog={badgeCatalog} earnedIds={earnedIds} />
          </div>

          {/* ── О себе — после Достижений ── */}
          <BioCard initialBio={currentBio} />
        </div>
      </div>
    </div>
  )
}
