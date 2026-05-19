import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/admin'
import type { AdminUser, AdminUserCreate, AdminUserUpdate } from '../../api/admin'
import { useAppToast } from '../../App'
import styles from './AdminUsersPage.module.css'

const ROLES = ['employee', 'manager', 'admin'] as const

// ── Валидация ────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/

function getPasswordStrength(p: string): number {
  if (!p) return 0
  let s = 0
  if (p.length >= 8)   s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^\w]/.test(p)) s++
  return s
}

const STRENGTH_COLORS = ['#EF4444', '#F59E0B', '#22D3EE', '#10B981']
const STRENGTH_LABELS = ['Очень слабый', 'Слабый', 'Хороший', 'Надёжный']

export function AdminUsersPage() {
  const toast = useAppToast()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminApi.listUsers(page, 20, search).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserUpdate }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => { toast('Пользователь обновлён', 'success'); invalidate(); setModal(null) },
    onError: () => toast('Ошибка при обновлении', 'error'),
  })

  const createMutation = useMutation({
    mutationFn: (data: AdminUserCreate) => adminApi.createUser(data),
    onSuccess: () => { toast('Пользователь создан', 'success'); invalidate(); setModal(null) },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(typeof detail === 'string' ? detail : 'Ошибка при создании', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => { toast('Пользователь удалён', 'success'); invalidate() },
    onError: () => toast('Нельзя удалить этого пользователя', 'error'),
  })

  const handleSearch = () => { setPage(1); setSearch(searchInput) }

  const knownDepartments = useMemo(
    () => Array.from(new Set((data?.items ?? []).map(u => u.department).filter(Boolean) as string[])).sort(),
    [data]
  )
  const knownProjects = useMemo(
    () => Array.from(new Set((data?.items ?? []).map(u => u.project).filter(Boolean) as string[])).sort(),
    [data]
  )

  const copyId = (id: string) => {
    try {
      navigator.clipboard?.writeText(id)
      toast('User ID скопирован в буфер обмена', 'success')
    } catch {
      toast('Не удалось скопировать ID', 'error')
    }
  }

  const openEdit = useCallback((user: AdminUser) => {
    setSelected(user)
    setModal('edit')
  }, [])

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Пользователи</h1>
        <button className={styles.btnPrimary} onClick={() => setModal('create')}>
          + Добавить
        </button>
      </div>

      {/* Поиск */}
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="Поиск по email или username..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={styles.btnSecondary} onClick={handleSearch}>Найти</button>
        {search && (
          <button className={styles.btnGhost} onClick={() => { setSearch(''); setSearchInput('') }}>
            Сбросить
          </button>
        )}
      </div>

      {/* Таблица */}
      {isLoading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>ID</th>
                  <th>Роль</th>
                  <th>Отдел</th>
                  <th>Проект</th>
                  <th>XP / Ур.</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <span className={styles.avatar}>
                          {(user.full_name || user.username).charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <div className={styles.userName}>{user.full_name || user.username}</div>
                          <div className={styles.userEmail}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.idCell}
                        title={`Скопировать ID: ${user.id}`}
                        onClick={() => copyId(user.id)}
                      >
                        <code>{user.id.slice(0, 8)}…</code>
                        <span className={styles.copyHint}>📋</span>
                      </button>
                    </td>
                    <td><RoleBadge role={user.role} /></td>
                    <td><span className={styles.muted}>{user.department || '—'}</span></td>
                    <td><span className={styles.muted}>{user.project || '—'}</span></td>
                    <td>
                      <span className={styles.xp}>{user.xp} XP</span>
                      <span className={styles.level}>Ур. {user.level}</span>
                    </td>
                    <td><StatusBadge active={user.is_active} /></td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.btnIcon}
                          title="Редактировать"
                          onClick={() => openEdit(user)}
                        >✏️</button>
                        <button
                          className={styles.btnIcon}
                          title={user.is_active ? 'Деактивировать' : 'Активировать'}
                          onClick={() => updateMutation.mutate({
                            id: user.id,
                            data: { is_active: !user.is_active },
                          })}
                        >{user.is_active ? '🔒' : '🔓'}</button>
                        {!user.is_superuser && (
                          <button
                            className={`${styles.btnIcon} ${styles.btnDanger}`}
                            title="Удалить"
                            onClick={() => {
                              if (confirm(`Удалить ${user.username}?`))
                                deleteMutation.mutate(user.id)
                            }}
                          >🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          <div className={styles.pagination}>
            <button
              className={styles.btnSecondary}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >← Назад</button>
            <span className={styles.pageInfo}>
              Стр. {page} из {totalPages} · всего {data?.total ?? 0}
            </span>
            <button
              className={styles.btnSecondary}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >Вперёд →</button>
          </div>
        </>
      )}

      {modal === 'edit' && selected && (
        <UserModal
          mode="edit"
          initial={selected}
          knownDepartments={knownDepartments}
          knownProjects={knownProjects}
          onClose={() => setModal(null)}
          onSubmit={(data) => updateMutation.mutate({ id: selected.id, data })}
          loading={updateMutation.isPending}
        />
      )}

      {modal === 'create' && (
        <UserModal
          mode="create"
          knownDepartments={knownDepartments}
          knownProjects={knownProjects}
          onClose={() => setModal(null)}
          onSubmit={(data) => createMutation.mutate(data as AdminUserCreate)}
          loading={createMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Вспомогательные компоненты ───────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: styles.roleAdmin,
    manager: styles.roleManager,
    employee: styles.roleEmployee,
  }
  const labels: Record<string, string> = {
    admin: 'Админ', manager: 'Менеджер', employee: 'Сотрудник',
  }
  return <span className={`${styles.badge} ${map[role] ?? ''}`}>{labels[role] ?? role}</span>
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`${styles.badge} ${active ? styles.statusActive : styles.statusInactive}`}>
      {active ? 'Активен' : 'Неактивен'}
    </span>
  )
}

