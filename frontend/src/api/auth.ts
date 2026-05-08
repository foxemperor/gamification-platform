import { api } from './axios'

export interface LoginPayload {
  email:    string
  password: string
}

export interface RegisterPayload {
  email:     string
  username:  string
  full_name: string
  password:  string
}

export interface AuthUserResponse {
  id:                  string
  username:            string
  email:               string
  full_name:           string | null
  role:                string
  xp:                  number
  level:               number
  coins:               number
  xp_to_next_level:    number
  xp_progress_percent: number
  is_active:           boolean
  is_verified:         boolean
  is_superuser:        boolean
  created_at:          string
}

export interface AuthResponse {
  user:   AuthUserResponse
  tokens: {
    access_token:  string
    refresh_token: string
    token_type:    string
  }
}

export const authApi = {
  login: (payload: LoginPayload, signal?: AbortSignal) =>
    api.post<AuthResponse>('/api/v1/auth/login', payload, { signal }).then((r) => r.data),

  register: (payload: RegisterPayload, signal?: AbortSignal) =>
    api.post<AuthResponse>('/api/v1/auth/register', payload, { signal }).then((r) => r.data),

  refreshToken: (refresh_token: string) =>
    api.post<{ access_token: string; refresh_token: string; token_type: string }>(
      '/api/v1/auth/refresh', { refresh_token }
    ).then((r) => r.data),

  getMe: (signal?: AbortSignal) =>
    api.get<AuthUserResponse>('/api/v1/auth/me', { signal }).then((r) => r.data),
}
