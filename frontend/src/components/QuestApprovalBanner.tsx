/**
 * Большой тоаст-баннер «Квест одобрен» — появляется при входе пользователя
 * если в reviewStore есть pendingApprovalBanner для его userId.
 * Показывается поверх всего, занимает нижнюю треть экрана.
 */
import { useEffect } from 'react'
import { useReviewStore } from '../store/reviewStore'
import { useAuthStore }   from '../store/authStore'
import styles from './QuestApprovalBanner.module.css'

export function QuestApprovalBanner() {
  const banner   = useReviewStore((s) => s.pendingApprovalBanner)
  const clearBanner = useReviewStore((s) => s.clearBanner)
  const updateUser  = useAuthStore((s) => s.updateUser)
  const user        = useAuthStore((s) => s.user)

  // Начисляем XP и монеты единоразово при появлении баннера
  useEffect(() => {
    if (!banner || !user) return
    if (banner.authorId !== user.id) return
    updateUser({
      xp:    user.xp    + (banner.awardedXp    ?? 0),
      coins: user.coins + (banner.awardedCoins ?? 0),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner?.id])

  if (!banner) return null
  if (banner.authorId !== user?.id) return null

  return (
    <div className={styles.backdrop}>
      <div className={styles.banner}>
        <div className={styles.confettiRow}>
          {'🎉🏆✨🎊⭐🌟'.split('').map((e, i) => (
            <span key={i} className={styles.confetti} style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>
          ))}
        </div>

        <div className={styles.questIcon}>{banner.questIcon}</div>

        <h2 className={styles.headline}>Квест одобрен!</h2>
        <p className={styles.questName}>«{banner.questTitle}»</p>

        <div className={styles.rewards}>
          <div className={styles.rewardChip}>
            <span className={styles.rewardIcon}>⚡</span>
            <span className={styles.rewardVal}>+{banner.awardedXp} XP</span>
            {banner.classXpBonus > 1 && (
              <span className={styles.rewardBonus}>
                (бонус {banner.authorClass} ×{banner.classXpBonus})
              </span>
            )}
          </div>
          <div className={styles.rewardChip}>
            <span className={styles.rewardIcon}>🪙</span>
            <span className={styles.rewardVal}>+{banner.awardedCoins} монет</span>
          </div>
        </div>

        <p className={styles.sub}>Награда зачислена на ваш аккаунт</p>

        <button className={styles.btn} onClick={clearBanner}>Отлично! 🎮</button>
      </div>
    </div>
  )
}
