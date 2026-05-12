import React, { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectProvider, useProject } from './context/ProjectContext'
import { AuthTabs } from './components/auth/AuthTabs'
import { ProjectList } from './components/projects/ProjectList'
import { ProjectPlayer } from './components/player/ProjectPlayer'
import { ProjectEditor } from './components/projects/ProjectEditor'
import { ProjectDetails } from './components/projects/ProjectDetails'
import { ProfilePage } from './components/profile/ProfilePage'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { Header } from './components/layout/Header'
import './App.css'
import './styles/admin.css'

function Layout({ children }) {
  const location = useLocation()
  const hideHeaderPaths = ['/login']
  const shouldHideHeader = hideHeaderPaths.some(path => location.pathname === path || location.pathname.startsWith(path))
  
  return (
    <>
      {!shouldHideHeader && <Header />}
      {children}
    </>
  )
}

function ProjectsPage() {
  const { user } = useAuth()
  const { projects, fetchProjects, loading } = useProject()
  const navigate = useNavigate()
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchProjects()
    }
  }, [fetchProjects])

  const handlePlayProject = (project) => {
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="app">
      <main className="app-main">
        {loading ? (
          <div className="loading-screen">
            <div className="loader"></div>
            <p>Загрузка проектов...</p>
          </div>
        ) : (
          <ProjectList 
            projects={projects} 
            onPlayProject={handlePlayProject}
            user={user}
          />
        )}
      </main>
    </div>
  )
}

function ProjectEditorWrapper() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const { loadProjectWithScenes, loadProjectFiles } = useProject()
  const navigate = useNavigate()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    const loadProjectData = async () => {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true
      
      setLoading(true)
      try {
        const result = await loadProjectWithScenes(parseInt(projectId))
        if (result.success) {
          await loadProjectFiles(parseInt(projectId))
          setProject(result.project)
        }
      } catch (error) {
        console.error('Load error:', error)
      }
      setLoading(false)
    }
    
    loadProjectData()
  }, [projectId, loadProjectWithScenes, loadProjectFiles])

  if (loading || !project) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка проекта...</p>
      </div>
    )
  }

  return (
    <ProjectEditor 
      project={project} 
      onClose={() => navigate('/projects')}
    />
  )
}

function ProjectPlayerWrapper() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const { loadProjectWithScenes, loadProjectFiles } = useProject()
  const { user } = useAuth()
  const navigate = useNavigate()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
    
    const loadProjectData = async () => {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true
      
      setLoading(true)
      try {
        const result = await loadProjectWithScenes(parseInt(projectId))
        if (result.success) {
          await loadProjectFiles(parseInt(projectId))
          setProject(result.project)
        }
      } catch (error) {
        console.error('Load error:', error)
      }
      setLoading(false)
    }
    
    loadProjectData()
    
    return () => {
      hasLoadedRef.current = false
    }
  }, [projectId])

  const handleClose = useCallback(() => {
    navigate('/projects')
  }, [navigate])

  if (loading || !project) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка новеллы...</p>
      </div>
    )
  }

  return (
    <ProjectPlayer 
      project={project} 
      onClose={handleClose}
      hidePoints={false}
    />
  )
}

function ProjectDetailsWrapper() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { loadProjectWithScenes } = useProject()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    const loadProject = async () => {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true
      
      const result = await loadProjectWithScenes(parseInt(projectId))
      if (result.success) {
        setProject(result.project)
      }
      setLoading(false)
    }
    loadProject()
  }, [projectId, loadProjectWithScenes])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка...</p>
      </div>
    )
  }

  if (!project) {
    return <div className="error-screen">Проект не найден</div>
  }

  return <ProjectDetails project={project} onBack={() => navigate('/projects')} />
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Загрузка...</p>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' || user.role === 'super_admin' ? '/admin' : '/projects'} replace />
  }
  
  return children
}

function AppRoutes() {
  const { user, isAdmin } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={isAdmin ? '/admin' : '/projects'} replace /> : <AuthTabs />
      } />
      
      <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/projects'} replace />} />
      
      <Route path="/projects" element={
        <ProtectedRoute allowedRoles={['student', 'teacher']}>
          <ProjectsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/project/:projectId" element={
        <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'super_admin']}>
          <ProjectDetailsWrapper />
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute allowedRoles={['student', 'teacher']}>
          <ProfilePage />
        </ProtectedRoute>
      } />
      
      <Route path="/projects/play/:projectId" element={
        <ProtectedRoute allowedRoles={['student']}>
          <ProjectPlayerWrapper />
        </ProtectedRoute>
      } />
      
      <Route path="/projects/edit/:projectId" element={
        <ProtectedRoute allowedRoles={['teacher', 'admin', 'super_admin']}>
          <ProjectEditorWrapper />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/projects/play/:projectId" element={
        <ProtectedRoute allowedRoles={['student']}>
          <ProjectPlayerWrapper />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/projects'} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProjectProvider>
          <Layout>
            <AppRoutes />
          </Layout>
        </ProjectProvider>
      </AuthProvider>
    </Router>
  )
}

export default App