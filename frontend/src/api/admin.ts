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
