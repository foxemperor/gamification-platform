import { useEffect, useState, useMemo } from 'react'
import { fetchCalendarEvents, isAbortError, toDateKey } from '../api/events'
import type { CalEvent, CalEventKind } from '../api/events'
import s from './EventsPage.module.css'

// ─── Константы ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const KIND_ICON: Record<CalEventKind, string> = {
  deadline: '📋',
  birthday: '🎂',
  holiday:  '🎉',
}

const KIND_PILL_CLASS: Record<CalEventKind, string> = {
  deadline: s.pillDeadline,
  birthday: s.pillBirthday,
  holiday:  s.pillHoliday,
}

const KIND_ICON_CLASS: Record<CalEventKind, string> = {
  deadline: s.iconDeadline,
  birthday: s.iconBirthday,
  holiday:  s.iconHoliday,
}

const DOT_CLASS: Record<CalEventKind, string> = {
  deadline: s.dotDeadline,
  birthday: s.dotBirthday,
  holiday:  s.dotHoliday,
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

/**
 * Возвращает массив ячеек календаря для заданного месяца.
 * Первая ячейка — понедельник первой видимой недели.
 */
function buildCalendarGrid(
  year: number,
  month: number, // 0-based
): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)

  // ISO: понедельник = 0
  const startDow = (firstDay.getDay() + 6) % 7
  const endDow   = (lastDay.getDay()  + 6) % 7

  const cells: { date: Date; isCurrentMonth: boolean }[] = []

  // Дни предыдущего месяца
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(firstDay)
    d.setDate(d.getDate() - i - 1)
    cells.push({ date: d, isCurrentMonth: false })
  }

  // Дни текущего месяца
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }

  // Дни следующего месяца
  const tail = endDow === 6 ? 0 : 6 - endDow
  for (let i = 1; i <= tail; i++) {
    cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
  }

  return cells
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay()
  return dow === 0 || dow === 6
}

// ─── Скелетон ────────────────────────────────────────────────────────────────

