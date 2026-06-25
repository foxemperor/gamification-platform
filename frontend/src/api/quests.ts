import axios from 'axios'
import { api } from './axios'

export type QuestType = 'personal' | 'team' | 'skill' | 'daily' | 'integration'
export type QuestDifficulty = 'easy' | 'medium' | 'hard' | 'epic'
export type QuestStatus = 'active' | 'archived'
export type UserQuestStatus = 'in_progress' | 'completed' | 'failed'

export interface Quest {
  id: string
  title: string
  description: string | null
  quest_type: QuestType
  difficulty: QuestDifficulty
  status: QuestStatus
  xp_reward: number
  coins_reward: number
  time_limit_hours: number | null
  integration_trigger: string | null
  integration_target: number | null
  created_at: string
}

/**
 * Соответствует UserQuestResponse в gamification-service/app/schemas.py
 * Бэкенд возвращает вложенный объект quest, а не плоскую структуру.
 */
export interface UserQuest {
  id: string
  user_id: string
  quest_id: string
  status: UserQuestStatus
  progress: number
  target: number
  progress_percent: number
  /** Дата принятия квеста (в бэкенде поле называется started_at) */
  started_at: string
  completed_at: string | null
  deadline_at: string | null
  quest: Quest
}

export interface QuestsListResponse {
  items: Quest[]
  total: number
  page: number
  per_page: number
  pages: number
}

export const questsApi = {
  /** Все доступные квесты (пагинация + фильтры) */
  getAll: (
    params?: { page?: number; per_page?: number; quest_type?: string; difficulty?: string },
    signal?: AbortSignal,
  ) =>
    api.get<QuestsListResponse>('/quests', { params, signal }).then(r => r.data),

  /** Квест по ID (GET /quests/:id) — для диагностики и детальной страницы */
  getById: (questId: string, signal?: AbortSignal) =>
    api.get<Quest>(`/quests/${questId}`, { signal }).then(r => r.data),

  /**
   * Квесты текущего пользователя.
   * Первый аргумент — опциональный объект с фильтрами (status, limit),
   * либо AbortSignal для обратной совместимости.
   */
  getMy: (
    paramsOrSignal?: { status?: UserQuestStatus; limit?: number } | AbortSignal,
    signal?: AbortSignal,
  ) => {
    let params: Record<string, unknown> | undefined
    let sig: AbortSignal | undefined

    if (paramsOrSignal instanceof AbortSignal) {
      sig = paramsOrSignal
    } else if (paramsOrSignal) {
      params = paramsOrSignal as Record<string, unknown>
      sig = signal
    } else {
      sig = signal
    }

    return api
      .get<UserQuest[]>('/quests/my', { params, signal: sig })
      .then(r => r.data)
  },

  /** Принять квест */
  accept: (questId: string, signal?: AbortSignal) =>
    api.post(`/quests/${questId}/accept`, null, { signal }).then(r => r.data),

  /** Завершить квест */
  complete: (questId: string, signal?: AbortSignal) =>
    api.post(`/quests/${questId}/complete`, null, { signal }).then(r => r.data),
}

/**
 * Возвращает true если ошибка является отменой AbortController-а
 * (например в StrictMode при двойном монтировании)
 */
export function isAbortError(err: unknown): boolean {
  return axios.isCancel(err) || (err instanceof DOMException && err.name === 'AbortError')
}

/**
 * Классифицирует ошибку при принятии квеста (Bug #3)
 *
 * already_active — квест уже принят (409 Conflict)
 * no_gateway     — нет связи с gateway / токен не готов (сеть / 401 / 403 / 422)
 * generic        — неожиданная серверная ошибка (5xx, 404 и др.)
 */
export function classifyAcceptError(
  err: unknown,
): 'already_active' | 'no_gateway' | 'generic' {
  if (!err || typeof err !== 'object') return 'no_gateway'
  const e = err as Record<string, unknown>
  const status = (
    e?.response as Record<string, unknown> | undefined
  )?.status as number | undefined

  if (status === 409) return 'already_active'
  // Нет ответа вообще (Network Error, socket hang up) или токен не готов
  if (!status || status === 401 || status === 403 || status === 422) return 'no_gateway'
  return 'generic'
}
