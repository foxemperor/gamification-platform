import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { meApi, type Character, type CosmeticCatalogItem } from '../api/me'
import { CharacterSprite } from '../components/CharacterSprite'
import s from './InventoryPage.module.css'

// ────── Справочники слотов и редкости ──────
const SLOT_LABEL: Record<string, string> = {
  hair: 'Причёска',
  head: 'Головной убор',
  head_accessory: 'Аксессуар головы',
  eyes: 'Глаза',
  face_expression: 'Выражение лица',
  torso: 'Одежда (верх)',
  torso_accessory: 'Аксессуар одежды',
  legs: 'Одежда (низ)',
  weapon_main: 'Основное оружие',
  weapon_secondary: 'Дополнительное оружие',
}

const SLOT_ICON: Record<string, string> = {
  hair: '💇', head: '🎩', head_accessory: '👓', eyes: '👁️',
  face_expression: '😀', torso: '👕', torso_accessory: '🎀',
  legs: '👖', weapon_main: '🗡️', weapon_secondary: '🛡️',
}

// Порядок отображения слотов
const SLOT_ORDER = [
  'hair', 'head', 'head_accessory', 'eyes', 'face_expression',
  'torso', 'torso_accessory', 'legs', 'weapon_main', 'weapon_secondary',
]

const RARITY_RING: Record<string, string> = {
  common: '#64748b',
  rare: '#22d3ee',
  epic: '#a855f7',
  legendary: '#f59e0b',
}
const RARITY_LABEL: Record<string, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
}

// ────── ItemCard ──────
function ItemCard({
  item, busy, onEquip, onUnequip,
}: {
  item: CosmeticCatalogItem
  busy: boolean
  onEquip: (item: CosmeticCatalogItem) => void
  onUnequip: (item: CosmeticCatalogItem) => void
}) {
  const ring = RARITY_RING[item.rarity] ?? RARITY_RING.common
  const locked = !item.is_unlocked

  const cls = [
    s.itemCard,
    locked ? s.itemLocked : '',
    item.is_equipped ? s.itemEquipped : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      style={item.is_equipped ? { borderColor: ring } : undefined}
    >
      <div className={s.itemIconWrap}>
        <span className={s.itemIcon}>{SLOT_ICON[item.slot] ?? '✨'}</span>
        {locked && <span className={s.lockOverlay}>🔒</span>}
        {item.is_equipped && <span className={s.equippedMark}>✓</span>}
      </div>

      <p className={s.itemName}>{item.name}</p>
      {item.description && <p className={s.itemDesc}>{item.description}</p>}

      <span className={s.itemRarity} style={{ color: ring }}>
        {RARITY_LABEL[item.rarity] ?? item.rarity}
      </span>

      {locked ? (
        <div className={s.unlockHint}>
          <span className={s.unlockHintIcon}>🔒</span>
          <span className={s.unlockHintText}>
            {item.unlock_requirement ?? 'Особое условие разблокировки'}
          </span>
        </div>
      ) : item.is_equipped ? (
        <button
          className={`${s.itemBtn} ${s.itemBtnGhost}`}
          disabled={busy}
          onClick={() => onUnequip(item)}
        >
          Снять
        </button>
      ) : (
        <button
          className={`${s.itemBtn} ${s.itemBtnPrimary}`}
          disabled={busy}
          onClick={() => onEquip(item)}
        >
          Надеть
        </button>
      )}
    </div>
  )
}

