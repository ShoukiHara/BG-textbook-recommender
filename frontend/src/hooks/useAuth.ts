import { useState } from 'react'
import { login } from '../lib/api'

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (password: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await login(password)
      setToken(data.access_token)
    } catch {
      setError('パスワードが正しくありません')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => setToken(null)

  return { token, error, loading, login: handleLogin, logout: handleLogout }
}
