/**
 * meApi — данные текущего пользователя из Gamification Service.
 *
 * Эндпоинт: GET /api/v1/profile/{userId}
 * Бэкенд считает прогрессию по формуле: XP_для_уровня_N = 100 * N^1.5
 * (BASE_XP_PER_LEVEL=100, XP_LEVEL_MULTIPLIER=1.5 — см. config.py).
 *
 * Фронт НЕ дублирует эту формулу — все цифры берём из ответа бэкенда.
 */
import { api } from './axios'

/**
 * Заготовка под персонажа пользователя.
 * Бэкенд пока возвращает null — поля добавлены для бесшовного расширения
 * когда появится Character-сервис/модель.
 */
export interface CharacterStub {
  id: string
  name: string
  avatar_url: string | null
  /** Уровень персонажа (отдельная прогрессия от уровня игрока) */
  char_level: number
  /** XP персонажа внутри его текущего уровня */
  char_xp: number
  /** XP до следующего уровня персонажа */
  char_xp_to_next: number
}

export interface PlayerProfile {
  user_id: string
  username: string
  full_name: string | null

  // Прогрессия игрока — рассчитана бэкендом по формуле 100 * N^1.5
  total_xp: number
  level: number
  /** XP необходимо для завершения текущего уровня (т.е. порог следующего уровня) */
  xp_to_next_level: number
  /** Процент прогресса внутри текущего уровня (0–100) */
  xp_progress_percent: number
  total_coins: number

  // Статистика
  quests_completed: number
  quests_in_progress: number
  badges_count: number

  // Рейтинги
  rank_all_time: number | null
  rank_weekly: number | null

  /**
   * Стрик — количество дней активности подряд.
   * Бэкенд может не возвращать поле (старые версии) — поэтому optional.
   */
  streak_days?: number

  /**
   * Должность / роль игрока в организации.
   * Опциональное поле — появляется когда HR-интеграция настроена.
   */
  position?: string | null

  /**
   * Персонаж пользователя.
   * null пока Character-модель не реализована на бэкенде.
   * Когда появится — здесь будут полные данные без изменения контракта.
   */
  character: CharacterStub | null
}

export const meApi = {
  /** Профиль игрока с актуальным XP прямо из xp_transactions */
  getProfile: (userId: string) =>
    api.get<PlayerProfile>(`/profile/${userId}`).then(r => r.data),
}
