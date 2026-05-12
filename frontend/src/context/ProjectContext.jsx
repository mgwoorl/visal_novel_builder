import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import api from '../utils/api'
import { useAuth } from './AuthContext'

const ProjectContext = createContext()

export const useProject = () => {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProject must be used within ProjectProvider')
  return context
}

// Structured logger
const log = (level, method, message, data = {}) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}][${level}][ProjectContext.${method}]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  logFn(prefix, message, data)
}

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [projectScenes, setProjectScenes] = useState([])
  const [projectFiles, setProjectFiles] = useState({ backgrounds: [], sprites: [], music: [], covers: [] })
  const [allStatuses, setAllStatuses] = useState([])
  const [loading, setLoading] = useState(false)
  const [scenesLoading, setScenesLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  
  const loadingFilesRef = useRef(false)
  const loadingProjectRef = useRef(false)
  const loadingScenesRef = useRef(false)
  const loadingProjectsRef = useRef(false)

  // ============= СТАТУСЫ =============
  const fetchAllStatuses = useCallback(async () => {
    if (!user) return { success: false, statuses: [] }
    try {
      log('INFO', 'fetchAllStatuses', 'Fetching')
      const response = await api.get('/projects/statuses/all')
      setAllStatuses(response.data)
      return { success: true, statuses: response.data }
    } catch (error) {
      log('ERROR', 'fetchAllStatuses', 'Failed', { error: error.message })
      return { success: false, statuses: [] }
    }
  }, [user])

  const addNewStatus = useCallback(async (statusName) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      const response = await api.post('/projects/statuses/add', { name: statusName.trim() })
      await fetchAllStatuses()
      return { success: true, status: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user, fetchAllStatuses])

  const deleteStatus = useCallback(async (statusId) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      await api.delete(`/projects/statuses/${statusId}`)
      await fetchAllStatuses()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user, fetchAllStatuses])

  // ============= ПОЛЬЗОВАТЕЛИ =============
  const getUserById = useCallback(async (userId) => {
    if (!user) return { success: false, user: null }
    try {
      const response = await api.get(`/users/${userId}`)
      return { success: true, user: response.data }
    } catch (error) {
      return { success: false, user: null }
    }
  }, [user])

  const getStudentProfile = useCallback(async () => {
    if (!user) return { success: false, data: null }
    try {
      const response = await api.get('/users/student/profile')
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, data: null }
    }
  }, [user])

  // ============= ПРОЕКТЫ =============
  const fetchProjects = useCallback(async () => {
    if (!user || loadingProjectsRef.current) return
    loadingProjectsRef.current = true
    setLoading(true)
    try {
      const response = await api.get('/projects/')
      setProjects(response.data)
    } catch (error) {
      log('ERROR', 'fetchProjects', 'Failed', { error: error.message })
    } finally {
      setLoading(false)
      loadingProjectsRef.current = false
    }
  }, [user])

  const createProject = useCallback(async (title, description, min_points = 0, reward_status = 'Стажёр', required_statuses = [], group_ids = []) => {
    if (!user) return { success: false, error: 'Auth required' }
    const formData = new FormData()
    formData.append('title', title)
    formData.append('description', description)
    formData.append('min_points', min_points)
    formData.append('reward_status', reward_status)
    formData.append('required_statuses', JSON.stringify(required_statuses))
    formData.append('group_ids', JSON.stringify(group_ids))
    try {
      const response = await api.post('/projects/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchProjects()
      return { success: true, project: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user, fetchProjects])

  const loadProject = useCallback(async (projectId) => {
    if (!user || loadingProjectRef.current) return { success: false, error: 'Already loading', project: currentProject }
    loadingProjectRef.current = true
    setLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}`)
      setCurrentProject(response.data)
      return { success: true, project: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', project: null }
    } finally {
      setLoading(false)
      loadingProjectRef.current = false
    }
  }, [user, currentProject])

  const updateProject = useCallback(async (projectId, projectData) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      const response = await api.put(`/projects/${projectId}`, projectData)
      setCurrentProject(response.data)
      await fetchProjects()
      return { success: true, project: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user, fetchProjects])

  const deleteProject = useCallback(async (projectId) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      await api.delete(`/projects/${projectId}`)
      await fetchProjects()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user, fetchProjects])

  const loadProjectWithScenes = useCallback(async (projectId) => {
    if (!user) return { success: false, error: 'Auth required', project: null }
    try {
      const projectResponse = await api.get(`/projects/${projectId}`)
      const project = projectResponse.data
      const scenesResponse = await api.get(`/scenes/project/${projectId}`)
      const scenesWithData = await Promise.all(
        scenesResponse.data.map(scene => api.get(`/scenes/${scene.id}/full`).then(r => r.data))
      )
      const fullProject = { ...project, scenes: scenesWithData }
      setCurrentProject(fullProject)
      return { success: true, project: fullProject }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', project: null }
    }
  }, [user])

  // ============= СЦЕНЫ =============
  const loadProjectScenes = useCallback(async (projectId) => {
    if (!user || loadingScenesRef.current) return { success: false, error: 'Already loading', scenes: projectScenes }
    loadingScenesRef.current = true
    setScenesLoading(true)
    try {
      const response = await api.get(`/scenes/project/${projectId}`)
      setProjectScenes(response.data)
      return { success: true, scenes: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', scenes: [] }
    } finally {
      setScenesLoading(false)
      loadingScenesRef.current = false
    }
  }, [user, projectScenes])

  const loadFullScene = useCallback(async (sceneId) => {
    if (!user) return { success: false, error: 'Auth required', scene: null }
    try {
      const response = await api.get(`/scenes/${sceneId}/full`)
      return { success: true, scene: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', scene: null }
    }
  }, [user])

  const createScene = useCallback(async (projectId, name = 'Новая сцена') => {
    if (!user) return { success: false, error: 'Auth required', scene: null }
    try {
      const response = await api.post(`/scenes/?project_id=${projectId}`, { name, project_id: projectId })
      await loadProjectScenes(projectId)
      return { success: true, scene: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', scene: null }
    }
  }, [user, loadProjectScenes])

  const saveScene = useCallback(async (sceneId, sceneData) => {
    if (!user) return { success: false, error: 'Auth required', scene: null }
    try {
      const response = await api.put(`/scenes/${sceneId}/full`, sceneData)
      setProjectScenes(prev => prev.map(s => s.id === sceneId ? { ...s, name: sceneData.name, background_url: sceneData.background_url, background_type: sceneData.background_type } : s))
      return { success: true, scene: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', scene: null }
    }
  }, [user])

  const deleteScene = useCallback(async (sceneId) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      await api.delete(`/scenes/${sceneId}`)
      setProjectScenes(prev => prev.filter(s => s.id !== sceneId))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user])

  const deleteSceneNode = useCallback(async (sceneId, nodeId) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      await api.delete(`/scenes/${sceneId}/nodes/${nodeId}`)
      return { success: true }
    } catch (error) { return { success: true } }
  }, [user])

  const deleteNodeOption = useCallback(async (sceneId, nodeId, optionId) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      await api.delete(`/scenes/${sceneId}/nodes/${nodeId}/options/${optionId}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user])

  // ============= ВЫПОЛНЕНИЕ ГРАФА =============
  
  /**
   * Запускает выполнение сцены.
   * @param {number} sceneId - ID сцены
   * @param {string|null} startNodeId - ID узла для старта (null = стартовый узел)
   */
  const startSceneExecution = useCallback(async (sceneId, startNodeId = null) => {
    try {
      log('INFO', 'startSceneExecution', 'Starting', { sceneId, startNodeId: startNodeId || 'default' })
      
      const requestBody = {}
      if (startNodeId && startNodeId !== 'null' && startNodeId !== 'undefined') {
        requestBody.start_node_id = startNodeId
        log('INFO', 'startSceneExecution', 'Resuming from node', { startNodeId })
      }
      
      const response = await api.post(`/scenes/execute/${sceneId}/start`, requestBody)
      
      log('INFO', 'startSceneExecution', 'Result', {
        status: response.data.execution?.status,
        currentNode: response.data.execution?.current_node?.id,
        hasOptions: response.data.execution?.has_options
      })
      
      return { success: true, execution: response.data.execution }
    } catch (error) {
      log('ERROR', 'startSceneExecution', 'Failed', { sceneId, error: error.message })
      return { success: false, error: error.response?.data?.detail || 'Error', execution: null }
    }
  }, [])

  const selectOption = useCallback(async (sceneId, nodeId, optionId, contextData) => {
    try {
      log('INFO', 'selectOption', 'Selecting', { sceneId, nodeId, optionId })
      const response = await api.post(`/scenes/execute/${sceneId}/select`, {
        node_id: nodeId,
        option_id: optionId,
        context_data: contextData
      })
      return { success: true, execution: response.data.execution }
    } catch (error) {
      log('ERROR', 'selectOption', 'Failed', { error: error.message })
      return { success: false, error: error.response?.data?.detail || 'Error', execution: null }
    }
  }, [])

  // ============= ПРОХОЖДЕНИЯ =============
  
  /**
   * Начинает новое прохождение или возвращает существующее.
   * ВАЖНО: Возвращает last_scene_index и last_node_id для восстановления.
   */
  const startPlaythrough = useCallback(async (projectId) => {
    if (!user) return { success: false, error: 'Auth required', playthrough_id: null }
    try {
      log('INFO', 'startPlaythrough', 'Starting', { projectId })
      const response = await api.post('/playthroughs/start', null, { params: { project_id: projectId } })
      const data = response.data
      
      log('INFO', 'startPlaythrough', 'Result', {
        playthroughId: data.playthrough_id,
        message: data.message,
        lastSceneIndex: data.last_scene_index,
        lastNodeId: data.last_node_id
      })
      
      return {
        success: true,
        playthrough_id: data.playthrough_id,
        message: data.message,
        last_scene_index: data.last_scene_index || 0,
        last_node_id: data.last_node_id || null,
        context_data: data.context_data || null
      }
    } catch (error) {
      log('ERROR', 'startPlaythrough', 'Failed', { error: error.message })
      return { success: false, error: error.response?.data?.detail || 'Error', playthrough_id: null }
    }
  }, [user])

  const abortPlaythrough = useCallback(async (playthroughId) => {
    if (!user) return { success: false }
    try {
      log('INFO', 'abortPlaythrough', 'Aborting', { playthroughId })
      await api.delete(`/playthroughs/${playthroughId}/abort`)
      return { success: true }
    } catch (error) {
      log('ERROR', 'abortPlaythrough', 'Failed', { error: error.message })
      return { success: false }
    }
  }, [user])

  const completePlaythrough = useCallback(async (playthroughId, totalPoints, answers) => {
    if (!user) return { success: false, error: 'Auth required', reward_status: null }
    try {
      log('INFO', 'completePlaythrough', 'Completing', { playthroughId, totalPoints, answersCount: answers.length })
      const response = await api.post(`/playthroughs/${playthroughId}/complete`, {
        total_points: totalPoints,
        answers
      })
      return { success: true, reward_status: response.data.reward_status }
    } catch (error) {
      log('ERROR', 'completePlaythrough', 'Failed', { error: error.message })
      return { success: false, error: error.response?.data?.detail || 'Error', reward_status: null }
    }
  }, [user])

  const getCompletedProjects = useCallback(async () => {
    if (!user) return { success: false, completed_ids: [] }
    try {
      const response = await api.get('/playthroughs/completed')
      return { success: true, completed_ids: response.data.completed_ids }
    } catch (error) { return { success: false, completed_ids: [] } }
  }, [user])

  const getUserStatuses = useCallback(async () => {
    if (!user) return { success: false, statuses: [] }
    try {
      const response = await api.get('/users/me/statuses')
      return { success: true, statuses: response.data }
    } catch (error) { return { success: false, statuses: [] } }
  }, [user])

  // ============= ФАЙЛЫ =============
  const loadProjectFiles = useCallback(async (projectId) => {
    if (!user || loadingFilesRef.current) return { success: false, error: 'Already loading', files: projectFiles }
    loadingFilesRef.current = true
    setFilesLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/files`)
      setProjectFiles(response.data)
      return { success: true, files: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', files: null }
    } finally {
      setFilesLoading(false)
      loadingFilesRef.current = false
    }
  }, [user, projectFiles])

  const uploadFile = useCallback(async (projectId, file, fileType, customName = null, replace = false) => {
    if (!user) return { success: false, error: 'Auth required', file: null }
    const formData = new FormData()
    formData.append('file', file)
    if (customName) formData.append('custom_name', customName)
    if (replace) formData.append('replace', 'true')
    try {
      const response = await api.post(`/projects/${projectId}/upload/${fileType}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (fileType === 'covers') {
        setCurrentProject(prev => prev ? { ...prev, cover_url: response.data.url } : null)
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, cover_url: response.data.url } : p))
      } else {
        setProjectFiles(prev => ({ ...prev, [fileType]: [...(prev[fileType] || []), response.data] }))
      }
      return { success: true, file: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error', file: null }
    }
  }, [user])

  const deleteFile = useCallback(async (projectId, file, fileType) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      const fileName = file.url ? file.url.split('/').pop() : file.name
      await api.delete(`/projects/${projectId}/files/${fileType}/${encodeURIComponent(fileName)}`)
      setProjectFiles(prev => ({ ...prev, [fileType]: prev[fileType].filter(f => f.id !== file.id) }))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user])

  const renameFile = useCallback(async (projectId, file, fileType, newName) => {
    if (!user) return { success: false, error: 'Auth required' }
    try {
      let oldFileName = file.url?.split('/').pop() || file.name || file.filename
      if (!oldFileName) return { success: false, error: 'Could not determine filename' }
      await api.put(`/projects/${projectId}/files/${fileType}/${encodeURIComponent(oldFileName)}`, { new_name: newName })
      setProjectFiles(prev => ({
        ...prev,
        [fileType]: prev[fileType].map(f => {
          if (f.id === file.id) {
            let newUrl = f.url
            if (newUrl) {
              const parts = newUrl.split('/')
              parts[parts.length - 1] = newName
              newUrl = parts.join('/')
            }
            return { ...f, name: newName, filename: newName, url: newUrl }
          }
          return f
        })
      }))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Error' }
    }
  }, [user])

  const clearCurrentProject = useCallback(() => {
    setCurrentProject(null)
    setProjectScenes([])
    setProjectFiles({ backgrounds: [], sprites: [], music: [], covers: [] })
  }, [])

  const value = {
    projects, currentProject, projectScenes, projectFiles, allStatuses,
    loading, scenesLoading, filesLoading,
    fetchAllStatuses, addNewStatus, deleteStatus,
    fetchProjects, createProject, loadProject, updateProject, deleteProject, loadProjectWithScenes,
    getUserById, getStudentProfile,
    loadProjectScenes, loadFullScene, createScene, saveScene, deleteScene, deleteSceneNode, deleteNodeOption,
    startSceneExecution, selectOption,
    startPlaythrough, abortPlaythrough, completePlaythrough, getCompletedProjects, getUserStatuses,
    loadProjectFiles, uploadFile, deleteFile, renameFile,
    clearCurrentProject
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}