import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiEdit, FiPlay, FiStar, FiCheckCircle, FiEye, FiEyeOff, FiTag, FiRefreshCw, FiBookOpen, FiTrash2 } from 'react-icons/fi'

const DefaultCover = () => (
  <div className="default-cover">
    <FiBookOpen className="default-cover-icon" />
    <span>Нет обложки</span>
  </div>
)

export const ProjectCard = ({ project, onPlay, userRole, isCompleted = false, hasActive = false, onDelete }) => {
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const coverUrl = project.cover_url 
    ? (project.cover_url.startsWith('http') 
        ? project.cover_url 
        : `http://localhost:8000${project.cover_url}`)
    : null

  const handleCardClick = (e) => {
    if (e.target.closest('button')) return
    navigate(`/project/${project.id}`)
  }

  const handleActionClick = (e) => {
    e.stopPropagation()
    if (userRole === 'teacher' || userRole === 'admin' || userRole === 'super_admin') {
      navigate(`/projects/edit/${project.id}`)
    } else {
      navigate(`/projects/play/${project.id}`)
    }
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = (e) => {
    e.stopPropagation()
    if (onDelete) onDelete(project.id)
    setShowDeleteConfirm(false)
  }

  const handleCancelDelete = (e) => {
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }

  const description = project.description || ''
  const shortDescription = description.length > 100 ? description.slice(0, 100) + '...' : description
  const shortTitle = project.title && project.title.length > 35 ? project.title.slice(0, 35) + '...' : project.title

  const getButtonProps = () => {
    if (hasActive && !isCompleted) {
      return { icon: FiPlay, text: ' Продолжить', className: 'play-btn continue-btn-style' }
    }
    if (isCompleted) {
      return { icon: FiRefreshCw, text: ' Играть снова', className: 'play-btn replay-btn' }
    }
    return { icon: FiPlay, text: ' Играть', className: 'play-btn' }
  }

  const buttonProps = getButtonProps()
  const ButtonIcon = buttonProps.icon

  if (userRole === 'teacher' || userRole === 'admin' || userRole === 'super_admin') {
    return (
      <div className="project-card teacher-card" onClick={handleCardClick}>
        <div className="project-cover">
          {coverUrl ? <img src={coverUrl} alt={project.title} /> : <DefaultCover />}
          <div className="cover-badge-container">
            {!project.is_published && <div className="cover-badge draft-badge"><FiEyeOff /> Черновик</div>}
            {project.is_published && <div className="cover-badge published-badge"><FiEye /> Опубликован</div>}
          </div>
        </div>
        <div className="project-content">
          <h3 className="project-title" title={project.title}>{shortTitle}</h3>
          {description && <p className="project-description">{shortDescription}</p>}
          {project.required_statuses && project.required_statuses.length > 0 && (
            <div className="project-required-statuses">
              <small><FiTag /> Требуемые статусы:</small>
              <div className="status-tags">
                {project.required_statuses.map(s => <span key={s} className="status-tag">{s}</span>)}
              </div>
            </div>
          )}
          {project.groups && project.groups.length > 0 && (
            <div className="project-required-statuses">
              <small>Группы:</small>
              <div className="status-tags">
                {project.groups.map(g => <span key={g} className="status-tag">{g}</span>)}
              </div>
            </div>
          )}
          <div className="project-footer">
            <button className="edit-btn" onClick={handleActionClick}><FiEdit /> Редактировать</button>
            <button className="delete-btn" onClick={handleDeleteClick} title="Удалить"><FiTrash2 /></button>
          </div>
        </div>
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
            <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
              <p>Удалить проект?</p>
              <div className="delete-confirm-actions">
                <button onClick={handleConfirmDelete} className="confirm-yes-btn">Удалить</button>
                <button onClick={handleCancelDelete} className="confirm-no-btn">Отмена</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="project-card student-card" onClick={handleCardClick}>
      <div className="project-cover">
        {coverUrl ? <img src={coverUrl} alt={project.title} /> : <DefaultCover />}
        <div className="cover-badge-container">
          {hasActive && !isCompleted && (
            <div className="cover-badge status-earned-badge"><FiPlay /> Активно</div>
          )}
          {isCompleted && (
            <div className="cover-badge completed-badge"><FiCheckCircle /> Пройдено</div>
          )}
        </div>
      </div>
      <div className="project-content">
        <h3 className="project-title" title={project.title}>{shortTitle}</h3>
        {description && <p className="project-description">{shortDescription}</p>}
        {project.required_statuses && project.required_statuses.length > 0 && (
          <div className="project-required-statuses">
            <small><FiTag /> Требуемые статусы:</small>
            <div className="status-tags">
              {project.required_statuses.map(s => <span key={s} className="status-tag">{s}</span>)}
            </div>
          </div>
        )}
        {project.reward_status && (
          <div className="project-reward"><FiStar /> Награда: <strong>{project.reward_status}</strong></div>
        )}
        <div className="project-footer">
          <button className={buttonProps.className} onClick={handleActionClick}>
            <ButtonIcon />{buttonProps.text}
          </button>
        </div>
      </div>
    </div>
  )
}