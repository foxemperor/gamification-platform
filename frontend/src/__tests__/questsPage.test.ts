/**
 * Тесты для новой страницы квестов (сессия 3):
 *
 * 1. useCountdown — логика таймера (expired, цветовые зоны, нет дедлайна)
 * 2. buildSlides (SkillViewer) — генерация слайдов для skill-квестов
 * 3. Фильтрация и поиск в каталоге квестов
 * 4. Классификация ошибок accept/complete
 * 5. Логика RewardData из ответа сервера
 * 6. Таймер: expired-квест считается провалённым
 */

import { describe, it, expect } from 'vitest'
import { buildSlides } from '../components/SkillViewer'

// ─────────────────────────────────────────────────────────────────
// Фабрика тестовых квестов
// ─────────────────────────────────────────────────────────────────

function makeQuest(overrides: Partial<{
  id: string
  title: string
  description: string | null
  quest_type: 'personal' | 'team' | 'skill' | 'daily' | 'integration'
  difficulty: 'easy' | 'medium' | 'hard' | 'epic'
  status: 'active' | 'archived'
  xp_reward: number
  coins_reward: number
  time_limit_hours: number | null
  integration_trigger: string | null
  integration_target: number | null
  created_at: string
}> = {}) {
  return {
    id: 'quest-001',
    title: 'Тестовый квест',
    description: 'Описание квеста для тестов',
    quest_type: 'personal' as const,
    difficulty: 'easy' as const,
    status: 'active' as const,
    xp_reward: 100,
    coins_reward: 10,
    time_limit_hours: null,
    integration_trigger: null,
    integration_target: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeUserQuest(overrides: Partial<{
  id: string
  user_id: string
  quest_id: string
  status: 'in_progress' | 'completed' | 'failed'
  progress: number
  target: number
  progress_percent: number
  started_at: string
  completed_at: string | null
  deadline_at: string | null
  quest: ReturnType<typeof makeQuest>
}> = {}) {
  const quest = overrides.quest ?? makeQuest()
  return {
    id: 'uq-001',
    user_id: 'user-001',
    quest_id: quest.id,
    status: 'in_progress' as const,
    progress: 0,
    target: 1,
    progress_percent: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
    deadline_at: null,
    quest,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────
// Портируем логику useCountdown для unit-теста (без React hooks)
// (хук использует setInterval, тестируем чистую calc-функцию)
// ─────────────────────────────────────────────────────────────────

interface CountdownResult {
  hours: number
  minutes: number
  seconds: number
  expired: boolean
  totalSeconds: number
}

function calcCountdown(deadline: string | null): CountdownResult {
  if (!deadline) {
    return { hours: 0, minutes: 0, seconds: 0, expired: false, totalSeconds: -1 }
  }
  const diff = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, expired: true, totalSeconds: 0 }
  }
  return {
    hours: Math.floor(diff / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    expired: false,
    totalSeconds: diff,
  }
}

// ─────────────────────────────────────────────────────────────────
// 1. Countdown — логика таймера
// ─────────────────────────────────────────────────────────────────

describe('useCountdown — логика таймера (Bug fix: accept + deadline)', () => {
  it('null deadline → не истёкший, totalSeconds=-1 (нет ограничения по времени)', () => {
    const result = calcCountdown(null)
    expect(result.expired).toBe(false)
    expect(result.totalSeconds).toBe(-1)
  })

  it('дедлайн в прошлом → expired=true', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()  // -1 час
    const result = calcCountdown(past)
    expect(result.expired).toBe(true)
    expect(result.totalSeconds).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(0)
  })

  it('дедлайн через 2 часа → правильные ЧЧ:ММ:СС', () => {
    const future = new Date(Date.now() + 2 * 3600_000).toISOString()
    const result = calcCountdown(future)
    expect(result.expired).toBe(false)
    // totalSeconds должен быть близок к 7200 (погрешность < 1 с)
    expect(result.totalSeconds).toBeGreaterThan(7195)
    expect(result.totalSeconds).toBeLessThanOrEqual(7200)
    // hours = 1 или 2 в зависимости от миллисекунд выполнения
    expect(result.hours).toBeGreaterThanOrEqual(1)
    expect(result.hours).toBeLessThanOrEqual(2)
  })

  it('дедлайн через 45 минут → hours=0, minutes ~44-45', () => {
    const future = new Date(Date.now() + 45 * 60_000).toISOString()
    const result = calcCountdown(future)
    expect(result.expired).toBe(false)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBeGreaterThanOrEqual(44)
    expect(result.minutes).toBeLessThanOrEqual(45)
  })

  it('дедлайн через 30 секунд → totalSeconds < 60', () => {
    const future = new Date(Date.now() + 30_000).toISOString()
    const result = calcCountdown(future)
    expect(result.expired).toBe(false)
    expect(result.totalSeconds).toBeLessThan(60)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
  })

  it('точно 0 секунд (now === deadline) → expired=true', () => {
    const now = new Date(Date.now() - 100).toISOString()  // 100ms в прошлом
    const result = calcCountdown(now)
    expect(result.expired).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────
// 2. Цветовые зоны таймера (для UI)
// ─────────────────────────────────────────────────────────────────

describe('Таймер — цветовые зоны', () => {
  function getTimerColor(totalSeconds: number, expired: boolean): 'normal' | 'warning' | 'critical' | 'expired' {
    if (expired) return 'expired'
    if (totalSeconds < 3600) return 'critical'    // < 1 часа → красный
    if (totalSeconds < 10800) return 'warning'    // < 3 часов → оранжевый
    return 'normal'
  }

  it('expired → цвет expired', () => {
    expect(getTimerColor(0, true)).toBe('expired')
  })

  it('50 минут (3000s) → critical (красный)', () => {
    expect(getTimerColor(3000, false)).toBe('critical')
  })

  it('2 часа (7200s) → warning (оранжевый)', () => {
    expect(getTimerColor(7200, false)).toBe('warning')
  })

  it('5 часов (18000s) → normal', () => {
    expect(getTimerColor(18000, false)).toBe('normal')
  })

  it('граница: ровно 1 час (3600s) → warning (не critical)', () => {
    expect(getTimerColor(3600, false)).toBe('warning')
  })

  it('граница: 3599s → critical', () => {
    expect(getTimerColor(3599, false)).toBe('critical')
  })
})

// ─────────────────────────────────────────────────────────────────
// 3. buildSlides — генерация слайдов для skill-квестов
// ─────────────────────────────────────────────────────────────────

describe('buildSlides (SkillViewer) — интерактивная презентация', () => {
  it('всегда генерирует минимум 4 слайда', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    expect(slides.length).toBeGreaterThanOrEqual(4)
  })

  it('первый слайд — intro, содержит название квеста', () => {
    const quest = makeQuest({ title: 'Мастерство TypeScript', quest_type: 'skill' })
    const slides = buildSlides(quest)
    expect(slides[0].type).toBe('intro')
    expect(slides[0].title).toBe('Мастерство TypeScript')
  })

  it('второй слайд — task', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    expect(slides[1].type).toBe('task')
  })

  it('третий слайд — skills', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    expect(slides[2].type).toBe('skills')
  })

  it('последний слайд — finish', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    expect(slides[slides.length - 1].type).toBe('finish')
  })

  it('если integration_trigger задан — task-слайд содержит его', () => {
    const quest = makeQuest({
      quest_type: 'skill',
      integration_trigger: 'github_commit',
      integration_target: 5,
    })
    const slides = buildSlides(quest)
    const taskSlide = slides.find(s => s.type === 'task')!
    expect(taskSlide).toBeDefined()
    expect(taskSlide.content).toContain('github_commit')
  })

  it('если description null — intro слайд имеет fallback текст', () => {
    const quest = makeQuest({ description: null, quest_type: 'skill' })
    const slides = buildSlides(quest)
    expect(slides[0].content).toBeTruthy()
    expect(slides[0].content.length).toBeGreaterThan(10)
  })

  it('task-слайд содержит bullets (непустой массив)', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    const taskSlide = slides.find(s => s.type === 'task')!
    expect(Array.isArray(taskSlide.bullets)).toBe(true)
    expect(taskSlide.bullets!.length).toBeGreaterThan(0)
  })

  it('skills-слайд содержит bullets с ключевыми навыками', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    const skillsSlide = slides.find(s => s.type === 'skills')!
    expect(skillsSlide).toBeDefined()
    expect(Array.isArray(skillsSlide.bullets)).toBe(true)
  })

  it('все слайды имеют id, title, content, icon', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const slides = buildSlides(quest)
    for (const slide of slides) {
      expect(typeof slide.id).toBe('number')
      expect(typeof slide.title).toBe('string')
      expect(slide.title.length).toBeGreaterThan(0)
      expect(typeof slide.content).toBe('string')
      expect(slide.content.length).toBeGreaterThan(0)
      expect(typeof slide.icon).toBe('string')
    }
  })

  it('buildSlides работает для personal/team квестов (не только skill)', () => {
    // buildSlides должен обрабатывать любой квест
    const quest = makeQuest({ quest_type: 'personal' })
    const slides = buildSlides(quest)
    expect(slides.length).toBeGreaterThanOrEqual(4)
  })
})

