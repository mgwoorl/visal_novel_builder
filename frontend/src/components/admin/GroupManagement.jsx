import React, { useState, useEffect } from 'react'
import api from '../../utils/api'
import { useToast } from '../common/ToastContext'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi'

export const GroupManagement = () => {
  const { addToast } = useToast()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    try {
      const response = await api.get('/users/groups')
      setGroups(response.data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    setError('')
    
    try {
      await api.post('/users/groups', formData)
      addToast('Группа создана', 'success')
      setSuccess('Group created')
      setFormData({ name: '', description: '' })
      setShowCreateModal(false)
      loadGroups()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to create group')
      addToast(error.response?.data?.detail || 'Ошибка создания группы', 'error')
    }
  }

  const handleUpdateGroup = async (e) => {
    e.preventDefault()
    setError('')
    
    try {
      await api.put(`/users/groups/${editingGroup.id}`, formData)
      addToast('Группа обновлена', 'success')
      setSuccess('Group updated')
      setShowEditModal(false)
      setEditingGroup(null)
      setFormData({ name: '', description: '' })
      loadGroups()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update group')
      addToast(error.response?.data?.detail || 'Ошибка обновления группы', 'error')
    }
  }

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this group? Students will lose group assignment.')) return
    
    try {
      await api.delete(`/users/groups/${groupId}`)
      addToast('Группа удалена', 'success')
      setSuccess('Group deleted')
      loadGroups()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete group')
      addToast(error.response?.data?.detail || 'Ошибка удаления группы', 'error')
    }
  }

  const openEditModal = (group) => {
    setEditingGroup(group)
    setFormData({ name: group.name, description: group.description || '' })
    setShowEditModal(true)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading groups...</p>
      </div>
    )
  }

  return (
    <div className="group-management">
      <div className="management-header">
        <h2>Управление группами</h2>
        <button onClick={() => setShowCreateModal(true)} className="create-btn">
          <FiPlus /> Создать группу
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="groups-list">
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>Группы еще не созданы</p>
            <p className="hint">Создайте группу для организации студентов</p>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map(group => (
              <div key={group.id} className="group-card">
                <div className="group-header">
                  <h3>{group.name}</h3>
                  <div className="group-actions">
                    <button onClick={() => openEditModal(group)} className="edit-group-btn" title="Редактировать">
                      <FiEdit2 />
                    </button>
                    <button onClick={() => handleDeleteGroup(group.id)} className="delete-group-btn" title="Удалить">
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                {group.description && (
                  <p className="group-description">{group.description}</p>
                )}
                <div className="group-meta">
                  <span>ID: {group.id}</span>
                  <span>Создана: {new Date(group.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создать группу</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Название группы</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: ПИ-101"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Описание (необязательно)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">
                  Отмена
                </button>
                <button type="submit" className="save-btn">
                  <FiSave /> Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingGroup && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать группу</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleUpdateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Название группы</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Описание (необязательно)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="cancel-btn">
                  Отмена
                </button>
                <button type="submit" className="save-btn">
                  <FiSave /> Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}