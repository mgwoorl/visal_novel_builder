import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FiLogOut, FiUser, FiBookOpen, FiSettings } from 'react-icons/fi'

export const Header = () => {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogoClick = () => {
    navigate('/projects')
  }

  const getRoleLabel = () => {
    switch(user?.role) {
      case 'super_admin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'teacher': return 'Teacher'
      default: return 'Student'
    }
  }

  const getUserDisplayName = () => {
    if (!user) return ''
    return `${user.last_name} ${user.first_name}`
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <FiBookOpen className="logo-icon" />
          <h1>Visual Novel Builder</h1>
        </div>
        <div className="user-menu">
          {isAdmin && (
            <Link to="/admin" className="admin-link">
              <FiSettings /> Панель управления
            </Link>
          )}
          <Link to={isAdmin ? '/admin' : '/profile'} className="user-name-link">
            <FiUser className="user-icon" />
            <span className="user-name">{getUserDisplayName()}</span>
          </Link>
          <span className="user-role-badge">{getRoleLabel()}</span>
          <button onClick={logout} className="logout-btn">
            <FiLogOut /> Выйти
          </button>
        </div>
      </div>
    </header>
  )
}