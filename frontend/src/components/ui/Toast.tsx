import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

export type ToastVariant = 'info' | 'warning' | 'success' | 'error'

export interface ToastItem {
  id:      number
  message: string
  variant: ToastVariant
}

interface Props {
  toasts:  ToastItem[]
  onClose: (id: number) => void
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  // Trigger enter animation on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const icons: Record<ToastVariant, string> = {
    info:    'ℹ️',
    warning: '⚠️',
    success: '✅',
    error:   '❌',
  }

  return (
    <div
      className={`${styles.toast} ${styles[toast.variant]} ${visible ? styles.visible : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon}>{icons[toast.variant]}</span>
      <span className={styles.msg}>{toast.message}</span>
      <button className={styles.close} onClick={onClose} aria-label="Закрыть">×</button>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  )
}
