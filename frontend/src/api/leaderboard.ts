import { api } from './axios'
import { isAbortError } from './quests'
export { isAbortError }

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time'

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  total_xp: number
  level: number
  total_coins: number
  quests_completed: number
  badges_count: number
  // профиль (добавлены поля, которые возвращает бэкенд)
  department: string | null
  project_name: string | null
  position: string | null
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  total_players: number
  updated_at: string
}

export const leaderboardApi = {
  getXP: (period: LeaderboardPeriod = 'all_time', limit = 50, signal?: AbortSignal) =>
    api
      .get<LeaderboardResponse>('/leaderboard/xp', { params: { period, limit }, signal })
      .then(r => r.data),
}
