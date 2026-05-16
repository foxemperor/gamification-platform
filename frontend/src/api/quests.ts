import axios from 'axios'
import { api } from './axios'

export type QuestType = 'personal' | 'team' | 'skill'
export type QuestDifficulty = 'easy' | 'medium' | 'hard'
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

  /** Квесты текущего пользователя */
  getMy: (signal?: AbortSignal) =>
    api.get<UserQuest[]>('/quests/my', { signal }).then(r => r.data),

  /** Принять квест */
  accept: (questId: string) =>
    api.post(`/quests/${questId}/accept`).then(r => r.data),

  /** Завершить квест */
  complete: (questId: string) =>
    api.post(`/quests/${questId}/complete`).then(r => r.data),
}

/**
 * Возвращает true если ошибка является отменой AbortController-а
 * (например в StrictMode при двойном монтировании)
 */
export function isAbortError(err: unknown): boolean {
  return axios.isCancel(err) || (err instanceof DOMException && err.name === 'AbortError')
}
