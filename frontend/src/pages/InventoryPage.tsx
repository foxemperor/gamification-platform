import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { meApi, type Character, type CosmeticCatalogItem } from '../api/me'
import { CharacterRenderer, type EquipSlot } from '../components/CharacterRenderer'
import s from './InventoryPage.module.css'

// ────── Справочники ──────
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
  face_expression: '😀', torso: '👕', torso_accessory: '🎠',
  legs: '👖', weapon_main: '🗡️', weapon_secondary: '🛡️',
}

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

  // ── Редактор цветов ──
  const [skin, setSkin]         = useState('#F5C5A3')
  const [hair, setHair]         = useState('#2C1810')
  const [eyes, setEyes]         = useState('#4A90D9')
  const [colorsDirty, setColorsDirty] = useState(false)
  const [savingColors, setSavingColors] = useState(false)

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
        // Синхронизируем локальные цвета с данными персонажа
        if (ch) {
          setSkin(ch.skin_color ?? '#F5C5A3')
          setHair(ch.hair_color ?? '#2C1810')
          setEyes(ch.eyes_color ?? '#4A90D9')
          setColorsDirty(false)
        }
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

  const saveColors = async () => {
    setSavingColors(true)
    try {
      const updated = await meApi.updateCharacterColors({
        skin_color: skin,
        hair_color: hair,
        eyes_color: eyes,
      })
      setCharacter(updated)
      setColorsDirty(false)
    } catch {
      setError(true)
    } finally {
      setSavingColors(false)
    }
  }

  const unlockedCount = items.filter(i => i.is_unlocked).length
  const totalCount    = items.length

  const filtered = items.filter(i => {
    if (filter === 'unlocked') return i.is_unlocked
    if (filter === 'locked')   return !i.is_unlocked
    return true
  })

  const grouped = SLOT_ORDER
    .map(slot => ({ slot, list: filtered.filter(i => i.slot === slot) }))
    .filter(g => g.list.length > 0)

  // Преобразуем equipment для CharacterRenderer
  const rendererEquipment: EquipSlot[] = (character?.equipment ?? []).map(eq => ({
    slot: eq.slot,
    name: eq.cosmetic_item.name,
    rarity: (eq.cosmetic_item.rarity as EquipSlot['rarity']) ?? 'common',
  }))

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

      {/* Нет персонажа */}
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
      ) : character ? (
        <>
          {/* ── Превью + редактор цветов ── */}
          <div className={s.charPanel}>
            <div className={s.charPreviewWrap}>
              <CharacterRenderer
                slug={character.character_type.slug}
                skinColor={skin}
                hairColor={hair}
                eyesColor={eyes}
                equipment={rendererEquipment}
                size={220}
              />
            </div>

            <div className={s.colorEditor}>
              <p className={s.colorEditorTitle}>🎨 Цвета персонажа</p>
              <div className={s.colorFields}>
                <label className={s.colorField}>
                  <span className={s.colorLabel}>🧖 Кожа</span>
                  <input
                    type="color"
                    className={s.colorInput}
                    value={skin}
                    onChange={e => { setSkin(e.target.value); setColorsDirty(true) }}
                  />
                </label>
                <label className={s.colorField}>
                  <span className={s.colorLabel}>💇 Волосы</span>
                  <input
                    type="color"
                    className={s.colorInput}
                    value={hair}
                    onChange={e => { setHair(e.target.value); setColorsDirty(true) }}
                  />
                </label>
                <label className={s.colorField}>
                  <span className={s.colorLabel}>👁️ Глаза</span>
                  <input
                    type="color"
                    className={s.colorInput}
                    value={eyes}
                    onChange={e => { setEyes(e.target.value); setColorsDirty(true) }}
                  />
                </label>
              </div>
              {colorsDirty && (
                <button
                  className={s.saveColorsBtn}
                  onClick={saveColors}
                  disabled={savingColors}
                >
                  {savingColors ? 'Сохранение…' : '✅ Сохранить цвета'}
                </button>
              )}
            </div>
          </div>

          {/* ── Фильтры ── */}
          <div className={s.filters}>
            {(['all', 'unlocked', 'locked'] as const).map(f => (
              <button
                key={f}
                className={`${s.filterBtn} ${filter === f ? s.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Все' : f === 'unlocked' ? 'Открытые' : 'Закрытые'}
              </button>
            ))}
          </div>

          {/* ── Сетка предметов по слотам ── */}
          {grouped.map(({ slot, list }) => (
            <div key={slot} className={s.slotGroup}>
              <h2 className={s.slotTitle}>
                {SLOT_ICON[slot]} {SLOT_LABEL[slot] ?? slot}
              </h2>
              <div className={s.itemGrid}>
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
            </div>
          ))}

          {grouped.length === 0 && (
            <p className={s.emptyMsg}>Предметы не найдены</p>
          )}
        </>
      ) : null}
    </div>
  )
}
