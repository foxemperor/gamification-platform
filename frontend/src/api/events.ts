/**
 * events.ts
 * Aggregates three event sources for the calendar:
 *  1. Quest deadlines (deadline_at from /quests/my)
 *  2. Employee birthdays — STATIC list (demo), with project info
 *  3. Russian public holidays — static list for 2025–2027
 */
import { api } from './axios'
import { isAbortError } from './quests'
export { isAbortError }

// ─── Types ───────────────────────────────────────────────────────────────────

export type CalEventKind = 'deadline' | 'birthday' | 'holiday'

export interface CalEvent {
  id: string
  kind: CalEventKind
  /** ISO date YYYY-MM-DD */
  date: string
  title: string
  /** Subtitle (quest name, employee name, …) */
  sub?: string
  /** deadline only: progress percent */
  progress?: number
  /** deadline only: quest is overdue */
  overdue?: boolean
}

// ─── Russian public holidays 2025–2027 ───────────────────────────────────────

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

// ─── Employee birthdays — STATIC (demo branch) ───────────────────────────────
// Source: services/auth-service/app/seed.py
// Format MM-DD — resolved to current and next year at runtime.
// Russian display names + project tag shown in the calendar.

const STATIC_BIRTHDAYS: { mmdd: string; name: string; project: string }[] = [
  { mmdd: '03-15', name: 'Алиса Иванова',    project: 'Веб-платформа' },
  { mmdd: '07-22', name: 'Борис Петров',      project: 'Мобильное приложение' },
  { mmdd: '11-08', name: 'Карина Сидорова',  project: 'Аналитика' },
  { mmdd: '02-28', name: 'Денис Козлов',      project: 'DevOps' },
  { mmdd: '09-05', name: 'Ева Морозова',      project: 'Веб-платформа' },
  { mmdd: '06-17', name: 'Фёдор Волков',      project: 'Мобильное приложение' },
  { mmdd: '12-03', name: 'Михаил Новиков',    project: 'Backend' },
  { mmdd: '04-20', name: 'Нина Попова',       project: 'Дизайн' },
  { mmdd: '08-11', name: 'Олег Лебедев',      project: 'Аналитика' },
  { mmdd: '01-14', name: 'Роман Кузнецов',    project: 'Backend' },
  { mmdd: '05-30', name: 'Иван Соколов',      project: 'DevOps' },
  { mmdd: '10-25', name: 'Юлия Смирнова',     project: 'Дизайн' },
  { mmdd: '03-07', name: 'Кирилл Орлов',      project: 'Веб-платформа' },
  { mmdd: '07-16', name: 'Сара Фёдорова',     project: 'Мобильное приложение' },
  { mmdd: '02-19', name: 'Лора Жукова',       project: 'HR' },
  { mmdd: '09-12', name: 'Тимур Васильев',    project: 'Backend' },
  { mmdd: '11-01', name: 'Полина Сорокина',   project: 'HR' },
  { mmdd: '06-08', name: 'Галина Титова',     project: 'Аналитика' },
  { mmdd: '04-03', name: 'Геннадий Белов',    project: 'DevOps' },
  { mmdd: '08-14', name: 'Dev User',           project: 'Веб-платформа' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converts ISO date to YYYY-MM-DD string */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

// ─── API response types ──────────────────────────────────────────────────────

interface MyQuestDeadline {
  id: string
  quest: { title: string }
  deadline_at: string | null
  progress_percent: number
  status: string
}

// ─── Main loader ─────────────────────────────────────────────────────────────

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

  // 1. Quest deadlines
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

  // 2. Birthdays — static list, shown for current and next year
  for (const b of STATIC_BIRTHDAYS) {
    for (const y of [year, year + 1]) {
      events.push({
        id: `bday-static-${b.mmdd}-${y}`,
        kind: 'birthday',
        date: `${y}-${b.mmdd}`,
        title: `🎂 ${b.name}`,
        sub: `День рождения · Проект: ${b.project}`,
      })
    }
  }

  // 3. Public holidays (static)
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
