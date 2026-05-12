import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(email, password)
    if (!result.success) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {error && <div className="error-message">{error}</div>}
      <div className="form-group">
        <label>Email</label>
        <div className="input-with-icon">
          <FiMail className="input-icon" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Пароль</label>
        <div className="input-with-icon">
          <FiLock className="input-icon" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>
      </div>
      <button type="submit" disabled={loading} className="auth-submit-btn">
        {loading ? 'Вход...' : (
          <>
            <FiLogIn /> Войти
          </>
        )}
      </button>
    </form>
  )
}