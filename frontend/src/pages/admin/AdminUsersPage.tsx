import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/admin'
import type { AdminUser, AdminUserCreate, AdminUserUpdate } from '../../api/admin'
import { useAppToast } from '../../App'
import styles from './AdminUsersPage.module.css'

const ROLES = ['employee', 'manager', 'admin'] as const

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
    onError: () => toast('Ошибка при создании', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => { toast('Пользователь удалён', 'success'); invalidate() },
    onError: () => toast('Нельзя удалить этого пользователя', 'error'),
  })

  const handleSearch = () => { setPage(1); setSearch(searchInput) }

  // Уникальные отделы/проекты с текущей страницы — используем для datalist в форме
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

      {/* Модалка редактирования */}
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

      {/* Модалка создания */}
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

// ── Вспомогательные компоненты ───────────────────────────────────

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

// ── Модальное окно создания/редактирования ───────────────────────

interface ModalProps {
  mode: 'create' | 'edit'
  initial?: AdminUser
  knownDepartments?: string[]
  knownProjects?: string[]
  onClose: () => void
  onSubmit: (data: AdminUserCreate | AdminUserUpdate) => void
  loading: boolean
}

function UserModal({ mode, initial, knownDepartments = [], knownProjects = [], onClose, onSubmit, loading }: ModalProps) {
  const [form, setForm] = useState({
    email:      initial?.email      ?? '',
    username:   initial?.username   ?? '',
    full_name:  initial?.full_name  ?? '',
    password:   '',
    department: initial?.department ?? '',
    project:    initial?.project    ?? '',
    role:       (initial?.role ?? 'employee') as 'employee' | 'manager' | 'admin',
    is_active:  initial?.is_active  ?? true,
    is_verified: initial?.is_verified ?? true,
  })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'create') {
      onSubmit({ ...form } as AdminUserCreate)
    } else {
      // Отправляем только заполненные поля
      const patch: AdminUserUpdate = {}
      if (form.email)      patch.email      = form.email
      if (form.username)   patch.username   = form.username
      if (form.full_name)  patch.full_name  = form.full_name
      if (form.password)   patch.password   = form.password
      patch.department = form.department || undefined
      patch.project    = form.project    || undefined
      patch.role       = form.role
      patch.is_active  = form.is_active
      patch.is_verified = form.is_verified
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

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <Field label="Email *">
              <input className={styles.input} type="email" required={mode==='create'}
                value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
            <Field label="Username *">
              <input className={styles.input} required={mode==='create'}
                value={form.username} onChange={e => set('username', e.target.value)} />
            </Field>
            <Field label="Полное имя">
              <input className={styles.input}
                value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            </Field>
            <Field label={mode === 'create' ? 'Пароль *' : 'Новый пароль (необязательно)'}>
              <input className={styles.input} type="password" required={mode==='create'}
                value={form.password} onChange={e => set('password', e.target.value)}
                placeholder={mode === 'edit' ? 'Не менять' : 'Минимум 8 символов'} />
              {mode === 'edit' && (
                <small className={styles.helpText}>
                  Оставьте поле пустым, чтобы не менять текущий пароль.
                </small>
              )}
            </Field>
            <Field label="Отдел">
              <input className={styles.input} list="dep-list" placeholder="напр. Разработка"
                value={form.department} onChange={e => set('department', e.target.value)} />
              <datalist id="dep-list">
                {knownDepartments.map(d => <option key={d} value={d} />)}
              </datalist>
            </Field>
            <Field label="Проект">
              <input className={styles.input} list="proj-list" placeholder="напр. GameQuest"
                value={form.project} onChange={e => set('project', e.target.value)} />
              <datalist id="proj-list">
                {knownProjects.map(p => <option key={p} value={p} />)}
              </datalist>
            </Field>
            <Field label="Роль">
              <select className={styles.input}
                value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => (
                  <option key={r} value={r}>
                    {r === 'admin' ? 'Админ' : r === 'manager' ? 'Менеджер' : 'Сотрудник'}
                  </option>
                ))}
              </select>
            </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  )
}
