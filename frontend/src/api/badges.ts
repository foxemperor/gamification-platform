/**
 * badgesApi — достижения (бейджи) из Gamification Service.
 *
 * Источник истины — бэкенд:
 *   GET /api/v1/badges      — полный каталог бейджей (условия разблокировки)
 *   GET /api/v1/badges/my   — бейджи, уже полученные текущим пользователем
 *
 * Фронт НЕ хранит локальный «фейковый» каталог достижений и НЕ считает
 * разблокировку по индексу. Открытым считается ровно тот бейдж, чей id
 * присутствует в /badges/my. Для закрытых показываем реальное условие
 * (condition_type + condition_value).
 */
import { api } from './axios'

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'

/** Тип условия разблокировки — совпадает с _check_badges в quests.py */
export type BadgeConditionType = 'quests_completed' | 'xp_reached' | string

export interface Badge {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  rarity: BadgeRarity
  /** Чем измеряется условие: число выполненных квестов или набранный XP */
  condition_type: BadgeConditionType | null
  /** Порог для разблокировки (квестов / XP) */
  condition_value: number | null
  /** Бонус XP, начисляемый при получении бейджа */
  xp_bonus: number
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  earned_at: string
  is_new: boolean
  badge: Badge
}

export const badgesApi = {
  /** Полный каталог бейджей с условиями разблокировки (публичный) */
  getCatalog: (signal?: AbortSignal) =>
    api.get<Badge[]>('/badges', { signal }).then(r => r.data),

  /** Бейджи, полученные текущим пользователем (UserBadge[]) */
  getMine: (signal?: AbortSignal) =>
    api.get<UserBadge[]>('/badges/my', { signal }).then(r => r.data),

  /**
   * Алиас getMine, который возвращает Badge[] (разворачивает UserBadge → Badge).
   * Используется в OverviewPage для построения earnedIds.
   */
  getMy: (signal?: AbortSignal): Promise<Badge[]> =>
    api
      .get<UserBadge[]>('/badges/my', { signal })
      .then(r => r.data.map((ub: UserBadge) => ub.badge)),
}

// ────── Утилиты отображения ──────

/** Человекочитаемая подпись условия разблокировки */
export function describeBadgeCondition(b: Badge): string {
  if (b.condition_type === 'quests_completed' && b.condition_value != null) {
    return `Выполни ${b.condition_value} ${pluralQuests(b.condition_value)}`
  }
  if (b.condition_type === 'xp_reached' && b.condition_value != null) {
    return `Набери ${b.condition_value.toLocaleString('ru-RU')} XP`
  }
  return b.description ?? 'Особое условие'
}

/** Текущий прогресс пользователя к условию бейджа (value / max) */
export function badgeProgress(
  b: Badge,
  stats: { quests_completed: number; total_xp: number },
): { value: number; max: number } | null {
  if (b.condition_type === 'quests_completed' && b.condition_value != null) {
    return { value: Math.min(stats.quests_completed, b.condition_value), max: b.condition_value }
  }
  if (b.condition_type === 'xp_reached' && b.condition_value != null) {
    return { value: Math.min(stats.total_xp, b.condition_value), max: b.condition_value }
  }
  return null
}

function pluralQuests(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'квест'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'квеста'
  return 'квестов'
}

/** Иконка по редкости — единый визуальный язык для всех бейджей */
export const RARITY_RING: Record<BadgeRarity, string> = {
  common: '#64748b',
  rare: '#22d3ee',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
}

/** Эмоджи-иконка по типу/редкости бейджа (бэкенд хранит icon_url опционально) */
export function badgeIcon(b: Badge): string {
  if (b.icon_url && b.icon_url.trim()) return b.icon_url
  if (b.condition_type === 'xp_reached') return '🔮'
  // quests_completed — по порогу
  const v = b.condition_value ?? 0
  if (v >= 50) return '👑'
  if (v >= 20) return '🏆'
  if (v >= 5) return '⭐'
  return '🎯'
}
