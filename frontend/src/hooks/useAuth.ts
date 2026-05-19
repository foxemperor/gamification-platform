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
        // login возвращает { user, tokens: { access_token, refresh_token } }
        setTokens(
          data.tokens.access_token,
          data.tokens.refresh_token,
          payload.rememberMe,
        )
        setUser(data.user as Parameters<typeof setUser>[0])
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
