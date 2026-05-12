/**
 * meApi — данные текущего пользователя из Gamification Service.
 * Используем GET /api/v1/profile/{userId} — эндпоинт уже реализован
 * в gamification-service/app/routers/quests.py и считает XP по транзакциям.
 */
import { api } from './axios'

export interface PlayerProfile {
  user_id: string
  username: string
  full_name: string | null
  total_xp: number
  level: number
  xp_to_next_level: number
  xp_progress_percent: number
  total_coins: number
  quests_completed: number
  quests_in_progress: number
  badges_count: number
}

export const meApi = {
  /** Профиль игрока с актуальным XP прямо из xp_transactions */
  getProfile: (userId: string) =>
    api.get<PlayerProfile>(`/profile/${userId}`).then(r => r.data),
}
