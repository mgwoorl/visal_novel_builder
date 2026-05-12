import React, { useState, useEffect } from 'react'
import { useProject } from '../../context/ProjectContext'
import { useToast } from '../common/ToastContext'
import { FiPlus, FiTrash2, FiSave, FiX } from 'react-icons/fi'

export const StatusManagement = () => {
  const { fetchAllStatuses, addNewStatus, deleteStatus, allStatuses } = useProject()
  const { addToast } = useToast()
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [newStatusName, setNewStatusName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadStatuses()
  }, [])

  const loadStatuses = async () => {
    setLoading(true)
    const result = await fetchAllStatuses()
    if (result.success) {
      setStatuses(result.statuses)
    }
    setLoading(false)
  }

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return
    
    setAdding(true)
    const result = await addNewStatus(newStatusName.trim())
    if (result.success) {
      addToast('Статус добавлен', 'success')
      setNewStatusName('')
      await loadStatuses()
    } else {
      addToast(result.error || 'Ошибка добавления статуса', 'error')
    }
    setAdding(false)
  }

  const handleDeleteStatus = async (statusId, statusName) => {
    if (statusName === 'Стажёр') {
      addToast('Нельзя удалить базовый статус "Стажёр"', 'warning')
      return
    }
    
    if (!window.confirm(`Удалить статус "${statusName}"?`)) return
    
    const result = await deleteStatus(statusId)
    if (result.success) {
      addToast('Статус удален', 'success')
      await loadStatuses()
    } else {
      addToast(result.error || 'Ошибка удаления статуса', 'error')
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка статусов...</p>
      </div>
    )
  }

  return (
    <div className="status-management">
      <div className="management-header">
        <h2>Управление статусами</h2>
      </div>

      <div className="status-add-form">
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <input
              type="text"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="Название нового статуса"
              onKeyPress={(e) => e.key === 'Enter' && handleAddStatus()}
            />
          </div>
          <button onClick={handleAddStatus} className="create-btn" disabled={adding || !newStatusName.trim()}>
            <FiPlus /> {adding ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>

      <div className="statuses-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Описание</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map(status => (
              <tr key={status.id}>
                <td>{status.id}</td>
                <td>
                  <span className="status-name-cell">
                    {status.name}
                    {status.name === 'Стажёр' && (
                      <span className="default-badge">по умолчанию</span>
                    )}
                  </span>
                </td>
                <td>{status.description || '-'}</td>
                <td>
                  <button
                    onClick={() => handleDeleteStatus(status.id, status.name)}
                    className="action-btn delete-btn"
                    title="Удалить статус"
                    disabled={status.name === 'Стажёр'}
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
            {statuses.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
                  Нет статусов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}