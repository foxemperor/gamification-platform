import { useAuthStore } from '../../store/authStore'
import styles from './SidebarXP.module.css'

interface Props { mini: boolean }

// Простая формула: каждый уровень требует level * 200 XP
function calcLevel(xp: number): { level: number; current: number; required: number } {
  let level = 1
  let spent = 0
  while (true) {
    const need = level * 200
    if (spent + need > xp) {
      return { level, current: xp - spent, required: need }
    }
    spent += need
    level++
  }
}

export function SidebarXP({ mini }: Props) {
  const user = useAuthStore(s => s.user)
  const totalXp = user?.xp ?? 0
  const { level, current, required } = calcLevel(totalXp)
  const pct = Math.min(100, Math.round((current / required) * 100))

  return (
    <div className={styles.wrap}>
      {!mini && (
        <div className={styles.head}>
          <span className={styles.lvl}>Уровень {level}</span>
          <span className={styles.xp}>{current.toLocaleString('ru')} / {required.toLocaleString('ru')} XP</span>
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
