import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { 
  FiMail, FiLock, FiUser, FiUsers, FiUserPlus
} from 'react-icons/fi'

export const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    last_name: '',
    first_name: '',
    patronymic: '',
    password: '',
    role: 'student'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await register(formData)
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
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@mail.com"
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Фамилия</label>
        <div className="input-with-icon">
          <FiUser className="input-icon" />
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            placeholder="Иванов"
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Имя</label>
        <div className="input-with-icon">
          <FiUser className="input-icon" />
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            placeholder="Иван"
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Отчество</label>
        <div className="input-with-icon">
          <FiUser className="input-icon" />
          <input
            type="text"
            name="patronymic"
            value={formData.patronymic}
            onChange={handleChange}
            placeholder="Иванович"
          />
        </div>
      </div>
      <div className="form-group">
        <label>Пароль</label>
        <div className="input-with-icon">
          <FiLock className="input-icon" />
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••"
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Роль</label>
        <div className="input-with-icon">
          <FiUsers className="input-icon" />
          <select name="role" value={formData.role} onChange={handleChange}>
            <option value="student">Студент</option>
            <option value="teacher">Преподаватель</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={loading} className="auth-submit-btn">
        {loading ? 'Регистрация...' : (
          <>
            <FiUserPlus /> Зарегистрироваться
          </>
        )}
      </button>
    </form>
  )
}