import { useState, useEffect, useCallback } from 'react'
import { Quest } from '../api/quests'
import styles from './SkillViewer.module.css'

interface SkillViewerProps {
  quest: Quest
  onComplete: () => void
  onClose: () => void
}

interface Slide {
  id: number
  type: 'intro' | 'task' | 'skills' | 'finish'
  title: string
  content: string
  bullets?: string[]
  icon: string
}

export function buildSlides(quest: Quest): Slide[] {
  const slides: Slide[] = []

  // Slide 1: Introduction
  slides.push({
    id: 0,
    type: 'intro',
    title: quest.title,
    content: quest.description ?? 'Добро пожаловать в этот квест! Здесь вы освоите новые навыки и прокачаете свои знания.',
    icon: '📖',
  })

  // Slide 2: What to do
  slides.push({
    id: 1,
    type: 'task',
    title: 'Что нужно сделать',
    content: quest.integration_trigger
      ? `Для выполнения этого квеста необходимо: ${quest.integration_trigger}`
      : 'Изучите предоставленные материалы, выполните практические задания и продемонстрируйте усвоенные знания.',
    bullets: quest.integration_trigger
      ? [
          `Триггер: ${quest.integration_trigger}`,
          `Целевое значение: ${quest.integration_target ?? 'не указано'}`,
          'Зафиксируйте прогресс в системе',
          'Убедитесь, что все условия выполнены',
        ]
      : [
          'Внимательно изучите все материалы квеста',
          'Выполните все практические упражнения',
          'Проверьте свои знания перед завершением',
          'Нажмите «Завершить квест» на последнем шаге',
        ],
    icon: '🎯',
  })

  // Slide 3: Key skills
  const difficultyMap: Record<string, string> = {
    easy: 'базовый',
    medium: 'средний',
    hard: 'продвинутый',
  }
  const typeMap: Record<string, string> = {
    personal: 'личный',
    team: 'командный',
    skill: 'навыковый',
  }
  slides.push({
    id: 2,
    type: 'skills',
    title: 'Ключевые навыки',
    content: `Этот квест относится к категории «${typeMap[quest.quest_type] ?? quest.quest_type}» и имеет уровень сложности «${difficultyMap[quest.difficulty] ?? quest.difficulty}». Успешное прохождение даст вам:`,
    bullets: [
      `+${quest.xp_reward} очков опыта (XP)`,
      `+${quest.coins_reward} монет`,
      'Практический опыт применения знаний',
      'Запись о выполнении в вашем профиле',
      quest.time_limit_hours
        ? `Ограничение по времени: ${quest.time_limit_hours} ч.`
        : 'Без ограничения по времени',
    ],
    icon: '💡',
  })

  // Slide 4: Finish
  slides.push({
    id: 3,
    type: 'finish',
    title: 'Всё готово!',
    content: `Вы изучили все материалы квеста «${quest.title}». Теперь вы можете завершить квест и получить награду.`,
    icon: '🏆',
  })

  return slides
}

export function SkillViewer({ quest, onComplete, onClose }: SkillViewerProps) {
  const slides = buildSlides(quest)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visitedMax, setVisitedMax] = useState(0)
  const [animDir, setAnimDir] = useState<'forward' | 'backward'>('forward')
  const [animating, setAnimating] = useState(false)

  const isLast = currentIndex === slides.length - 1
  const isFirst = currentIndex === 0

  const navigate = useCallback(
    (dir: 'forward' | 'backward') => {
      if (animating) return
      if (dir === 'forward' && currentIndex >= slides.length - 1) return
      if (dir === 'backward' && currentIndex <= 0) return

      setAnimDir(dir)
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(prev => {
          const next = dir === 'forward' ? prev + 1 : prev - 1
          setVisitedMax(m => Math.max(m, next))
          return next
        })
        setAnimating(false)
      }, 250)
    },
    [animating, currentIndex, slides.length],
  )

  // keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate('forward')
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate('backward')
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [navigate, onClose])

  const slide = slides[currentIndex]

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Материал: ${quest.title}`}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.questLabel}>
            <span className={styles.skillBadge}>📚 Skill-квест</span>
            <span className={styles.questTitle}>{quest.title}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Progress segments */}
        <div className={styles.segmentBar} role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemax={slides.length}>
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={`${styles.segment} ${
                i < currentIndex
                  ? styles.segmentDone
                  : i === currentIndex
                  ? styles.segmentActive
                  : styles.segmentPending
              }`}
            />
          ))}
        </div>
        <div className={styles.stepLabel}>
          Шаг {currentIndex + 1} из {slides.length}
        </div>

        {/* Slide content */}
        <div
          className={`${styles.slideContent} ${
            animating
              ? animDir === 'forward'
                ? styles.exitLeft
                : styles.exitRight
              : styles.enterVisible
          }`}
        >
          <div className={styles.slideIcon}>{slide.icon}</div>
          <h2 className={styles.slideTitle}>{slide.title}</h2>
          <p className={styles.slideBody}>{slide.content}</p>
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className={styles.bulletList}>
              {slide.bullets.map((b, i) => (
                <li key={i} className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {slide.type === 'finish' && (
            <div className={styles.rewardPreview}>
              <div className={styles.rewardChip}>
                <span className={styles.rewardIcon}>⚡</span>
                <span>+{quest.xp_reward} XP</span>
              </div>
              <div className={`${styles.rewardChip} ${styles.rewardChipGold}`}>
                <span className={styles.rewardIcon}>🪙</span>
                <span>+{quest.coins_reward}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={styles.navBar}>
          <button
            className={`${styles.navBtn} ${styles.navBtnSecondary}`}
            onClick={() => navigate('backward')}
            disabled={isFirst || animating}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Назад
          </button>

          <div className={styles.dotRow}>
            {slides.map((s, i) => (
              <span
                key={s.id}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : i <= visitedMax ? styles.dotVisited : ''}`}
              />
            ))}
          </div>

          {isLast ? (
            <button className={`${styles.navBtn} ${styles.navBtnPrimary}`} onClick={onComplete}>
              Завершить квест
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button
              className={`${styles.navBtn} ${styles.navBtnPrimary}`}
              onClick={() => navigate('forward')}
              disabled={animating}
            >
              Далее
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
