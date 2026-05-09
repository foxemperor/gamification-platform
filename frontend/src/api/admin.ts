import { api } from './axios'

export interface AdminUser {
  id: string
  email: string
  username: string
  full_name: string | null
  department: string | null
  project: string | null
  position: string | null
  role: 'employee' | 'manager' | 'admin'
  xp: number
  level: number
  coins: number
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  created_at: string
  last_login_at: string | null
  updated_at: string
}

export interface AdminUsersListResponse {
  total: number
  page: number
  per_page: number
  items: AdminUser[]
}

export interface AdminUserCreate {
  email: string
  username: string
  password: string
  full_name?: string
  department?: string
  project?: string
  position?: string
  role: 'employee' | 'manager' | 'admin'
  is_active: boolean
  is_verified: boolean
}

export interface AdminUserUpdate {
  email?: string
  username?: string
  full_name?: string
  password?: string
  department?: string
  project?: string
  position?: string
  role?: 'employee' | 'manager' | 'admin'
  is_active?: boolean
  is_verified?: boolean
}

export const adminApi = {
  listUsers: (page = 1, perPage = 20, search = '') =>
    api.get<AdminUsersListResponse>('/admin/users', {
      params: { page, per_page: perPage, search: search || undefined },
    }),

  getUser: (id: string) =>
    api.get<AdminUser>(`/admin/users/${id}`),

  createUser: (data: AdminUserCreate) =>
    api.post<AdminUser>('/admin/users', data),

  updateUser: (id: string, data: AdminUserUpdate) =>
    api.patch<AdminUser>(`/admin/users/${id}`, data),

  deleteUser: (id: string) =>
    api.delete<{ message: string }>(`/admin/users/${id}`),
}


// ===================================
// QUESTS / BADGES / XP — Gamification Service
// ===================================

export type QuestType = 'personal' | 'team' | 'daily' | 'skill' | 'integration'
export type QuestDifficulty = 'easy' | 'medium' | 'hard' | 'epic'
export type QuestStatus = 'draft' | 'active' | 'archived'
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type XPSource =
  | 'quest'
  | 'badge'
  | 'github_commit'
  | 'github_pr'
  | 'jira_task'
  | 'admin'
  | 'penalty'

export interface AdminQuest {
  id: string
  title: string
  description: string | null
  quest_type: QuestType
  difficulty: QuestDifficulty
  status: QuestStatus
  xp_reward: number
  coins_reward: number
  time_limit_hours: number | null
  integration_trigger: string | null
  integration_target: number | null
  created_by: string | null
  created_at: string
  updated_at: string | null
}

export interface AdminQuestCreate {
  title: string
  description?: string
  quest_type?: QuestType
  difficulty?: QuestDifficulty
  status?: QuestStatus
  xp_reward?: number
  coins_reward?: number
  time_limit_hours?: number | null
  integration_trigger?: string | null
  integration_target?: number | null
}

export type AdminQuestUpdate = Partial<AdminQuestCreate>

export interface AdminQuestListResponse {
  items: AdminQuest[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface AdminBadge {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  rarity: BadgeRarity
  condition_type: string | null
  condition_value: number | null
  xp_bonus: number
  created_at: string
}

export interface AdminBadgeCreate {
  name: string
  description?: string
  icon_url?: string
  rarity?: BadgeRarity
  condition_type?: string
  condition_value?: number
  xp_bonus?: number
}

export type AdminBadgeUpdate = Partial<AdminBadgeCreate>

export interface AdminBadgeListResponse {
  items: AdminBadge[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface AdminXPGrantInput {
  user_id: string
  amount: number
  /** Свободное описание операции — соответствует полю description в БД. */
  description?: string
  source?: XPSource
  source_id?: string
}

export interface AdminXPTransaction {
  id: string
  user_id: string
  amount: number
  source: XPSource
  source_id: string | null
  description: string | null
  created_at: string
}

export interface AdminXPTransactionListResponse {
  items: AdminXPTransaction[]
  total: number
  page: number
  per_page: number
  pages: number
}

export const adminQuestsApi = {
  list: (params: {
    page?: number
    per_page?: number
    status?: QuestStatus
    quest_type?: QuestType
    difficulty?: QuestDifficulty
    search?: string
  } = {}) =>
    api.get<AdminQuestListResponse>('/admin/quests', { params }),

  create: (data: AdminQuestCreate) =>
    api.post<AdminQuest>('/admin/quests', data),

  update: (id: string, data: AdminQuestUpdate) =>
    api.patch<AdminQuest>(`/admin/quests/${id}`, data),

  remove: (id: string) =>
    api.delete<void>(`/admin/quests/${id}`),
}

export const adminBadgesApi = {
  list: (params: { page?: number; per_page?: number; search?: string } = {}) =>
    api.get<AdminBadgeListResponse>('/admin/badges', { params }),

  create: (data: AdminBadgeCreate) =>
    api.post<AdminBadge>('/admin/badges', data),

  update: (id: string, data: AdminBadgeUpdate) =>
    api.patch<AdminBadge>(`/admin/badges/${id}`, data),

  remove: (id: string) =>
    api.delete<void>(`/admin/badges/${id}`),
}

export const adminXPApi = {
  grant: (data: AdminXPGrantInput) =>
    api.post<AdminXPTransaction>('/admin/xp/grant', data),

  listTransactions: (params: {
    page?: number
    per_page?: number
    user_id?: string
    source?: XPSource
  } = {}) =>
    api.get<AdminXPTransactionListResponse>('/admin/xp/transactions', { params }),
}
