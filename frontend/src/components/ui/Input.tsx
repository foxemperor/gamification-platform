import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react'
import styles from './Input.module.css'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Pass a Feather SVG icon component, e.g. <IconMail /> */
  iconNode?: ReactNode
  /** @deprecated use iconNode instead */
  icon?: string
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, iconNode, rightSlot, ...rest }, ref) => {
    const hasIcon = !!iconNode || !!icon
    return (
      <div className={styles.field}>
        {label && <label className={styles.label}>{label}</label>}
        <div className={styles.wrap}>
          {iconNode && <span className={styles.iconSvg}>{iconNode}</span>}
          {!iconNode && icon && <span className={styles.icon}>{icon}</span>}
          <input
            ref={ref}
            className={[
              styles.input,
              hasIcon   ? styles.withIcon : '',
              error     ? styles.err      : '',
            ].join(' ')}
            {...rest}
          />
          {rightSlot && <div className={styles.right}>{rightSlot}</div>}
        </div>
        {error && <p className={styles.errMsg}>{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
