/**
 * events.ts
 * Агрегирует три источника событий для календаря:
 *  1. Сроки сдачи квестов (deadline_at из /quests/my)
 *  2. Дни рождения сотрудников — СТАТИЧЕСКИЙ список (demo)
 *  3. Российские праздничные выходные — статический список на 2025–2027
 */
import { api } from './axios'
import { isAbortError } from './quests'
export { isAbortError }

// ─── Типы ───────────────────────────────────────────────────────────────────

export type CalEventKind = 'deadline' | 'birthday' | 'holiday'

export interface CalEvent {
  id: string
  kind: CalEventKind
  /** ISO-дата YYYY-MM-DD */
  date: string
  title: string
  /** Дополнительная подпись (имя квеста, имя сотрудника, …) */
  sub?: string
  /** Только для deadline: процент прогресса */
  progress?: number
  /** Только для deadline: квест уже просрочен */
  overdue?: boolean
}

// ─── Российские нерабочие дни 2025–2027 ─────────────────────────────────────

const RU_HOLIDAYS: { date: string; title: string }[] = [
  // 2025
  { date: '2025-01-01', title: 'Новый год' },
  { date: '2025-01-02', title: 'Новогодние каникулы' },
  { date: '2025-01-03', title: 'Новогодние каникулы' },
  { date: '2025-01-06', title: 'Новогодние каникулы' },
  { date: '2025-01-07', title: 'Рождество Христово' },
  { date: '2025-01-08', title: 'Новогодние каникулы' },
  { date: '2025-02-24', title: 'День защитника Отечества (перенос)' },
  { date: '2025-03-10', title: 'Международный женский день (перенос)' },
  { date: '2025-05-01', title: 'Праздник Весны и Труда' },
  { date: '2025-05-02', title: 'Праздник Весны и Труда (перенос)' },
  { date: '2025-05-08', title: 'День Победы (перенос)' },
  { date: '2025-05-09', title: 'День Победы' },
  { date: '2025-06-12', title: 'День России' },
  { date: '2025-11-04', title: 'День народного единства' },
  { date: '2025-12-31', title: 'Новогодние каникулы (перенос)' },
  // 2026
  { date: '2026-01-01', title: 'Новый год' },
  { date: '2026-01-02', title: 'Новогодние каникулы' },
  { date: '2026-01-07', title: 'Рождество Христово' },
  { date: '2026-01-08', title: 'Новогодние каникулы' },
  { date: '2026-01-09', title: 'Новогодние каникулы' },
  { date: '2026-02-23', title: 'День защитника Отечества' },
  { date: '2026-03-09', title: 'Международный женский день (перенос)' },
  { date: '2026-05-01', title: 'Праздник Весны и Труда' },
  { date: '2026-05-04', title: 'Праздник Весны и Труда (перенос)' },
  { date: '2026-05-08', title: 'День Победы (перенос)' },
  { date: '2026-05-11', title: 'День Победы (перенос)' },
  { date: '2026-06-12', title: 'День России' },
  { date: '2026-11-04', title: 'День народного единства' },
  // 2027
  { date: '2027-01-01', title: 'Новый год' },
  { date: '2027-01-04', title: 'Новогодние каникулы' },
  { date: '2027-01-05', title: 'Новогодние каникулы' },
  { date: '2027-01-06', title: 'Новогодние каникулы' },
  { date: '2027-01-07', title: 'Рождество Христово' },
  { date: '2027-01-08', title: 'Новогодние каникулы' },
  { date: '2027-02-22', title: 'День защитника Отечества (перенос)' },
  { date: '2027-02-23', title: 'День защитника Отечества' },
  { date: '2027-03-08', title: 'Международный женский день' },
  { date: '2027-05-03', title: 'Праздник Весны и Труда (перенос)' },
  { date: '2027-05-10', title: 'День Победы (перенос)' },
  { date: '2027-06-14', title: 'День России (перенос)' },
  { date: '2027-11-04', title: 'День народного единства' },
  { date: '2027-11-05', title: 'День народного единства (перенос)' },
]

