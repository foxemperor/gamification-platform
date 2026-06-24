import { api } from './axios'
import { isAbortError } from './quests'
export { isAbortError }

// ─── Типы ───────────────────────────────────────────────────────────────────

export type MemberScope = 'all' | 'project' | 'department' | 'team'

export interface MemberEntry {
  user_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  level: number
  department: string | null
  project_name: string | null
  manager_id: string | null
  is_self: boolean
  /** ISO-дата дня рождения (YYYY-MM-DD), может отсутствовать */
  birthday?: string | null
}

export interface MembersResponse {
  scope: MemberScope
  items: MemberEntry[]
  total: number
}

// ─── API ────────────────────────────────────────────────────────────────────

export const membersApi = {
  getMembers: (
    scope: MemberScope = 'all',
    search = '',
    limit = 100,
    signal?: AbortSignal,
  ) =>
    api
      .get<MembersResponse>('/members', {
        params: {
          scope,
          ...(search.trim() ? { search: search.trim() } : {}),
          limit,
        },
        signal,
      })
      .then(r => r.data),
}
