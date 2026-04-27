import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'accent' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, children, disabled, ...rest }: Props) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  )
}
