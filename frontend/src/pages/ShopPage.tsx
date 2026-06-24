import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppToast } from '../App'
import s from './ShopPage.module.css'

// ──────────────────────────────────────────────
// Типы
// ──────────────────────────────────────────────
type Category = 'food' | 'privilege' | 'game'

interface ShopItem {
  id: number
  name: string
  description: string
  category: Category
  price: number
  emoji: string
  badge?: string
}

// ──────────────────────────────────────────────
// Мок-данные
// ──────────────────────────────────────────────
const ITEMS: ShopItem[] = [
  // 🍫 Еда и напитки
  { id: 1,  name: 'Milka молочный',        description: 'Шоколад Milka классический молочный 100г',       category: 'food',      price: 150,  emoji: '🍫' },
  { id: 2,  name: 'Milka с орехами',        description: 'Шоколад Milka с цельным фундуком 100г',          category: 'food',      price: 170,  emoji: '🍫' },
  { id: 3,  name: 'KitKat',                 description: 'Шоколадный батончик KitKat 4 пальца',            category: 'food',      price: 120,  emoji: '🍬' },
  { id: 4,  name: 'Snickers',               description: 'Шоколадный батончик Snickers 50г',               category: 'food',      price: 100,  emoji: '🍬' },
  { id: 5,  name: 'Twix',                   description: 'Шоколадный батончик Twix 55г',                   category: 'food',      price: 100,  emoji: '🍬' },
  { id: 6,  name: 'Mars',                   description: 'Шоколадный батончик Mars 51г',                   category: 'food',      price: 100,  emoji: '🍬' },
  { id: 7,  name: 'Coca-Cola 0.5л',         description: 'Напиток Coca-Cola газированный 0.5л',            category: 'food',      price: 80,   emoji: '🥤' },
  { id: 8,  name: 'Pepsi 0.5л',             description: 'Напиток Pepsi Cola газированный 0.5л',           category: 'food',      price: 80,   emoji: '🥤' },
  { id: 9,  name: 'Red Bull 0.25л',         description: 'Энергетик Red Bull 0.25л',                       category: 'food',      price: 130,  emoji: '🔋', badge: '⚡ хит' },
  { id: 10, name: 'Burn 0.5л',              description: 'Энергетик Burn 0.5л',                            category: 'food',      price: 110,  emoji: '🔋' },
  { id: 11, name: 'Кофе из кофемашины',     description: 'Один стакан кофе из офисной кофемашины',        category: 'food',      price: 60,   emoji: '☕', badge: '💸 дёшево' },
  { id: 12, name: 'Бесплатный обед',        description: 'Бесплатный обед в офисной столовой',            category: 'food',      price: 400,  emoji: '🍽️' },

  // 🏖️ Нематериальные привилегии
  { id: 13, name: 'Дополнительный отпуск',  description: 'Один дополнительный день неоплачиваемого отпуска', category: 'privilege', price: 2000, emoji: '🏖️', badge: '🔥 популярно' },
  { id: 14, name: 'Дополнительная премия',  description: 'Фиксированная премия — сумма настраивается администратором', category: 'privilege', price: 5000, emoji: '💰' },
  { id: 15, name: 'Ранний уход с работы',   description: 'Уйти на 1 час раньше (1 раз)',                  category: 'privilege', price: 800,  emoji: '🚪' },
  { id: 16, name: 'Работа из дома',         description: 'Один рабочий день удалённо',                    category: 'privilege', price: 1200, emoji: '🏠', badge: '🔥 популярно' },

  // 🎮 Игровые товары
  { id: 17, name: 'Смена класса',           description: 'Сменить класс персонажа. Внимание: уровень и XP обнуляются!', category: 'game', price: 3000, emoji: '🔄', badge: '⚠️ необратимо' },
  { id: 18, name: 'Редкий скин',            description: 'Эксклюзивный редкий скин для персонажа',       category: 'game',      price: 1500, emoji: '✨' },
  { id: 19, name: 'Доп. слот экипировки',   description: 'Дополнительный слот для предметов снаряжения', category: 'game',      price: 2500, emoji: '🎒' },
  { id: 20, name: 'Буст опыта x2 (24ч)',    description: 'Двойной опыт за все действия в течение 24 часов', category: 'game',    price: 1000, emoji: '⚡', badge: '🔥 популярно' },
]

