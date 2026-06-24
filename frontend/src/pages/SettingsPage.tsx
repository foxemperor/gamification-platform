/**
 * SettingsPage — настройки учётной записи пользователя.
 *
 * Три секции:
 *   1. Профиль       — отображаемое имя (full_name) и дата рождения (birthday).
 *   2. Аватар        — выбор из пресетов ИЛИ загрузка своего файла.
 *                      Загруженный файл конвертируется в data-URL и сохраняется
 *                      в users.avatar_url (Text), без отдельного файлового бэкенда.
 *   3. Персонаж      — создание героя выбранного архетипа с кастомными цветами,
 *                      если персонаж ещё не создан (модель Character).
 *
 * Все изменения профиля/аватара сохраняются через PATCH /auth/me и
 * синхронизируются в authStore (updateUser) — сразу видны в сайдбаре и обзоре.
 */
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'
import {
  meApi,
  type Character,
  type CharacterType,
  type CharacterTypeSlug,
} from '../api/me'
import { CharacterSprite } from '../components/CharacterSprite'
import { useAppToast } from '../App'
import s from './SettingsPage.module.css'

// ────── Пресеты аватаров (SVG data-URL, без внешних ассетов) ──────
function presetAvatar(bg: string, emoji: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" rx="48" fill="${bg}"/>` +
    `<text x="48" y="50" font-size="46" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const AVATAR_PRESETS: string[] = [
  presetAvatar('#22D3EE', '🦊'),
  presetAvatar('#A78BFA', '🐱'),
  presetAvatar('#34D399', '🐸'),
  presetAvatar('#FBBF24', '🦁'),
  presetAvatar('#F87171', '🦄'),
  presetAvatar('#60A5FA', '🐺'),
  presetAvatar('#F472B6', '🐰'),
  presetAvatar('#2DD4BF', '🐲'),
  presetAvatar('#FB923C', '🦉'),
  presetAvatar('#818CF8', '🤖'),
  presetAvatar('#4ADE80', '👾'),
  presetAvatar('#E879F9', '🎮'),
]

const ARCHETYPE_EMOJI: Record<CharacterTypeSlug, string> = {
  warrior: '⚔️', mage: '🔮', rogue: '🗡️', engineer: '🛠️',
}

const MAX_AVATAR_BYTES = 512 * 1024 // 512 КБ на data-URL

function initialsOf(name: string | null | undefined, email: string): string {
  if (name && name.trim()) return name.trim().slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

/**
 * Конвертирует дату рождения в значение для <input type="date"> (YYYY-MM-DD).
 * Защищает от локализованного формата DD.MM.YYYY, который может храниться
 * в старых записях или прийти из бэкенда в человекочитаемом виде.
 */
function toDateInputValue(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  // DD.MM.YYYY → YYYY-MM-DD
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(isoDate)) {
    const [d, m, y] = isoDate.split('.')
    return `${y}-${m}-${d}`
  }
  // Уже ISO YYYY-MM-DD или datetime — берём первые 10 символов
  return isoDate.slice(0, 10)
}

export function SettingsPage() {
  const user = useAuthStore(st => st.user)
  const updateUser = useAuthStore(st => st.updateUser)
  const toast = useAppToast()

  // ── Профиль / аватар ──
  const [fullName, setFullName]     = useState(user?.full_name ?? '')
  const [birthday, setBirthday]     = useState<string>(toDateInputValue(user?.birthday as string | null))
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(user?.avatar_url ?? null)
  const [savingProfile, setSavingProfile] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Персонаж ──
  const [character, setCharacter]     = useState<Character | null>(null)
  const [charLoading, setCharLoading] = useState(true)
  const [types, setTypes]             = useState<CharacterType[]>([])
  const [selSlug, setSelSlug]         = useState<CharacterTypeSlug>('warrior')
  const [skin, setSkin]               = useState('#F5C5A3')
  const [hair, setHair]               = useState('#2C1810')
  const [eyes, setEyes]               = useState('#4A90D9')
  const [creatingChar, setCreatingChar] = useState(false)

  useEffect(() => {
    setFullName(user?.full_name ?? '')
    setAvatarUrl(user?.avatar_url ?? null)
    setBirthday(toDateInputValue(user?.birthday as string | null))
  }, [user?.full_name, user?.avatar_url, user?.birthday])

  useEffect(() => {
    const ac = new AbortController()
    meApi.getCharacterTypes()
      .then(t => { if (!ac.signal.aborted) setTypes(t) })
      .catch(() => { /* silent */ })
    meApi.getMyCharacter(ac.signal)
      .then(c => { if (!ac.signal.aborted) setCharacter(c) })
      .catch(() => { if (!ac.signal.aborted) setCharacter(null) })
      .finally(() => { if (!ac.signal.aborted) setCharLoading(false) })
    return () => ac.abort()
  }, [])

  if (!user) return null

  const previewAvatar = avatarUrl
  const initials = initialsOf(fullName, user.email)

  // ────── Загрузка файла → data-URL ──────
  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Выберите файл изображения', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (result.length > MAX_AVATAR_BYTES * 1.4) {
        toast('Изображение слишком большое (макс. ~512 КБ). Выберите файл поменьше.', 'error')
        return
      }
      setAvatarUrl(result)
    }
    reader.onerror = () => toast('Не удалось прочитать файл', 'error')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ────── Сохранение профиля + аватара ──────
  async function saveProfile() {
    setSavingProfile(true)
    try {
      const updated = await authApi.updateMe({
        full_name: fullName.trim(),
        avatar_url: avatarUrl ?? '',
        birthday: birthday || null,
      })
      updateUser({
        full_name: updated.full_name,
        avatar_url: updated.avatar_url,
        birthday: updated.birthday,
      })
      toast('Профиль сохранён', 'success')
    } catch {
      toast('Не удалось сохранить профиль', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // ────── Создание персонажа ──────
  async function createCharacter() {
    setCreatingChar(true)
    try {
      const created = await meApi.createCharacter({
        character_type_slug: selSlug,
        skin_color: skin,
        hair_color: hair,
        eyes_color: eyes,
      })
      setCharacter(created)
      toast('Персонаж создан! Бонусы уже активны.', 'success')
    } catch {
      toast('Не удалось создать персонажа', 'error')
    } finally {
      setCreatingChar(false)
    }
  }

  const selType = types.find(t => t.slug === selSlug)

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <h1 className={s.pageTitle}>Настройки аккаунта</h1>
        <p className={s.pageSub}>Управление профилем, аватаром и персонажем игрока</p>
      </div>

      {/* ───── Профиль ───── */}
      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>👤</span>
          <div>
            <h2 className={s.cardTitle}>Профиль</h2>
            <p className={s.cardDesc}>Имя и дата рождения, которые видят другие участники команды</p>
          </div>
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor="fullName">Отображаемое имя</label>
          <input
            id="fullName"
            className={s.input}
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Например: Иван Иванов"
            maxLength={120}
          />
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor="birthday">Дата рождения</label>
          <input
            id="birthday"
            className={s.input}
            type="date"
            value={birthday}
            onChange={e => setBirthday(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
          {birthday && (
            <button
              type="button"
              className={s.clearBtn}
              onClick={() => setBirthday('')}
            >
              Очистить дату
            </button>
          )}
        </div>

        <div className={s.field}>
          <span className={s.label}>Логин</span>
          <input className={s.input} type="text" value={user.username} disabled />
        </div>
      </section>

      {/* ───── Аватар ───── */}
      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>🖼️</span>
          <div>
            <h2 className={s.cardTitle}>Аватар</h2>
            <p className={s.cardDesc}>Выберите готовый или загрузите свой</p>
          </div>
        </div>

        <div className={s.avatarRow}>
          <div className={s.avatarPreview}>
            {previewAvatar
              ? <img className={s.avatarPreviewImg} src={previewAvatar} alt="Аватар" />
              : initials}
          </div>
          <div className={s.avatarActions}>
            <button
              type="button"
              className={s.uploadBtn}
              onClick={() => fileRef.current?.click()}
            >
              ⬆️ Загрузить изображение
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFilePick}
            />
            <span className={s.uploadHint}>PNG, JPG или SVG, до ~512 КБ</span>
            {avatarUrl && (
              <button type="button" className={s.clearBtn} onClick={() => setAvatarUrl(null)}>
                Убрать аватар
              </button>
            )}
          </div>
        </div>

        <p className={s.presetsLabel}>Или выберите готовый аватар</p>
        <div className={s.presetsGrid}>
          {AVATAR_PRESETS.map((url, i) => {
            const active = avatarUrl === url
            return (
              <button
                key={i}
                type="button"
                className={`${s.presetItem} ${active ? s.presetItemActive : ''}`}
                onClick={() => setAvatarUrl(url)}
                aria-label={`Пресет ${i + 1}`}
              >
                <img className={s.presetImg} src={url} alt="" />
                {active && <span className={s.presetCheck}>✓</span>}
              </button>
            )
          })}
        </div>

        <div className={s.saveRow}>
          <button
            className={s.saveBtn}
            onClick={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? 'Сохранение…' : 'Сохранить профиль'}
          </button>
        </div>
      </section>

      {/* ───── Персонаж ───── */}
      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>🎭</span>
          <div>
            <h2 className={s.cardTitle}>Персонаж игрока</h2>
            <p className={s.cardDesc}>
              Архетип даёт бонусы к XP и монетам. Выбирается один раз.
            </p>
          </div>
        </div>

        {charLoading ? (
          <p className={s.cardDesc}>Загрузка…</p>
        ) : character ? (
          /* ── Персонаж уже создан ── */
          <>
            <div className={s.charExisting}>
              <CharacterSprite
                slug={character.character_type.slug}
                skinColor={character.skin_color}
                hairColor={character.hair_color}
                eyesColor={character.eyes_color}
                size={88}
              />
              <div className={s.charExistingInfo}>
                <span className={s.charExistingName}>
                  {ARCHETYPE_EMOJI[character.character_type.slug]} {character.character_type.name}
                </span>
                <span className={s.charExistingMeta}>
                  Уровень {character.level} · {character.experience.toLocaleString()} XP
                </span>
                {character.character_type.bonus_description && (
                  <span className={s.charExistingMeta}>
                    {character.character_type.bonus_description}
                  </span>
                )}
                <div className={s.charExistingTags}>
                  <span className={s.charExistingTag}>
                    ×{character.xp_multiplier.toFixed(2)} XP
                  </span>
                  <span className={s.charExistingTag}>
                    ×{character.coin_multiplier.toFixed(2)} монеты
                  </span>
                </div>
              </div>
            </div>
            <p className={s.lockNote}>
              🔒 Архетип персонажа изменить нельзя. Внешний вид меняется через косметику в магазине.
            </p>
          </>
        ) : (
          /* ── Создание персонажа ── */
          <>
            <div className={s.archGrid}>
              {types.map(t => {
                const active = selSlug === t.slug
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`${s.archCard} ${active ? s.archCardActive : ''}`}
                    onClick={() => setSelSlug(t.slug)}
                  >
                    <span className={s.archEmoji}>{ARCHETYPE_EMOJI[t.slug]}</span>
                    <span className={s.archName}>{t.name}</span>
                    {t.bonus_description && (
                      <span className={s.archBonus}>{t.bonus_description}</span>
                    )}
                    <span className={s.archMult}>
                      <span className={s.archMultTag}>×{t.xp_multiplier_base.toFixed(2)} XP</span>
                      <span className={s.archMultTag}>×{t.coin_multiplier_base.toFixed(2)} 🪙</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className={s.colorsRow}>
              <div className={s.colorField}>
                <span className={s.colorLabel}>Кожа</span>
                <input className={s.colorInput} type="color" value={skin}
                  onChange={e => setSkin(e.target.value)} />
              </div>
              <div className={s.colorField}>
                <span className={s.colorLabel}>Волосы</span>
                <input className={s.colorInput} type="color" value={hair}
                  onChange={e => setHair(e.target.value)} />
              </div>
              <div className={s.colorField}>
                <span className={s.colorLabel}>Глаза</span>
                <input className={s.colorInput} type="color" value={eyes}
                  onChange={e => setEyes(e.target.value)} />
              </div>
              <div className={s.previewBox}>
                <CharacterSprite
                  slug={selSlug}
                  skinColor={skin}
                  hairColor={hair}
                  eyesColor={eyes}
                  size={80}
                />
                <span className={s.previewLabel}>
                  {selType?.name ?? ARCHETYPE_EMOJI[selSlug]}
                </span>
              </div>
            </div>

            <div className={s.saveRow}>
              <button
                className={s.saveBtn}
                onClick={createCharacter}
                disabled={creatingChar || types.length === 0}
              >
                {creatingChar ? 'Создание…' : 'Создать персонажа'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