// ── Модальное окно ───────────────────────────────────────────────────

interface FormFields {
  email:       string
  username:    string
  first_name:  string
  last_name:   string
  password:    string
  department:  string
  project:     string
  role:        'employee' | 'manager' | 'admin'
  is_active:   boolean
  is_verified: boolean
}

type FormErrors = Partial<Record<keyof FormFields, string>>

interface ModalProps {
  mode: 'create' | 'edit'
  initial?: AdminUser
  knownDepartments?: string[]
  knownProjects?: string[]
  onClose: () => void
  onSubmit: (data: AdminUserCreate | AdminUserUpdate) => void
  loading: boolean
}

function UserModal({
  mode, initial, knownDepartments = [], knownProjects = [],
  onClose, onSubmit, loading,
}: ModalProps) {
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Разбиваем full_name на first_name + last_name для редактирования
  const [nameParts] = useState(() => {
    const parts = (initial?.full_name ?? '').split(' ')
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
  })

  const [form, setForm] = useState<FormFields>({
    email:       initial?.email      ?? '',
    username:    initial?.username   ?? '',
    first_name:  nameParts.first,
    last_name:   nameParts.last,
    password:    '',
    department:  initial?.department ?? '',
    project:     initial?.project    ?? '',
    role:        (initial?.role ?? 'employee') as 'employee' | 'manager' | 'admin',
    is_active:   initial?.is_active  ?? true,
    is_verified: initial?.is_verified ?? true,
  })

  const set = (k: keyof FormFields, v: unknown) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }

  const strength = getPasswordStrength(form.password)

  const validate = (): boolean => {
    const e: FormErrors = {}

    // Email
    if (!EMAIL_RE.test(form.email))
      e.email = 'Введите корректный email'

    // Username
    if (!USERNAME_RE.test(form.username))
      e.username = 'Мин. 3 символа, только a-z, 0-9, _, -'

    // Имя / Фамилия
    if (!form.first_name.trim())
      e.first_name = 'Введите имя'
    if (!form.last_name.trim())
      e.last_name = 'Введите фамилию'

    // Пароль: обязателен при создании, при редактировании — опционален
    if (mode === 'create' && form.password.length < 8)
      e.password = 'Мин. 8 символов'
    if (mode === 'edit' && form.password && form.password.length < 8)
      e.password = 'Мин. 8 символов (60ставьте пустым, чтобы не менять)'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim()

    if (mode === 'create') {
      onSubmit({
        email:       form.email,
        username:    form.username,
        full_name,
        password:    form.password,
        department:  form.department || undefined,
        project:     form.project    || undefined,
        role:        form.role,
        is_active:   form.is_active,
        is_verified: form.is_verified,
      } as AdminUserCreate)
    } else {
      const patch: AdminUserUpdate = {
        email:       form.email,
        username:    form.username,
        full_name,
        department:  form.department || undefined,
        project:     form.project    || undefined,
        role:        form.role,
        is_active:   form.is_active,
        is_verified: form.is_verified,
      }
      if (form.password) patch.password = form.password
      onSubmit(patch)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{mode === 'create' ? 'Новый пользователь' : 'Редактирование'}</h2>
          <button className={styles.btnGhost} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formGrid}>

            {/* Имя + Фамилия */}
            <Field label="Имя *" error={errors.first_name}>
              <input
                className={`${styles.input} ${errors.first_name ? styles.inputError : ''}`}
                placeholder="Напр. Алексей"
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
              />
            </Field>

            <Field label="Фамилия *" error={errors.last_name}>
              <input
                className={`${styles.input} ${errors.last_name ? styles.inputError : ''}`}
                placeholder="Напр. Иванов"
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
              />
            </Field>

            {/* Email */}
            <Field label="Email *" error={errors.email}>
              <input
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                type="email"
                placeholder="your@company.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </Field>

            {/* Username */}
            <Field label="Username *" error={errors.username}>
              <input
                className={`${styles.input} ${errors.username ? styles.inputError : ''}`}
                placeholder="Напр. alexey_ivanov"
                value={form.username}
                onChange={e => set('username', e.target.value.toLowerCase())}
              />
            </Field>

            {/* Пароль */}
            <Field
              label={mode === 'create' ? 'Пароль *' : 'Новый пароль'}
              error={errors.password}
              className={styles.fieldFull}
            >
              <div className={styles.passwordWrap}>
                <input
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  type={showPass ? 'text' : 'password'}
                  placeholder={mode === 'create' ? 'Мин. 8 символов' : 'Оставьте пустым, чтобы не менять'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-label={showPass ? 'Скрыть' : 'Показать'}
                  onClick={() => setShowPass(v => !v)}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Индикатор силы пароля */}
              {form.password && (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthSegs}>
                    {[0,1,2,3].map(i => (
                      <div
                        key={i}
                        className={styles.seg}
                        style={{
                          background: i < strength
                            ? STRENGTH_COLORS[strength - 1]
                            : 'var(--border)'
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className={styles.strengthLabel}
                    style={{ color: STRENGTH_COLORS[strength - 1] ?? 'var(--text-faint)' }}
                  >
                    {STRENGTH_LABELS[strength - 1] ?? 'Очень слабый'}
                  </span>
                </div>
              )}
            </Field>

            {/* Отдел */}
            <Field label="Отдел">
              <input
                className={styles.input}
                list="dep-list"
                placeholder="Напр. Разработка"
                value={form.department}
                onChange={e => set('department', e.target.value)}
              />
              <datalist id="dep-list">
                {knownDepartments.map(d => <option key={d} value={d} />)}
              </datalist>
            </Field>

            {/* Проект */}
            <Field label="Проект">
              <input
                className={styles.input}
                list="proj-list"
                placeholder="Напр. GameQuest"
                value={form.project}
                onChange={e => set('project', e.target.value)}
              />
              <datalist id="proj-list">
                {knownProjects.map(p => <option key={p} value={p} />)}
              </datalist>
            </Field>

            {/* Роль */}
            <Field label="Роль">
              <select
                className={styles.input}
                value={form.role}
                onChange={e => set('role', e.target.value)}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>
                    {r === 'admin' ? 'Админ' : r === 'manager' ? 'Менеджер' : 'Сотрудник'}
                  </option>
                ))}
              </select>
            </Field>

            {/* Статусы */}
            <Field label="Статусы">
              <div className={styles.checkboxGroup}>
                <label>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)} />
                  Активен
                </label>
                <label>
                  <input type="checkbox" checked={form.is_verified}
                    onChange={e => set('is_verified', e.target.checked)} />
                  Подтверждён
                </label>
              </div>
            </Field>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field — поле с лейблом и ошибкой ───────────────────────────────

function Field({
  label, error, className, children,
}: {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  )
}
