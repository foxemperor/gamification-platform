/**
 * Leaderboard API client
 * Автор: Dmitry Koval
 */

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time'

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  full_name: string | null
  total_xp: number
  level: number
  total_coins: number
  quests_completed: number
  badges_count: number
  /** Отдел пользователя из auth.users */
  department: string | null
  /** Проект пользователя из auth.users */
  project_name: string | null
  /** Должность пользователя из auth.users */
  position: string | null
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  total_players: number
  updated_at: string
}

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException && err.name === 'AbortError'
  )
}

export const leaderboardApi = {
  /**
   * GET /api/v1/leaderboard/xp
   * @param period   - weekly | monthly | all_time
   * @param limit    - max entries (1-100)
   * @param signal   - AbortController signal
   * @param project  - optional project name filter
   */
  async getXP(
    period: LeaderboardPeriod = 'all_time',
    limit = 50,
    signal?: AbortSignal,
    project?: string,
  ): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({
      period,
      limit: String(limit),
    })
    if (project) params.set('project', project)

    const res = await fetch(`/api/v1/leaderboard/xp?${params}`, { signal })
    if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`)
    return res.json() as Promise<LeaderboardResponse>
  },
}
