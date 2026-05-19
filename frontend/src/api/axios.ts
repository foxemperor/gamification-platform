import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// Прикрепляем access token к каждому запросу
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh на 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }

    const url: string = original.url ?? ''
    if (url.includes('/auth/refresh')) {
      useAuthStore.getState().logout()
      window.location.href = '/auth'
      return Promise.reject(error)
    }

    original._retry = true
    const { refreshToken, rememberMe } = useAuthStore.getState()
    if (!refreshToken) {
      useAuthStore.getState().logout()
      window.location.href = '/auth'
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post<{
        access_token: string
        refresh_token: string
        token_type: string
      }>(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken })

      // Передаём rememberMe, чтобы не сбросить предпочтение хранилища
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token, rememberMe)
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
