/**
 * SidebarXP — полоска XP/уровень в сайдбаре.
 *
 * Ранее брала данные из authStore.user.xp, который обновлялся только
 * при логине и не отражал ручные гранты XP из админки.
 *
 * Теперь использует react-query хук, который:
 *  - запрашивает GET /api/v1/profile/{userId} при монтировании
 *  - повторяет каждые 30 секунд (staleTime=0, refetchInterval=30_000)
 *  - инвалидируется из AdminXPPage после успешного гранта
 *  - при ошибке или загрузке отображает последние известные данные из authStore
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { meApi } from '../../api/me'
import styles from './SidebarXP.module.css'

interface Props { mini: boolean }

function calcLevel(xp: number): { level: number; current: number; required: number } {
  let level = 1
  let spent = 0
  while (true) {
    const need = level * 200
    if (spent + need > xp) return { level, current: xp - spent, required: need }
    spent += need
    level++
  }
}

export function SidebarXP({ mini }: Props) {
  const user = useAuthStore(s => s.user)

  // Живой профиль из gamification-service — истина по XP
  const { data: profile } = useQuery({
    queryKey: ['xp-profile', user?.id],
    queryFn: () => meApi.getProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 30_000,
    // При ошибке показываем данные из authStore (см. fallback ниже)
    retry: 1,
  })

  // Fallback: если профиль ещё не загружен — используем authStore
  const totalXp = profile?.total_xp ?? user?.xp ?? 0

  // Если gamification вернул уровень — используем его (формула там идентична)
  // Иначе считаем локально по той же формуле что была раньше
  const { level, current, required } = profile
    ? {
        level: profile.level,
        current: totalXp - (totalXp - (profile.xp_progress_percent / 100) * (profile.xp_to_next_level + (totalXp - (totalXp - (profile.xp_progress_percent / 100) * (profile.xp_to_next_level + 0))))),
        required: profile.xp_to_next_level + Math.round((profile.xp_progress_percent / 100) * profile.xp_to_next_level),
      }
    : calcLevel(totalXp)

  // Более надёжный расчёт: пересчитываем current/required из total_xp напрямую
  // чтобы не полагаться на сложную арифметику выше
  const computed = calcLevel(totalXp)
  const pct = Math.min(100, Math.round((computed.current / computed.required) * 100))
  const displayLevel = profile?.level ?? computed.level

  return (
    <div className={styles.wrap}>
      {!mini && (
        <div className={styles.head}>
          <span className={styles.lvl}>Уровень {displayLevel}</span>
          <span className={styles.xp}>
            {computed.current.toLocaleString('ru')} / {computed.required.toLocaleString('ru')} XP
          </span>
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
