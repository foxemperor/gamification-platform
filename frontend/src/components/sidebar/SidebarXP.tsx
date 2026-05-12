/**
 * SidebarXP — полоска XP/уровень в сайдбаре.
 *
 * Источник данных: GET /api/v1/profile/{userId} (gamification-service).
 * Обновляется каждые 30 секунд и мгновенно после гранта XP из AdminXPPage
 * (AdminXPPage инвалидирует queryKey ['xp-profile'] после успешного мутейта).
 *
 * Fallback: если запрос ещё не завершён или упал — используем authStore.user.xp
 * (данные на момент последнего логина), чтобы полоска не исчезала.
 *
 * Формула уровней одинакова на фронте и бэкенде: level N требует N * 200 XP.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { meApi } from '../../api/me'
import styles from './SidebarXP.module.css'

interface Props { mini: boolean }

/**
 * Рассчитывает уровень и прогресс внутри уровня по суммарному XP.
 * Формула: уровень N стоит N * 200 XP (1→200, 2→400, 3→600, …).
 * Идентична логике в gamification-service/app/models.py::xp_required_for_level.
 */
function calcLevel(totalXp: number): { level: number; current: number; required: number } {
  let level = 1
  let spent = 0
  while (true) {
    const needed = level * 200
    if (spent + needed > totalXp) {
      return { level, current: totalXp - spent, required: needed }
    }
    spent += needed
    level++
  }
}

export function SidebarXP({ mini }: Props) {
  const user = useAuthStore(s => s.user)

  const { data: profile } = useQuery({
    queryKey: ['xp-profile', user?.id],
    queryFn: () => meApi.getProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 1,
  })

  // Авторитетный XP из gamification-service; при недоступности — из authStore
  const totalXp = profile?.total_xp ?? user?.xp ?? 0

  // Весь расчёт — через одну функцию, никаких дублирующих веток
  const { level: calcedLevel, current, required } = calcLevel(totalXp)

  // profile.level приоритетен: бэкенд — единственный источник истины об уровне.
  // Значения совпадут (та же формула), но при расхождении схем доверяем бэку.
  const displayLevel = profile?.level ?? calcedLevel

  const pct = Math.min(100, Math.round((current / required) * 100))

  return (
    <div className={styles.wrap}>
      {!mini && (
        <div className={styles.head}>
          <span className={styles.lvl}>Уровень {displayLevel}</span>
          <span className={styles.xp}>
            {current.toLocaleString('ru')} / {required.toLocaleString('ru')} XP
          </span>
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
