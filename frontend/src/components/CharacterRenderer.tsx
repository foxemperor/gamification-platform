/**
 * CharacterRenderer
 * =================
 * Слоевой SVG-рендер персонажа для демо-ветки (issue #12).
 * Работает полностью на фронтенде — никаких бэкенд-запросов.
 *
 * Слои (снизу вверх):
 *   body → legs → torso → torso_accessory → weapon_main → weapon_secondary → head → hair → eyes → head_accessory
 *
 * Props:
 *   slug          — тип персонажа ('warrior' | 'mage' | 'archer' | др.)
 *   skinColor     — hex цвет кожи
 *   hairColor     — hex цвет волос
 *   eyesColor     — hex цвет глаз
 *   equipment     — список надетых предметов { slot, name }
 *   onEquipChange — колбэк (slot, itemName | null) при клике по слоту
 *   size          — размер SVG в px (default 220)
 */
import { useState } from 'react'
import s from './CharacterRenderer.module.css'

export interface EquipSlot {
  slot: string
  name: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
}

interface Props {
  slug?: string
  skinColor?: string
  hairColor?: string
  eyesColor?: string
  equipment?: EquipSlot[]
  size?: number
  className?: string
}

const RARITY_COLOR: Record<string, string> = {
  common: '#64748b',
  rare: '#22d3ee',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

// Цвета базового силуэта по классу
const CLASS_PALETTE: Record<string, { armor: string; weapon: string; accent: string }> = {
  warrior: { armor: '#4a6fa5', weapon: '#c0c0c0', accent: '#e63946' },
  mage:    { armor: '#6a4c9c', weapon: '#a8dadc', accent: '#f4d35e' },
  archer:  { armor: '#2d6a4f', weapon: '#8b5e3c', accent: '#95d5b2' },
  rogue:   { armor: '#1d3557', weapon: '#e9c46a', accent: '#e76f51' },
  default: { armor: '#5c677d', weapon: '#adb5bd', accent: '#4cc9f0' },
}

export function CharacterRenderer({
  slug = 'warrior',
  skinColor = '#f4c89a',
  hairColor = '#5c3d2e',
  eyesColor = '#2d6a8f',
  equipment = [],
  size = 220,
  className,
}: Props) {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null)

  const pal = CLASS_PALETTE[slug] ?? CLASS_PALETTE.default

  const equipped = (slot: string) => equipment.find(e => e.slot === slot)
  const hasWeapon = !!equipped('weapon_main')
  const hasArmor  = !!equipped('torso')
  const hasHelmet = !!equipped('head')
  const hasShield = !!equipped('weapon_secondary')
  const hasCloak  = !!equipped('torso_accessory')

  const slotGlow = (slot: string) =>
    hoveredSlot === slot ? 'url(#glow)' : 'none'

  const armorColor = hasArmor  ? pal.armor  : '#7c8a9e'
  const weapColor  = hasWeapon ? pal.weapon : '#9ca3af'
  const accentColor = pal.accent

  return (
    <div className={`${s.wrap} ${className ?? ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 140"
        xmlns="http://www.w3.org/2000/svg"
        className={s.svg}
        aria-label="Персонаж"
      >
        <defs>
          {/* Glow filter для hover */}
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Metallic gradient для оружия */}
          <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#e8e8e8" />
            <stop offset="50%" stopColor={weapColor} />
            <stop offset="100%" stopColor="#888" />
          </linearGradient>
          {/* Armor gradient */}
          <linearGradient id="armorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={armorColor} />
            <stop offset="100%" stopColor={`${armorColor}99`} />
          </linearGradient>
        </defs>

        {/* ── СЛОЙ 0: Тень ── */}
        <ellipse cx="50" cy="132" rx="18" ry="4" fill="rgba(0,0,0,0.18)" />

        {/* ── СЛОЙ 1: Ноги ── */}
        <g className={s.layerLegs}>
          {/* Левая нога */}
          <rect x="38" y="88" width="10" height="26" rx="4"
            fill={hasArmor ? `${armorColor}cc` : skinColor} />
          {/* Правая нога */}
          <rect x="52" y="88" width="10" height="26" rx="4"
            fill={hasArmor ? `${armorColor}cc` : skinColor} />
          {/* Ступни */}
          <rect x="36" y="111" width="13" height="5" rx="3" fill="#3d2c1e" />
          <rect x="51" y="111" width="13" height="5" rx="3" fill="#3d2c1e" />
        </g>

        {/* ── СЛОЙ 2: Туловище ── */}
        <g
          className={s.layerTorso}
          filter={slotGlow('torso')}
          onMouseEnter={() => setHoveredSlot('torso')}
          onMouseLeave={() => setHoveredSlot(null)}
          style={{ cursor: 'pointer' }}
        >
          <rect x="34" y="58" width="32" height="32" rx="6"
            fill="url(#armorGrad)" stroke={hasArmor ? accentColor : 'none'} strokeWidth="0.8" />
          {/* Детали брони */}
          {hasArmor && (
            <>
              <rect x="38" y="62" width="24" height="3" rx="1.5" fill={`${accentColor}80`} />
              <circle cx="50" cy="72" r="3" fill={accentColor} opacity="0.7" />
              <rect x="42" y="78" width="16" height="2" rx="1" fill={`${accentColor}60`} />
            </>
          )}
        </g>

        {/* ── СЛОЙ 3: Плащ/аксессуар туловища ── */}
        {hasCloak && (
          <g
            filter={slotGlow('torso_accessory')}
            onMouseEnter={() => setHoveredSlot('torso_accessory')}
            onMouseLeave={() => setHoveredSlot(null)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d="M34 65 Q20 80 22 115 L34 110 Z"
              fill={`${accentColor}60`}
              stroke={accentColor}
              strokeWidth="0.5"
            />
            <path
              d="M66 65 Q80 80 78 115 L66 110 Z"
              fill={`${accentColor}60`}
              stroke={accentColor}
              strokeWidth="0.5"
            />
          </g>
        )}

        {/* ── СЛОЙ 4: Основное оружие (левая рука) ── */}
        <g
          filter={slotGlow('weapon_main')}
          onMouseEnter={() => setHoveredSlot('weapon_main')}
          onMouseLeave={() => setHoveredSlot(null)}
          style={{ cursor: 'pointer' }}
        >
          {slug === 'mage' ? (
            /* Посох */
            <g>
              <rect x="18" y="30" width="3" height="60" rx="1.5" fill="#8b5e3c" />
              <circle cx="19.5" cy="28" r="5" fill={weapColor}
                filter={hasWeapon ? 'url(#glow)' : undefined} />
              <circle cx="19.5" cy="28" r="3" fill={`${weapColor}cc`} />
            </g>
          ) : slug === 'archer' ? (
            /* Лук */
            <g>
              <path d="M18 35 Q10 70 18 105" fill="none" stroke="#8b5e3c" strokeWidth="2" />
              <line x1="18" y1="35" x2="18" y2="105" stroke={weapColor} strokeWidth="0.5" strokeDasharray="3,3" />
            </g>
          ) : (
            /* Меч */
            <g>
              <rect x="17" y="45" width="4" height="55" rx="2"
                fill="url(#metalGrad)" />
              <rect x="13" y="65" width="12" height="4" rx="2" fill={accentColor} />
              <rect x="18" y="43" width="2" height="6" rx="1" fill="#f59e0b" />
            </g>
          )}
        </g>

        {/* ── СЛОЙ 5: Щит/доп.оружие (правая рука) ── */}
        {hasShield && (
          <g
            filter={slotGlow('weapon_secondary')}
            onMouseEnter={() => setHoveredSlot('weapon_secondary')}
            onMouseLeave={() => setHoveredSlot(null)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d="M76 55 Q88 58 88 78 Q88 95 76 100 Q64 95 64 78 Q64 58 76 55Z"
              fill={armorColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <circle cx="76" cy="77" r="5" fill={accentColor} opacity="0.6" />
          </g>
        )}

        {/* ── СЛОЙ 6: Руки ── */}
        <g className={s.layerArms}>
          {/* Левая рука */}
          <rect x="24" y="60" width="9" height="22" rx="4"
            fill={hasArmor ? armorColor : skinColor} />
          <circle cx="28.5" cy="84" r="5" fill={skinColor} />
          {/* Правая рука */}
          <rect x="67" y="60" width="9" height="22" rx="4"
            fill={hasArmor ? armorColor : skinColor} />
          <circle cx="71.5" cy="84" r="5" fill={skinColor} />
        </g>

        {/* ── СЛОЙ 7: Шея + голова ── */}
        <rect x="45" y="50" width="10" height="10" rx="2" fill={skinColor} />

        <g
          filter={slotGlow('head')}
          onMouseEnter={() => setHoveredSlot('head')}
          onMouseLeave={() => setHoveredSlot(null)}
          style={{ cursor: 'pointer' }}
        >
          {/* Голова */}
          <ellipse cx="50" cy="38" rx="16" ry="18" fill={skinColor} />

          {/* Глаза */}
          <ellipse cx="44" cy="36" rx="3.5" ry="4" fill="white" />
          <ellipse cx="56" cy="36" rx="3.5" ry="4" fill="white" />
          <circle cx="44" cy="37" r="2" fill={eyesColor} />
          <circle cx="56" cy="37" r="2" fill={eyesColor} />
          <circle cx="44.8" cy="36.2" r="0.7" fill="white" />
          <circle cx="56.8" cy="36.2" r="0.7" fill="white" />

          {/* Рот */}
          <path d="M45 44 Q50 47 55 44" fill="none" stroke="#c0796a" strokeWidth="1.2" strokeLinecap="round" />

          {/* Шлем */}
          {hasHelmet && (
            <>
              <path
                d="M34 32 Q34 16 50 14 Q66 16 66 32 L62 34 Q50 20 38 34 Z"
                fill={armorColor}
                stroke={accentColor}
                strokeWidth="1"
              />
              {/* Забрало */}
              <rect x="40" y="30" width="20" height="8" rx="3"
                fill={`${armorColor}dd`}
                stroke={accentColor}
                strokeWidth="0.8"
              />
            </>
          )}
        </g>

        {/* ── СЛОЙ 8: Волосы ── */}
        {!hasHelmet && (
          <g
            filter={slotGlow('hair')}
            onMouseEnter={() => setHoveredSlot('hair')}
            onMouseLeave={() => setHoveredSlot(null)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d="M34 34 Q33 18 50 14 Q67 18 66 34 Q62 22 50 21 Q38 22 34 34Z"
              fill={hairColor}
            />
            {slug === 'mage' && (
              <path d="M50 14 Q55 5 60 10 Q58 14 55 15Z" fill={hairColor} />
            )}
          </g>
        )}

        {/* ── СЛОЙ 9: Аксессуар головы ── */}
        {equipped('head_accessory') && (
          <g
            filter={slotGlow('head_accessory')}
            onMouseEnter={() => setHoveredSlot('head_accessory')}
            onMouseLeave={() => setHoveredSlot(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Корона / очки — выбираем по rariry */}
            {equipped('head_accessory')?.rarity === 'legendary' ? (
              /* Корона */
              <g>
                <rect x="38" y="16" width="24" height="5" rx="1" fill="#f59e0b" />
                <polygon points="38,16 41,9 44,16" fill="#f59e0b" />
                <polygon points="47,16 50,8 53,16" fill="#f59e0b" />
                <polygon points="56,16 59,9 62,16" fill="#f59e0b" />
                <circle cx="50" cy="11" r="2" fill="#ef4444" />
              </g>
            ) : (
              /* Очки */
              <g>
                <circle cx="44" cy="36" r="5" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
                <circle cx="56" cy="36" r="5" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
                <line x1="49" y1="36" x2="51" y2="36" stroke="#f59e0b" strokeWidth="1" />
                <line x1="34" y1="35" x2="39" y2="36" stroke="#f59e0b" strokeWidth="1" />
                <line x1="61" y1="36" x2="66" y2="35" stroke="#f59e0b" strokeWidth="1" />
              </g>
            )}
          </g>
        )}
      </svg>

      {/* Подсказка слота */}
      {hoveredSlot && (
        <div className={s.slotTooltip}>
          {equipped(hoveredSlot)
            ? <><span className={s.tooltipEquipped}>✓</span> {equipped(hoveredSlot)!.name}</>
            : <span className={s.tooltipEmpty}>Слот свободен</span>
          }
        </div>
      )}
    </div>
  )
}
