import { useState } from 'react'
import { useReviewStore, type QuestSubmission } from '../../store/reviewStore'
import styles from './AdminReviewPage.module.css'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function AdminReviewPage() {
  const { submissions, approveSubmission, rejectSubmission } = useReviewStore()
  const pending  = submissions.filter((s) => s.status === 'pending_review')
  const reviewed = submissions.filter((s) => s.status !== 'pending_review')

  const [rejectTarget, setRejectTarget] = useState<QuestSubmission | null>(null)
  const [rejectText, setRejectText]     = useState('')
  const [rejectErr, setRejectErr]       = useState(false)
  const [tab, setTab]                   = useState<'pending' | 'history'>('pending')

  function handleReject() {
    if (!rejectText.trim()) { setRejectErr(true); return }
    rejectSubmission(rejectTarget!.id, rejectText.trim())
    setRejectTarget(null)
    setRejectText('')
    setRejectErr(false)
  }

  const list = tab === 'pending' ? pending : reviewed

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>🔍 Проверка квестов</h1>
        <p className={styles.sub}>Квесты сотрудников, ожидающие подтверждения</p>
      </header>

      <div className={styles.tabs}>
        <button
          className={[styles.tab, tab === 'pending' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('pending')}
        >
          ⏳ На проверке
          {pending.length > 0 && <span className={styles.badge}>{pending.length}</span>}
        </button>
        <button
          className={[styles.tab, tab === 'history' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('history')}
        >
          📋 История
        </button>
      </div>

      {list.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>{tab === 'pending' ? '🎉' : '📭'}</span>
          <p>{tab === 'pending' ? 'Нет квестов на проверке — все задания проверены!' : 'История пуста'}</p>
        </div>
      )}

      <div className={styles.list}>
        {list.map((sub) => (
          <div key={sub.id} className={[
            styles.card,
            sub.status === 'approved' ? styles.cardApproved : '',
            sub.status === 'rejected' ? styles.cardRejected : '',
          ].join(' ')}>
            <div className={styles.cardTop}>
              <div className={styles.questIcon}>{sub.questIcon}</div>
              <div className={styles.questInfo}>
                <span className={styles.questTitle}>{sub.questTitle}</span>
                <span className={styles.questMeta}>
                  +{sub.xpReward} XP · +{sub.coinsReward} 🪙
                  {sub.classXpBonus > 1 && (
                    <span className={styles.bonus}>
                      &nbsp;({sub.authorClass}: ×{sub.classXpBonus} XP → +{Math.round(sub.xpReward * sub.classXpBonus)} XP)
                    </span>
                  )}
                </span>
              </div>
              <StatusBadge status={sub.status} />
            </div>

            <div className={styles.authorRow}>
              <div className={styles.avatar}>
                {sub.authorAvatar
                  ? <img src={sub.authorAvatar} alt={sub.authorName} />
                  : <span>{sub.authorName.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div>
                <span className={styles.authorName}>{sub.authorName}</span>
                <span className={styles.authorMeta}>Ур. {sub.authorLevel} · {sub.authorClass}</span>
              </div>
              <span className={styles.date}>{fmtDate(sub.submittedAt)}</span>
            </div>

            {sub.submissionComment && (
              <blockquote className={styles.comment}>
                💬 &laquo;{sub.submissionComment}&raquo;
              </blockquote>
            )}

            {sub.status === 'rejected' && sub.reviewComment && (
              <div className={styles.rejectNote}>
                ❌ Причина: {sub.reviewComment}
              </div>
            )}

            {sub.status === 'approved' && (
              <div className={styles.approveNote}>
                ✅ Одобрено · Начислено {sub.awardedXp} XP + {sub.awardedCoins} 🪙
              </div>
            )}

            {sub.status === 'pending_review' && (
              <div className={styles.actions}>
                <button
                  className={styles.btnApprove}
                  onClick={() => approveSubmission(sub.id)}
                >
                  ✅ Одобрить
                </button>
                <button
                  className={styles.btnReject}
                  onClick={() => { setRejectTarget(sub); setRejectText(''); setRejectErr(false) }}
                >
                  ❌ Отклонить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Модалка отклонения */}
      {rejectTarget && (
        <div className={styles.overlay} onClick={() => setRejectTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Отклонить квест</h2>
            <p className={styles.modalSub}>
              «{rejectTarget.questTitle}» — {rejectTarget.authorName}
            </p>
            <label className={styles.label}>Причина отклонения *</label>
            <textarea
              className={[styles.textarea, rejectErr ? styles.inputError : ''].join(' ')}
              rows={4}
              placeholder="Опишите, что нужно исправить или доделать…"
              value={rejectText}
              onChange={(e) => { setRejectText(e.target.value); setRejectErr(false) }}
            />
            {rejectErr && <span className={styles.errMsg}>Укажите причину отклонения</span>}
            <div className={styles.modalActions}>
              <button className={styles.btnApprove} onClick={handleReject}>Отклонить</button>
              <button className={styles.btnCancel} onClick={() => setRejectTarget(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: QuestSubmission['status'] }) {
  const map = {
    pending_review: { label: '⏳ На проверке', cls: 'badgePending' },
    approved:       { label: '✅ Одобрено',    cls: 'badgeApproved' },
    rejected:       { label: '❌ Отклонено',   cls: 'badgeRejected' },
  } as const
  const { label, cls } = map[status]
  return <span className={[styles.statusBadge, styles[cls]].join(' ')}>{label}</span>
}
