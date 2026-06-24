/**
 * events.ts
 * Агрегирует три источника событий для календаря:
 *  1. Сроки сдачи квестов (deadline_at из /quests/my)
 *  2. Дни рождения сотрудников (birthday из /members)
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
// Источник: Постановления Правительства РФ о переносе выходных

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

// ─── Вспомогательные ────────────────────────────────────────────────────────

/** Преобразует ISO-дату в строку YYYY-MM-DD */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * День рождения «приводится» к текущему году для отображения.
 * Возвращает YYYY-MM-DD с учётом текущего года.
 */
function birthdayThisYear(birthday: string, year: number): string {
  const mmdd = birthday.slice(5, 10) // MM-DD
  return `${year}-${mmdd}`
}

// ─── Ответы API ─────────────────────────────────────────────────────────────

interface MemberWithBirthday {
  user_id: string
  full_name: string | null
  username: string
  birthday: string | null
}

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

  const [questsRes, membersRes] = await Promise.allSettled([
    api.get<MyQuestDeadline[]>('/quests/my', { signal }).then(r => r.data),
    api.get<{ items: MemberWithBirthday[] }>('/members', {
      params: { scope: 'all', limit: 500 },
      signal,
    }).then(r => r.data.items),
  ])

  const events: CalEvent[] = []

  // 1. Сроки сдачи квестов
  if (questsRes.status === 'fulfilled') {
    for (const uq of questsRes.value) {
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

  // 2. Дни рождения — показываем в текущем и следующем году
  if (membersRes.status === 'fulfilled') {
    for (const m of membersRes.value) {
      if (!m.birthday) continue
      const name = m.full_name || m.username
      // текущий год
      events.push({
        id: `bday-${m.user_id}-${year}`,
        kind: 'birthday',
        date: birthdayThisYear(m.birthday, year),
        title: `🎂 ${name}`,
        sub: 'День рождения',
      })
      // следующий год (чтобы декабрьские праздники были видны)
      events.push({
        id: `bday-${m.user_id}-${year + 1}`,
        kind: 'birthday',
        date: birthdayThisYear(m.birthday, year + 1),
        title: `🎂 ${name}`,
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
