import React, { useState, useEffect } from 'react'
import api from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import { FiUsers } from 'react-icons/fi'

export const ProjectGroupsSettings = ({ projectId, onUpdate }) => {
  const { user } = useAuth()
  const [allGroups, setAllGroups] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadGroups()
    loadProjectGroups()
  }, [projectId])

  const loadGroups = async () => {
    try {
      const response = await api.get('/users/groups')
      setAllGroups(response.data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    }
  }

  const loadProjectGroups = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/groups`, {
        params: {
          user_email: user.email,
          user_password: user.password
        }
      })
      setSelectedGroups(response.data.map(g => g.id))
    } catch (error) {
      console.error('Failed to load project groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleGroup = (groupId) => {
    setSelectedGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/projects/${projectId}/groups`, selectedGroups, {
        params: {
          user_email: user.email,
          user_password: user.password
        }
      })
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to save project groups:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading-files">Loading groups...</div>
  }

  return (
    <div className="project-groups-settings">
      <h4><FiUsers /> Access by groups</h4>
      <div className="groups-checkbox-list">
        {allGroups.map(group => (
          <label key={group.id} className="group-checkbox">
            <input
              type="checkbox"
              checked={selectedGroups.includes(group.id)}
              onChange={() => handleToggleGroup(group.id)}
            />
            <span>{group.name}</span>
          </label>
        ))}
        {allGroups.length === 0 && (
          <p className="hint">No groups created yet. Create groups in admin panel.</p>
        )}
      </div>
      <button onClick={handleSave} disabled={saving} className="save-groups-btn">
        {saving ? 'Saving...' : 'Save groups'}
      </button>
    </div>
  )
}