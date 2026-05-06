import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth'
import { useAuthStore } from '../store/authStore'

function isAbortError(e: unknown): boolean {
  // axios wraps AbortError — check both cases
  return (
    axios.isCancel(e) ||
    (e instanceof Error && e.name === 'AbortError')
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
      setTokens(data.access_token, data.refresh_token)
      setUser(data.user)
      navigate('/dashboard')
    } catch (e: unknown) {
      if (isAbortError(e)) return   // component unmounted — silently ignore
      const msg =
        (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? 'Неверный логин или пароль'
      setError(msg)
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
      setTokens(data.access_token, data.refresh_token)
      setUser(data.user)
      setSuccess(true)
    } catch (e: unknown) {
      if (isAbortError(e)) return   // component unmounted — silently ignore
      const msg =
        (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? 'Ошибка регистрации. Попробуйте снова.'
      setError(msg)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  return { register, loading, error, success }
}
