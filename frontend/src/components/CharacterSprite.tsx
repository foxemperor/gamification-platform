/**
 * CharacterSprite — векторный аватар персонажа игрока.
 *
 * Рисуется SVG-ом и раскрашивается по полям Character:
 *   skin_color / hair_color / eyes_color.
 * Архетип (warrior / mage / rogue / engineer) меняет цвет «экипировки»
 * и иконку-эмблему, чтобы персонажи разных классов отличались визуально.
 *
 * Никаких внешних ассетов — всё рисуется кодом, что надёжно для
 * оффлайн-демонстрации дипломного проекта.
 */
import type { CharacterTypeSlug } from '../api/me'

interface Props {
  slug: CharacterTypeSlug
  skinColor?: string | null
  hairColor?: string | null
  eyesColor?: string | null
  size?: number
  className?: string
}

const ARCHETYPE_GEAR: Record<CharacterTypeSlug, { gear: string; emblem: string }> = {
  warrior:  { gear: '#B0413E', emblem: '⚔️' },
  mage:     { gear: '#5B3FA0', emblem: '🔮' },
  rogue:    { gear: '#2E7D55', emblem: '🗡️' },
  engineer: { gear: '#1E7FA8', emblem: '🛠️' },
}

export function CharacterSprite({
  slug,
  skinColor = '#F5C5A3',
  hairColor = '#2C1810',
  eyesColor = '#4A90D9',
  size = 120,
  className,
}: Props) {
  const skin = skinColor || '#F5C5A3'
  const hair = hairColor || '#2C1810'
  const eyes = eyesColor || '#4A90D9'
  const gear = ARCHETYPE_GEAR[slug]?.gear ?? '#1E7FA8'

  return (
    <svg
      className={className}
      width={size}
      height={size * 1.17}
      viewBox="0 0 120 140"
      role="img"
      aria-label={`Персонаж класса ${slug}`}
    >
      {/* Тело / экипировка */}
      <path
        d="M30 138 Q30 96 60 96 Q90 96 90 138 Z"
        fill={gear}
      />
      <rect x="48" y="92" width="24" height="14" rx="4" fill={skin} />

      {/* Голова */}
      <circle cx="60" cy="62" r="30" fill={skin} />

      {/* Волосы */}
      <path
        d="M30 60 Q30 28 60 28 Q90 28 90 60 Q90 44 60 44 Q30 44 30 60 Z"
        fill={hair}
      />

      {/* Глаза */}
      <circle cx="50" cy="62" r="4.2" fill={eyes} />
      <circle cx="70" cy="62" r="4.2" fill={eyes} />
      <circle cx="50" cy="62" r="1.6" fill="#1a1a1a" />
      <circle cx="70" cy="62" r="1.6" fill="#1a1a1a" />

      {/* Улыбка */}
      <path
        d="M52 76 Q60 82 68 76"
        stroke="#7a4a36"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Воротник-акцент архетипа */}
      <path
        d="M44 100 L60 110 L76 100 L72 118 L48 118 Z"
        fill={gear}
        opacity="0.85"
      />
    </svg>
  )
}