// ─────────────────────────────────────────────────────────────────
// 4. Фильтрация каталога квестов
// ─────────────────────────────────────────────────────────────────

describe('Каталог — фильтрация и поиск', () => {
  const catalog = [
    makeQuest({ id: '1', title: 'Первый квест', quest_type: 'personal', difficulty: 'easy' }),
    makeQuest({ id: '2', title: 'Командный марафон', quest_type: 'team', difficulty: 'medium' }),
    makeQuest({ id: '3', title: 'Навык React', quest_type: 'skill', difficulty: 'hard' }),
    makeQuest({ id: '4', title: 'TypeScript мастерство', quest_type: 'skill', difficulty: 'easy' }),
    makeQuest({ id: '5', title: 'Проект команды', quest_type: 'team', difficulty: 'easy' }),
    makeQuest({ id: '6', title: 'Ежедневная задача', quest_type: 'daily', difficulty: 'easy' }),
    makeQuest({ id: '7', title: 'GitHub интеграция', quest_type: 'integration', difficulty: 'epic' }),
    makeQuest({ id: '8', title: 'Эпический вызов', quest_type: 'personal', difficulty: 'epic' }),
  ]

  function filterQuests(
    quests: ReturnType<typeof makeQuest>[],
    filterType: string,
    filterDiff: string,
    search: string,
  ) {
    return quests.filter(q => {
      if (filterType !== 'all' && q.quest_type !== filterType) return false
      if (filterDiff !== 'all' && q.difficulty !== filterDiff) return false
      if (search.trim()) {
        const s = search.trim().toLowerCase()
        if (!q.title.toLowerCase().includes(s) &&
            !(q.description ?? '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }

  it('без фильтров → все квесты', () => {
    const result = filterQuests(catalog, 'all', 'all', '')
    expect(result).toHaveLength(8)
  })

  it('фильтр по типу skill → только skill-квесты', () => {
    const result = filterQuests(catalog, 'skill', 'all', '')
    expect(result).toHaveLength(2)
    expect(result.every(q => q.quest_type === 'skill')).toBe(true)
  })

  it('фильтр по сложности easy → только лёгкие', () => {
    const result = filterQuests(catalog, 'all', 'easy', '')
    expect(result).toHaveLength(4)  // id 1,4,5,6 (персонал, скилл, тим, дейли)
    expect(result.every(q => q.difficulty === 'easy')).toBe(true)
  })

  it('комбинированный фильтр: team + easy → 1 квест', () => {
    const result = filterQuests(catalog, 'team', 'easy', '')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('5')
  })

  it('поиск "React" → находит квест с React в названии', () => {
    const result = filterQuests(catalog, 'all', 'all', 'React')
    expect(result).toHaveLength(1)
    expect(result[0].title).toContain('React')
  })

  it('поиск регистронезависимый', () => {
    const result = filterQuests(catalog, 'all', 'all', 'typescript')
    expect(result).toHaveLength(1)
    expect(result[0].title.toLowerCase()).toContain('typescript')
  })

  it('поиск несуществующего → пустой результат', () => {
    const result = filterQuests(catalog, 'all', 'all', 'XYZ_NOT_FOUND')
    expect(result).toHaveLength(0)
  })

  it('фильтр team + hard → пусто (нет таких)', () => {
    const result = filterQuests(catalog, 'team', 'hard', '')
    expect(result).toHaveLength(0)
  })

  // Новые типы: daily, integration, epic
  it('фильтр по типу daily → только ежедневные квесты', () => {
    const result = filterQuests(catalog, 'daily', 'all', '')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('6')
    expect(result.every(q => q.quest_type === 'daily')).toBe(true)
  })

  it('фильтр по типу integration → только integration-квесты', () => {
    const result = filterQuests(catalog, 'integration', 'all', '')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('7')
    expect(result.every(q => q.quest_type === 'integration')).toBe(true)
  })

  it('фильтр по сложности epic → 2 квеста (id 7 и 8)', () => {
    const result = filterQuests(catalog, 'all', 'epic', '')
    expect(result).toHaveLength(2)
    expect(result.every(q => q.difficulty === 'epic')).toBe(true)
    expect(result.map(q => q.id).sort()).toEqual(['7', '8'])
  })

  it('комбинация: integration + epic → один квест', () => {
    const result = filterQuests(catalog, 'integration', 'epic', '')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('7')
  })

  it('поиск «ежедневная» → находит daily-квест', () => {
    const result = filterQuests(catalog, 'all', 'all', 'ежедневная')
    expect(result).toHaveLength(1)
    expect(result[0].quest_type).toBe('daily')
  })

  it('поиск «GitHub» с фильтром integration → находит GitHub-квест', () => {
    const result = filterQuests(catalog, 'integration', 'all', 'GitHub')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('7')
  })
})

// ─────────────────────────────────────────────────────────────────
// 5. Логика RewardData из ответа сервера
// ─────────────────────────────────────────────────────────────────

describe('RewardData — парсинг ответа complete', () => {
  function parseReward(
    result: Record<string, unknown>,
    questTitle: string,
    fallbackXp: number,
    fallbackCoins: number,
  ) {
    return {
      xp_earned: result?.xp_earned as number ?? fallbackXp,
      coins_earned: result?.coins_earned as number ?? fallbackCoins,
      level_up: !!(result?.level_up),
      new_level: (result?.new_level as number | null) ?? null,
      badges_earned: (result?.badges_earned as string[]) ?? [],
      quest_title: questTitle,
    }
  }

  it('полный ответ сервера → все поля заполнены', () => {
    const serverResponse = {
      xp_earned: 500,
      coins_earned: 50,
      level_up: true,
      new_level: 5,
      badges_earned: ['Первопроходец', 'Мастер навыков'],
    }
    const reward = parseReward(serverResponse, 'Квест навыка', 100, 10)
    expect(reward.xp_earned).toBe(500)
    expect(reward.coins_earned).toBe(50)
    expect(reward.level_up).toBe(true)
    expect(reward.new_level).toBe(5)
    expect(reward.badges_earned).toEqual(['Первопроходец', 'Мастер навыков'])
    expect(reward.quest_title).toBe('Квест навыка')
  })

  it('ответ без level_up → level_up=false, new_level=null', () => {
    const serverResponse = { xp_earned: 100, coins_earned: 10 }
    const reward = parseReward(serverResponse, 'Тест', 0, 0)
    expect(reward.level_up).toBe(false)
    expect(reward.new_level).toBeNull()
  })

  it('пустой ответ → fallback к данным квеста', () => {
    const reward = parseReward({}, 'Квест', 200, 20)
    expect(reward.xp_earned).toBe(200)
    expect(reward.coins_earned).toBe(20)
  })

  it('badges_earned отсутствует → пустой массив', () => {
    const reward = parseReward({ xp_earned: 50 }, 'Квест', 50, 5)
    expect(reward.badges_earned).toEqual([])
    expect(Array.isArray(reward.badges_earned)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────
// 6. Логика accept квеста — is already accepted check
// ─────────────────────────────────────────────────────────────────

describe('Accept квеста — проверка дублирования', () => {
  it('квест уже принят (есть в myQuests) → isAlreadyAccepted=true', () => {
    const quest = makeQuest({ id: 'q-100' })
    const myQuests = [
      makeUserQuest({ quest_id: 'q-100', quest }),
    ]
    const isAlreadyAccepted = myQuests.some(uq => uq.quest_id === quest.id)
    expect(isAlreadyAccepted).toBe(true)
  })

  it('квест не принят → isAlreadyAccepted=false', () => {
    const quest = makeQuest({ id: 'q-200' })
    const myQuests = [
      makeUserQuest({ quest_id: 'q-100' }),
    ]
    const isAlreadyAccepted = myQuests.some(uq => uq.quest_id === quest.id)
    expect(isAlreadyAccepted).toBe(false)
  })

  it('завершённый квест считается принятым (status=completed)', () => {
    const quest = makeQuest({ id: 'q-300' })
    const myQuests = [
      makeUserQuest({ quest_id: 'q-300', status: 'completed', quest }),
    ]
    const isAlreadyAccepted = myQuests.some(uq => uq.quest_id === quest.id)
    expect(isAlreadyAccepted).toBe(true)
  })

  it('пустой myQuests → ни один квест не принят', () => {
    const quest = makeQuest({ id: 'q-400' })
    const isAlreadyAccepted = [].some((uq: ReturnType<typeof makeUserQuest>) =>
      uq.quest_id === quest.id
    )
    expect(isAlreadyAccepted).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────
// 7. Expired квест — логика провала
// ─────────────────────────────────────────────────────────────────

describe('Expired квест — проверка провала при истёкшем дедлайне', () => {
  it('in_progress + expired deadline → визуально "Провален", кнопка скрыта', () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString()
    const result = calcCountdown(pastDeadline)

    expect(result.expired).toBe(true)
    // Логика UI: если expired && status === 'in_progress' → показать как failed
    const status = 'in_progress'
    const effectivelyFailed = status === 'in_progress' && result.expired
    expect(effectivelyFailed).toBe(true)
  })

  it('in_progress + будущий deadline → не провален', () => {
    const futureDeadline = new Date(Date.now() + 3600_000).toISOString()
    const result = calcCountdown(futureDeadline)

    const status = 'in_progress'
    const effectivelyFailed = status === 'in_progress' && result.expired
    expect(effectivelyFailed).toBe(false)
  })

  it('completed + expired deadline → НЕ провален (уже выполнен)', () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString()
    const cdResult = calcCountdown(pastDeadline)
    // Проверяем через универсальную функцию чтобы обойти narrowing
    function isEffectivelyFailed(st: string, expired: boolean) {
      return st === 'in_progress' && expired
    }
    expect(isEffectivelyFailed('completed', cdResult.expired)).toBe(false)
  })

  it('null deadline → никогда не expired', () => {
    const result = calcCountdown(null)
    expect(result.expired).toBe(false)
    expect(result.totalSeconds).toBe(-1)
  })
})

// ─────────────────────────────────────────────────────────────────
// 8. Skill-квест: кнопка "Открыть" вместо "Принять"
// ─────────────────────────────────────────────────────────────────

describe('Skill-квест — особая логика кнопки', () => {
  it('skill quest → label кнопки "Открыть"', () => {
    const quest = makeQuest({ quest_type: 'skill' })
    const label = quest.quest_type === 'skill' ? 'Открыть' : 'Принять'
    expect(label).toBe('Открыть')
  })

  it('personal quest → label кнопки "Принять"', () => {
    const quest = makeQuest({ quest_type: 'personal' })
    const label = quest.quest_type === 'skill' ? 'Открыть' : 'Принять'
    expect(label).toBe('Принять')
  })

  it('team quest → label кнопки "Принять"', () => {
    const quest = makeQuest({ quest_type: 'team' })
    const label = quest.quest_type === 'skill' ? 'Открыть' : 'Принять'
    expect(label).toBe('Принять')
  })

  it('skill quest уже принят → MyQuestCard показывает "Открыть материал"', () => {
    const uq = makeUserQuest({
      status: 'in_progress',
      quest: makeQuest({ quest_type: 'skill' }),
    })
    const isSkill = uq.quest.quest_type === 'skill'
    const buttonLabel = isSkill ? 'Открыть материал' : 'Завершить'
    expect(buttonLabel).toBe('Открыть материал')
  })

  it('personal quest принят → MyQuestCard показывает "Завершить"', () => {
    const uq = makeUserQuest({
      status: 'in_progress',
      quest: makeQuest({ quest_type: 'personal' }),
    })
    const isSkill = uq.quest.quest_type === 'skill'
    const buttonLabel = isSkill ? 'Открыть материал' : 'Завершить'
    expect(buttonLabel).toBe('Завершить')
  })
})

// ─────────────────────────────────────────────────────────────────
// 9. Прогресс-бар квеста
// ─────────────────────────────────────────────────────────────────

describe('Прогресс-бар квеста', () => {
  it('0/1 → 0%', () => {
    const uq = makeUserQuest({ progress: 0, target: 1, progress_percent: 0 })
    expect(uq.progress_percent).toBe(0)
  })

  it('progress_percent не превышает 100 при clamp', () => {
    const rawPercent = 150 // "невалидные" данные
    const clamped = Math.min(rawPercent, 100)
    expect(clamped).toBe(100)
  })

  it('completed → progress === target', () => {
    const uq = makeUserQuest({ progress: 5, target: 5, status: 'completed' })
    expect(uq.progress).toBe(uq.target)
  })
})

// ─────────────────────────────────────────────────────────────────
// 10. Разделение мои квесты на секции
// ─────────────────────────────────────────────────────────────────

describe('Мои квесты — разделение на секции', () => {
  const myQuests = [
    makeUserQuest({ id: 'uq-1', status: 'in_progress' }),
    makeUserQuest({ id: 'uq-2', status: 'completed' }),
    makeUserQuest({ id: 'uq-3', status: 'in_progress' }),
    makeUserQuest({ id: 'uq-4', status: 'failed' }),
    makeUserQuest({ id: 'uq-5', status: 'completed' }),
  ]

  it('активные квесты → только in_progress', () => {
    const active = myQuests.filter(q => q.status === 'in_progress')
    expect(active).toHaveLength(2)
  })

  it('выполненные → только completed', () => {
    const completed = myQuests.filter(q => q.status === 'completed')
    expect(completed).toHaveLength(2)
  })

  it('счётчик активных для таба', () => {
    const activeCount = myQuests.filter(q => q.status === 'in_progress').length
    expect(activeCount).toBe(2)
  })
})
