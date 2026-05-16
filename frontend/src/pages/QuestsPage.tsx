import { useEffect, useState, useCallback, useRef } from 'react'
import { questsApi, isAbortError, type Quest, type UserQuest } from '../api/quests'
import { useAppToast } from '../App'
import s from './QuestsPage.module.css'

// ─────────────────── константы ───────────────────

const TYPE_LABELS: Record<string, string> = {
  personal: 'Личный',
  team:     'Командный',
  skill:    'Навык',
}

const DIFF_LABELS: Record<string, string> = {
  easy:   'Легко',
  medium: 'Средне',
  hard:   'Сложно',
}

const DIFF_CLASS: Record<string, string> = {
  easy:   s.diffEasy,
  medium: s.diffMedium,
  hard:   s.diffHard,
}

const TYPE_ICON: Record<string, string> = {
  personal: '💼',
  team:     '👥',
  skill:    '📚',
}

// ─────────────────── карточка каталога ───────────────────

function CatalogCard({
  quest,
  onAccept,
  accepting,
}: {
  quest: Quest
  onAccept: (id: string) => void
  accepting: boolean
}) {
  return (
    <div className={s.card}>
      <div className={s.cardTop}>
        <span className={s.typeIcon}>{TYPE_ICON[quest.quest_type] ?? '⭐'}</span>
        <div className={s.cardMeta}>
          <span className={s.typeLabel}>{TYPE_LABELS[quest.quest_type] ?? quest.quest_type}</span>
          <span className={`${s.diffBadge} ${DIFF_CLASS[quest.difficulty] ?? ''}`}>
            {DIFF_LABELS[quest.difficulty] ?? quest.difficulty}
          </span>
        </div>
      </div>

      <h3 className={s.cardTitle}>{quest.title}</h3>
      <p className={s.cardDesc}>{quest.description}</p>

      <div className={s.cardFooter}>
        <div className={s.rewards}>
          <span className={s.rewardXp}>+{quest.xp_reward} XP</span>
          <span className={s.rewardCoins}>+{quest.coins_reward} 🪙</span>
          {quest.time_limit_hours && (
            <span className={s.timeLimit}>⏱ {quest.time_limit_hours}ч</span>
          )}
        </div>
        <button
          className={s.acceptBtn}
          onClick={() => onAccept(quest.id)}
          disabled={accepting}
          aria-label={`Принять квест ${quest.title}`}
        >
          {accepting ? '…' : 'Принять'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────── карточка "Мои квесты" ───────────────────

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'В процессе',
  completed:   'Выполнен',
  failed:      'Провален',
}
const STATUS_CLASS: Record<string, string> = {
  in_progress: s.statusProgress,
  completed:   s.statusDone,
  failed:      s.statusFailed,
}

function MyQuestCard({
  quest,
  onComplete,
  completing,
}: {
  quest: UserQuest
  onComplete: (id: string) => void
  completing: boolean
}) {
  // Данные самого квеста — во вложенном объекте quest.quest
  const q = quest.quest

  return (
    <div className={`${s.card} ${quest.status === 'completed' ? s.cardDone : ''}`}>
      <div className={s.cardTop}>
        <span className={s.typeIcon}>{TYPE_ICON[q.quest_type] ?? '⭐'}</span>
        <div className={s.cardMeta}>
          <span className={`${s.statusBadge} ${STATUS_CLASS[quest.status] ?? ''}`}>
            {STATUS_LABEL[quest.status] ?? quest.status}
          </span>
          <span className={`${s.diffBadge} ${DIFF_CLASS[q.difficulty] ?? ''}`}>
            {DIFF_LABELS[q.difficulty] ?? q.difficulty}
          </span>
        </div>
      </div>

      <h3 className={s.cardTitle}>{q.title}</h3>

      {/* progress bar */}
      <div className={s.progressWrap}>
        <div className={s.progressTrack}>
          <div
            className={s.progressFill}
            style={{ width: `${Math.min(quest.progress_percent, 100)}%` }}
          />
        </div>
        <span className={s.progressLabel}>
          {quest.progress} / {quest.target} · {quest.progress_percent.toFixed(0)}%
        </span>
      </div>

      <div className={s.cardFooter}>
        <div className={s.rewards}>
          <span className={s.rewardXp}>+{q.xp_reward} XP</span>
          <span className={s.rewardCoins}>+{q.coins_reward} 🪙</span>
          {quest.deadline_at && (
            <span className={s.timeLimit}>
              до {new Date(quest.deadline_at).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
        {quest.status === 'in_progress' && (
          <button
            className={`${s.acceptBtn} ${s.completeBtn}`}
            onClick={() => onComplete(quest.id)}
            disabled={completing}
            aria-label={`Завершить квест ${q.title}`}
          >
            {completing ? '…' : 'Завершить'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────── skeleton ───────────────────

function SkeletonCard() {
  return <div className={`${s.card} ${s.skeleton}`} style={{ minHeight: 180 }} />
}

// ─────────────────── главная страница ───────────────────

type Tab = 'catalog' | 'my'

export function QuestsPage() {
  const toast = useAppToast()
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const [tab, setTab] = useState<Tab>('catalog')

  // ── каталог ──
  const [quests, setQuests]                 = useState<Quest[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [filterType, setFilterType]         = useState<string>('')
  const [filterDiff, setFilterDiff]         = useState<string>('')
  const [accepting, setAccepting]           = useState<string | null>(null)

  // ── мои квесты ──
  const [myQuests, setMyQuests]     = useState<UserQuest[]>([])
  const [myLoading, setMyLoading]   = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  const loadCatalog = useCallback(() => {
    setCatalogLoading(true)
    const ctrl = new AbortController()

    questsApi
      .getAll(
        { quest_type: filterType || undefined, difficulty: filterDiff || undefined, per_page: 50 },
        ctrl.signal,
      )
      .then(res => {
        if (ctrl.signal.aborted) return
        setQuests(res.items)
      })
      .catch(err => {
        if (isAbortError(err) || ctrl.signal.aborted) return
        toastRef.current('Не удалось загрузить квесты', 'error')
      })
      .finally(() => { if (!ctrl.signal.aborted) setCatalogLoading(false) })

    return ctrl
  }, [filterType, filterDiff])

  const loadMy = useCallback(() => {
    setMyLoading(true)
    const ctrl = new AbortController()

    questsApi
      .getMy(ctrl.signal)
      .then(list => {
        if (ctrl.signal.aborted) return
        setMyQuests(Array.isArray(list) ? list : [])
      })
      .catch(err => {
        if (isAbortError(err) || ctrl.signal.aborted) return
        if (err?.response?.status === 404) { setMyQuests([]); return }
        toastRef.current('Не удалось загрузить ваши квесты', 'error')
      })
      .finally(() => { if (!ctrl.signal.aborted) setMyLoading(false) })

    return ctrl
  }, [])

  useEffect(() => {
    const c = loadCatalog()
    return () => c.abort()
  }, [loadCatalog])

  useEffect(() => {
    const c = loadMy()
    return () => c.abort()
  }, [loadMy])

  const handleAccept = async (questId: string) => {
    setAccepting(questId)
    try {
      await questsApi.accept(questId)
      toast('Квест принят! Переходи в "Мои квесты"', 'success')
      loadMy()
      setTab('my')
    } catch {
      toast('Не удалось принять квест. Возможно, он уже активен.', 'warning')
    } finally {
      setAccepting(null)
    }
  }

  const handleComplete = async (userQuestId: string) => {
    setCompleting(userQuestId)
    try {
      await questsApi.complete(userQuestId)
      toast('Квест выполнен! Награда начислена 🎉', 'success')
      loadMy()
    } catch {
      toast('Не удалось завершить квест', 'error')
    } finally {
      setCompleting(null)
    }
  }

  const myActive    = myQuests.filter(q => q.status === 'in_progress')
  const myCompleted = myQuests.filter(q => q.status === 'completed')

  return (
    <div className={s.page}>
      <header className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Квесты</h1>
          <p className={s.pageSub}>Выполняй задания — получай XP и монеты</p>
        </div>
        {myActive.length > 0 && (
          <span className={s.activeBadge}>{myActive.length} активных</span>
        )}
      </header>

      <div className={s.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'catalog'}
          className={`${s.tab} ${tab === 'catalog' ? s.tabActive : ''}`}
          onClick={() => setTab('catalog')}
        >
          Каталог
        </button>
        <button
          role="tab"
          aria-selected={tab === 'my'}
          className={`${s.tab} ${tab === 'my' ? s.tabActive : ''}`}
          onClick={() => setTab('my')}
        >
          Мои квесты
          {myActive.length > 0 && (
            <span className={s.tabCount}>{myActive.length}</span>
          )}
        </button>
      </div>

      {tab === 'catalog' && (
        <div className={s.filters}>
          <select
            className={s.select}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            aria-label="Фильтр по типу"
          >
            <option value="">Все типы</option>
            <option value="personal">Личный</option>
            <option value="team">Командный</option>
            <option value="skill">Навык</option>
          </select>
          <select
            className={s.select}
            value={filterDiff}
            onChange={e => setFilterDiff(e.target.value)}
            aria-label="Фильтр по сложности"
          >
            <option value="">Вся сложность</option>
            <option value="easy">Легко</option>
            <option value="medium">Средне</option>
            <option value="hard">Сложно</option>
          </select>
          {(filterType || filterDiff) && (
            <button
              className={s.clearBtn}
              onClick={() => { setFilterType(''); setFilterDiff('') }}
            >
              × Сбросить
            </button>
          )}
        </div>
      )}

      {tab === 'catalog' && (
        catalogLoading ? (
          <div className={s.grid}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : quests.length > 0 ? (
          <div className={s.grid}>
            {quests.map(q => (
              <CatalogCard
                key={q.id}
                quest={q}
                onAccept={handleAccept}
                accepting={accepting === q.id}
              />
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <span className={s.emptyIcon}>🔍</span>
            <p className={s.emptyTitle}>Квесты не найдены</p>
            <p className={s.emptyHint}>Попробуйте сбросить фильтры — возможно, админ ещё не создал квесты.</p>
          </div>
        )
      )}

      {tab === 'my' && (
        myLoading ? (
          <div className={s.grid}>
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : myQuests.length > 0 ? (
          <>
            {myActive.length > 0 && (
              <section className={s.section}>
                <h2 className={s.sectionTitle}>В процессе</h2>
                <div className={s.grid}>
                  {myActive.map(q => (
                    <MyQuestCard
                      key={q.id}
                      quest={q}
                      onComplete={handleComplete}
                      completing={completing === q.id}
                    />
                  ))}
                </div>
              </section>
            )}
            {myCompleted.length > 0 && (
              <section className={s.section}>
                <h2 className={s.sectionTitle}>Выполненные</h2>
                <div className={s.grid}>
                  {myCompleted.map(q => (
                    <MyQuestCard
                      key={q.id}
                      quest={q}
                      onComplete={handleComplete}
                      completing={false}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className={s.empty}>
            <span className={s.emptyIcon}>🎯</span>
            <p className={s.emptyTitle}>Нет активных квестов</p>
            <p className={s.emptyHint}>Перейди в каталог и прими первый квест!</p>
            <button className={s.goBtn} onClick={() => setTab('catalog')}>Открыть каталог</button>
          </div>
        )
      )}
    </div>
  )
}
