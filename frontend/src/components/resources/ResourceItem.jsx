import React, { useState } from 'react'

export const ResourceItem = ({ resource, onClick }) => {
  const [imageError, setImageError] = useState(false)
  
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(resource))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleImageError = () => {
    console.log('❌ Ошибка загрузки изображения:', resource.url)
    setImageError(true)
  }

  const isImage = resource.type === 'backgrounds' || resource.type === 'sprites'
  const imageUrl = resource.url.startsWith('http') 
    ? resource.url 
    : `http://localhost:8000${resource.url}`

  return (
    <div 
      className="resource-item" 
      onClick={() => onClick(resource)} 
      onDragStart={handleDragStart} 
      draggable
    >
      {isImage ? (
        !imageError ? (
          <img 
            src={imageUrl} 
            alt={resource.name} 
            className="resource-preview"
            onError={handleImageError}
          />
        ) : (
          <div className="resource-preview audio">
            🖼️
            <div style={{ fontSize: '10px', marginTop: '5px' }}>Ошибка</div>
          </div>
        )
      ) : (
        <div className="resource-preview audio">🎵</div>
      )}
      <div className="resource-name">{resource.name}</div>
    </div>
  )
}