// ─── Дни рождения сотрудников — СТАТИКА (demo-ветка) ────────────────────────
// Источник: services/auth-service/app/seed.py
// Формат MM-DD — привязывается к текущему и следующему году в рантайме

const STATIC_BIRTHDAYS: { mmdd: string; name: string }[] = [
  { mmdd: '03-15', name: 'Alice Ivanova' },
  { mmdd: '07-22', name: 'Bob Petrov' },
  { mmdd: '11-08', name: 'Carol Sidorova' },
  { mmdd: '02-28', name: 'Dave Kozlov' },
  { mmdd: '09-05', name: 'Eve Morozova' },
  { mmdd: '06-17', name: 'Frank Volkov' },
  { mmdd: '12-03', name: 'Mike Novikov' },
  { mmdd: '04-20', name: 'Nina Popova' },
  { mmdd: '08-11', name: 'Oscar Lebedev' },
  { mmdd: '01-14', name: 'Roman Kuznetsov' },
  { mmdd: '05-30', name: 'Ivan Sokolov' },
  { mmdd: '10-25', name: 'Julia Smirnova' },
  { mmdd: '03-07', name: 'Kevin Orlov' },
  { mmdd: '07-16', name: 'Sara Fedorova' },
  { mmdd: '02-19', name: 'Laura Zhukova' },
  { mmdd: '09-12', name: 'Tom Vasiliev' },
  { mmdd: '11-01', name: 'Polina Sorokina' },
  { mmdd: '06-08', name: 'Grace Titova' },
  { mmdd: '04-03', name: 'Henry Belov' },
  { mmdd: '08-14', name: 'Dev User' },
]

// ─── Вспомогательные ────────────────────────────────────────────────────────

/** Преобразует ISO-дату в строку YYYY-MM-DD */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

// ─── Ответы API ─────────────────────────────────────────────────────────────

interface MyQuestDeadline {
  id: string
  quest: { title: string }
  deadline_at: string | null
  progress_percent: number
  status: string
}

// ─── Основная функция загрузки ───────────────────────────────────────────────

export async function fetchCalendarEvents(
  signal?: AbortSignal,
): Promise<CalEvent[]> {
  const today = new Date()
  const todayKey = toDateKey(today.toISOString())
  const year = today.getFullYear()

  const questsRes = await Promise.allSettled([
    api.get<MyQuestDeadline[]>('/quests/my', { signal }).then(r => r.data),
  ])

  const events: CalEvent[] = []

  // 1. Сроки сдачи квестов
  if (questsRes[0].status === 'fulfilled') {
    for (const uq of questsRes[0].value) {
      if (!uq.deadline_at || uq.status === 'completed' || uq.status === 'failed') continue
      const dateKey = toDateKey(uq.deadline_at)
      events.push({
        id: `deadline-${uq.id}`,
        kind: 'deadline',
        date: dateKey,
        title: uq.quest.title,
        sub: 'Срок сдачи задания',
        progress: uq.progress_percent,
        overdue: dateKey < todayKey,
      })
    }
  }

  // 2. Дни рождения — статический список, показываем в текущем и следующем году
  for (const b of STATIC_BIRTHDAYS) {
    for (const y of [year, year + 1]) {
      events.push({
        id: `bday-static-${b.mmdd}-${y}`,
        kind: 'birthday',
        date: `${y}-${b.mmdd}`,
        title: `🎂 ${b.name}`,
        sub: 'День рождения',
      })
    }
  }

  // 3. Праздничные выходные (статика)
  for (const h of RU_HOLIDAYS) {
    events.push({
      id: `holiday-${h.date}`,
      kind: 'holiday',
      date: h.date,
      title: h.title,
      sub: 'Нерабочий день',
    })
  }

  return events
}
