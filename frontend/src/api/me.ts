/**
 * meApi — данные текущего пользователя из Gamification Service.
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
  avatar_url: string | null
  bio: string | null
  birthday: string | null
  total_xp: number
  level: number
  xp_to_next_level: number
  xp_progress_percent: number
  total_coins: number
  quests_completed: number
  quests_in_progress: number
  badges_count: number
  rank_all_time: number | null
  rank_weekly: number | null
  streak_days?: number
  position?: string | null
  character: Character | null
}

// ────── Инвентарь ──────

export interface CosmeticCatalogItem {
  id: string
  name: string
  slug: string
  description: string | null
  preview_url: string | null
  slot: string
  rarity: string
  visibility: string
  unlock_type: string
  is_unlocked: boolean
  is_equipped: boolean
  unlock_requirement: string | null
}

export const meApi = {
  getProfile: (userId: string) =>
    api.get<PlayerProfile>(`/profile/${userId}`).then(r => r.data),

  getCharacterTypes: () =>
    api.get<CharacterType[]>('/character/types').then(r => r.data),

  getMyCharacter: (signal?: AbortSignal) =>
    api.get<Character>('/character/me', { signal }).then(r => r.data),

  createCharacter: (payload: {
    character_type_slug: CharacterTypeSlug
    skin_color?: string
    hair_color?: string
    eyes_color?: string
  }) => api.post<Character>('/character/create', payload).then(r => r.data),

  /** Обновить цвета персонажа (skin / hair / eyes). Все поля опциональны. */
  updateCharacterColors: (payload: {
    skin_color?: string
    hair_color?: string
    eyes_color?: string
  }) => api.patch<Character>('/character/me/colors', payload).then(r => r.data),

  getInventory: (signal?: AbortSignal) =>
    api.get<CosmeticCatalogItem[]>('/character/inventory', { signal }).then(r => r.data),

  equipItem: (payload: {
    slot: string
    cosmetic_item_id: string | null
    color?: string | null
  }) => api.patch<Character>('/character/equipment', payload).then(r => r.data),
}
