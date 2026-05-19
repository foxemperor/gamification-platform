import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import { questsApi, isAbortError, classifyAcceptError } from '../api/quests'
import type { Quest, UserQuest, QuestType, QuestDifficulty } from '../api/quests'
import { useAppToast } from '../App'
import { SkillViewer } from '../components/SkillViewer'
import styles from './QuestsPage.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RewardData {
  xp_earned: number
  coins_earned: number
  level_up: boolean
  new_level: number | null
  badges_earned: string[]
  quest_title: string
}

type TabId = 'catalog' | 'my'

// ─── Countdown hook ───────────────────────────────────────────────────────────

interface CountdownResult {
  hours: number
  minutes: number
  seconds: number
  expired: boolean
  totalSeconds: number
}

export function useCountdown(deadline: string | null): CountdownResult {
  const calc = useCallback((): CountdownResult => {
    if (!deadline) return { hours: 0, minutes: 0, seconds: 0, expired: false, totalSeconds: -1 }
    const diff = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true, totalSeconds: 0 }
    return {
      hours: Math.floor(diff / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
      expired: false,
      totalSeconds: diff,
    }
  }, [deadline])

  const [state, setState] = useState<CountdownResult>(calc)

  useEffect(() => {
    if (!deadline) return
    setState(calc())
    const id = setInterval(() => setState(calc()), 1000)
    return () => clearInterval(id)
  }, [deadline, calc])

  return state
}

// ─── Helper: format countdown ─────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CountdownDisplay({ deadline }: { deadline: string | null }) {
  const { hours, minutes, seconds, expired, totalSeconds } = useCountdown(deadline)
  if (totalSeconds === -1) return null
  if (expired) return <span className={`${styles.countdown} ${styles.countdownExpired}`}>Время вышло</span>

  const urgency =
    totalSeconds < 3600
      ? styles.countdownRed
      : totalSeconds < 10800
      ? styles.countdownOrange
      : ''

  return (
    <span className={`${styles.countdown} ${urgency}`} title="Оставшееся время">
      ⏱ {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  )
}

// ─── Difficulty / type helpers ────────────────────────────────────────────────

const DIFF_LABELS: Record<QuestDifficulty, string> = {
  easy:   'Лёгкий',
  medium: 'Средний',
  hard:   'Сложный',
  epic:   'Эпический',
}
const TYPE_LABELS: Record<QuestType, string> = {
  personal:    'Личный',
  team:        'Командный',
  skill:       'Навык',
  daily:       'Ежедневный',
  integration: 'Интеграция',
}
const DIFF_CLASS: Record<QuestDifficulty, string> = {
  easy:   styles.diffEasy,
  medium: styles.diffMedium,
  hard:   styles.diffHard,
  epic:   styles.diffEpic,
}
const TYPE_CLASS: Record<QuestType, string> = {
  personal:    styles.typePersonal,
  team:        styles.typeTeam,
  skill:       styles.typeSkill,
  daily:       styles.typeDaily,
  integration: styles.typeIntegration,
}
const TYPE_ICON: Record<QuestType, string> = {
  personal:    '⚡',
  team:        '🤝',
  skill:       '📚',
  daily:       '🌅',
  integration: '🔗',
}

// ─── CatalogCard ──────────────────────────────────────────────────────────────

interface CatalogCardProps {
  quest: Quest
  myQuests: UserQuest[]
  onAccept: (quest: Quest) => void
  onOpenSkill: (quest: Quest) => void
  onPreview: (quest: Quest) => void
}

