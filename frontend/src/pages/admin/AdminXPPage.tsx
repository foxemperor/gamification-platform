import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  adminXPApi,
  type AdminXPGrantInput,
  type XPSource,
} from '../../api/admin'
import { UserPicker } from '../../components/admin/UserPicker'
import { useAppToast } from '../../App'
import { useAuthStore } from '../../store/authStore'
import styles from './AdminTools.module.css'

const SOURCES: XPSource[] = [
  'quest',
  'badge',
  'github_commit',
  'github_pr',
  'jira_task',
  'admin',
  'penalty',
]

export function AdminXPPage() {
  const toast = useAppToast()
  const qc = useQueryClient()
  const currentUserId = useAuthStore(s => s.user?.id)

  const [page, setPage] = useState(1)
  const [userIdFilter, setUserIdFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<XPSource | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-xp-tx', page, userIdFilter, sourceFilter],
    queryFn: () => adminXPApi.listTransactions({
      page,
      per_page: 20,
      user_id: userIdFilter || undefined,
      source: sourceFilter || undefined,
    }).then(r => r.data),
  })

  const invalidate = (grantedUserId?: string) => {
    qc.invalidateQueries({ queryKey: ['admin-xp-tx'] })
    // Инвалидируем xp-profile чтобы SidebarXP обновился мгновенно.
    // Инвалидируем как свой профиль (currentUser), так и того, кому начислили.
    qc.invalidateQueries({ queryKey: ['xp-profile'] })
    if (grantedUserId) {
      qc.invalidateQueries({ queryKey: ['xp-profile', grantedUserId] })
    }
    if (currentUserId) {
      qc.invalidateQueries({ queryKey: ['xp-profile', currentUserId] })
    }
  }

  const grantM = useMutation({
    mutationFn: (input: AdminXPGrantInput) => adminXPApi.grant(input),
    onSuccess: (_data, variables) => {
      toast('XP операция выполнена', 'success')
      invalidate(variables.user_id)
    },
    onError: (e: any) => toast(e?.response?.data?.detail || 'Не удалось начислить XP', 'error'),
  })

  const totalPages = data ? data.pages : 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Админ: XP</h1>
          <p className={styles.subtitle}>Ручное начисление/списание XP и журнал транзакций</p>
        </div>
      </div>

      <GrantForm
        onSubmit={(input) => grantM.mutate(input)}
        submitting={grantM.isPending}
      />

      <div style={{ marginTop: 32 }}>
        <h2 className={styles.title} style={{ fontSize: 18, marginBottom: 12 }}>Журнал XP-транзакций</h2>
        <div className={styles.toolbar}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <UserPicker
              value={userIdFilter}
              onChange={(id) => { setUserIdFilter(id); setPage(1) }}
              placeholder="Фильтр по пользователю (email/username/имя)…"
            />
          </div>
          <select
            className={styles.select}
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value as XPSource | ''); setPage(1) }}
          >
            <option value="">Все источники</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(userIdFilter || sourceFilter) && (
            <button
              className={styles.btnGhost}
              onClick={() => { setUserIdFilter(''); setSourceFilter(''); setPage(1) }}
            >
              Сбросить
            </button>
          )}
        </div>

        {isLoading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : !data?.items.length ? (
          <div className={styles.empty}>Транзакций не найдено</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>User ID</th>
                    <th>Сумма</th>
                    <th>Источник</th>
                    <th>Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(tx => (
                    <tr key={tx.id}>
                      <td><span className={styles.muted}>{new Date(tx.created_at).toLocaleString()}</span></td>
                      <td><code style={{ fontSize: 12 }}>{tx.user_id}</code></td>
                      <td>
                        <span className={tx.amount >= 0 ? styles.amountPos : styles.amountNeg}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount}
                        </span>
                      </td>
                      <td><span className={styles.muted}>{tx.source}</span></td>
                      <td>{tx.description || <span className={styles.muted}>—</span>}</td>
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
      </div>
    </div>
  )
}

function GrantForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: AdminXPGrantInput) => void
  submitting: boolean
}) {
  const [userId, setUserId] = useState('')
  const [amount, setAmount] = useState<number>(100)
  const [description, setDescription] = useState('')
  const [source, setSource] = useState<XPSource | ''>('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    const id = userId.trim()
    if (!id) {
      setError('Выберите пользователя или введите его UUID')
      return
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setError('user_id должен быть в формате UUID. Используйте поиск по пользователю.')
      return
    }
    if (amount === 0) {
      setError('Сумма не может быть 0')
      return
    }
    onSubmit({
      user_id: id,
      amount,
      description: description || undefined,
      source: source || undefined,
    })
  }

  return (
    <div className={styles.statCard}>
      <h2 className={styles.title} style={{ fontSize: 18, marginBottom: 12 }}>Начислить / списать XP</h2>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.formGrid}>
        <div className={`${styles.formField} ${styles.formFull}`}>
          <label>Пользователь *</label>
          <UserPicker
            id="xp-user-picker"
            value={userId}
            onChange={(id) => setUserId(id)}
            placeholder="Найти по email, username или имени…"
          />
          <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Подсказка: начните вводить email/имя — внизу заполнится UUID. Можно вставить UUID вручную.
          </small>
        </div>
        <div className={styles.formField}>
          <label>Сумма XP (отрицательная = списание)</label>
          <input
            className={styles.input}
            data-testid="xp-amount"
            type="number"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
          />
        </div>
        <div className={styles.formField}>
          <label>Источник (опц.)</label>
          <select
            className={styles.select}
            value={source}
            onChange={e => setSource(e.target.value as XPSource | '')}
          >
            <option value="">авто (admin / penalty)</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className={`${styles.formField} ${styles.formFull}`}>
          <label>Описание</label>
          <input
            className={styles.input}
            data-testid="xp-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Например: ручная корректировка"
          />
        </div>
      </div>
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} onClick={submit} disabled={submitting}>
          {submitting ? 'Отправка...' : 'Применить'}
        </button>
      </div>
    </div>
  )
}
