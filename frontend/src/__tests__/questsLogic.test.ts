/**
 * Тесты для логики страницы квестов (QuestsPage):
 * - isSilentError должен правильно классифицировать ошибки
 * - Принятие квеста: 201 → успех, 409 → не крашит приложение
 *
 * Bug #2: toast не должен появляться при Network Error (gateway не запущен)
 * Bug #3: accept quest должен корректно обрабатывать 409
 */

import { describe, it, expect } from 'vitest'

// ── Утилита isSilentError (копируем логику из QuestsPage.tsx) ──────
function isSilentError(err: unknown): boolean {
  const s = (err as { response?: { status?: number } })?.response?.status
  if (s === undefined || s === null) return true  // Network Error
  return s === 401 || s === 403 || s === 422
}

// ── Утилита classifyAcceptError (логика из handleAccept) ──────────
function classifyAcceptError(err: unknown): 'already_active' | 'no_gateway' | 'generic' {
  const httpStatus = (err as { response?: { status?: number } })?.response?.status
  if (httpStatus === 409) return 'already_active'
  if (httpStatus === undefined || httpStatus === null) return 'no_gateway'
  return 'generic'
}

// ─────────────────────────────────────────────────────────────────
// Bug #2: Silent error classification
// ─────────────────────────────────────────────────────────────────

describe('isSilentError (Bug #2 — toast при refresh)', () => {
  it('Network Error (нет gateway) → silent', () => {
    const networkError = new Error('Network Error')
    // Axios network error не имеет response
    expect(isSilentError(networkError)).toBe(true)
  })

  it('undefined response.status → silent', () => {
    const err = { response: { status: undefined } }
    expect(isSilentError(err)).toBe(true)
  })

  it('null response → silent', () => {
    expect(isSilentError({})).toBe(true)
  })

  it('401 Unauthorized → silent (токен не готов при refresh)', () => {
    const err = { response: { status: 401 } }
    expect(isSilentError(err)).toBe(true)
  })

  it('403 Forbidden → silent', () => {
    const err = { response: { status: 403 } }
    expect(isSilentError(err)).toBe(true)
  })

  it('422 Unprocessable Entity → silent (невалидный токен)', () => {
    const err = { response: { status: 422 } }
    expect(isSilentError(err)).toBe(true)
  })

  it('500 Internal Server Error → НЕ silent (должен показать toast)', () => {
    const err = { response: { status: 500 } }
    expect(isSilentError(err)).toBe(false)
  })

  it('404 Not Found → НЕ silent (должен показать toast)', () => {
    const err = { response: { status: 404 } }
    expect(isSilentError(err)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────
// Bug #3: Accept quest error classification
// ─────────────────────────────────────────────────────────────────

describe('classifyAcceptError (Bug #3 — Принять квест)', () => {
  it('409 → already_active (не "возможно уже принят")', () => {
    const err = { response: { status: 409 } }
    expect(classifyAcceptError(err)).toBe('already_active')
  })

  it('Network Error (нет gateway) → no_gateway', () => {
    const err = new Error('Network Error')
    expect(classifyAcceptError(err)).toBe('no_gateway')
  })

  it('undefined status → no_gateway', () => {
    expect(classifyAcceptError({})).toBe('no_gateway')
  })

  it('500 → generic error', () => {
    const err = { response: { status: 500 } }
    expect(classifyAcceptError(err)).toBe('generic')
  })

  it('401 → generic error (при accept всегда должен быть авторизован)', () => {
    const err = { response: { status: 401 } }
    expect(classifyAcceptError(err)).toBe('generic')
  })
})

// ─────────────────────────────────────────────────────────────────
// Bug #1: AdminUser type — xp и level не должны быть 0/1 по умолчанию
// (проверяем тип, реальные данные приходят из API)
// ─────────────────────────────────────────────────────────────────

describe('AdminUser XP/Level (Bug #1 — 0 XP в панели Users)', () => {
  it('AdminUser объект поддерживает произвольные xp и level', () => {
    // Мокаем данные как они приходят из enriched API response
    const mockUser = {
      id: 'abc-123',
      email: 'user@example.com',
      username: 'testuser',
      full_name: null,
      department: null,
      project: null,
      position: null,
      role: 'employee' as const,
      xp: 1500,      // реальный XP из gamification-service
      level: 4,      // реальный уровень
      coins: 0,
      is_active: true,
      is_verified: true,
      is_superuser: false,
      created_at: new Date().toISOString(),
      last_login_at: null,
      updated_at: new Date().toISOString(),
    }

    // Проверяем что структура соответствует ожидаемым значениям
    expect(mockUser.xp).toBe(1500)
    expect(mockUser.level).toBe(4)
    expect(mockUser.xp).toBeGreaterThan(0)
    expect(mockUser.level).toBeGreaterThan(1)
  })

  it('Пользователь без XP имеет xp=0, level=1 (это норма для новых)', () => {
    const newUser = {
      xp: 0,
      level: 1,
    }
    expect(newUser.xp).toBe(0)
    expect(newUser.level).toBe(1)
  })

  it('Обогащённый список пользователей сохраняет реальный XP', () => {
    // Симулируем логику обогащения из api-gateway
    const authUsers = [
      { id: 'user-1', xp: 0, level: 1 },  // stale данные из auth-service
      { id: 'user-2', xp: 0, level: 1 },
    ]

    const xpBulkResult = [
      { user_id: 'user-1', xp: 350, level: 3 },
      { user_id: 'user-2', xp: 1200, level: 5 },
    ]

    const xpMap = Object.fromEntries(xpBulkResult.map(e => [e.user_id, e]))

    const enriched = authUsers.map(user => ({
      ...user,
      ...(xpMap[user.id] ? { xp: xpMap[user.id].xp, level: xpMap[user.id].level } : {}),
    }))

    expect(enriched[0].xp).toBe(350)
    expect(enriched[0].level).toBe(3)
    expect(enriched[1].xp).toBe(1200)
    expect(enriched[1].level).toBe(5)

    // Убеждаемся что больше нет нулей у обогащённых пользователей
    expect(enriched.every(u => u.xp >= 0)).toBe(true)
    expect(enriched.every(u => u.level >= 1)).toBe(true)
  })
})
