import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../context/ProjectContext'
import { useToast } from '../common/ToastContext'
import { FiEye, FiEdit, FiTrash2, FiX, FiAlertCircle } from 'react-icons/fi'

export const AdminProjectsList = () => {
  const navigate = useNavigate()
  const { projects, fetchProjects, deleteProject, loading } = useProject()
  const { addToast } = useToast()
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return
    
    const result = await deleteProject(deleteConfirm)
    if (result.success) {
      addToast('Проект удален', 'success')
      await fetchProjects()
    } else {
      addToast(result.error || 'Ошибка удаления проекта', 'error')
    }
    setDeleteConfirm(null)
  }

  const getOwnerName = (project) => {
    return `ID владельца: ${project.owner_id}`
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка проектов...</p>
      </div>
    )
  }

  return (
    <div className="admin-projects">
      <div className="management-header">
        <h2>Все проекты ({projects.length})</h2>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>Нет проектов в системе</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Владелец</th>
                <th>Статус</th>
                <th>Сцен</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id}>
                  <td>{project.id}</td>
                  <td>
                    <span 
                      style={{ cursor: 'pointer', color: '#667eea' }}
                      onClick={() => navigate(`/project/${project.id}`)}
                      title="Просмотреть детали"
                    >
                      {project.title.length > 30 ? project.title.substring(0, 30) + '...' : project.title}
                    </span>
                  </td>
                  <td>{getOwnerName(project)}</td>
                  <td>
                    <span className={`status-badge ${project.is_published ? 'published' : 'draft'}`}>
                      {project.is_published ? 'Опубликован' : 'Черновик'}
                    </span>
                  </td>
                  <td>{project.scenes_count || 0}</td>
                  <td>{new Date(project.created_at).toLocaleDateString('ru-RU')}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="action-btn view-btn"
                      title="Просмотреть"
                    >
                      <FiEye />
                    </button>
                    <button
                      onClick={() => navigate(`/projects/edit/${project.id}`)}
                      className="action-btn edit-btn"
                      title="Редактировать"
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(project.id)}
                      className="action-btn delete-btn"
                      title="Удалить"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить проект?</h3>
            <p>Это действие нельзя отменить. Все сцены и файлы будут удалены.</p>
            <div className="confirm-actions">
              <button onClick={handleDeleteProject} className="confirm-yes">
                <FiTrash2 /> Удалить
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no">
                <FiX /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}