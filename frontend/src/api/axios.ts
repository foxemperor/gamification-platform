import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Empty string = relative URL — requests go through Vite dev proxy
// In production this will be served from the same origin via Nginx
const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh на 401. 403 (Forbidden) НЕ должен сбрасывать сессию —
// пользователь авторизован, но просто не имеет прав на этот ресурс.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }

    // Не пытаемся рефрешить ответ самого refresh-эндпоинта — иначе цикл.
    const url: string = original.url ?? ''
    if (url.includes('/auth/refresh')) {
      useAuthStore.getState().logout()
      window.location.href = '/auth'
      return Promise.reject(error)
    }

    original._retry = true
    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) {
      useAuthStore.getState().logout()
      window.location.href = '/auth'
      return Promise.reject(error)
    }

    try {
      // Auth-service /auth/refresh возвращает Token напрямую:
      // { access_token, refresh_token, token_type } — без обёртки tokens.
      const { data } = await axios.post<{
        access_token: string
        refresh_token: string
        token_type: string
      }>(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken })

      useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (refreshErr) {
      useAuthStore.getState().logout()
      window.location.href = '/auth'
      return Promise.reject(refreshErr)
    }
  },
)
