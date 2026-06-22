/**
 * Тесты для фиксов маршрутизации admin router (сессия 3):
 * - Admin quests/badges/xp должны идти в gamification-service
 * - _GAMIFICATION_PATHS включает quests, badges, xp, system-metrics
 *
 * Bug #4: admin/quests → 404 (шло в auth-service)
 * Bug #5: admin/badges → 404 (шло в auth-service)
 * Bug #6: admin/xp/transactions → 404 (шло в auth-service)
 */

import { describe, it, expect } from 'vitest'

// ── Симулируем логику маршрутизации из api-gateway/admin.py ──────────────
const GAMIFICATION_PATHS = new Set(['system-metrics', 'quests', 'badges', 'xp'])
const AUTH_SERVICE_URL = 'http://auth-service:8001'
const GAMIFICATION_SERVICE_URL = 'http://gamification-service:8002'

function resolveUpstream(
  path: string,
  method: string
): { service: string; url: string } {
  const firstSegment = path.split('/')[0] ?? ''

  // Специальный случай: users/xp-bulk POST → gamification
  if (path === 'users/xp-bulk' && method === 'POST') {
    return {
      service: 'gamification',
      url: `${GAMIFICATION_SERVICE_URL}/api/v1/admin/users/xp-bulk`,
    }
  }

  // GET users → auth (с обогащением XP)
  if (path === 'users' && method === 'GET') {
    return {
      service: 'auth',
      url: `${AUTH_SERVICE_URL}/api/v1/admin/users`,
    }
  }

  // quests/badges/xp/system-metrics → gamification
  if (GAMIFICATION_PATHS.has(firstSegment)) {
    return {
      service: 'gamification',
      url: `${GAMIFICATION_SERVICE_URL}/api/v1/admin/${path}`,
    }
  }

  // всё остальное → auth
  return {
    service: 'auth',
    url: path
      ? `${AUTH_SERVICE_URL}/api/v1/admin/${path}`
      : `${AUTH_SERVICE_URL}/api/v1/admin`,
  }
}

// ─────────────────────────────────────────────────────────────────
// Bug #4: Admin Quests → gamification-service
// ─────────────────────────────────────────────────────────────────

describe('Admin Router: Quests → gamification-service', () => {
  it('GET admin/quests → gamification', () => {
    const result = resolveUpstream('quests', 'GET')
    expect(result.service).toBe('gamification')
    expect(result.url).toContain('gamification-service')
  })

  it('POST admin/quests → gamification', () => {
    const result = resolveUpstream('quests', 'POST')
    expect(result.service).toBe('gamification')
  })

  it('PATCH admin/quests/{id} → gamification', () => {
    const result = resolveUpstream('quests/some-uuid-here', 'PATCH')
    expect(result.service).toBe('gamification')
    expect(result.url).toContain('gamification-service')
  })

  it('DELETE admin/quests/{id} → gamification', () => {
    const result = resolveUpstream('quests/some-uuid-here', 'DELETE')
    expect(result.service).toBe('gamification')
  })

  it('GET admin/quests НЕ идёт в auth-service (Bug #4 fix)', () => {
    const result = resolveUpstream('quests', 'GET')
    expect(result.url).not.toContain('auth-service')
  })
})

// ─────────────────────────────────────────────────────────────────
// Bug #5: Admin Badges → gamification-service
// ─────────────────────────────────────────────────────────────────

describe('Admin Router: Badges → gamification-service', () => {
  it('GET admin/badges → gamification', () => {
    const result = resolveUpstream('badges', 'GET')
    expect(result.service).toBe('gamification')
    expect(result.url).toContain('gamification-service')
  })

  it('POST admin/badges → gamification', () => {
    const result = resolveUpstream('badges', 'POST')
    expect(result.service).toBe('gamification')
  })

  it('PATCH admin/badges/{id} → gamification', () => {
    const result = resolveUpstream('badges/badge-id-123', 'PATCH')
    expect(result.service).toBe('gamification')
  })

  it('GET admin/badges НЕ идёт в auth-service (Bug #5 fix)', () => {
    const result = resolveUpstream('badges', 'GET')
    expect(result.url).not.toContain('auth-service')
  })
})

// ─────────────────────────────────────────────────────────────────
// Bug #6: Admin XP → gamification-service
// ─────────────────────────────────────────────────────────────────

describe('Admin Router: XP → gamification-service', () => {
  it('GET admin/xp/transactions → gamification', () => {
    const result = resolveUpstream('xp/transactions', 'GET')
    expect(result.service).toBe('gamification')
    expect(result.url).toContain('gamification-service')
    expect(result.url).toContain('xp/transactions')
  })

  it('POST admin/xp/grant → gamification', () => {
    const result = resolveUpstream('xp/grant', 'POST')
    expect(result.service).toBe('gamification')
  })

  it('GET admin/xp/transactions НЕ идёт в auth-service (Bug #6 fix)', () => {
    const result = resolveUpstream('xp/transactions', 'GET')
    expect(result.url).not.toContain('auth-service')
  })
})

// ─────────────────────────────────────────────────────────────────
// users/xp-bulk → gamification-service (специальный случай)
// ─────────────────────────────────────────────────────────────────

describe('Admin Router: users/xp-bulk → gamification-service', () => {
  it('POST admin/users/xp-bulk → gamification (не auth)', () => {
    const result = resolveUpstream('users/xp-bulk', 'POST')
    expect(result.service).toBe('gamification')
    expect(result.url).toContain('gamification-service')
    expect(result.url).toContain('xp-bulk')
  })

  it('GET admin/users → auth (с XP enrichment)', () => {
    const result = resolveUpstream('users', 'GET')
    expect(result.service).toBe('auth')
    expect(result.url).toContain('auth-service')
  })

  it('PATCH admin/users/{id} → auth', () => {
    const result = resolveUpstream('users/some-user-id', 'PATCH')
    expect(result.service).toBe('auth')
  })

  it('DELETE admin/users/{id} → auth', () => {
    const result = resolveUpstream('users/some-user-id', 'DELETE')
    expect(result.service).toBe('auth')
  })
})

// ─────────────────────────────────────────────────────────────────
// system-metrics → gamification-service (старое поведение сохранено)
// ─────────────────────────────────────────────────────────────────

describe('Admin Router: system-metrics → gamification-service', () => {
  it('GET admin/system-metrics → gamification (как было)', () => {
    const result = resolveUpstream('system-metrics', 'GET')
    expect(result.service).toBe('gamification')
    expect(result.url).toContain('gamification-service')
  })
})

// ─────────────────────────────────────────────────────────────────
// _GAMIFICATION_PATHS содержит все нужные first-segments
// ─────────────────────────────────────────────────────────────────

describe('_GAMIFICATION_PATHS — полнота набора', () => {
  it('включает quests (Bug #4)', () => {
    expect(GAMIFICATION_PATHS.has('quests')).toBe(true)
  })

  it('включает badges (Bug #5)', () => {
    expect(GAMIFICATION_PATHS.has('badges')).toBe(true)
  })

  it('включает xp (Bug #6)', () => {
    expect(GAMIFICATION_PATHS.has('xp')).toBe(true)
  })

  it('включает system-metrics (существующий)', () => {
    expect(GAMIFICATION_PATHS.has('system-metrics')).toBe(true)
  })

  it('НЕ включает users (users → auth-service)', () => {
    expect(GAMIFICATION_PATHS.has('users')).toBe(false)
  })
})
