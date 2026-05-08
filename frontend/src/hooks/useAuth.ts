import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth'
import { useAuthStore } from '../store/authStore'

function isAbortError(e: unknown): boolean {
  return axios.isCancel(e) || (e instanceof Error && e.name === 'AbortError')
}

function extractError(e: unknown, fallback: string): string {
  return (
    (e as { response?: { data?: { detail?: string } } })
      ?.response?.data?.detail ?? fallback
  )
}

export function useLogin() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  const login = async (payload: LoginPayload, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.login(payload, signal)
      setTokens(data.tokens.access_token, data.tokens.refresh_token)
      setUser({
        id:       data.user.id,
        username: data.user.username,
        email:    data.user.email,
        first_name: data.user.full_name?.split(' ')[0] ?? '',
        last_name:  data.user.full_name?.split(' ')[1] ?? '',
        role:     data.user.role,
        theme_preference: '',
        xp:     data.user.xp,
        level:  data.user.level,
        coins:  data.user.coins,
      })
      navigate('/')
    } catch (e: unknown) {
      if (isAbortError(e)) return
      setError(extractError(e, 'Неверный email или пароль'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  return { login, loading, error }
}

export function useRegister() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { setTokens, setUser } = useAuthStore()

  const register = async (payload: RegisterPayload, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.register(payload, signal)
      setTokens(data.tokens.access_token, data.tokens.refresh_token)
      setUser({
        id:       data.user.id,
        username: data.user.username,
        email:    data.user.email,
        first_name: data.user.full_name?.split(' ')[0] ?? '',
        last_name:  data.user.full_name?.split(' ')[1] ?? '',
        role:     data.user.role,
        theme_preference: '',
        xp:     data.user.xp,
        level:  data.user.level,
        coins:  data.user.coins,
      })
      setSuccess(true)
    } catch (e: unknown) {
      if (isAbortError(e)) return
      setError(extractError(e, 'Ошибка регистрации. Попробуйте снова.'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  return { register, loading, error, success }
}
