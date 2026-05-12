import React, { useState } from 'react'
import { UserManagement } from './UserManagement'
import { GroupManagement } from './GroupManagement'
import { StatusManagement } from './StatusManagement'
import { AdminProjectsList } from './AdminProjectsList'
import { FiUsers, FiGrid, FiTag, FiFolder } from 'react-icons/fi'

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="admin-dashboard">
      <div className="admin-tabs-container">
        <div className="admin-tabs-wrapper">
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <FiUsers className="tab-icon" />
            <span className="tab-label">Пользователи</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <FiGrid className="tab-icon" />
            <span className="tab-label">Группы</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'statuses' ? 'active' : ''}`}
            onClick={() => setActiveTab('statuses')}
          >
            <FiTag className="tab-icon" />
            <span className="tab-label">Статусы</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FiFolder className="tab-icon" />
            <span className="tab-label">Проекты</span>
          </button>
        </div>
      </div>
      <div className="admin-content-panel">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'groups' && <GroupManagement />}
        {activeTab === 'statuses' && <StatusManagement />}
        {activeTab === 'projects' && <AdminProjectsList />}
      </div>
    </div>
  )
}