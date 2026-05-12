import React, { useState, useRef, useEffect } from 'react'
import { 
  FiImage, FiMusic, FiUser, FiChevronUp, FiChevronDown, 
  FiTrash2, FiUpload, FiVideo, FiFolder, FiX,
  FiVolume2, FiSearch, FiFilter, FiUsers, FiEdit2,
  FiAlertCircle
} from 'react-icons/fi'
import { 
  groupSpritesByCharacter, 
  getUniqueCharacters, 
  filterSprites,
  validateFileName,
  isFileNameExists,
  generateUniqueFileName,
  extractCharacterName
} from '../../utils/fileUtils'

export const ResourceBar = ({ 
  projectId, 
  files, 
  onUpload, 
  onSelectResource, 
  onDeleteResource,
  onRenameFile,
  loading 
}) => {
  const [activeTab, setActiveTab] = useState('backgrounds')
  const [backgroundSubTab, setBackgroundSubTab] = useState('all')
  const [isExpanded, setIsExpanded] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState('all')
  const [showRenameDialog, setShowRenameDialog] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [conflictAction, setConflictAction] = useState(null)
  
  const spritesByCharacter = groupSpritesByCharacter(files.sprites || [])
  const uniqueCharacters = getUniqueCharacters(files.sprites || [])
  
  const filteredSprites = filterSprites(
    files.sprites || [], 
    searchTerm, 
    selectedCharacter
  )

  const tabs = [
    { id: 'backgrounds', label: 'Фоны', icon: FiImage },
    { id: 'sprites', label: 'Спрайты', icon: FiUser },
    { id: 'music', label: 'Музыка', icon: FiMusic }
  ]

  const openUploadDialog = (file) => {
    const defaultName = file.name.replace(/\.[^/.]+$/, '')
    setUploadFileName(defaultName)
    setPendingFile(file)
    setUploadError('')
    setConflictAction(null)
    setShowUploadDialog(true)
  }

  const handleUploadConfirm = async () => {
    const validation = validateFileName(uploadFileName)
    if (!validation.isValid) {
      setUploadError(validation.error)
      return
    }
    
    const currentFiles = files[activeTab] || []
    if (isFileNameExists(currentFiles, uploadFileName)) {
      setConflictAction('replace')
      setUploadError(`Файл с именем "${uploadFileName}" уже существует. Хотите заменить его?`)
      return
    }
    
    await performUpload()
  }

  const performUpload = async () => {
    setUploadProgress(0)
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 100)
    
    await onUpload(pendingFile, activeTab, uploadFileName)
    
    clearInterval(interval)
    setUploadProgress(100)
    setTimeout(() => {
      setUploadProgress(null)
      setShowUploadDialog(false)
      setPendingFile(null)
      setUploadFileName('')
      setConflictAction(null)
    }, 1000)
  }

  const handleReplaceFile = async () => {
    await onUpload(pendingFile, activeTab, uploadFileName, true)
    setUploadProgress(100)
    setTimeout(() => {
      setUploadProgress(null)
      setShowUploadDialog(false)
      setPendingFile(null)
      setUploadFileName('')
      setConflictAction(null)
    }, 1000)
  }

  const handleCreateCopy = () => {
    const currentFiles = files[activeTab] || []
    const uniqueName = generateUniqueFileName(currentFiles, uploadFileName)
    setUploadFileName(uniqueName)
    setUploadError('')
    setConflictAction(null)
    setTimeout(() => performUpload(), 100)
  }

  const cancelUpload = () => {
    setShowUploadDialog(false)
    setPendingFile(null)
    setUploadFileName('')
    setUploadError('')
    setConflictAction(null)
  }

  const handleRenameClick = (file, fileType) => {
    const currentName = file.name || file.filename || ''
    const nameWithoutExt = currentName.replace(/\.[^/.]+$/, '')
    setRenameValue(nameWithoutExt)
    setRenameError('')
    setShowRenameDialog({ file, fileType })
  }

  const handleRenameConfirm = async () => {
    const validation = validateFileName(renameValue)
    if (!validation.isValid) {
      setRenameError(validation.error)
      return
    }
    
    const currentFiles = files[showRenameDialog.fileType] || []
    if (isFileNameExists(currentFiles, renameValue, showRenameDialog.file.id)) {
      setRenameError(`Файл с именем "${renameValue}" уже существует`)
      return
    }
    
    const oldName = showRenameDialog.file.name || showRenameDialog.filename || ''
    const extension = oldName.split('.').pop()
    const newNameWithExt = `${renameValue}.${extension}`
    
    if (onRenameFile) {
      const result = await onRenameFile(showRenameDialog.file, showRenameDialog.fileType, newNameWithExt)
      
      if (result && result.success) {
        setShowRenameDialog(null)
        setRenameValue('')
        setRenameError('')
      } else {
        setRenameError(result?.error || 'Ошибка при переименовании')
      }
    } else {
      setRenameError('Функция переименования не доступна')
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      openUploadDialog(file)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      openUploadDialog(file)
    }
    e.target.value = ''
  }

  const getAcceptTypes = () => {
    if (activeTab === 'backgrounds') {
      if (backgroundSubTab === 'images') {
        return '.jpg,.jpeg,.png,.gif,.webp'
      } else if (backgroundSubTab === 'videos') {
        return '.mp4,.webm,.ogg,.mov'
      }
      return '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.ogg,.mov'
    }
    
    switch(activeTab) {
      case 'music':
        return '.mp3,.wav,.ogg,.m4a'
      case 'sprites':
        return '.png,.gif,.webp,.jpg,.jpeg'
      default:
        return '.jpg,.jpeg,.png,.gif,.webp'
    }
  }

  const getDropzoneText = () => {
    if (activeTab === 'sprites') {
      return 'Перетащите спрайт или нажмите для выбора'
    }
    if (activeTab === 'backgrounds') {
      if (backgroundSubTab === 'images') {
        return 'Перетащите изображение или нажмите для выбора'
      } else if (backgroundSubTab === 'videos') {
        return 'Перетащите видео или нажмите для выбора'
      }
      return 'Перетащите изображение или видео, или нажмите для выбора'
    }
    if (activeTab === 'music') {
      return 'Перетащите аудиофайл или нажмите для выбора'
    }
    return 'Перетащите файл или нажмите для выбора'
  }

  const getDropzoneHint = () => {
    if (activeTab === 'sprites') {
      return 'Поддерживаются: PNG, GIF, WEBP, JPG, JPEG'
    }
    if (activeTab === 'backgrounds') {
      if (backgroundSubTab === 'images') {
        return 'Поддерживаются: JPG, PNG, GIF, WEBP'
      } else if (backgroundSubTab === 'videos') {
        return 'Поддерживаются: MP4, WEBM, OGG, MOV'
      }
      return 'Поддерживаются: JPG, PNG, GIF, WEBP, MP4, WEBM, OGG, MOV'
    }
    if (activeTab === 'music') {
      return 'Поддерживаются: MP3, WAV, OGG, M4A'
    }
    return ''
  }

  const handleDeleteClick = (file, fileType, e) => {
    e.stopPropagation()
    setDeleteConfirm({ file, fileType })
  }

  const confirmDelete = async () => {
    if (deleteConfirm && onDeleteResource) {
      await onDeleteResource(deleteConfirm.file, deleteConfirm.fileType)
      setDeleteConfirm(null)
    }
  }

  const getFilteredBackgrounds = () => {
    if (activeTab !== 'backgrounds') return []
    
    const backgrounds = files.backgrounds || []
    if (backgroundSubTab === 'images') {
      return backgrounds.filter(file => file.type === 'image')
    } else if (backgroundSubTab === 'videos') {
      return backgrounds.filter(file => file.type === 'video')
    }
    return backgrounds
  }

  const renderResourceItem = (file, fileType, showCharacter = false) => {
    const PreviewIcon = file.type === 'audio' ? FiVolume2 : 
                       file.type === 'video' ? FiVideo : FiImage
    
    const characterName = showCharacter ? extractCharacterName(file.name || file.filename || '') : null
    
    return (
      <div
        key={file.id}
        className="resource-item"
        onClick={() => onSelectResource(file, activeTab)}
        draggable={activeTab !== 'sprites'}
        onDragStart={(e) => {
          if (activeTab !== 'sprites') {
            e.dataTransfer.setData('application/json', JSON.stringify(file))
            e.dataTransfer.effectAllowed = 'copy'
          } else {
            e.preventDefault()
          }
        }}
      >
        {file.type === 'audio' ? (
          <div className="resource-preview audio">
            <PreviewIcon className="preview-icon" />
          </div>
        ) : file.type === 'video' ? (
          <div className="resource-preview video">
            <video 
              src={`http://localhost:8000${file.url}`}
              className="resource-preview-video"
              muted
              onMouseOver={e => e.target.play()}
              onMouseOut={e => e.target.pause()}
            />
          </div>
        ) : (
          <div className="resource-preview image">
            <img 
              src={`http://localhost:8000${file.url}`} 
              alt={file.name}
              onError={(e) => {
                e.target.style.display = 'none'
                const parent = e.target.parentNode
                if (parent) {
                  parent.innerHTML = `<div class="preview-icon">${PreviewIcon}</div>`
                }
              }}
            />
          </div>
        )}
        <div className="resource-info">
          <div className="resource-name" title={file.name}>
            {file.name}
          </div>
          {showCharacter && characterName && fileType === 'sprites' && (
            <div className="resource-character">
              <FiUser size={12} />
              <span>{characterName}</span>
            </div>
          )}
          <div className="resource-meta">
            <span className="resource-size">
              {file.size ? Math.round(file.size / 1024) : 0} KB
            </span>
          </div>
        </div>
        <div className="resource-actions">
          <button 
            className="resource-rename-btn"
            onClick={(e) => {
              e.stopPropagation()
              handleRenameClick(file, fileType)
            }}
            title="Переименовать"
          >
            <FiEdit2 />
          </button>
          <button 
            className="resource-delete-btn"
            onClick={(e) => handleDeleteClick(file, fileType, e)}
            title="Удалить файл"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
    )
  }

  const renderSpritesContent = () => {
    if (searchTerm !== '' || selectedCharacter !== 'all') {
      if (filteredSprites.length === 0) {
        return (
          <div className="resources-empty">
            <p>Нет спрайтов, соответствующих фильтру</p>
          </div>
        )
      }
      return (
        <div className="resources-grid">
          {filteredSprites.map(sprite => renderResourceItem(sprite, 'sprites', true))}
        </div>
      )
    }
    
    if (Object.keys(spritesByCharacter).length === 0) {
      return (
        <div className="resources-empty">
          <p>Нет загруженных спрайтов</p>
          <p className="hint">Загрузите спрайты, используя формат "Персонаж_название" для автоматической группировки</p>
        </div>
      )
    }
    
    return Object.entries(spritesByCharacter).map(([character, characterSprites]) => (
      <div key={character} className="character-group">
        <div className="character-group-header">
          <FiUsers size={16} />
          <span className="character-name">{character}</span>
          <span className="character-count">({characterSprites.length})</span>
        </div>
        <div className="character-sprites-grid">
          {characterSprites.map(sprite => renderResourceItem(sprite, 'sprites', false))}
        </div>
      </div>
    ))
  }

  const ActiveTabIcon = tabs.find(t => t.id === activeTab)?.icon || FiFolder

  const getCurrentFiles = () => {
    switch(activeTab) {
      case 'backgrounds':
        return getFilteredBackgrounds()
      case 'sprites':
        return null
      case 'music':
        return files.music || []
      default:
        return []
    }
  }

  const currentFiles = getCurrentFiles()
  const isSpritesTab = activeTab === 'sprites'

  return (
    <div className={`resource-bar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="resource-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3><ActiveTabIcon /> Библиотека ресурсов</h3>
        <button className="toggle-btn">{isExpanded ? <FiChevronUp /> : <FiChevronDown />}</button>
      </div>

      {isExpanded && (
        <div className="resource-content">
          <div className="resource-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon
              const count = files[tab.id]?.length || 0
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  className={`tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon /> 
                  <span className="tab-label">{tab.label}</span>
                  {count > 0 && (
                    <span className={`tab-count ${isActive ? 'active-count' : ''}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {activeTab === 'backgrounds' && (
            <div className="resource-subtabs">
              <button
                className={`subtab ${backgroundSubTab === 'all' ? 'active' : ''}`}
                onClick={() => setBackgroundSubTab('all')}
              >
                <FiFolder size={14} />
                <span>Все</span>
              </button>
              <button
                className={`subtab ${backgroundSubTab === 'images' ? 'active' : ''}`}
                onClick={() => setBackgroundSubTab('images')}
              >
                <FiImage size={14} />
                <span>Изображения</span>
              </button>
              <button
                className={`subtab ${backgroundSubTab === 'videos' ? 'active' : ''}`}
                onClick={() => setBackgroundSubTab('videos')}
              >
                <FiVideo size={14} />
                <span>Видео</span>
              </button>
            </div>
          )}

          {activeTab === 'sprites' && (
            <div className="resource-filters">
              <div className="search-bar">
                <FiSearch size={16} />
                <input
                  type="text"
                  placeholder="Поиск спрайтов..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    className="search-clear"
                    onClick={() => setSearchTerm('')}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
              <div className="character-filter">
                <FiFilter size={16} />
                <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                >
                  <option value="all">Все персонажи</option>
                  {uniqueCharacters.map(char => (
                    <option key={char} value={char}>{char}</option>
                  ))}
                </select>
                {selectedCharacter !== 'all' && (
                  <button 
                    className="filter-clear"
                    onClick={() => setSelectedCharacter('all')}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div 
            className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={getAcceptTypes()}
              onChange={handleFileSelect}
              className="file-input-hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="upload-zone-label">
              <div className="upload-zone-icon">
                <FiUpload size={32} />
              </div>
              <div className="upload-zone-text">
                {getDropzoneText()}
              </div>
              <div className="upload-zone-hint">
                {getDropzoneHint()}
              </div>
            </label>
          </div>

          {uploadProgress !== null && (
            <div className="upload-progress">
              <div 
                className="upload-progress-bar" 
                style={{ width: `${uploadProgress}%` }}
              />
              <span className="upload-progress-text">{uploadProgress}%</span>
            </div>
          )}

          {loading ? (
            <div className="loading-files">
              <div className="loader-small"></div>
              <span>Загрузка файлов...</span>
            </div>
          ) : (
            <div className="resources-scroll-container">
              {isSpritesTab ? (
                <div className="sprites-container">
                  {renderSpritesContent()}
                </div>
              ) : (
                <div className="resources-grid">
                  {currentFiles.map(file => renderResourceItem(file, activeTab, false))}
                  {currentFiles.length === 0 && (
                    <div className="resources-empty">
                      <p>Нет загруженных файлов</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Диалог загрузки с именем */}
      {showUploadDialog && (
        <div className="modal-overlay" onClick={cancelUpload}>
          <div className="modal-content upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Загрузка файла</h3>
              <button className="modal-close" onClick={cancelUpload}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Имя файла</label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => {
                    setUploadFileName(e.target.value)
                    setUploadError('')
                  }}
                  placeholder="Введите имя файла"
                  autoFocus
                />
                {activeTab === 'sprites' && (
                  <small className="hint">
                    Используйте символ "_" для группировки спрайтов (например: "Анна_портрет")
                  </small>
                )}
              </div>
              {uploadError && (
                <div className="error-message">
                  <FiAlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}
              {conflictAction === 'replace' && (
                <div className="conflict-actions">
                  <button onClick={handleReplaceFile} className="conflict-replace-btn">
                    Заменить
                  </button>
                  <button onClick={handleCreateCopy} className="conflict-copy-btn">
                    Создать копию
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={cancelUpload} className="cancel-btn">
                Отмена
              </button>
              <button onClick={handleUploadConfirm} className="save-btn" disabled={!!conflictAction}>
                Загрузить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог переименования */}
      {showRenameDialog && (
        <div className="modal-overlay" onClick={() => setShowRenameDialog(null)}>
          <div className="modal-content rename-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Переименовать файл</h3>
              <button className="modal-close" onClick={() => setShowRenameDialog(null)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Новое имя</label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value)
                    setRenameError('')
                  }}
                  placeholder="Введите новое имя"
                  autoFocus
                />
                {showRenameDialog.fileType === 'sprites' && (
                  <small className="hint">
                    Используйте символ "_" для группировки (например: "Анна_портрет")
                  </small>
                )}
              </div>
              {renameError && (
                <div className="error-message">
                  <FiAlertCircle size={16} />
                  <span>{renameError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRenameDialog(null)} className="cancel-btn">
                Отмена
              </button>
              <button onClick={handleRenameConfirm} className="save-btn">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Удалить файл?</h3>
            <p>Вы уверены, что хотите удалить файл "{deleteConfirm.file.name}"?</p>
            <div className="confirm-actions">
              <button onClick={confirmDelete} className="confirm-yes">
                <FiTrash2 /> Удалить
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="confirm-no">
                <FiX /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}