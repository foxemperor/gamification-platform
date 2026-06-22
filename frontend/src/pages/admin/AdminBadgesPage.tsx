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

// Известные шаблоны условий получения бейджа.
// Backend принимает любой string<=50, но в UI ограничиваем выбор
// понятными вариантами и плюс "custom" для свободного ввода.
const CONDITION_TEMPLATES: Array<{
  value: string
  label: string
  hint: string
  valueHint: string
}> = [
  { value: '',                   label: '— не задано —',         hint: 'Бейдж выдаётся вручную или через интеграции',          valueHint: '' },
  { value: 'manual',             label: 'Ручная выдача',         hint: 'Админ выдаёт бейдж вручную',                            valueHint: 'не используется' },
  { value: 'xp_threshold',       label: 'Достижение XP',          hint: 'Бейдж выдаётся, когда у пользователя XP ≥ значения',    valueHint: 'например, 1000' },
  { value: 'level_reached',      label: 'Достижение уровня',      hint: 'Бейдж выдаётся при достижении уровня',                  valueHint: 'например, 5' },
  { value: 'quest_completed',    label: 'Выполнено квестов',      hint: 'Количество выполненных квестов любого типа',            valueHint: 'например, 10' },
  { value: 'streak_days',        label: 'Серия дней активности',  hint: 'Подряд активных дней',                                   valueHint: 'например, 7' },
  { value: 'github_commits',     label: 'GitHub-коммиты',         hint: 'Количество засчитанных коммитов',                       valueHint: 'например, 50' },
  { value: 'github_pr',          label: 'GitHub-PR',              hint: 'Количество смерженных PR',                              valueHint: 'например, 5' },
  { value: 'jira_tasks',         label: 'Jira-задачи',            hint: 'Количество завершённых задач',                          valueHint: 'например, 25' },
  { value: '__custom__',         label: 'Своё значение…',         hint: 'Произвольный строковый ключ условия',                   valueHint: 'число (опционально)' },
]

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
  const [iconError, setIconError] = useState(false)
  const [rarity, setRarity] = useState<BadgeRarity>(initial?.rarity ?? 'common')

  // Стартовое значение: если в БД уже сохранено что-то нестандартное —
  // открываем форму в режиме custom.
  const initialCondition = initial?.condition_type ?? ''
  const isKnownTemplate = CONDITION_TEMPLATES.some(t => t.value === initialCondition && t.value !== '__custom__')
  const [conditionTemplate, setConditionTemplate] = useState<string>(
    initialCondition === '' ? '' : isKnownTemplate ? initialCondition : '__custom__'
  )
  const [customConditionType, setCustomConditionType] = useState(
    isKnownTemplate ? '' : initialCondition
  )
  const [conditionValue, setConditionValue] = useState<number | ''>(initial?.condition_value ?? '')
  const [xpBonus, setXpBonus] = useState<number>(initial?.xp_bonus ?? 0)
  const [error, setError] = useState<string | null>(null)

  const tmpl = CONDITION_TEMPLATES.find(t => t.value === conditionTemplate)
  const finalConditionType =
    conditionTemplate === ''
      ? ''
      : conditionTemplate === '__custom__'
        ? customConditionType.trim()
        : conditionTemplate

  const submit = () => {
    setError(null)
    if (!name.trim() || name.trim().length < 2) {
      setError('Название должно быть не короче 2 символов')
      return
    }
    if (conditionTemplate === '__custom__' && !customConditionType.trim()) {
      setError('Введите свой код условия или выберите шаблон')
      return
    }
    if (finalConditionType.length > 50) {
      setError('Тип условия слишком длинный (максимум 50 символов)')
      return
    }
    onSubmit({
      name: name.trim(),
      description: description || undefined,
      icon_url: iconUrl || undefined,
      rarity,
      condition_type: finalConditionType || undefined,
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
            <div className={styles.iconRow}>
              <input
                className={styles.input}
                value={iconUrl}
                placeholder="https://… (png/svg/webp) или data:image/…"
                onChange={e => { setIconUrl(e.target.value); setIconError(false) }}
              />
              <div className={styles.iconPreview} aria-label="Предпросмотр иконки">
                {iconUrl && !iconError ? (
                  <img
                    src={iconUrl}
                    alt="preview"
                    onError={() => setIconError(true)}
                    onLoad={() => setIconError(false)}
                  />
                ) : (
                  <span className={styles.iconPlaceholder}>
                    {iconError ? '⚠️' : '🏅'}
                  </span>
                )}
              </div>
            </div>
            {iconError && (
              <small style={{ color: 'var(--danger, #d44)', fontSize: 12 }}>
                Не удалось загрузить изображение. Проверьте URL.
              </small>
            )}
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
          <div className={`${styles.formField} ${styles.formFull}`}>
            <label>Тип условия</label>
            <select
              className={styles.select}
              value={conditionTemplate}
              onChange={e => setConditionTemplate(e.target.value)}
            >
              {CONDITION_TEMPLATES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {tmpl && tmpl.hint && (
              <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tmpl.hint}</small>
            )}
            {conditionTemplate === '__custom__' && (
              <input
                className={styles.input}
                style={{ marginTop: 6 }}
                placeholder="ключ условия (a-z, без пробелов, до 50 символов)"
                value={customConditionType}
                onChange={e => setCustomConditionType(e.target.value)}
                maxLength={50}
              />
            )}
            {finalConditionType && conditionTemplate !== '' && (
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                Будет сохранено как: <code>{finalConditionType}</code>
              </small>
            )}
          </div>
          <div className={styles.formField}>
            <label>Значение условия</label>
            <input
              className={styles.input}
              type="number"
              value={conditionValue}
              placeholder={tmpl?.valueHint || 'число (опционально)'}
              onChange={e => setConditionValue(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!conditionTemplate || conditionTemplate === 'manual'}
            />
            {tmpl?.valueHint && (
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tmpl.valueHint}</small>
            )}
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
