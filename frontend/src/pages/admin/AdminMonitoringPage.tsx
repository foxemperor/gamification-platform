import { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { adminApi, adminQuestsApi, adminBadgesApi, adminXPApi } from '../../api/admin'
import styles from './AdminTools.module.css'

type ServiceStatus = 'up' | 'down' | 'unknown'

interface ProbeResult {
  status: ServiceStatus
  latency: number | null
  httpCode: number | null
  payload: unknown
  checkedAt: string
  error?: string
}

const POLL_INTERVAL_MS = 7000

// Используем отдельный axios без общего interceptor:
// health-проверки публичные, токен подмешивать незачем,
// и мы не хотим вызывать reload-on-401 ни при каких условиях.
const probeClient = axios.create({ timeout: 5000 })

async function probe(url: string): Promise<ProbeResult> {
  const t0 = performance.now()
  try {
    const r = await probeClient.get(url, { validateStatus: () => true })
    const latency = Math.round(performance.now() - t0)
    return {
      status: r.status >= 200 && r.status < 300 ? 'up' : 'down',
      latency,
      httpCode: r.status,
      payload: r.data,
      checkedAt: new Date().toISOString(),
    }
  } catch (e: any) {
    return {
      status: 'down',
      latency: null,
      httpCode: null,
      payload: null,
      checkedAt: new Date().toISOString(),
      error: e?.message ?? 'network error',
    }
  }
}

export function AdminMonitoringPage() {
  const [authProbe, setAuthProbe] = useState<ProbeResult | null>(null)
  const [gameProbe, setGameProbe] = useState<ProbeResult | null>(null)
  const [paused, setPaused] = useState(false)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(async () => {
    const [a, g] = await Promise.all([
      probe('/_monitor/auth'),
      probe('/_monitor/gamification'),
    ])
    setAuthProbe(a)
    setGameProbe(g)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      refresh()
      setTick(t => t + 1)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [paused, refresh])

  // Counts с уже существующих admin endpoint'ов.
  const usersQ = useQuery({
    queryKey: ['mon-users-count', tick],
    queryFn: () => adminApi.listUsers(1, 1, '').then(r => r.data),
    refetchInterval: paused ? false : POLL_INTERVAL_MS,
  })
  const questsQ = useQuery({
    queryKey: ['mon-quests-count', tick],
    queryFn: () => adminQuestsApi.list({ page: 1, per_page: 1 }).then(r => r.data),
    refetchInterval: paused ? false : POLL_INTERVAL_MS,
  })
  const badgesQ = useQuery({
    queryKey: ['mon-badges-count', tick],
    queryFn: () => adminBadgesApi.list({ page: 1, per_page: 1 }).then(r => r.data),
    refetchInterval: paused ? false : POLL_INTERVAL_MS,
  })
  const txQ = useQuery({
    queryKey: ['mon-xp-tx', tick],
    queryFn: () => adminXPApi.listTransactions({ page: 1, per_page: 5 }).then(r => r.data),
    refetchInterval: paused ? false : POLL_INTERVAL_MS,
  })

  const lastUpdated = useMemo(() => {
    const dates = [authProbe?.checkedAt, gameProbe?.checkedAt].filter(Boolean) as string[]
    if (!dates.length) return null
    return new Date(Math.max(...dates.map(d => new Date(d).getTime())))
  }, [authProbe, gameProbe])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Мониторинг сервисов</h1>
          <p className={styles.subtitle}>
            Поллинг каждые {POLL_INTERVAL_MS / 1000}с. Без секретов и приватных данных.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={styles.btnSecondary}
            onClick={() => setPaused(p => !p)}
            title="Поставить опрос на паузу"
          >
            {paused ? '▶ Возобновить' : '⏸ Пауза'}
          </button>
          <button className={styles.btnPrimary} onClick={refresh}>
            ↻ Обновить
          </button>
        </div>
      </div>

      <div className={styles.monitorTopBar}>
        <span className={styles.legend}>
          {lastUpdated
            ? `Последняя проверка: ${lastUpdated.toLocaleTimeString()}`
            : 'Опрашиваем сервисы…'}
        </span>
      </div>

      <div className={styles.monitorCards}>
        <ServiceCard title="Auth Service" url="/_monitor/auth" probe={authProbe} />
        <ServiceCard title="Gamification Service" url="/_monitor/gamification" probe={gameProbe} />
      </div>

      <h2 className={styles.title} style={{ fontSize: 18, marginBottom: 12 }}>Счётчики</h2>
      <div className={styles.statCards}>
        <StatCard label="Пользователей" value={usersQ.data?.total} />
        <StatCard label="Квестов" value={questsQ.data?.total} />
        <StatCard label="Бейджей" value={badgesQ.data?.total} />
        <StatCard label="XP-транзакций" value={txQ.data?.total} />
      </div>

      <h2 className={styles.title} style={{ fontSize: 18, marginBottom: 12 }}>Последние XP-транзакции</h2>
      {!txQ.data?.items?.length ? (
        <div className={styles.empty}>Транзакций нет</div>
      ) : (
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
              {txQ.data.items.map(tx => (
                <tr key={tx.id}>
                  <td><span className={styles.muted}>{new Date(tx.created_at).toLocaleString()}</span></td>
                  <td><code style={{ fontSize: 12 }}>{tx.user_id.slice(0, 8)}…</code></td>
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
      )}
    </div>
  )
}

function ServiceCard({ title, url, probe }: { title: string; url: string; probe: ProbeResult | null }) {
  const status: ServiceStatus = probe?.status ?? 'unknown'
  const pillClass =
    status === 'up' ? styles.pillUp : status === 'down' ? styles.pillDown : styles.pillUnknown
  const pillLabel = status === 'up' ? '● UP' : status === 'down' ? '● DOWN' : '● …'

  return (
    <div className={styles.monitorCard}>
      <div className={styles.monitorCardHeader}>
        <span className={styles.monitorCardTitle}>{title}</span>
        <span className={`${styles.monitorPill} ${pillClass}`}>{pillLabel}</span>
      </div>
      <div className={styles.monitorMeta}>
        <span>HTTP: <code>{probe?.httpCode ?? '—'}</code></span>
        <span>Задержка: <code>{probe?.latency != null ? `${probe.latency} мс` : '—'}</code></span>
        <span>Endpoint: <code>{url}</code></span>
        {probe?.checkedAt && (
          <span>Проверено: {new Date(probe.checkedAt).toLocaleTimeString()}</span>
        )}
        {probe?.error && (
          <span style={{ color: 'var(--danger, #d44)' }}>Ошибка: {probe.error}</span>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value ?? '…'}</p>
    </div>
  )
}