const CATEGORIES: { key: Category | 'all'; label: string; emoji: string }[] = [
  { key: 'all',       label: 'Все товары',    emoji: '🛒' },
  { key: 'food',      label: 'Еда и напитки', emoji: '🍫' },
  { key: 'privilege', label: 'Привилегии',    emoji: '🏖️' },
  { key: 'game',      label: 'Игровые',       emoji: '🎮' },
]

// ──────────────────────────────────────────────
// История покупок (локальная)
// ──────────────────────────────────────────────
interface Purchase {
  id: number
  item: ShopItem
  purchasedAt: Date
  status: 'pending' | 'fulfilled'
}

// ──────────────────────────────────────────────
// Модалка подтверждения
// ──────────────────────────────────────────────
function ConfirmModal({
  item,
  balance,
  onConfirm,
  onCancel,
  busy,
}: {
  item: ShopItem
  balance: number
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  const enough = balance >= item.price
  const after  = balance - item.price

  return (
    <div className={s.overlay} onClick={onCancel}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <button className={s.modalClose} onClick={onCancel} aria-label="Закрыть">✕</button>

        <div className={s.modalIcon}>{item.emoji}</div>
        <h2 className={s.modalTitle}>{item.name}</h2>
        <p className={s.modalDesc}>{item.description}</p>

        {item.id === 17 && (
          <div className={s.warningBox}>
            ⚠️ Смена класса необратима — уровень и весь заработанный XP будут обнулены!
          </div>
        )}

        <div className={s.modalMeta}>
          <div className={s.modalMetaRow}>
            <span className={s.modalMetaLabel}>Цена</span>
            <span className={s.modalMetaVal}>🪙 {item.price.toLocaleString('ru')}</span>
          </div>
          <div className={s.modalMetaRow}>
            <span className={s.modalMetaLabel}>Баланс</span>
            <span className={s.modalMetaVal}>🪙 {balance.toLocaleString('ru')}</span>
          </div>
          {enough && (
            <div className={s.modalMetaRow}>
              <span className={s.modalMetaLabel}>После покупки</span>
              <span className={s.modalMetaVal} style={{ color: after < 200 ? 'var(--color-warning)' : undefined }}>
                🪙 {after.toLocaleString('ru')}
              </span>
            </div>
          )}
        </div>

        {!enough && (
          <div className={s.errorMsg}>Недостаточно монет для покупки</div>
        )}

        <div className={s.modalActions}>
          <button className={s.btnGhost} onClick={onCancel} disabled={busy}>Отмена</button>
          <button
            className={s.btnPrimary}
            disabled={!enough || busy}
            onClick={onConfirm}
          >
            {busy ? 'Покупаем…' : `Купить за 🪙 ${item.price.toLocaleString('ru')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Карточка товара
// ──────────────────────────────────────────────
function ItemCard({ item, balance, onBuy }: { item: ShopItem; balance: number; onBuy: (item: ShopItem) => void }) {
  const canAfford = balance >= item.price

  return (
    <div className={`${s.card} ${!canAfford ? s.cardCantAfford : ''}`}>
      {item.badge && <span className={s.cardBadge}>{item.badge}</span>}
      <div className={s.cardEmoji}>{item.emoji}</div>
      <p className={s.cardName}>{item.name}</p>
      <p className={s.cardDesc}>{item.description}</p>
      <div className={s.cardFooter}>
        <span className={s.cardPrice}>🪙 {item.price.toLocaleString('ru')}</span>
        <button
          className={`${s.buyBtn} ${!canAfford ? s.buyBtnDisabled : ''}`}
          onClick={() => onBuy(item)}
          disabled={!canAfford}
          title={!canAfford ? 'Недостаточно монет' : undefined}
        >
          {canAfford ? 'Купить' : '🔒 Мало монет'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Страница
// ──────────────────────────────────────────────
export function ShopPage() {
  const user    = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const toast   = useAppToast()

  const coins = user?.coins ?? 0

  const [tab,       setTab]       = useState<Category | 'all'>('all')
  const [histTab,   setHistTab]   = useState<'shop' | 'history'>('shop')
  const [selected,  setSelected]  = useState<ShopItem | null>(null)
  const [busy,      setBusy]      = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [nextId,    setNextId]    = useState(1)

  const filtered = tab === 'all' ? ITEMS : ITEMS.filter(i => i.category === tab)

  const handleBuy = (item: ShopItem) => setSelected(item)

  const confirmBuy = () => {
    if (!selected || !user) return
    setBusy(true)

    // Имитируем задержку сети
    setTimeout(() => {
      // Списываем монеты локально
      setUser({ ...user, coins: user.coins - selected.price })

      // Добавляем в историю
      const newPurchase: Purchase = {
        id: nextId,
        item: selected,
        purchasedAt: new Date(),
        status: selected.category === 'food' ? 'pending' : 'fulfilled',
      }
      setPurchases(prev => [newPurchase, ...prev])
      setNextId(p => p + 1)

      toast(`✅ Куплено: ${selected.name}`, 'success')
      setSelected(null)
      setBusy(false)
    }, 900)
  }

  const statusLabel: Record<Purchase['status'], string> = {
    pending:   '⏳ Ожидает выдачи',
    fulfilled: '✅ Выполнено',
  }

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Магазин</h1>
          <p className={s.subtitle}>Трать монеты на реальные призы и игровые бонусы</p>
        </div>
        <div className={s.balanceBadge}>
          <span className={s.balanceIcon}>🪙</span>
          <div>
            <span className={s.balanceNum}>{coins.toLocaleString('ru')}</span>
            <span className={s.balanceLabel}>монет</span>
          </div>
        </div>
      </header>

      {/* ── Переключатель вкладок Магазин / История ── */}
      <div className={s.topTabs}>
        <button
          className={`${s.topTab} ${histTab === 'shop' ? s.topTabActive : ''}`}
          onClick={() => setHistTab('shop')}
        >
          🛒 Каталог
        </button>
        <button
          className={`${s.topTab} ${histTab === 'history' ? s.topTabActive : ''}`}
          onClick={() => setHistTab('history')}
        >
          📋 Мои покупки
          {purchases.length > 0 && (
            <span className={s.histBadge}>{purchases.length}</span>
          )}
        </button>
      </div>

      {histTab === 'shop' ? (
        <>
          {/* ── Фильтры по категориям ── */}
          <div className={s.categories}>
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                className={`${s.catBtn} ${tab === c.key ? s.catBtnActive : ''}`}
                onClick={() => setTab(c.key)}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {/* ── Сетка товаров ── */}
          <div className={s.grid}>
            {filtered.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                balance={coins}
                onBuy={handleBuy}
              />
            ))}
          </div>
        </>
      ) : (
        /* ── История покупок ── */
        <div className={s.historyList}>
          {purchases.length === 0 ? (
            <div className={s.emptyState}>
              <span className={s.emptyIcon}>🛍️</span>
              <p className={s.emptyText}>Покупок ещё нет — самое время потратить монеты!</p>
              <button className={s.emptyBtn} onClick={() => setHistTab('shop')}>Перейти в каталог</button>
            </div>
          ) : (
            purchases.map(p => (
              <div key={p.id} className={s.historyItem}>
                <span className={s.historyEmoji}>{p.item.emoji}</span>
                <div className={s.historyInfo}>
                  <p className={s.historyName}>{p.item.name}</p>
                  <p className={s.historyMeta}>
                    {p.purchasedAt.toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <div className={s.historyRight}>
                  <span className={s.historyPrice}>−🪙 {p.item.price.toLocaleString('ru')}</span>
                  <span className={`${s.historyStatus} ${
                    p.status === 'fulfilled' ? s.historyStatusOk : s.historyStatusPending
                  }`}>
                    {statusLabel[p.status]}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Модалка подтверждения ── */}
      {selected && (
        <ConfirmModal
          item={selected}
          balance={coins}
          onConfirm={confirmBuy}
          onCancel={() => !busy && setSelected(null)}
          busy={busy}
        />
      )}
    </div>
  )
}
