import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/ToastContext'
import api from '../../utils/api'
import { FiPlus, FiTrash2, FiKey, FiX, FiSave, FiUserPlus, FiAlertCircle } from 'react-icons/fi'

export const UserManagement = () => {
  const { isSuperAdmin, user } = useAuth()
  const { addToast } = useToast()
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    last_name: '',
    first_name: '',
    patronymic: '',
    role: 'student',
    group_id: '',
    password: ''
  })
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUsers()
    loadGroups()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/users/admin/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await api.get('/users/groups')
      setGroups(response.data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    }
  }

  const getRoleLabel = (role) => {
    const labels = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'teacher': 'Teacher',
      'student': 'Student'
    }
    return labels[role] || role
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!formData.password || formData.password.length < 4) {
      setError('Пароль должен быть не менее 4 символов')
      return
    }
    
    try {
      const payload = {
        email: formData.email,
        last_name: formData.last_name,
        first_name: formData.first_name,
        patronymic: formData.patronymic || '',
        role: formData.role,
        password: formData.password
      }
      
      if (formData.role === 'student' && formData.group_id) {
        payload.group_id = parseInt(formData.group_id)
      }
      
      await api.post('/users/admin/users', payload)
      addToast('Пользователь успешно создан', 'success')
      setSuccess('Пользователь создан')
      setFormData({
        email: '', last_name: '', first_name: '', patronymic: '',
        role: 'student', group_id: '', password: ''
      })
      setShowCreateModal(false)
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка создания пользователя')
      addToast(error.response?.data?.detail || 'Ошибка создания пользователя', 'error')
    }
  }

  const handleUpdateUserGroup = async (userId, groupId) => {
    try {
      const groupIdValue = groupId ? parseInt(groupId) : null
      await api.put(`/users/admin/users/${userId}`, { group_id: groupIdValue })
      loadUsers()
      addToast('Группа пользователя обновлена', 'success')
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка обновления группы', 'error')
    }
  }

  const handleChangeRole = async (userId, newRole) => {
    if (!isSuperAdmin) {
      addToast('Только супер-админ может менять роли', 'warning')
      return
    }
    
    try {
      await api.put(`/users/admin/users/${userId}`, { role: newRole })
      
      if (newRole !== 'student') {
        await api.put(`/users/admin/users/${userId}`, { group_id: null })
      }
      
      addToast('Роль пользователя изменена', 'success')
      loadUsers()
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка изменения роли', 'error')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return
    
    try {
      await api.delete(`/users/admin/users/${deleteConfirm}`)
      addToast('Пользователь удален', 'success')
      loadUsers()
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка удаления пользователя', 'error')
    }
    setDeleteConfirm(null)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetPassword || resetPassword.length < 4) {
      setError('Пароль должен быть не менее 4 символов')
      return
    }
    
    try {
      await api.post(`/users/admin/users/${selectedUserId}/reset-password`, {
        new_password: resetPassword
      })
      addToast('Пароль успешно сброшен', 'success')
      setShowResetModal(false)
      setResetPassword('')
      setSelectedUserId(null)
    } catch (error) {
      addToast(error.response?.data?.detail || 'Ошибка сброса пароля', 'error')
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка пользователей...</p>
      </div>
    )
  }

  return (
    <div className="user-management">
      <div className="management-header">
        <h2>Управление пользователями</h2>
        <button onClick={() => setShowCreateModal(true)} className="create-btn">
          <FiUserPlus /> Создать пользователя
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Группа</th>
              <th>Дата регистрации</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{`${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim()}</td>
                <td>{u.email}</td>
                <td>
                  <span className="role-display">{getRoleLabel(u.role)}</span>
                  {isSuperAdmin && u.id !== user?.id && u.role !== 'super_admin' && (
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u.id, e.target.value)}
                      className="role-select-mini"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                <td>
                  {u.role === 'student' ? (
                    <select
                      value={u.group_id || ''}
                      onChange={(e) => handleUpdateUserGroup(u.id, e.target.value || null)}
                      className="group-select"
                    >
                      <option value="">Нет группы</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>
                  )}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                <td className="actions-cell">
                  <button
                    onClick={() => { setSelectedUserId(u.id); setShowResetModal(true) }}
                    className="action-btn reset-btn"
                    title="Сбросить пароль"
                  >
                    <FiKey />
                  </button>
                  {u.id !== user?.id && u.role !== 'super_admin' && (
                    <button
                      onClick={() => setDeleteConfirm(u.id)}
                      className="action-btn delete-btn"
                      title="Удалить пользователя"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно создания пользователя */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создать пользователя</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Фамилия</label>
                    <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Имя</label>
                    <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Отчество</label>
                    <input type="text" value={formData.patronymic} onChange={(e) => setFormData({ ...formData, patronymic: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Роль</label>
                    <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value, group_id: e.target.value !== 'student' ? '' : formData.group_id })}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      {isSuperAdmin && <option value="admin">Admin</option>}
                    </select>
                  </div>
                  {formData.role === 'student' && (
                    <div className="form-group">
                      <label>Группа</label>
                      <select value={formData.group_id} onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}>
                        <option value="">Нет группы</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Пароль</label>
                  <input type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required placeholder="Минимум 4 символа" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">Отмена</button>
                <button type="submit" className="save-btn"><FiSave /> Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно сброса пароля */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Сбросить пароль</h3>
              <button className="modal-close" onClick={() => setShowResetModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Новый пароль</label>
                  <input type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required placeholder="Минимум 4 символа" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowResetModal(false)} className="cancel-btn">Отмена</button>
                <button type="submit" className="save-btn"><FiSave /> Сбросить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Подтверждение удаления */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><FiAlertCircle /> Удалить пользователя?</h3>
            <p>Это действие нельзя отменить. Все данные пользователя будут удалены.</p>
            <div className="confirm-actions">
              <button onClick={handleDeleteUser} className="confirm-yes"><FiTrash2 /> Удалить</button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no"><FiX /> Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}