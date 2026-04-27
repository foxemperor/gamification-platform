import { type InputHTMLAttributes, forwardRef } from 'react'
import styles from './Input.module.css'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: string
  rightSlot?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, rightSlot, ...rest }, ref) => (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.wrap}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          ref={ref}
          className={`${styles.input} ${icon ? styles.withIcon : ''} ${error ? styles.err : ''}`}
          {...rest}
        />
        {rightSlot && <div className={styles.right}>{rightSlot}</div>}
      </div>
      {error && <p className={styles.errMsg}>{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