function CatalogCard({ quest, myQuests, onAccept, onOpenSkill, onPreview }: CatalogCardProps) {
  const accepted = myQuests.find(uq => uq.quest_id === quest.id)
  const isSkill = quest.quest_type === 'skill'

  const handleBtn = () => {
    if (isSkill) {
      onOpenSkill(quest)
    } else if (!accepted) {
      onAccept(quest)
    }
  }

  return (
    <div
      className={`${styles.catalogCard} ${TYPE_CLASS[quest.quest_type]} ${isSkill ? styles.catalogCardSkill : ''}`}
      role="article"
    >
      <div className={styles.cardAccentBar} />
      <div className={styles.cardHeader}>
        <span className={styles.typeIcon} aria-hidden="true">
          {TYPE_ICON[quest.quest_type]}
        </span>
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${TYPE_CLASS[quest.quest_type]}`}>
            {TYPE_LABELS[quest.quest_type]}
          </span>
          <span className={`${styles.badge} ${DIFF_CLASS[quest.difficulty]}`}>
            {DIFF_LABELS[quest.difficulty]}
          </span>
          {accepted && (
            <span className={`${styles.badge} ${styles.badgeAccepted}`}>Принят</span>
          )}
        </div>
      </div>

      <h3
        className={`${styles.cardTitle} ${styles.cardTitleClickable}`}
        onClick={() => onPreview(quest)}
        title="Нажмите для просмотра деталей"
      >
        {quest.title}
      </h3>
      {quest.description && (
        <p className={styles.cardDesc}>{quest.description}</p>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.rewardRow}>
          <span className={styles.rewardXp}>⚡ {quest.xp_reward} XP</span>
          <span className={styles.rewardCoins}>🪙 {quest.coins_reward}</span>
          {quest.time_limit_hours !== null && (
            <span className={styles.timeChip}>⏳ {quest.time_limit_hours}ч</span>
          )}
        </div>
        <button
          className={`${styles.acceptBtn} ${accepted && !isSkill ? styles.acceptBtnDone : ''} ${isSkill ? styles.acceptBtnSkill : ''}`}
          onClick={handleBtn}
          disabled={!isSkill && !!accepted}
        >
          {isSkill ? 'Открыть' : accepted ? 'Принят' : 'Принять'}
        </button>
      </div>
    </div>
  )
}

// ─── MyQuestCard ──────────────────────────────────────────────────────────────

interface MyQuestCardProps {
  userQuest: UserQuest
  onComplete: (questId: string) => void
  onOpenSkill: (quest: Quest) => void
}

function MyQuestCard({ userQuest, onComplete, onOpenSkill }: MyQuestCardProps) {
  const { quest } = userQuest
  const isCompleted = userQuest.status === 'completed'
  const isSkill = quest.quest_type === 'skill'
  const { expired } = useCountdown(userQuest.deadline_at)
  const isFailed = expired && !isCompleted

  const pct = Math.min(100, Math.round(userQuest.progress_percent))

  return (
    <div
      className={`${styles.myCard} ${isCompleted ? styles.myCardCompleted : ''} ${isFailed ? styles.myCardFailed : ''} ${TYPE_CLASS[quest.quest_type]}`}
    >
      <div className={styles.cardAccentBar} />
      <div className={styles.myCardHeader}>
        <div className={styles.badgeRow}>
          {isFailed ? (
            <span className={`${styles.badge} ${styles.badgeFailed}`}>Провален</span>
          ) : isCompleted ? (
            <span className={`${styles.badge} ${styles.badgeCompleted}`}>Выполнен</span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeInProgress}`}>В процессе</span>
          )}
          <span className={`${styles.badge} ${DIFF_CLASS[quest.difficulty]}`}>
            {DIFF_LABELS[quest.difficulty]}
          </span>
          <span className={`${styles.badge} ${TYPE_CLASS[quest.quest_type]}`}>
            {TYPE_LABELS[quest.quest_type]}
          </span>
        </div>
        {!isCompleted && (
          <CountdownDisplay deadline={userQuest.deadline_at} />
        )}
      </div>

      <h3 className={styles.cardTitle}>{quest.title}</h3>

      {/* Progress bar */}
      {!isCompleted && (
        <div className={styles.progressWrap}>
          <div className={styles.progressBar}>
            <div
              className={`${styles.progressFill} ${isFailed ? styles.progressFillFailed : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={styles.progressLabel}>
            {userQuest.progress} / {userQuest.target} ({pct}%)
          </span>
        </div>
      )}

      {/* Actions */}
      {!isCompleted && !isFailed && (
        <div className={styles.myCardActions}>
          {isSkill && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
              onClick={() => onOpenSkill(quest)}
            >
              📚 Открыть материал
            </button>
          )}
          <button
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => onComplete(quest.id)}
          >
            Завершить
          </button>
        </div>
      )}

      {isCompleted && (
        <div className={styles.completedRow}>
          <span className={styles.completedMeta}>
            {userQuest.completed_at
              ? `Выполнен ${new Date(userQuest.completed_at).toLocaleDateString('ru-RU')}`
              : 'Выполнен'}
          </span>
          <div className={styles.rewardRow}>
            <span className={styles.rewardXp}>⚡ +{quest.xp_reward} XP</span>
            <span className={styles.rewardCoins}>🪙 +{quest.coins_reward}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── QuestPreviewModal ────────────────────────────────────────────────────────
// Показывает детали квеста через GET /quests/:id и позволяет принять его

interface QuestPreviewModalProps {
  questId: string
  onAccept: () => void
  onClose: () => void
}

function QuestPreviewModal({ questId, onAccept, onClose }: QuestPreviewModalProps) {
  const [quest, setQuest] = useState<Quest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    questsApi.getById(questId, ctrl.signal)
      .then(data => { setQuest(data); setLoading(false) })
      .catch(err => {
        if (!isAbortError(err)) {
          setError('Не удалось загрузить квест')
          setLoading(false)
        }
      })
    return () => ctrl.abort()
  }, [questId])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={styles.rewardOverlay} role="dialog" aria-modal="true" aria-label="Детали квеста">
      <div className={styles.rewardBackdrop} onClick={onClose} />
      <div className={styles.rewardModal}>
        {loading && (
          <div className={styles.loadingRow}>
            <span className={styles.spinner} />
            <span>Загрузка…</span>
          </div>
        )}
        {error && <p style={{ color: 'var(--color-error)' }}>{error}</p>}
        {quest && !loading && (
          <>
            <div className={styles.rewardEmoji}>{TYPE_ICON[quest.quest_type]}</div>
            <h2 className={styles.rewardHeading}>{quest.title}</h2>
            {quest.description && <p className={styles.rewardQuestTitle}>{quest.description}</p>}
            <div className={styles.rewardCards}>
              <div className={`${styles.rewardCard} ${styles.rewardCardXp}`}>
                <span className={styles.rewardCardIcon}>⚡</span>
                <span className={styles.rewardCardValue}>{quest.xp_reward}</span>
                <span className={styles.rewardCardLabel}>XP</span>
              </div>
              <div className={`${styles.rewardCard} ${styles.rewardCardCoins}`}>
                <span className={styles.rewardCardIcon}>🪙</span>
                <span className={styles.rewardCardValue}>{quest.coins_reward}</span>
                <span className={styles.rewardCardLabel}>монет</span>
              </div>
              {quest.time_limit_hours !== null && (
                <div className={`${styles.rewardCard} ${styles.rewardCardLevel}`}>
                  <span className={styles.rewardCardIcon}>⏳</span>
                  <span className={styles.rewardCardValue}>{quest.time_limit_hours}</span>
                  <span className={styles.rewardCardLabel}>часов</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className={styles.rewardCloseBtn} style={{ flex: 1, background: 'var(--color-surface-offset)' }} onClick={onClose}>
                Закрыть
              </button>
              <button className={styles.rewardCloseBtn} style={{ flex: 2 }} onClick={onAccept}>
                Принять квест
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── RewardModal ──────────────────────────────────────────────────────────────

interface RewardModalProps {
  data: RewardData
  onClose: () => void
}

function RewardModal({ data, onClose }: RewardModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={styles.rewardOverlay} role="dialog" aria-modal="true" aria-label="Награда за квест">
      <div className={styles.rewardBackdrop} onClick={onClose} />
      <div className={styles.rewardModal}>
        <div className={styles.rewardEmoji}>🎉</div>
        <h2 className={styles.rewardHeading}>Квест выполнен!</h2>
        <p className={styles.rewardQuestTitle}>{data.quest_title}</p>

        <div className={styles.rewardCards}>
          <div className={`${styles.rewardCard} ${styles.rewardCardXp}`}>
            <span className={styles.rewardCardIcon}>⚡</span>
            <span className={styles.rewardCardValue}>+{data.xp_earned}</span>
            <span className={styles.rewardCardLabel}>опыта</span>
          </div>
          <div className={`${styles.rewardCard} ${styles.rewardCardCoins}`}>
            <span className={styles.rewardCardIcon}>🪙</span>
            <span className={styles.rewardCardValue}>+{data.coins_earned}</span>
            <span className={styles.rewardCardLabel}>монет</span>
          </div>
          {data.level_up && data.new_level !== null && (
            <div className={`${styles.rewardCard} ${styles.rewardCardLevel}`}>
              <span className={styles.rewardCardIcon}>🌟</span>
              <span className={styles.rewardCardValue}>{data.new_level}</span>
              <span className={styles.rewardCardLabel}>новый уровень</span>
            </div>
          )}
        </div>

        {data.badges_earned.length > 0 && (
          <div className={styles.badgesSection}>
            <p className={styles.badgesTitle}>Получены бейджи</p>
            <div className={styles.badgesList}>
              {data.badges_earned.map((b, i) => (
                <span key={i} className={styles.badgeEarned}>{b}</span>
              ))}
            </div>
          </div>
        )}

        <button className={styles.rewardCloseBtn} onClick={onClose}>
          Отлично!
        </button>
      </div>
    </div>
  )
}

// ─── QuestsPage ───────────────────────────────────────────────────────────────

export function QuestsPage() {
  const showToast = useAppToast()

  // Data state
  const [quests, setQuests] = useState<Quest[]>([])
  const [myQuests, setMyQuests] = useState<UserQuest[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>('catalog')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<QuestType | 'all'>('all')
  const [filterDiff, setFilterDiff] = useState<QuestDifficulty | 'all'>('all')

  // Quest preview modal (GET /quests/:id)
  const [previewQuestId, setPreviewQuestId] = useState<string | null>(null)

  // Skill viewer
  const [activeSkillQuest, setActiveSkillQuest] = useState<Quest | null>(null)
  const pendingCompleteRef = useRef<string | null>(null)

  // Reward modal
  const [rewardData, setRewardData] = useState<RewardData | null>(null)

  // Abort controllers
  const abortRef = useRef<AbortController | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)

    const [catalogResult, myResult] = await Promise.allSettled([
      questsApi.getAll({ per_page: 100 }, ctrl.signal),
      questsApi.getMy(ctrl.signal),
    ])

    if (ctrl.signal.aborted) return

    if (catalogResult.status === 'fulfilled') {
      setQuests(catalogResult.value.items)
    } else if (!isAbortError(catalogResult.reason)) {
      showToast('Не удалось загрузить каталог квестов', 'error')
    }

    if (myResult.status === 'fulfilled') {
      setMyQuests(Array.isArray(myResult.value) ? myResult.value : [])
    } else {
      setMyQuests([])
    }

    setLoading(false)
  }, [showToast])

  useEffect(() => {
    loadData()
    return () => { abortRef.current?.abort() }
  }, [loadData])

  // ── Accept quest ───────────────────────────────────────────────────────────

  const handleAccept = useCallback(async (quest: Quest) => {
    try {
      await questsApi.accept(quest.id)
      showToast(`Квест «${quest.title}» принят!`, 'success')
      setPreviewQuestId(null)
      await loadData()
      setActiveTab('my')
    } catch (err: unknown) {
      if (isAbortError(err)) return
      const kind = classifyAcceptError(err)
      if (kind === 'already_active') {
        showToast('Квест уже принят — переходим к активным', 'warning')
        setPreviewQuestId(null)
        await loadData()
        setActiveTab('my')
      } else if (kind === 'no_gateway') {
        // gateway недоступен или токен ещё не готов — silent, не спамим toast
      } else {
        showToast('Не удалось принять квест', 'error')
      }
    }
  }, [loadData, showToast])

  // ── Open skill viewer ──────────────────────────────────────────────────────

  const handleOpenSkill = useCallback(async (quest: Quest) => {
    const alreadyAccepted = myQuests.some(uq => uq.quest_id === quest.id)
    if (!alreadyAccepted) {
      try {
        await questsApi.accept(quest.id)
        showToast(`Квест «${quest.title}» принят!`, 'success')
        await loadData()
      } catch (err: unknown) {
        if (isAbortError(err)) return
        const kind = classifyAcceptError(err)
        if (kind !== 'no_gateway') {
          showToast('Не удалось принять квест', 'error')
        }
        return
      }
    }
    setActiveSkillQuest(quest)
  }, [myQuests, loadData, showToast])

  // ── Complete quest ─────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (questId: string) => {
    try {
      const result = await questsApi.complete(questId)
      const quest = quests.find(q => q.id === questId)
      const reward: RewardData = {
        xp_earned: (result as Record<string, unknown>)?.xp_earned as number ?? quest?.xp_reward ?? 0,
        coins_earned: (result as Record<string, unknown>)?.coins_earned as number ?? quest?.coins_reward ?? 0,
        level_up: !!((result as Record<string, unknown>)?.level_up),
        new_level: ((result as Record<string, unknown>)?.new_level as number | null) ?? null,
        badges_earned: ((result as Record<string, unknown>)?.badges_earned as string[]) ?? [],
        quest_title: quest?.title ?? 'Квест',
      }
      setRewardData(reward)
      await loadData()
    } catch (err: unknown) {
      showToast('Не удалось завершить квест', 'error')
    }
  }, [quests, loadData, showToast])

  // ── Skill viewer complete ──────────────────────────────────────────────────

  const handleSkillViewerComplete = useCallback(() => {
    const questId = activeSkillQuest?.id ?? pendingCompleteRef.current
    setActiveSkillQuest(null)
    if (questId) {
      handleComplete(questId)
    }
  }, [activeSkillQuest, handleComplete])

  // ── Filtered catalog ───────────────────────────────────────────────────────

  const filteredQuests = quests.filter(q => {
    if (filterType !== 'all' && q.quest_type !== filterType) return false
    if (filterDiff !== 'all' && q.difficulty !== filterDiff) return false
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      if (!q.title.toLowerCase().includes(s) && !(q.description ?? '').toLowerCase().includes(s)) return false
    }
    return true
  })

  const activeMyQuests = myQuests.filter(uq => uq.status === 'in_progress')
  const completedMyQuests = myQuests.filter(uq => uq.status === 'completed')
  const activeCount = activeMyQuests.length

  const resetFilters = () => {
    setSearch('')
    setFilterType('all')
    setFilterDiff('all')
  }

  const hasFilters = search !== '' || filterType !== 'all' || filterDiff !== 'all'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Квесты</h1>
          <p className={styles.pageSubtitle}>Выполняй задания, прокачивай навыки, получай награды</p>
        </div>
        {activeCount > 0 && (
          <div className={styles.activeCounter}>
            <span className={styles.activeDot} />
            <span>{activeCount} активных</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'catalog'}
          className={`${styles.tab} ${activeTab === 'catalog' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          Каталог
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'my'}
          className={`${styles.tab} ${activeTab === 'my' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('my')}
        >
          Мои квесты
          {activeCount > 0 && (
            <span className={styles.tabBadge}>{activeCount}</span>
          )}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className={styles.loadingRow}>
          <span className={styles.spinner} />
          <span>Загрузка квестов…</span>
        </div>
      )}

      {/* ── Catalog tab ──────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'catalog' && (
        <div className={styles.tabContent}>
          {/* Search + filters */}
          <div className={styles.controlsRow}>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Поиск по названию…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Поиск квестов"
              />
            </div>
            <div className={styles.filterRow}>
              <select
                className={styles.filterSelect}
                value={filterType}
                onChange={e => setFilterType(e.target.value as QuestType | 'all')}
                aria-label="Фильтр по типу"
              >
                <option value="all">Все типы</option>
                <option value="personal">Личный</option>
                <option value="team">Командный</option>
                <option value="skill">Навык</option>
                <option value="daily">Ежедневный</option>
                <option value="integration">Интеграция</option>
              </select>
              <select
                className={styles.filterSelect}
                value={filterDiff}
                onChange={e => setFilterDiff(e.target.value as QuestDifficulty | 'all')}
                aria-label="Фильтр по сложности"
              >
                <option value="all">Все уровни</option>
                <option value="easy">Лёгкий</option>
                <option value="medium">Средний</option>
                <option value="hard">Сложный</option>
                <option value="epic">Эпический</option>
              </select>
              {hasFilters && (
                <button className={styles.resetBtn} onClick={resetFilters}>
                  ✕ Сброс
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          {filteredQuests.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🔍</span>
              <p>Квесты не найдены</p>
              {hasFilters && (
                <button className={styles.resetBtn} onClick={resetFilters}>Сбросить фильтры</button>
              )}
            </div>
          ) : (
            <div className={styles.questGrid}>
              {filteredQuests.map(q => (
                <CatalogCard
                  key={q.id}
                  quest={q}
                  myQuests={myQuests}
                  onAccept={handleAccept}
                  onOpenSkill={handleOpenSkill}
                  onPreview={q => setPreviewQuestId(q.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My quests tab ─────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'my' && (
        <div className={styles.tabContent}>
          {myQuests.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🎯</span>
              <p>У вас пока нет принятых квестов</p>
              <button className={styles.resetBtn} onClick={() => setActiveTab('catalog')}>
                Перейти в каталог
              </button>
            </div>
          ) : (
            <>
              {activeMyQuests.length > 0 && (
                <section className={styles.mySection}>
                  <h2 className={styles.mySectionTitle}>
                    В процессе
                    <span className={styles.sectionCount}>{activeMyQuests.length}</span>
                  </h2>
                  <div className={styles.questGrid}>
                    {activeMyQuests.map(uq => (
                      <MyQuestCard
                        key={uq.id}
                        userQuest={uq}
                        onComplete={handleComplete}
                        onOpenSkill={handleOpenSkill}
                      />
                    ))}
                  </div>
                </section>
              )}

              {completedMyQuests.length > 0 && (
                <section className={styles.mySection}>
                  <h2 className={styles.mySectionTitle}>
                    Выполнено
                    <span className={styles.sectionCount}>{completedMyQuests.length}</span>
                  </h2>
                  <div className={styles.questGrid}>
                    {completedMyQuests.map(uq => (
                      <MyQuestCard
                        key={uq.id}
                        userQuest={uq}
                        onComplete={handleComplete}
                        onOpenSkill={handleOpenSkill}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Quest preview modal (GET /quests/:id) ─────────────────────────────── */}
      {previewQuestId !== null && (
        <QuestPreviewModal
          questId={previewQuestId}
          onAccept={() => {
            const quest = quests.find(q => q.id === previewQuestId)
            if (quest) handleAccept(quest)
          }}
          onClose={() => setPreviewQuestId(null)}
        />
      )}

      {/* ── SkillViewer overlay ───────────────────────────────────────────────── */}
      {activeSkillQuest !== null && (
        <SkillViewer
          quest={activeSkillQuest}
          onComplete={handleSkillViewerComplete}
          onClose={() => setActiveSkillQuest(null)}
        />
      )}

      {/* ── Reward modal ──────────────────────────────────────────────────────── */}
      {rewardData !== null && (
        <RewardModal
          data={rewardData}
          onClose={() => setRewardData(null)}
        />
      )}
    </div>
  )
}
