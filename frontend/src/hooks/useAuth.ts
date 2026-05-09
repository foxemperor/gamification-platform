import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authApi, type LoginPayload, type RegisterPayload, type AuthUserResponse } from '../api/auth'
import { useAuthStore, type User } from '../store/authStore'

function isAbortError(e: unknown): boolean {
  return axios.isCancel(e) || (e instanceof Error && e.name === 'AbortError')
}

function extractError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { detail?: unknown } } })?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) {
    const first = data.detail[0] as { msg?: string } | undefined
    if (first?.msg) return first.msg
  }
  return fallback
}

function toStoreUser(u: AuthUserResponse): User {
  return {
    id:           u.id,
    username:     u.username,
    email:        u.email,
    full_name:    u.full_name,
    role:         u.role,
    department:   null,
    project:      null,
    position:     null,
    xp:           u.xp,
    level:        u.level,
    coins:        u.coins,
    is_active:    u.is_active,
    is_verified:  u.is_verified,
    is_superuser: u.is_superuser,
  }
}

export function useLogin() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser   = useAuthStore((s) => s.setUser)
  const navigate  = useNavigate()

  const login = async (payload: LoginPayload, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.login(payload, signal)
      setTokens(data.tokens.access_token, data.tokens.refresh_token)
      setUser(toStoreUser(data.user))
      navigate('/', { replace: true })
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
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser   = useAuthStore((s) => s.setUser)
  const navigate  = useNavigate()

  const register = async (payload: RegisterPayload, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.register(payload, signal)
      setTokens(data.tokens.access_token, data.tokens.refresh_token)
      setUser(toStoreUser(data.user))
      setSuccess(true)
      navigate('/', { replace: true })
    } catch (e: unknown) {
      if (isAbortError(e)) return
      setError(extractError(e, 'Ошибка регистрации. Попробуйте снова.'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  return { register, loading, error, success }
}
