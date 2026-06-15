/**
 * meApi — данные текущего пользователя из Gamification Service.
 *
 * Эндпоинт: GET /api/v1/profile/{userId}
 * Бэкенд считает прогрессию по формуле: XP_для_уровня_N = 100 * N^1.5
 * (BASE_XP_PER_LEVEL=100, XP_LEVEL_MULTIPLIER=1.5 — см. config.py).
 *
 * Фронт НЕ дублирует эту формулу — все цифры берём из ответа бэкенда.
 *
 * Источник истины:
 * - монеты (total_coins), имя (full_name) и аватар (avatar_url) бэкенд
 *   читает напрямую из таблицы public.users auth-service, поэтому они
 *   совпадают со значениями в сайдбаре — никакого рассинхрона.
 */
import { api } from './axios'

// ────── Персонаж ──────

export type CharacterTypeSlug = 'warrior' | 'mage' | 'rogue' | 'engineer'

export interface CharacterType {
  id: string
  slug: CharacterTypeSlug
  name: string
  description: string | null
  icon_url: string | null
  coin_multiplier_base: number
  xp_multiplier_base: number
  bonus_description: string | null
}

export interface CharacterEquipmentItem {
  id: string
  slot: string
  color: string | null
  equipped_at: string
  cosmetic_item: {
    id: string
    name: string
    slug: string
    preview_url: string | null
    slot: string
    rarity: string
  }
}

export interface Character {
  id: string
  user_id: string
  level: number
  experience: number
  coin_multiplier: number
  xp_multiplier: number
  skin_color: string | null
  hair_color: string | null
  eyes_color: string | null
  created_at: string
  updated_at: string
  character_type: CharacterType
  equipment: CharacterEquipmentItem[]
}

export interface PlayerProfile {
  user_id: string
  username: string
  full_name: string | null
  /** URL аватара пользователя (из public.users) — null если не задан */
  avatar_url: string | null

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
   * null пока пользователь не создал персонажа.
   * Эндпоинт /character/me и /character/types дают полный CRUD.
   */
  character: Character | null
}

export const meApi = {
  /** Профиль игрока с актуальным XP/монетами/именем/аватаром */
  getProfile: (userId: string) =>
    api.get<PlayerProfile>(`/profile/${userId}`).then(r => r.data),

  /** Список доступных архетипов персонажа (публичный) */
  getCharacterTypes: () =>
    api.get<CharacterType[]>('/character/types').then(r => r.data),

  /** Персонаж текущего пользователя (404 если ещё не создан) */
  getMyCharacter: (signal?: AbortSignal) =>
    api.get<Character>('/character/me', { signal }).then(r => r.data),

  /** Создать персонажа выбранного архетипа */
  createCharacter: (payload: {
    character_type_slug: CharacterTypeSlug
    skin_color?: string
    hair_color?: string
    eyes_color?: string
  }) => api.post<Character>('/character/create', payload).then(r => r.data),
}
