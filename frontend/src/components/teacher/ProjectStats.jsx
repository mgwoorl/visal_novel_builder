import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

export const ProjectStats = () => {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setProject({
        id: projectId,
        title: 'Первое приключение'
      })
      setLoading(false)
    }, 1000)
  }, [projectId])

  if (loading) return <div>Загрузка...</div>

  return (
    <div className="project-stats">
      <h2>Статистика проекта: {project?.title}</h2>
      <p>Здесь будет статистика по проекту</p>
    </div>
  )
}