// ────── Page ──────
export function InventoryPage() {
  const user = useAuthStore(st => st.user)

  const [character, setCharacter] = useState<Character | null>(null)
  const [items,     setItems]     = useState<CosmeticCatalogItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [busySlot,  setBusySlot]  = useState<string | null>(null)
  const [filter,    setFilter]    = useState<'all' | 'unlocked' | 'locked'>('all')
  const [error,     setError]     = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const reload = useCallback((sig?: AbortSignal) => {
    setLoading(true)
    Promise.all([
      meApi.getInventory(sig),
      meApi.getMyCharacter(sig).catch(() => null),
    ])
      .then(([inv, ch]) => {
        if (sig?.aborted) return
        setItems(inv)
        setCharacter(ch)
        setError(false)
      })
      .catch(err => {
        if (sig?.aborted) return
        const isAbort =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (typeof err?.message === 'string' && err.message === 'canceled')
        if (!isAbort) setError(true)
      })
      .finally(() => { if (!sig?.aborted) setLoading(false) })
  }, [])

  useEffect(() => {
    if (!user?.id) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    reload(ac.signal)
    return () => ac.abort()
  }, [user?.id, reload])

  // Надеть предмет: PATCH /character/equipment, затем перезагрузка
  const equip = async (item: CosmeticCatalogItem) => {
    if (!character) return
    setBusySlot(item.slot)
    try {
      await meApi.equipItem({ slot: item.slot, cosmetic_item_id: item.id })
      reload()
    } catch {
      setError(true)
    } finally {
      setBusySlot(null)
    }
  }

  // Снять предмет: cosmetic_item_id=null
  const unequip = async (item: CosmeticCatalogItem) => {
    if (!character) return
    setBusySlot(item.slot)
    try {
      await meApi.equipItem({ slot: item.slot, cosmetic_item_id: null })
      reload()
    } catch {
      setError(true)
    } finally {
      setBusySlot(null)
    }
  }

  // Статистика
  const unlockedCount = items.filter(i => i.is_unlocked).length
  const totalCount    = items.length

  // Фильтрация
  const filtered = items.filter(i => {
    if (filter === 'unlocked') return i.is_unlocked
    if (filter === 'locked')   return !i.is_unlocked
    return true
  })

  // Группировка по слотам в заданном порядке
  const grouped = SLOT_ORDER
    .map(slot => ({ slot, list: filtered.filter(i => i.slot === slot) }))
    .filter(g => g.list.length > 0)

  return (
    <div className={s.page}>

      {/* Header */}
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Инвентарь</h1>
          <p className={s.subtitle}>
            Выбирай косметику для персонажа и открывай новые предметы за достижения
          </p>
        </div>
        {!loading && (
          <div className={s.headerBadge}>
            <span className={s.headerBadgeCount}>{unlockedCount}</span>
            <span className={s.headerBadgeLabel}>из {totalCount} открыто</span>
          </div>
        )}
      </header>

      {/* Нет персонажа — нечего наряжать */}
      {!loading && !character && (
        <div className={s.noChar}>
          <span className={s.noCharIcon}>🎭</span>
          <p className={s.noCharText}>
            Сначала создайте персонажа — тогда можно будет наряжать его предметами инвентаря.
          </p>
          <Link to="/settings" className={s.noCharBtn}>Создать персонажа</Link>
        </div>
      )}

      {loading ? (
        <div className={s.skelGrid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`${s.itemCard} ${s.skel}`} />
          ))}
        </div>
      ) : error ? (
        <div className={s.errorBox}>
          ⚠️ Не удалось загрузить инвентарь —{' '}
          <button className={s.retryBtn} onClick={() => reload()}>повторить</button>
        </div>
      ) : (
        <div className={s.layout}>

          {/* Превью персонажа */}
          {character && (
            <aside className={s.preview}>
              <div className={s.previewSprite}>
                <CharacterSprite
                  className={s.previewSpriteBody}
                  slug={character.character_type.slug}
                  skinColor={character.skin_color}
                  hairColor={character.hair_color}
                  eyesColor={character.eyes_color}
                />
              </div>
              <p className={s.previewName}>{character.character_type.name}</p>
              <p className={s.previewLevel}>LVL {character.level}</p>

              <div className={s.previewEquip}>
                <p className={s.previewEquipTitle}>Надето</p>
                {(character.equipment?.length ?? 0) > 0 ? (
                  <ul className={s.previewEquipList}>
                    {character.equipment.map(eq => (
                      <li key={eq.id} className={s.previewEquipItem}>
                        <span>{SLOT_ICON[eq.slot] ?? '✨'}</span>
                        <span className={s.previewEquipName}>{eq.cosmetic_item.name}</span>
                        <span className={s.previewEquipSlot}>{SLOT_LABEL[eq.slot] ?? eq.slot}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={s.previewEmpty}>Слоты пусты</p>
                )}
              </div>
            </aside>
          )}

          {/* Каталог предметов */}
          <div className={s.catalog}>

            {/* Фильтр */}
            <div className={s.filterRow}>
              {(['all', 'unlocked', 'locked'] as const).map(f => (
                <button
                  key={f}
                  className={`${s.filterBtn} ${filter === f ? s.filterBtnActive : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all'      && `Все (${totalCount})`}
                  {f === 'unlocked' && `Доступны (${unlockedCount})`}
                  {f === 'locked'   && `Закрыты (${totalCount - unlockedCount})`}
                </button>
              ))}
            </div>

            {grouped.length === 0 ? (
              <div className={s.empty}>
                <span className={s.emptyIcon}>🎒</span>
                <p>В этой категории пока нет предметов</p>
              </div>
            ) : (
              grouped.map(({ slot, list }) => (
                <section key={slot} className={s.slotSection}>
                  <h2 className={s.slotTitle}>
                    <span className={s.slotTitleIcon}>{SLOT_ICON[slot] ?? '✨'}</span>
                    {SLOT_LABEL[slot] ?? slot}
                  </h2>
                  <div className={s.itemsGrid}>
                    {list.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        busy={busySlot === item.slot}
                        onEquip={equip}
                        onUnequip={unequip}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
