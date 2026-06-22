/**
 * SidebarXP — полоска XP и уровень в сайдбаре.
 *
 * Источник истины: GET /api/v1/profile/{userId} (gamification-service).
 * Формула прогрессии на бэкенде: XP_для_уровня_N = 100 * N^1.5
 * Фронт не дублирует эту формулу — все цифры берём из profile.
 *
 * Обновление:
 *   - каждые 30 секунд (refetchInterval)
 *   - мгновенно после гранта XP из AdminXPPage (инвалидация queryKey)
 *
 * Fallback при недоступности gamification-service:
 *   - показываем «—» вместо некорректных цифр из authStore
 *     (лучше явный прочерк, чем тихое отображение устаревших данных)
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { meApi } from '../../api/me'
import styles from './SidebarXP.module.css'

interface Props { mini: boolean }

export function SidebarXP({ mini }: Props) {
  const user = useAuthStore(s => s.user)

  const { data: profile, isError } = useQuery({
    queryKey: ['xp-profile', user?.id],
    queryFn: () => meApi.getProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 1,
  })

  // Все цифры — строго из бэкенда. Никакой локальной арифметики.
  // xp_progress_percent и xp_to_next_level рассчитаны по формуле 100*N^1.5.
  const level   = profile?.level
  const current = profile ? Math.round(profile.xp_progress_percent / 100 * profile.xp_to_next_level) : null
  const required = profile?.xp_to_next_level ?? null
  const pct     = profile ? Math.min(100, Math.round(profile.xp_progress_percent)) : 0

  // Персонаж: показываем имя в mini-режиме если уже есть
  const charName = profile?.character?.character_type?.name ?? null

  const formatXp = (n: number | null) =>
    n === null ? '—' : n.toLocaleString('ru')

  return (
    <div className={styles.wrap}>
      {!mini && (
        <div className={styles.head}>
          <span className={styles.lvl}>
            {level !== undefined ? `Уровень ${level}` : '—'}
            {charName && <span className={styles.charName}> · {charName}</span>}
          </span>
          <span className={styles.xp}>
            {isError
              ? <span className={styles.error}>Нет данных</span>
              : <>{formatXp(current)} / {formatXp(required)} XP</>
            }
          </span>
        </div>
      )}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%` }}
          title={`${pct}%`}
        />
      </div>
    </div>
  )
}
