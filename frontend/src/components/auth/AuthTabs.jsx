import React from 'react'
import { Login } from './Login'
import { FiLogIn } from 'react-icons/fi'

export const AuthTabs = () => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-tabs">
          <button className="auth-tab active">
            <FiLogIn /> Вход
          </button>
        </div>
        <div className="auth-content">
          <Login />
        </div>
      </div>
    </div>
  )
}