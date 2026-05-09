import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  adminBadgesApi,
  type AdminBadge,
  type AdminBadgeCreate,
  type AdminBadgeUpdate,
  type BadgeRarity,
} from '../../api/admin'
import { useAppToast } from '../../App'
import styles from './AdminTools.module.css'

const RARITIES: BadgeRarity[] = ['common', 'rare', 'epic', 'legendary']

export function AdminBadgesPage() {
  const toast = useAppToast()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminBadge | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-badges', page, search],
    queryFn: () => adminBadgesApi.list({ page, per_page: 20, search: search || undefined }).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-badges'] })

  const createM = useMutation({
    mutationFn: (input: AdminBadgeCreate) => adminBadgesApi.create(input),
    onSuccess: () => { toast('Бейдж создан', 'success'); invalidate(); setModal(null) },
    onError: (e: any) => toast(e?.response?.data?.detail || 'Не удалось создать бейдж', 'error'),
  })

  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminBadgeUpdate }) =>
      adminBadgesApi.update(id, input),
    onSuccess: () => { toast('Бейдж обновлён', 'success'); invalidate(); setModal(null) },
    onError: (e: any) => toast(e?.response?.data?.detail || 'Не удалось обновить бейдж', 'error'),
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => adminBadgesApi.remove(id),
    onSuccess: () => { toast('Бейдж удалён', 'success'); invalidate() },
    onError: () => toast('Не удалось удалить бейдж', 'error'),
  })

  const handleSearch = () => { setPage(1); setSearch(searchInput) }

  const totalPages = data ? data.pages : 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Админ: Бейджи</h1>
        <button className={styles.btnPrimary} onClick={() => { setSelected(null); setModal('create') }}>
          + Создать бейдж
        </button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          placeholder="Поиск по названию или описанию..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={styles.btnSecondary} onClick={handleSearch}>Найти</button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : !data?.items.length ? (
        <div className={styles.empty}>Бейджей не найдено</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Редкость</th>
                  <th>XP бонус</th>
                  <th>Условие</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(b => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td><span className={styles.muted}>{b.rarity}</span></td>
                    <td>{b.xp_bonus}</td>
                    <td><span className={styles.muted}>
                      {b.condition_type ? `${b.condition_type}: ${b.condition_value ?? '—'}` : '—'}
                    </span></td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.btnSecondary} onClick={() => { setSelected(b); setModal('edit') }}>
                          Изменить
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => { if (confirm('Удалить бейдж?')) deleteM.mutate(b.id) }}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <button className={styles.btnSecondary} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
            <span>Страница {page} / {totalPages}</span>
            <button className={styles.btnSecondary} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Далее →</button>
          </div>
        </>
      )}

      {modal && (
        <BadgeFormModal
          initial={selected}
          mode={modal}
          onClose={() => setModal(null)}
          onSubmit={(form) => {
            if (modal === 'create') createM.mutate(form as AdminBadgeCreate)
            else if (selected) updateM.mutate({ id: selected.id, input: form })
          }}
          submitting={createM.isPending || updateM.isPending}
        />
      )}
    </div>
  )
}

function BadgeFormModal({
  initial,
  mode,
  onClose,
  onSubmit,
  submitting,
}: {
  initial: AdminBadge | null
  mode: 'create' | 'edit'
  onClose: () => void
  onSubmit: (form: AdminBadgeCreate | AdminBadgeUpdate) => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [iconUrl, setIconUrl] = useState(initial?.icon_url ?? '')
  const [rarity, setRarity] = useState<BadgeRarity>(initial?.rarity ?? 'common')
  const [conditionType, setConditionType] = useState(initial?.condition_type ?? '')
  const [conditionValue, setConditionValue] = useState<number | ''>(initial?.condition_value ?? '')
  const [xpBonus, setXpBonus] = useState<number>(initial?.xp_bonus ?? 0)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (!name.trim() || name.trim().length < 2) {
      setError('Название должно быть не короче 2 символов')
      return
    }
    onSubmit({
      name: name.trim(),
      description: description || undefined,
      icon_url: iconUrl || undefined,
      rarity,
      condition_type: conditionType || undefined,
      condition_value: conditionValue === '' ? undefined : Number(conditionValue),
      xp_bonus: xpBonus,
    })
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{mode === 'create' ? 'Создать бейдж' : 'Редактировать бейдж'}</h2>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.formGrid}>
          <div className={`${styles.formField} ${styles.formFull}`}>
            <label>Название *</label>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className={`${styles.formField} ${styles.formFull}`}>
            <label>Описание</label>
            <input className={styles.input} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className={`${styles.formField} ${styles.formFull}`}>
            <label>URL иконки</label>
            <input className={styles.input} value={iconUrl} onChange={e => setIconUrl(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <label>Редкость</label>
            <select className={styles.select} value={rarity} onChange={e => setRarity(e.target.value as BadgeRarity)}>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <label>XP бонус</label>
            <input className={styles.input} type="number" value={xpBonus} onChange={e => setXpBonus(Number(e.target.value))} />
          </div>
          <div className={styles.formField}>
            <label>Тип условия</label>
            <input className={styles.input} value={conditionType} onChange={e => setConditionType(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <label>Значение условия</label>
            <input
              className={styles.input}
              type="number"
              value={conditionValue}
              onChange={e => setConditionValue(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>Отмена</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={submitting}>
            {submitting ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
