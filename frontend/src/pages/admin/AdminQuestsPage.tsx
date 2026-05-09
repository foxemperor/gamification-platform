import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  adminQuestsApi,
  type AdminQuest,
  type AdminQuestCreate,
  type AdminQuestUpdate,
  type QuestStatus,
  type QuestType,
  type QuestDifficulty,
} from '../../api/admin'
import { useAppToast } from '../../App'
import styles from './AdminTools.module.css'

const QUEST_TYPES: QuestType[] = ['personal', 'team', 'daily', 'skill', 'integration']
const DIFFICULTIES: QuestDifficulty[] = ['easy', 'medium', 'hard', 'epic']
const STATUSES: QuestStatus[] = ['draft', 'active', 'archived']

export function AdminQuestsPage() {
  const toast = useAppToast()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuestStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<QuestType | ''>('')

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminQuest | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-quests', page, search, statusFilter, typeFilter],
    queryFn: () => adminQuestsApi.list({
      page,
      per_page: 20,
      search: search || undefined,
      status: statusFilter || undefined,
      quest_type: typeFilter || undefined,
    }).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-quests'] })

  const createM = useMutation({
    mutationFn: (input: AdminQuestCreate) => adminQuestsApi.create(input),
    onSuccess: () => { toast('Квест создан', 'success'); invalidate(); setModal(null) },
    onError: () => toast('Не удалось создать квест', 'error'),
  })

  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminQuestUpdate }) =>
      adminQuestsApi.update(id, input),
    onSuccess: () => { toast('Квест обновлён', 'success'); invalidate(); setModal(null) },
    onError: () => toast('Не удалось обновить квест', 'error'),
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => adminQuestsApi.remove(id),
    onSuccess: () => { toast('Квест удалён', 'success'); invalidate() },
    onError: () => toast('Не удалось удалить квест', 'error'),
  })

  const handleSearch = () => { setPage(1); setSearch(searchInput) }

  const totalPages = data ? data.pages : 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Админ: Квесты</h1>
        <button className={styles.btnPrimary} onClick={() => { setSelected(null); setModal('create') }}>
          + Создать квест
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
        <select
          className={styles.select}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as QuestStatus | ''); setPage(1) }}
        >
          <option value="">Все статусы</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className={styles.select}
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as QuestType | ''); setPage(1) }}
        >
          <option value="">Все типы</option>
          {QUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className={styles.btnSecondary} onClick={handleSearch}>Найти</button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : !data?.items.length ? (
        <div className={styles.empty}>Квестов не найдено</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Сложность</th>
                  <th>Статус</th>
                  <th>XP</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(q => (
                  <tr key={q.id}>
                    <td>{q.title}</td>
                    <td><span className={styles.muted}>{q.quest_type}</span></td>
                    <td><span className={styles.muted}>{q.difficulty}</span></td>
                    <td><span className={styles.muted}>{q.status}</span></td>
                    <td>{q.xp_reward}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.btnSecondary} onClick={() => { setSelected(q); setModal('edit') }}>
                          Изменить
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => { if (confirm('Удалить квест?')) deleteM.mutate(q.id) }}
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
        <QuestFormModal
          initial={selected}
          mode={modal}
          onClose={() => setModal(null)}
          onSubmit={(form) => {
            if (modal === 'create') createM.mutate(form as AdminQuestCreate)
            else if (selected) updateM.mutate({ id: selected.id, input: form })
          }}
          submitting={createM.isPending || updateM.isPending}
        />
      )}
    </div>
  )
}

function QuestFormModal({
  initial,
  mode,
  onClose,
  onSubmit,
  submitting,
}: {
  initial: AdminQuest | null
  mode: 'create' | 'edit'
  onClose: () => void
  onSubmit: (form: AdminQuestCreate | AdminQuestUpdate) => void
  submitting: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [questType, setQuestType] = useState<QuestType>(initial?.quest_type ?? 'personal')
  const [difficulty, setDifficulty] = useState<QuestDifficulty>(initial?.difficulty ?? 'medium')
  const [status, setStatus] = useState<QuestStatus>(initial?.status ?? 'active')
  const [xpReward, setXpReward] = useState<number>(initial?.xp_reward ?? 150)
  const [coinsReward, setCoinsReward] = useState<number>(initial?.coins_reward ?? 10)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (!title.trim()) {
      setError('Название обязательно')
      return
    }
    onSubmit({
      title: title.trim(),
      description: description || undefined,
      quest_type: questType,
      difficulty,
      status,
      xp_reward: xpReward,
      coins_reward: coinsReward,
    })
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{mode === 'create' ? 'Создать квест' : 'Редактировать квест'}</h2>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.formGrid}>
          <div className={`${styles.formField} ${styles.formFull}`}>
            <label>Название *</label>
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className={`${styles.formField} ${styles.formFull}`}>
            <label>Описание</label>
            <input className={styles.input} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <label>Тип</label>
            <select className={styles.select} value={questType} onChange={e => setQuestType(e.target.value as QuestType)}>
              {QUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <label>Сложность</label>
            <select className={styles.select} value={difficulty} onChange={e => setDifficulty(e.target.value as QuestDifficulty)}>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <label>Статус</label>
            <select className={styles.select} value={status} onChange={e => setStatus(e.target.value as QuestStatus)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <label>XP награда</label>
            <input className={styles.input} type="number" value={xpReward} onChange={e => setXpReward(Number(e.target.value))} />
          </div>
          <div className={styles.formField}>
            <label>Монеты</label>
            <input className={styles.input} type="number" value={coinsReward} onChange={e => setCoinsReward(Number(e.target.value))} />
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
