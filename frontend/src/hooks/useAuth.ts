import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'

interface LoginPayload {
  email:      string
  password:   string
  rememberMe: boolean
}

export function useLogin() {
  const { setTokens, setUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const login = useCallback(
    async (payload: LoginPayload, signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const data = await authApi.login(
          { email: payload.email, password: payload.password },
          signal,
        )
        setTokens(data.access_token, data.refresh_token, payload.rememberMe)

        const me = await authApi.me(data.access_token, signal)
        setUser(me)
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (err as { message?: string })?.message ??
          'Ошибка входа'
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      } finally {
        setLoading(false)
      }
    },
    [setTokens, setUser],
  )

  return { login, loading, error }
}
