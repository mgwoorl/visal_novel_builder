import React, { useState, useEffect } from 'react'
import { useProject } from '../../context/ProjectContext'
import { useAuth } from '../../context/AuthContext'

export const TeacherDashboard = () => {
  const { projects, fetchProjects } = useProject()
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalProjects: 0,
    publishedProjects: 0,
    totalStudents: 0,
    totalPlaythroughs: 0
  })

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (projects) {
      setStats({
        totalProjects: projects.length,
        publishedProjects: projects.filter(p => p.is_published).length,
        totalStudents: 5,
        totalPlaythroughs: 12
      })
    }
  }, [projects])

  return (
    <div className="teacher-dashboard">
      <h2>Панель преподавателя</h2>
      <p>Добро пожаловать, {user?.last_name} {user?.first_name}!</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalProjects}</div>
          <div className="stat-label">Всего проектов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.publishedProjects}</div>
          <div className="stat-label">Опубликовано</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">Студентов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalPlaythroughs}</div>
          <div className="stat-label">Прохождений</div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="section">
          <h3>Последние проекты</h3>
          <div className="projects-list">
            {projects.slice(0, 5).map(project => (
              <div key={project.id} className="project-item">
                <span>{project.title}</span>
                <span className={`status ${project.is_published ? 'published' : 'draft'}`}>
                  {project.is_published ? 'Опубликован' : 'Черновик'}
                </span>
                <button onClick={() => window.location.href = `/projects/edit/${project.id}`}>
                  Редактировать
                </button>
              </div>
            ))}
          </div>
          <button 
            className="create-project-btn"
            onClick={() => window.location.href = '/teacher/projects/create'}
          >
            Создать новый проект
          </button>
        </div>
      </div>
    </div>
  )
}