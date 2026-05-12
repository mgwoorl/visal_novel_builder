import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../utils/api'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

const log = (level, module, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][${module}]`
  switch (level) {
    case 'ERROR': console.error(prefix, message, data); break
    case 'WARN': console.warn(prefix, message, data); break
    default: console.log(prefix, message, data)
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        setToken(savedToken)
        setUser(parsedUser)
        api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
        log('INFO', 'AuthContext', 'Session restored from localStorage', { userId: parsedUser.id, role: parsedUser.role })
      } catch (error) {
        log('ERROR', 'AuthContext', 'Failed to restore session', { error: error.message })
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password) => {
    log('INFO', 'AuthContext', 'Login attempt', { email })
    setLoading(true)
    try {
      const response = await api.post('/users/login', { email, password })
      
      if (response.data.success) {
        const userData = response.data.user
        const accessToken = response.data.access_token
        
        setUser(userData)
        setToken(accessToken)
        localStorage.setItem('token', accessToken)
        localStorage.setItem('user', JSON.stringify(userData))
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
        
        log('INFO', 'AuthContext', 'Login successful', { userId: userData.id, role: userData.role })
        return { success: true }
      }
      
      log('WARN', 'AuthContext', 'Login failed - invalid credentials', { email })
      return { success: false, error: response.data.message }
    } catch (error) {
      log('ERROR', 'AuthContext', 'Login error', { email, error: error.message })
      return { success: false, error: 'Ошибка соединения' }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    log('INFO', 'AuthContext', 'Logout', { userId: user?.id })
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
  }, [user])

  const getFullName = useCallback(() => {
    if (!user) return ''
    return `${user.last_name} ${user.first_name} ${user.patronymic || ''}`.trim()
  }, [user])

  const isAdmin = useMemo(() => user?.role === 'admin' || user?.role === 'super_admin', [user])
  const isSuperAdmin = useMemo(() => user?.role === 'super_admin', [user])
  const isTeacher = useMemo(() => ['teacher', 'admin', 'super_admin'].includes(user?.role), [user])

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, logout, getFullName,
      isAdmin, isSuperAdmin, isTeacher,
      isStudent: user?.role === 'student'
    }}>
      {children}
    </AuthContext.Provider>
  )
}