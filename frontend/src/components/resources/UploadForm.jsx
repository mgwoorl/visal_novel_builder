import React, { useState } from 'react'

export const UploadForm = ({ resourceType, onUpload }) => {
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (file) {
      onUpload(file, name || file.name)
      setFile(null)
      setName('')
    }
  }

  const acceptTypes = {
    backgrounds: 'image/*',
    sprites: 'image/png, image/gif',
    music: 'audio/*'
  }

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <input
        type="file"
        accept={acceptTypes[resourceType]}
        onChange={(e) => setFile(e.target.files[0])}
        className="file-input"
      />
      <input
        type="text"
        placeholder="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="name-input"
      />
      <button type="submit" disabled={!file} className="upload-btn">Загрузить</button>
    </form>
  )
}