import React, { useState, useEffect } from 'react'
import { 
  FiX, FiMusic, FiUser, FiTrash2, FiSearch, FiFilter,
  FiChevronDown, FiChevronUp, FiImage, FiRepeat
} from 'react-icons/fi'
import { groupSpritesByCharacter, getUniqueCharacters } from '../../utils/fileUtils'

export const NodeEditor = ({ 
  node, 
  onUpdate, 
  onClose, 
  onDeleteOption,
  characters = [], 
  sprites = [],
  music = [],
  allNodes = [] 
}) => {
  const [data, setData] = useState({
    characterName: '',
    spriteFile: '',
    musicFile: '',
    loopMusic: false,
    text: '',
    options: [],
    ...node?.data
  })

  const [spriteFilter, setSpriteFilter] = useState('all')
  const [spriteSearch, setSpriteSearch] = useState('')
  const [showSpriteGallery, setShowSpriteGallery] = useState(false)

  useEffect(() => {
    if (node?.data) {
      const nodeData = {
        characterName: node.data.characterName || '',
        spriteFile: node.data.spriteFile || '',
        musicFile: node.data.musicFile || '',
        loopMusic: node.data.loopMusic !== undefined && node.data.loopMusic !== null 
          ? node.data.loopMusic 
          : false,
        text: node.data.text || '',
        options: node.data.options && node.data.options.length > 0 
          ? node.data.options 
          : [createDefaultOption()],
      }
      setData(nodeData)
      
      // Авто-выбор фильтра по имени персонажа
      if (nodeData.characterName && sprites.length > 0) {
        const charName = nodeData.characterName.toLowerCase()
        const uniqueChars = getUniqueCharacters(sprites)
        const matchingCharacter = uniqueChars.find(
          char => {
            const lowerChar = char.toLowerCase()
            return lowerChar.includes(charName) || charName.includes(lowerChar)
          }
        )
        if (matchingCharacter) {
          setSpriteFilter(matchingCharacter)
        }
      }
    }
  }, [node, sprites])

  const createDefaultOption = () => ({
    id: `opt-${Date.now()}-${Math.random()}`,
    text: 'Далее',
    targetType: 'node',
    targetNodeId: '',
    points: 0
  })

  if (!node) return null

  const handleSave = () => {
    console.log('Saving node data:', {
      characterName: data.characterName,
      loopMusic: data.loopMusic,
      musicFile: data.musicFile
    })
    onUpdate(node.id, { ...node, data })
    onClose()
  }

  const handleCharacterNameChange = (value) => {
    setData({ ...data, characterName: value })
    
    // Авто-выбор фильтра при изменении имени персонажа
    if (value && sprites.length > 0) {
      const charName = value.toLowerCase()
      const uniqueChars = getUniqueCharacters(sprites)
      const matchingCharacter = uniqueChars.find(
        char => {
          const lowerChar = char.toLowerCase()
          return lowerChar.includes(charName) || charName.includes(lowerChar)
        }
      )
      if (matchingCharacter) {
        setSpriteFilter(matchingCharacter)
      }
    }
  }

  const addOption = () => {
    setData({
      ...data,
      options: [...data.options, createDefaultOption()]
    })
  }

  const updateOption = (optionId, field, value, e) => {
    if (e) e.stopPropagation()
    setData({
      ...data,
      options: data.options.map(opt =>
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
    })
  }

  const deleteOption = (optionId, e) => {
    if (e) e.stopPropagation()
    if (data.options.length <= 1) {
      alert('Должен быть хотя бы один вариант')
      return
    }
    
    if (onDeleteOption) {
      onDeleteOption(node.id, optionId)
    }
    
    setData({
      ...data,
      options: data.options.filter(opt => opt.id !== optionId)
    })
  }

  const groupedSprites = groupSpritesByCharacter(sprites)
  const uniqueCharacters = getUniqueCharacters(sprites)

  const currentSprite = sprites.find(s => 
    s.name === data.spriteFile || s.filename === data.spriteFile
  )

  return (
    <div className="node-editor-overlay" onClick={onClose}>
      <div className="node-editor" onClick={(e) => e.stopPropagation()}>
        <div className="node-editor-header">
          <h3>Редактирование блока</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="node-editor-content">
          <div className="form-section">
            <h4><FiUser /> Персонаж</h4>
            
            <div className="form-group">
              <label>Имя персонажа:</label>
              <input
                type="text"
                value={data.characterName || ''}
                onChange={(e) => handleCharacterNameChange(e.target.value)}
                placeholder="Кто говорит?"
              />
            </div>

            <div className="form-group">
              <label>Спрайт персонажа:</label>
              
              <div className="sprite-selector">
                <div 
                  className="sprite-current"
                  onClick={() => setShowSpriteGallery(!showSpriteGallery)}
                >
                  {currentSprite ? (
                    <div className="sprite-current-preview">
                      <span className="sprite-current-name">{currentSprite.name}</span>
                    </div>
                  ) : (
                    <div className="sprite-placeholder">
                      <FiUser />
                      <span>Выбрать спрайт</span>
                    </div>
                  )}
                  <button type="button" className="sprite-toggle-btn">
                    {showSpriteGallery ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                </div>

                {data.spriteFile && (
                  <button 
                    type="button"
                    className="sprite-clear-btn"
                    onClick={() => setData({ ...data, spriteFile: '' })}
                  >
                    <FiX /> Без спрайта
                  </button>
                )}
              </div>

              {showSpriteGallery && (
                <div className="sprite-gallery">
                  <div className="sprite-gallery-filters">
                    <div className="sprite-search-bar">
                      <FiSearch size={14} />
                      <input
                        type="text"
                        placeholder="Поиск спрайта..."
                        value={spriteSearch}
                        onChange={(e) => setSpriteSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {spriteSearch && (
                        <button className="search-clear" onClick={() => setSpriteSearch('')}>
                          <FiX size={12} />
                        </button>
                      )}
                    </div>

                    <div className="sprite-filter-select">
                      <FiFilter size={14} />
                      <select
                        value={spriteFilter}
                        onChange={(e) => setSpriteFilter(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="all">Все персонажи</option>
                        {uniqueCharacters.map(char => (
                          <option key={char} value={char}>{char}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sprite-gallery-groups">
                    {Object.entries(groupedSprites)
                      .filter(([character]) => {
                        if (spriteFilter !== 'all') return character.toLowerCase() === spriteFilter.toLowerCase()
                        if (spriteSearch.trim()) {
                          const search = spriteSearch.toLowerCase()
                          return character.toLowerCase().includes(search) || 
                            groupedSprites[character].some(s => 
                              (s.name || s.filename || '').toLowerCase().includes(search)
                            )
                        }
                        return true
                      })
                      .map(([character, characterSprites]) => {
                        const filteredCharSprites = spriteSearch.trim()
                          ? characterSprites.filter(s => 
                              (s.name || s.filename || '').toLowerCase().includes(spriteSearch.toLowerCase())
                            )
                          : characterSprites

                        if (filteredCharSprites.length === 0) return null

                        return (
                          <div key={character} className="sprite-group-section">
                            <div className="sprite-group-header">
                              <FiUser size={14} />
                              <span>{character}</span>
                              <span className="sprite-group-count">{filteredCharSprites.length}</span>
                            </div>
                            <div className="sprite-group-grid">
                              {filteredCharSprites.map(sprite => (
                                <div
                                  key={sprite.id}
                                  className={`sprite-gallery-item ${data.spriteFile === (sprite.name || sprite.filename) ? 'selected' : ''}`}
                                  onClick={() => {
                                    setData({ ...data, spriteFile: sprite.name || sprite.filename })
                                    setShowSpriteGallery(false)
                                    setSpriteSearch('')
                                  }}
                                >
                                  <div className="sprite-gallery-name-only">
                                    {(sprite.name || sprite.filename).split('_').slice(1).join('_') || sprite.name || sprite.filename}
                                  </div>
                                  {data.spriteFile === (sprite.name || sprite.filename) && (
                                    <div className="sprite-gallery-check">✓</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    
                    {Object.keys(groupedSprites).length === 0 && (
                      <div className="sprite-gallery-empty">
                        <FiImage size={24} />
                        <p>Нет спрайтов</p>
                        <small>Загрузите спрайты в библиотеке ресурсов</small>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h4><FiMusic /> Фоновая музыка</h4>
            <div className="form-group">
              <label>Фоновая музыка:</label>
              <select
                value={data.musicFile || ''}
                onChange={(e) => setData({ ...data, musicFile: e.target.value })}
              >
                <option value="">-- Без музыки --</option>
                {music.map(track => (
                  <option key={track.id} value={track.name}>{track.name}</option>
                ))}
              </select>
            </div>
            
            {data.musicFile && (
              <div className="form-group">
                <label 
                  className="checkbox-label" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    cursor: 'pointer',
                    padding: '10px 0'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={data.loopMusic === true}
                    onChange={(e) => {
                      const newLoopMusic = e.target.checked
                      console.log('Setting loopMusic to:', newLoopMusic)
                      setData({ ...data, loopMusic: newLoopMusic })
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiRepeat /> Зациклить музыку
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="form-section">
            <h4>Текст</h4>
            <div className="form-group">
              <textarea
                value={data.text || ''}
                onChange={(e) => setData({ ...data, text: e.target.value })}
                rows={3}
                placeholder="Текст диалога..."
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Варианты ответа</h4>
            {data.options.map((opt, idx) => (
              <div key={`${node.id}-opt-${opt.id}`} className="option-group">
                <div className="option-row">
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(opt.id, 'text', e.target.value, e)}
                    placeholder={`Вариант ${idx + 1}`}
                    className="option-input"
                  />
                  
                  <input
                    type="number"
                    value={opt.points || 0}
                    onChange={(e) => updateOption(opt.id, 'points', parseInt(e.target.value) || 0, e)}
                    placeholder="Баллы"
                    className="option-points"
                    min="0"
                    step="1"
                  />
                </div>

                <div className="option-row">
                  <select
                    value={opt.targetType || 'node'}
                    onChange={(e) => updateOption(opt.id, 'targetType', e.target.value, e)}
                    className="option-type"
                  >
                    <option value="node">Другой блок</option>
                    <option value="next_scene">Следующая сцена</option>
                    <option value="novel_end">Конец новеллы</option>
                  </select>
                </div>

                {opt.targetType === 'next_scene' && (
                  <div className="option-hint-full">
                    При выборе этого варианта произойдет переход на следующую сцену
                  </div>
                )}

                {opt.targetType === 'novel_end' && (
                  <div className="option-hint-full">
                    При выборе этого варианта новелла завершится
                  </div>
                )}

                {opt.targetType === 'node' && (
                  <div className="option-hint-full">
                    Переход на другой блок (нужно соединить линией в редакторе)
                  </div>
                )}

                {data.options.length > 1 && (
                  <div className="option-row">
                    <button 
                      onClick={(e) => deleteOption(opt.id, e)} 
                      className="delete-option-full"
                      title="Удалить вариант"
                    >
                      <FiTrash2 /> Удалить вариант
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={(e) => { e.stopPropagation(); addOption(); }} className="add-option">
              + Добавить вариант
            </button>
          </div>
        </div>

        <div className="node-editor-footer">
          <button onClick={handleSave} className="save-btn">Сохранить</button>
          <button onClick={onClose} className="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default NodeEditor