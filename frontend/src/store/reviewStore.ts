/**
 * reviewStore — in-memory стор для демо-флоу проверки квестов.
 * Живёт пока жива вкладка браузера → смена аккаунта данные не сбрасывает.
 */
import { create } from 'zustand'

export type ReviewStatus = 'pending_review' | 'approved' | 'rejected'

export interface QuestSubmission {
  id: string                 // uuid
  questId: string
  questTitle: string
  questIcon: string
  xpReward: number
  coinsReward: number
  // персонаж автора
  authorId: string
  authorName: string
  authorAvatar: string | null
  authorClass: string        // e.g. «Воин», «Маг»...
  authorLevel: number
  // доп. бонус персонажа (множитель к XP)
  classXpBonus: number       // напр. 1.2 → +20%
  // данные сдачи
  submissionComment: string
  submittedAt: string        // ISO
  status: ReviewStatus
  reviewComment?: string
  reviewedAt?: string
  // итоговые начисленные значения (заполняются при approve)
  awardedXp?: number
  awardedCoins?: number
}

interface ReviewState {
  submissions: QuestSubmission[]
  /** Список id квестов, сданных текущим пользователем (для блокировки кнопки) */
  submittedQuestIds: string[]
  /** Флаг: показать «большой» тоаст-баннер одобрения (заполняется при approve) */
  pendingApprovalBanner: QuestSubmission | null

  submitQuest: (s: Omit<QuestSubmission, 'id' | 'status' | 'submittedAt'>) => void
  approveSubmission: (submissionId: string) => void
  rejectSubmission: (submissionId: string, reason: string) => void
  clearBanner: () => void
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const useReviewStore = create<ReviewState>()((set, get) => ({
  submissions: [],
  submittedQuestIds: [],
  pendingApprovalBanner: null,

  submitQuest: (data) => {
    const entry: QuestSubmission = {
      ...data,
      id: uuid(),
      status: 'pending_review',
      submittedAt: new Date().toISOString(),
    }
    set((s) => ({
      submissions: [entry, ...s.submissions],
      submittedQuestIds: [...s.submittedQuestIds, data.questId],
    }))
  },

  approveSubmission: (submissionId) => {
    set((s) => {
      const submissions = s.submissions.map((sub) => {
        if (sub.id !== submissionId) return sub
        const awardedXp    = Math.round(sub.xpReward * sub.classXpBonus)
        const awardedCoins = sub.coinsReward
        return {
          ...sub,
          status: 'approved' as ReviewStatus,
          reviewedAt: new Date().toISOString(),
          awardedXp,
          awardedCoins,
        }
      })
      const approved = submissions.find((s) => s.id === submissionId)!
      return { submissions, pendingApprovalBanner: approved }
    })
  },

  rejectSubmission: (submissionId, reason) => {
    set((s) => ({
      submissions: s.submissions.map((sub) =>
        sub.id !== submissionId
          ? sub
          : {
              ...sub,
              status: 'rejected' as ReviewStatus,
              reviewComment: reason,
              reviewedAt: new Date().toISOString(),
            }
      ),
      // разблокируем кнопку — пользователь может сдать повторно
      submittedQuestIds: s.submittedQuestIds.filter((id) => {
        const sub = s.submissions.find((s) => s.id === submissionId)
        return id !== sub?.questId
      }),
    }))
  },

  clearBanner: () => set({ pendingApprovalBanner: null }),
}))
