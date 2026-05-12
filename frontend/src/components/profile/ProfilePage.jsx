import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProject } from '../../context/ProjectContext'
import { 
  FiUser, FiMail, FiAward, FiCalendar, FiBookOpen, 
  FiStar, FiArrowLeft, FiRefreshCw, FiUsers
} from 'react-icons/fi'

export const ProfilePage = () => {
  const { user, getFullName } = useAuth()
  const { getStudentProfile, getUserStatuses } = useProject()
  const navigate = useNavigate()
  
  const [profileData, setProfileData] = useState(null)
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('statuses')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      if (user?.role === 'student') {
        const profileResult = await getStudentProfile()
        if (profileResult.success) {
          setProfileData(profileResult.data)
        }
        
        const statusesResult = await getUserStatuses()
        if (statusesResult.success) {
          setStatuses(statusesResult.statuses || [])
        }
      }
      
      setLoading(false)
    }
    
    if (user) {
      loadData()
    }
  }, [user, getStudentProfile, getUserStatuses])

  const handleReplayProject = (projectId) => {
    navigate(`/projects/play/${projectId}`)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-screen">
          <div className="loader"></div>
          <p>Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  const isTeacher = user?.role === 'teacher'

  return (
    <div className="profile-page">
      <div className="profile-nav">
        <button onClick={() => navigate('/projects')} className="back-link">
          <FiArrowLeft /> Вернуться к новеллам
        </button>
      </div>

      <div className="profile-header">
        <div className="profile-avatar">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div className="profile-info">
          <h2>{getFullName()}</h2>
          <p className="profile-email"><FiMail /> {user?.email}</p>
          <p className="profile-role">
            {isTeacher ? 'Преподаватель' : 'Студент'}
          </p>
          {profileData?.user?.group_name && (
            <p className="profile-group">
              <FiUsers /> Группа: {profileData.user.group_name}
            </p>
          )}
        </div>
      </div>

      {!isTeacher && (
        <>
          <div className="profile-tabs">
            <button 
              className={`tab ${activeTab === 'statuses' ? 'active' : ''}`}
              onClick={() => setActiveTab('statuses')}
            >
              <FiAward /> Статусы ({statuses.length})
            </button>
            <button 
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <FiBookOpen /> Прохождения ({profileData?.completed_projects?.length || 0})
            </button>
            <button 
              className={`tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <FiUser /> Профиль
            </button>
          </div>

          <div className="profile-content">
            {activeTab === 'statuses' && (
              <div className="statuses-section">
                <h3><FiAward /> Полученные статусы</h3>
                {statuses.length === 0 ? (
                  <div className="empty-state">
                    <p>У вас пока нет статусов</p>
                    <p className="hint">Проходите новеллы, чтобы получать новые статусы!</p>
                  </div>
                ) : (
                  <div className="statuses-grid">
                    {statuses.map((status, index) => (
                      <div key={index} className="status-card">
                        <div className="status-icon">
                          <FiStar />
                        </div>
                        <div className="status-info">
                          <div className="status-name">{status.name}</div>
                          <div className="status-date">
                            <FiCalendar /> {formatDate(status.earned_at)}
                          </div>
                          {status.project_title && (
                            <div className="status-project" title={status.project_title}>
                              За новеллу: {status.project_title && status.project_title.length > 35 
                                ? status.project_title.slice(0, 35) + '...' 
                                : status.project_title}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="history-section">
                <h3><FiBookOpen /> Завершенные прохождения</h3>
                {!profileData?.completed_projects || profileData.completed_projects.length === 0 ? (
                  <div className="empty-state">
                    <p>Вы ещё не прошли ни одной новеллы</p>
                    <p className="hint">Начните прохождение, чтобы увидеть результаты!</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {profileData.completed_projects.map((project) => (
                      <div key={project.project_id} className="history-card">
                        <div className="history-project">
                          <strong 
                            onClick={() => handleReplayProject(project.project_id)}
                            style={{ cursor: 'pointer', color: '#667eea' }}
                            title="Пройти заново"
                          >
                            {project.project_title}
                          </strong>
                        </div>
                        <div className="history-details">
                          <div className="history-stat">
                            Попыток: {project.attempts}
                          </div>
                          <div className="history-stat">
                            <FiStar /> Лучший балл: {project.best_points}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleReplayProject(project.project_id)}
                          className="replay-btn-small"
                          title="Пройти заново"
                        >
                          <FiRefreshCw /> Пройти
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="info-section">
                <h3><FiUser /> Личные данные</h3>
                <div className="info-card">
                  <div className="info-item">
                    <span className="info-label">Фамилия</span>
                    <span className="info-value">{user?.last_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Имя</span>
                    <span className="info-value">{user?.first_name}</span>
                  </div>
                  {user?.patronymic && (
                    <div className="info-item">
                      <span className="info-label">Отчество</span>
                      <span className="info-value">{user?.patronymic}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <span className="info-value">{user?.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Роль</span>
                    <span className="info-value">Студент</span>
                  </div>
                  {profileData?.user?.group_name && (
                    <div className="info-item">
                      <span className="info-label">Группа</span>
                      <span className="info-value">{profileData.user.group_name}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="info-label">Дата регистрации</span>
                    <span className="info-value">{formatDate(user?.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isTeacher && (
        <div className="profile-content">
          <div className="info-section">
            <h3><FiUser /> Личные данные</h3>
            <div className="info-card">
              <div className="info-item">
                <span className="info-label">Фамилия</span>
                <span className="info-value">{user?.last_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Имя</span>
                <span className="info-value">{user?.first_name}</span>
              </div>
              {user?.patronymic && (
                <div className="info-item">
                  <span className="info-label">Отчество</span>
                  <span className="info-value">{user?.patronymic}</span>
                </div>
              )}
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{user?.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Роль</span>
                <span className="info-value">Преподаватель</span>
              </div>
              <div className="info-item">
                <span className="info-label">Дата регистрации</span>
                <span className="info-value">{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}