import { useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../../api/admin'
import type { AdminUser } from '../../api/admin'
import styles from './UserPicker.module.css'

export interface UserPickerProps {
  value: string
  onChange: (userId: string, user?: AdminUser) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

/**
 * Удобный поиск пользователя для админки: вводишь email/username/имя,
 * получаешь подсказки, выбираешь — в value подставляется UUID.
 * Если ввели полный UUID вручную — это тоже валидно.
 */
export function UserPicker({ value, onChange, placeholder, disabled, id }: UserPickerProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<AdminUser[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Search debounced
  useEffect(() => {
    if (!query || query.length < 2) {
      setItems([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await adminApi.listUsers(1, 10, query)
        if (!cancelled) setItems(r.data.items)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const showList = open && (loading || items.length > 0 || query.length >= 2)
  const hint = useMemo(() => {
    if (selected) return `${selected.username} · ${selected.email}`
    if (value && /^[0-9a-f-]{36}$/i.test(value)) return 'UUID введён вручную'
    return ''
  }, [selected, value])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        className={styles.input}
        value={query}
        placeholder={placeholder ?? 'Введите email, username или имя…'}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); setSelected(null) }}
        disabled={disabled}
        autoComplete="off"
      />

      {showList && (
        <div className={styles.list} role="listbox">
          {loading && <div className={styles.empty}>Поиск…</div>}
          {!loading && items.length === 0 && (
            <div className={styles.empty}>Никто не найден</div>
          )}
          {!loading && items.map(u => (
            <button
              key={u.id}
              type="button"
              className={styles.item}
              onClick={() => {
                onChange(u.id, u)
                setSelected(u)
                setQuery(`${u.username} (${u.email})`)
                setOpen(false)
              }}
              role="option"
            >
              <div className={styles.itemTop}>
                <span className={styles.itemName}>{u.full_name || u.username}</span>
                <span className={styles.itemRole}>{u.role}</span>
              </div>
              <div className={styles.itemMeta}>
                <span>{u.email}</span>
                <code className={styles.itemId}>{u.id}</code>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className={styles.hintRow}>
        <input
          className={styles.uuidInput}
          value={value}
          onChange={e => onChange(e.target.value.trim())}
          placeholder="UUID пользователя (заполняется автоматически)"
          disabled={disabled}
          spellCheck={false}
        />
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
    </div>
  )
}
