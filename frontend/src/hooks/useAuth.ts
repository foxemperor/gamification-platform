import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export function useLogin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  const login = async (payload: LoginPayload) => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.login(payload)
      setTokens(data.access_token, data.refresh_token)
      setUser(data.user)           // also syncs theme from server
      navigate('/dashboard')
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? 'Неверный логин или пароль'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, error }
}

export function useRegister() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { setTokens, setUser } = useAuthStore()

  const register = async (payload: RegisterPayload) => {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.register(payload)
      setTokens(data.access_token, data.refresh_token)
      setUser(data.user)
      setSuccess(true)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? 'Ошибка регистрации. Попробуйте снова.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return { register, loading, error, success }
}
