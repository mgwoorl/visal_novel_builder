import React from 'react'
import { ResourceItem } from './ResourceItem'

export const ResourceGallery = ({ items, onItemClick }) => {
  if (!items.length) {
    return <p className="empty-state">Нет загруженных ресурсов</p>
  }

  return (
    <div className="resources-grid">
      {items.map(item => (
        <ResourceItem key={item.id} item={item} onClick={onItemClick} />
      ))}
    </div>
  )
}