function CalSkeleton() {
  return (
    <div className={s.calWrap}>
      <div className={s.calHead}>
        {DAY_NAMES.map(d => (
          <div key={d} className={[s.calHeadCell, d === 'Сб' || d === 'Вс' ? s.weekend : ''].join(' ')}>
            {d}
          </div>
        ))}
      </div>
      <div className={s.calBody}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className={s.skelCell}>
            <div className={s.skel} style={{ width: 22, height: 12, borderRadius: 6 }} />
            <div className={s.skel} style={{ width: '70%', height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Панель выбранного дня ───────────────────────────────────────────────────

function DayPanel({
  date,
  events,
}: {
  date: Date
  events: CalEvent[]
}) {
  const label = date.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className={s.dayPanel}>
      <div className={s.dayPanelTitle}>{label}</div>
      {events.length === 0 ? (
        <div className={s.dayEmpty}>
          <div className={s.dayEmptyIcon}>📅</div>
          <div className={s.dayEmptyText}>Событий нет</div>
        </div>
      ) : (
        <div className={s.dayEventList}>
          {events.map(ev => (
            <div key={ev.id} className={s.dayEvent}>
              <div className={[s.dayEventIcon, KIND_ICON_CLASS[ev.kind]].join(' ')}>
                {KIND_ICON[ev.kind]}
              </div>
              <div className={s.dayEventBody}>
                <div className={s.dayEventTitle}>{ev.title}</div>
                {ev.sub && <div className={s.dayEventSub}>{ev.sub}</div>}
                {ev.kind === 'deadline' && ev.progress !== undefined && (
                  <div className={s.progressBar}>
                    <div
                      className={[s.progressFill, ev.overdue ? s.progressFillOverdue : ''].join(' ')}
                      style={{ width: `${ev.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {ev.overdue && (
                <span className={s.overdueBadge}>Просрочено</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export function EventsPage() {
  const today = useMemo(() => new Date(), [])
  const todayKey = toDateKey(today.toISOString())

  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<Date>(today)

  const [events,  setEvents]  = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Индекс событий по дате
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of events) {
      const arr = map.get(ev.date) ?? []
      arr.push(ev)
      map.set(ev.date, arr)
    }
    return map
  }, [events])

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    setLoading(true)
    fetchCalendarEvents(ctrl.signal)
      .then(evs => { if (!cancelled) setEvents(evs) })
      .catch(err => { if (!isAbortError(err) && !cancelled) setEvents([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; ctrl.abort() }
  }, [])

  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month])

  // Праздники текущего месяца — для подсветки ячеек
  const holidaySet = useMemo(() => {
    const s = new Set<string>()
    for (const ev of events) {
      if (ev.kind === 'holiday') s.add(ev.date)
    }
    return s
  }, [events])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelected(today)
  }

  const selectedKey = toDateKey(selected.toISOString())
  const selectedEvents = eventsByDate.get(selectedKey) ?? []

  // Считаем общее кол-во событий в текущем месяце
  const monthEventCount = useMemo(() => {
    return cells.filter(c => c.isCurrentMonth).reduce((acc, c) => {
      return acc + (eventsByDate.get(toDateKey(c.date.toISOString()))?.length ?? 0)
    }, 0)
  }, [cells, eventsByDate])

  const MAX_PILLS = 2

  return (
    <div className={s.page}>
      {/* Шапка */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>События</h1>
          {!loading && (
            <p className={s.pageSub}>
              {monthEventCount > 0
                ? `${monthEventCount} ${monthEventCount === 1 ? 'событие' : monthEventCount < 5 ? 'события' : 'событий'} в ${MONTH_NAMES[month].toLowerCase()}`
                : `Нет событий в ${MONTH_NAMES[month].toLowerCase()}`}
            </p>
          )}
        </div>

        {/* Навигация */}
        <div className={s.calNav}>
          <button className={s.calNavBtn} onClick={prevMonth} aria-label="Предыдущий месяц">‹</button>
          <span className={s.calMonthLabel}>{MONTH_NAMES[month]} {year}</span>
          <button className={s.calNavBtn} onClick={nextMonth} aria-label="Следующий месяц">›</button>
          <button className={s.calTodayBtn} onClick={goToday}>Сегодня</button>
        </div>
      </div>

      {/* Легенда */}
      <div className={s.legend}>
        <div className={s.legendItem}>
          <span className={[s.legendDot, s.dotDeadline].join(' ')} />
          Срок сдачи задания
        </div>
        <div className={s.legendItem}>
          <span className={[s.legendDot, s.dotBirthday].join(' ')} />
          День рождения
        </div>
        <div className={s.legendItem}>
          <span className={[s.legendDot, s.dotHoliday].join(' ')} />
          Праздничный выходной
        </div>
      </div>

      {/* Календарная сетка */}
      {loading ? <CalSkeleton /> : (
        <div className={s.calWrap}>
          {/* Заголовки дней */}
          <div className={s.calHead}>
            {DAY_NAMES.map((d, i) => (
              <div
                key={d}
                className={[
                  s.calHeadCell,
                  i >= 5 ? s.weekend : '',
                ].join(' ')}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Ячейки */}
          <div className={s.calBody}>
            {cells.map((cell, idx) => {
              const key  = toDateKey(cell.date.toISOString())
              const evs  = eventsByDate.get(key) ?? []
              const isToday     = key === todayKey
              const isSelected  = isSameDay(cell.date, selected)
              const isHoliday   = holidaySet.has(key)
              const isWknd      = isWeekend(cell.date)

              const cellClass = [
                s.calCell,
                !cell.isCurrentMonth ? s.otherMonth : '',
                isToday    ? s.today   : '',
                isHoliday  ? s.holiday : '',
                isWknd     ? s.weekend : '',
                isSelected ? s.selectedCell : '',
              ].filter(Boolean).join(' ')

              const visibleEvs = evs.slice(0, MAX_PILLS)
              const hiddenCount = evs.length - MAX_PILLS

              return (
                <div
                  key={idx}
                  className={cellClass}
                  onClick={() => setSelected(cell.date)}
                  style={isSelected ? {
                    outline: '2px solid var(--primary)',
                    outlineOffset: '-2px',
                    borderRadius: 0,
                  } : undefined}
                >
                  <span className={s.calDayNum}>{cell.date.getDate()}</span>

                  {visibleEvs.map(ev => (
                    <div
                      key={ev.id}
                      className={[
                        s.calPill,
                        ev.kind === 'deadline' && ev.overdue
                          ? s.pillDeadlineOverdue
                          : KIND_PILL_CLASS[ev.kind],
                      ].join(' ')}
                      title={ev.title}
                    >
                      {KIND_ICON[ev.kind]} {ev.title}
                    </div>
                  ))}

                  {hiddenCount > 0 && (
                    <div className={s.calMore}>+{hiddenCount} ещё</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Панель выбранного дня */}
      <DayPanel date={selected} events={selectedEvents} />
    </div>
  )
}
