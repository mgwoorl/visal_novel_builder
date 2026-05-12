import React, { useState, useEffect } from 'react'
import { FiPlus, FiX, FiFolder, FiCheckCircle, FiClock, FiTag, FiGrid, FiUsers } from 'react-icons/fi'
import { ProjectCard } from './ProjectCard'
import { useProject } from '../../context/ProjectContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/ToastContext'
import api from '../../utils/api'

export const ProjectList = ({ projects, onPlayProject, user }) => {
  const { createProject, fetchAllStatuses, getCompletedProjects, getUserStatuses, deleteProject, fetchProjects, getStudentProfile } = useProject()
  const { addToast } = useToast()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProject, setNewProject] = useState({ 
    title: '', description: '', min_points: 0, reward_status: 'Стажёр', required_statuses: [], group_ids: []
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [allStatuses, setAllStatuses] = useState([])
  const [groupsList, setGroupsList] = useState([])
  const [showNewStatusInput, setShowNewStatusInput] = useState(false)
  const [newStatusName, setNewStatusName] = useState('')
  const [activeTab, setActiveTab] = useState('available')
  const [completedProjects, setCompletedProjects] = useState([])
  const [earnedStatuses, setEarnedStatuses] = useState({})
  const [activeProjects, setActiveProjects] = useState({})

  useEffect(() => {
    if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin') {
      loadStatusesAndGroups()
    }
  }, [user])

  useEffect(() => {
    if (user?.role === 'student') {
      loadStudentData()
    }
  }, [user])

  const loadStudentData = async () => {
    const completedResult = await getCompletedProjects()
    if (completedResult.success) setCompletedProjects(completedResult.completed_ids)
    
    const statusesResult = await getUserStatuses()
    if (statusesResult.success) {
      const earned = {}
      statusesResult.statuses.forEach(s => { if (s.playthrough_id) earned[s.playthrough_id] = s.name })
      setEarnedStatuses(earned)
    }
    
    // Загружаем профиль для получения активных прохождений
    const profileResult = await getStudentProfile()
    if (profileResult.success && profileResult.data) {
      const active = {}
      if (profileResult.data.active_projects) {
        profileResult.data.active_projects.forEach(p => {
          active[p.project_id] = true
        })
      }
      setActiveProjects(active)
    }
  }

  const loadStatusesAndGroups = async () => {
    try {
      const statusesResult = await fetchAllStatuses()
      if (statusesResult.success) setAllStatuses(statusesResult.statuses)
      const groupsResponse = await api.get('/users/groups')
      setGroupsList(groupsResponse.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    if (!newProject.title.trim()) {
      setError('Введите название проекта')
      setLoading(false)
      return
    }
    
    const result = await createProject(
      newProject.title, newProject.description, newProject.min_points,
      newProject.reward_status, newProject.required_statuses, newProject.group_ids
    )
    if (result.success) {
      addToast('Проект успешно создан', 'success')
      setNewProject({ title: '', description: '', min_points: 0, reward_status: 'Стажёр', required_statuses: [], group_ids: [] })
      setShowCreateForm(false)
    } else {
      setError(result.error)
      addToast(result.error || 'Ошибка создания проекта', 'error')
    }
    setLoading(false)
  }

  const handleDeleteProject = async (projectId) => {
    const result = await deleteProject(projectId)
    if (result.success) {
      addToast('Проект удален', 'success')
      await fetchProjects()
    } else {
      addToast(result.error || 'Ошибка удаления проекта', 'error')
    }
  }

  const handleAddNewStatus = async () => {
    if (!newStatusName.trim()) return
    try {
      const response = await api.post('/projects/statuses/add', { name: newStatusName.trim() })
      setAllStatuses([...allStatuses, response.data])
      setNewProject({ ...newProject, reward_status: response.data.name })
      addToast('Статус добавлен', 'success')
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка добавления статуса', 'error')
    }
    setNewStatusName('')
    setShowNewStatusInput(false)
  }

  const handleToggleGroup = (groupId) => {
    setNewProject(prev => ({
      ...prev,
      group_ids: prev.group_ids.includes(groupId) ? prev.group_ids.filter(id => id !== groupId) : [...prev.group_ids, groupId]
    }))
  }

  const handleToggleRequiredStatus = (statusName) => {
    if (newProject.required_statuses.includes(statusName)) {
      setNewProject({ ...newProject, required_statuses: newProject.required_statuses.filter(s => s !== statusName) })
    } else {
      setNewProject({ ...newProject, required_statuses: [...newProject.required_statuses, statusName] })
    }
  }

  if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin') {
    return (
      <div className="projects-container teacher-container">
        <div className="projects-header">
          <h2><FiGrid /> Мои проекты</h2>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="create-btn">
            <FiPlus /> {showCreateForm ? 'Отмена' : 'Новый проект'}
          </button>
        </div>

        {showCreateForm && (
          <div className="create-form">
            <h3>Создание нового проекта</h3>
            <form onSubmit={handleCreateProject}>
              {error && <div className="error-message">{error}</div>}
              <div className="form-group">
                <label>Название проекта</label>
                <input type="text" value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} placeholder="Например: Моя первая новелла" required />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Краткое описание" rows="3" />
              </div>
              <div className="form-group">
                <label>Минимальные баллы</label>
                <input type="number" value={newProject.min_points} onChange={(e) => setNewProject({ ...newProject, min_points: parseInt(e.target.value) || 0 })} min="0" />
              </div>
              <div className="form-group">
                <label>Статус за прохождение</label>
                <div className="reward-status-select-container">
                  <select value={newProject.reward_status} onChange={(e) => setNewProject({ ...newProject, reward_status: e.target.value })} className="reward-status-select">
                    {allStatuses.map(status => <option key={status.id} value={status.name}>{status.name}</option>)}
                  </select>
                  {!showNewStatusInput ? (
                    <button type="button" onClick={() => setShowNewStatusInput(true)} className="add-status-inline-btn"><FiPlus /> Новый</button>
                  ) : (
                    <div className="new-status-inline">
                      <input type="text" value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="Название статуса" autoFocus />
                      <button type="button" onClick={handleAddNewStatus} className="confirm-btn">✓</button>
                      <button type="button" onClick={() => setShowNewStatusInput(false)} className="cancel-btn">✕</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label><FiTag /> Требуемые статусы</label>
                <div className="required-statuses-container create-form-statuses">
                  <div className="selected-statuses">
                    {newProject.required_statuses.map(status => (
                      <div key={status} className="status-tag selected">{status}
                        <button onClick={() => handleToggleRequiredStatus(status)} className="remove-status">×</button>
                      </div>
                    ))}
                    {newProject.required_statuses.length === 0 && <span className="hint">Не выбрано (доступно всем)</span>}
                  </div>
                  <div className="statuses-list">
                    <label>Выберите из существующих:</label>
                    <div className="status-options">
                      {allStatuses.map(status => (
                        <div key={status.id} className={`status-option ${newProject.required_statuses.includes(status.name) ? 'selected' : ''}`}
                          onClick={() => handleToggleRequiredStatus(status.name)}>{status.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label><FiUsers /> Группы для доступа</label>
                <div className="required-statuses-container create-form-statuses">
                  <div className="selected-statuses">
                    {newProject.group_ids.map(groupId => {
                      const group = groupsList.find(g => g.id === groupId)
                      return group ? (
                        <div key={groupId} className="status-tag selected">{group.name}
                          <button onClick={() => handleToggleGroup(groupId)} className="remove-status">×</button>
                        </div>
                      ) : null
                    })}
                    {newProject.group_ids.length === 0 && <span className="hint">Не выбрано (доступно всем)</span>}
                  </div>
                  <div className="statuses-list">
                    <label>Выберите группы:</label>
                    <div className="status-options">
                      {groupsList.map(group => (
                        <div key={group.id} className={`status-option ${newProject.group_ids.includes(group.id) ? 'selected' : ''}`}
                          onClick={() => handleToggleGroup(group.id)}>{group.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <small className="hint">Студент должен быть в одной из выбранных групп</small>
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Создание...' : 'Создать проект'}</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-form-btn">Отмена</button>
              </div>
            </form>
          </div>
        )}

        {projects.length === 0 && !showCreateForm ? (
          <div className="empty-state">
            <p>У вас пока нет проектов</p>
            <p>Нажмите "Новый проект" чтобы создать первый проект</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} onPlay={onPlayProject} userRole={user?.role} onDelete={handleDeleteProject} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const projectsWithStatus = projects.map(project => ({
    ...project,
    reward_status_earned: earnedStatuses[project.id] || null,
    has_active: activeProjects[project.id] || false
  }))

  const availableProjects = projectsWithStatus.filter(p => !completedProjects.includes(p.id))
  const completed = projectsWithStatus.filter(p => completedProjects.includes(p.id))

  return (
    <div className="projects-container student-view">
      <div className="projects-header">
        <h2><FiGrid /> Доступные новеллы</h2>
      </div>
      <div className="projects-tabs">
        <button className={`tab ${activeTab === 'available' ? 'active' : ''}`} onClick={() => setActiveTab('available')}>
          <FiClock /> Доступные ({availableProjects.length})
        </button>
        <button className={`tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
          <FiCheckCircle /> Пройденные ({completed.length})
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'available' && (
          availableProjects.length === 0 ? (
            <div className="empty-state"><p>Нет доступных новелл</p><p className="hint">Возможно, вам нужно получить определенные статусы</p></div>
          ) : (
            <div className="projects-grid">
              {availableProjects.map(project => (
                <ProjectCard key={project.id} project={project} onPlay={onPlayProject} userRole={user?.role} isCompleted={false} hasActive={project.has_active || false} />
              ))}
            </div>
          )
        )}
        {activeTab === 'completed' && (
          completed.length === 0 ? (
            <div className="empty-state"><p>Вы ещё не прошли ни одной новеллы</p></div>
          ) : (
            <div className="projects-grid">
              {completed.map(project => (
                <ProjectCard key={project.id} project={project} onPlay={onPlayProject} userRole={user?.role} isCompleted={true} hasActive={project.has_active || false} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}