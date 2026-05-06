import { api } from './axios'

export interface LoginPayload {
  username: string
  password: string
}

// role omitted from public interface — always sent as 'employee' from the form
export interface RegisterPayload {
  first_name: string
  last_name:  string
  email:      string
  username:   string
  password:   string
  role:       'employee'
}

export interface AuthResponse {
  access_token:  string
  refresh_token: string
  token_type:    string
  user: {
    id:               string
    username:         string
    email:            string
    first_name:       string
    last_name:        string
    role:             string
    theme_preference: string
    xp:               number
    level:            number
    coins:            number
  }
}

export const authApi = {
  login: (payload: LoginPayload, signal?: AbortSignal) =>
    api.post<AuthResponse>('/auth/login', payload, { signal }).then((r) => r.data),

  register: (payload: RegisterPayload, signal?: AbortSignal) =>
    api.post<AuthResponse>('/auth/register', payload, { signal }).then((r) => r.data),

  refreshToken: (refresh_token: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),

  getMe: (signal?: AbortSignal) =>
    api.get<AuthResponse['user']>('/users/me', { signal }).then((r) => r.data),

  updatePreferences: (theme_preference: string) =>
    api.patch('/users/me/preferences', { theme_preference }),
}
