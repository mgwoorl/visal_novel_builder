import React, { useState, useEffect } from 'react'
import { FiSave, FiX, FiVideo, FiImage, FiVolume2, FiVolumeX } from 'react-icons/fi'
import { DialogueEditor } from '../dialogue/DialogueEditor'
import { NodeEditor } from '../dialogue/NodeEditor'
import { useProject } from '../../context/ProjectContext'

export const SceneBuilder = ({ 
  scene, 
  allScenes, 
  onSave, 
  onClose, 
  sprites = [],
  music = []
}) => {
  const [name, setName] = useState(scene?.name || 'Новая сцена')
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState(scene?.background_url || null)
  const [backgroundType, setBackgroundType] = useState(scene?.background_type || 'image')
  const [enableVideoAudio, setEnableVideoAudio] = useState(scene?.use_video_audio || false)
  const [mediaError, setMediaError] = useState(false)
  const [mediaKey, setMediaKey] = useState(Date.now())
  const [loadingMedia, setLoadingMedia] = useState(false)
  
  const { deleteSceneNode, deleteNodeOption } = useProject()

  useEffect(() => {
    if (scene) {
      const sceneNodes = Array.isArray(scene.nodes) ? scene.nodes : []
      let sceneEdges = Array.isArray(scene.edges) ? scene.edges : []
      
      // Нормализуем sourceHandle - убираем лишний префикс "opt-opt-" если есть
      sceneEdges = sceneEdges.map(edge => {
        let sourceHandle = edge.sourceHandle
        // Если sourceHandle начинается с "opt-opt-", заменяем на "opt-"
        if (sourceHandle && sourceHandle.startsWith('opt-opt-')) {
          sourceHandle = sourceHandle.replace('opt-opt-', 'opt-')
        }
        return {
          ...edge,
          sourceHandle: sourceHandle
        }
      })
      
      setNodes(sceneNodes)
      setEdges(sceneEdges)
      
      if (scene.background_url) {
        setBackgroundUrl(scene.background_url)
        setBackgroundType(scene.background_type || 'image')
        setEnableVideoAudio(scene.use_video_audio || false)
        setMediaKey(Date.now())
        setMediaError(false)
        setLoadingMedia(true)
      }
    }
  }, [scene])

  const handleAddNode = () => {
    const newNodeId = `node-${Date.now()}`
    const newOptionId = `opt-${Date.now()}-${Math.random()}`
    
    const newNode = {
      id: newNodeId,
      type: 'dialogue',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: {
        characterName: '',
        text: '',
        spriteFile: '',
        musicFile: '',
        isStart: nodes.length === 0,
        options: [{ 
          id: newOptionId, 
          text: 'Далее', 
          targetType: 'node',
          targetNodeId: '',
          points: 0
        }]
      }
    }
    
    setNodes([...nodes, newNode])
  }

  const handleNodeClick = (event, node) => {
    setSelectedNode(node)
    setShowNodeEditor(true)
  }

  const handleNodeUpdate = (nodeId, updatedNode) => {
    setNodes(nodes.map(node => 
      node.id === nodeId ? updatedNode : node
    ))
  }

  const handleDeleteNode = async (nodeId) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId)
    
    if (nodeToDelete?.data?.isStart) {
      alert('Нельзя удалить стартовый блок')
      return
    }

    if (window.confirm('Удалить этот блок? Все связанные опции и переходы будут также удалены.')) {
      setNodes(prevNodes => prevNodes.filter(n => n.id !== nodeId))
      setEdges(prevEdges => prevEdges.filter(e => e.source !== nodeId && e.target !== nodeId))
      
      try {
        if (deleteSceneNode && scene?.id) {
          await deleteSceneNode(scene.id, nodeId)
        }
      } catch (error) {
        console.error('Ошибка при удалении узла из БД:', error)
      }
    }
  }

  const handleDeleteOption = async (nodeId, optionId) => {
    if (window.confirm('Удалить этот вариант ответа?')) {
      setNodes(prevNodes => prevNodes.map(node => {
        if (node.id === nodeId) {
          const newOptions = node.data.options.filter(opt => opt.id !== optionId)
          return {
            ...node,
            data: {
              ...node.data,
              options: newOptions
            }
          }
        }
        return node
      }))
      
      // Также удаляем связанные edges
      setEdges(prevEdges => prevEdges.filter(edge => 
        !(edge.source === nodeId && edge.sourceHandle === `opt-${optionId}`)
      ))
      
      try {
        if (deleteNodeOption && scene?.id) {
          await deleteNodeOption(scene.id, nodeId, optionId)
        }
      } catch (error) {
        console.error('Ошибка при удалении опции из БД:', error)
      }
    }
  }

  const handleBackgroundDrop = (e) => {
    e.preventDefault()
    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) {
        const bg = JSON.parse(data)
        
        if (!bg.url) {
          console.error('Нет URL у перетащенного файла')
          return
        }
        
        setBackgroundUrl(bg.url)
        setBackgroundType(bg.type === 'video' ? 'video' : 'image')
        setEnableVideoAudio(false)
        setMediaError(false)
        setMediaKey(Date.now())
        setLoadingMedia(true)
      }
    } catch (error) {
      console.error('Drop error:', error)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleSave = () => {
    // Перед сохранением убеждаемся, что sourceHandle в правильном формате
    const normalizedEdges = edges.map(edge => {
      let sourceHandle = edge.sourceHandle
      // Убираем лишний префикс "opt-opt-" если есть
      if (sourceHandle && sourceHandle.startsWith('opt-opt-')) {
        sourceHandle = sourceHandle.replace('opt-opt-', 'opt-')
      }
      return {
        ...edge,
        sourceHandle: sourceHandle
      }
    })
    
    const sceneData = {
      id: scene.id,
      name,
      background_url: backgroundUrl,
      background_type: backgroundType,
      use_video_audio: enableVideoAudio,
      nodes,
      edges: normalizedEdges
    }
    console.log('Сохранение сцены с edges:', normalizedEdges)
    onSave(sceneData)
  }

  const getFullMediaUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    return `http://localhost:8000${url}`
  }

  const backgroundMediaUrl = backgroundUrl ? getFullMediaUrl(backgroundUrl) : null

  const handleMediaLoad = () => {
    setLoadingMedia(false)
    setMediaError(false)
  }

  const handleMediaError = () => {
    console.error('Ошибка загрузки медиа:', backgroundMediaUrl)
    setMediaError(true)
    setLoadingMedia(false)
  }

  useEffect(() => {
    if (backgroundMediaUrl && loadingMedia) {
      fetch(backgroundMediaUrl, { method: 'HEAD', mode: 'cors' })
        .then(response => {
          if (!response.ok) {
            setMediaError(true)
            setLoadingMedia(false)
          }
        })
        .catch(err => {
          console.error('Ошибка проверки медиа:', err)
          setMediaError(true)
          setLoadingMedia(false)
        })
    }
  }, [backgroundMediaUrl])

  const hasNodes = nodes && nodes.length > 0

  return (
    <div className="scene-builder">
      <div className="builder-header">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название сцены"
          className="scene-name-input"
        />
        <div className="builder-actions">
          <button onClick={handleSave} className="save-btn">
            <FiSave /> Сохранить
          </button>
          <button onClick={onClose} className="close-btn">
            <FiX />
          </button>
        </div>
      </div>

      <div 
        className="scene-background-area"
        style={{ 
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%',
          backgroundColor: '#000',
          overflow: 'hidden'
        }}
        onDragOver={handleDragOver}
        onDrop={handleBackgroundDrop}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}>
          {backgroundUrl && backgroundType === 'video' ? (
            <>
              {loadingMedia && (
                <div className="background-placeholder">
                  <div className="loader"></div>
                  <p>Загрузка видео...</p>
                </div>
              )}
              {!mediaError && backgroundMediaUrl && (
                <video 
                  key={`video-${mediaKey}`}
                  src={backgroundMediaUrl}
                  className="scene-background-preview"
                  autoPlay
                  loop
                  muted={!enableVideoAudio}
                  playsInline
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    display: loadingMedia ? 'none' : 'block'
                  }}
                />
              )}
              {mediaError && (
                <div className="background-placeholder">
                  <FiVideo size={48} />
                  <p>Ошибка загрузки видео</p>
                  <small>{backgroundUrl?.split('/').pop()}</small>
                  <button 
                    onClick={() => {
                      setMediaError(false)
                      setLoadingMedia(true)
                      setMediaKey(Date.now())
                    }}
                    style={{ marginTop: '10px', padding: '4px 12px', cursor: 'pointer' }}
                  >
                    Повторить
                  </button>
                </div>
              )}
              {!mediaError && !loadingMedia && (
                <div className="background-controls">
                  <button 
                    className="video-audio-toggle"
                    onClick={() => setEnableVideoAudio(!enableVideoAudio)}
                    title={enableVideoAudio ? 'Отключить звук' : 'Включить звук'}
                  >
                    {enableVideoAudio ? <FiVolume2 /> : <FiVolumeX />}
                  </button>
                </div>
              )}
            </>
          ) : backgroundUrl && backgroundType === 'image' ? (
            <>
              {!mediaError && backgroundMediaUrl ? (
                <img 
                  key={`img-${mediaKey}`}
                  src={backgroundMediaUrl} 
                  alt="background" 
                  className="scene-background-preview"
                  onLoad={handleMediaLoad}
                  onError={handleMediaError}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div className="background-placeholder">
                  <FiImage size={48} />
                  <p>Ошибка загрузки изображения</p>
                  <small>{backgroundUrl?.split('/').pop()}</small>
                  <button 
                    onClick={() => {
                      setMediaError(false)
                      setMediaKey(Date.now())
                    }}
                    style={{ marginTop: '10px', padding: '4px 12px', cursor: 'pointer' }}
                  >
                    Повторить
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="background-placeholder">
              <FiImage size={48} />
              <p>Перетащите фон сюда</p>
              <small>Поддерживаются изображения и видео</small>
            </div>
          )}
          {backgroundUrl && !mediaError && !loadingMedia && (
            <div className="background-name">
              {backgroundType === 'video' ? <FiVideo /> : <FiImage />}
              <span> {backgroundType === 'video' ? 'Видеофон' : 'Фон'}</span>
            </div>
          )}
        </div>
      </div>

      {hasNodes ? (
        <DialogueEditor
          nodes={nodes}
          edges={edges}
          onChange={(newNodes, newEdges) => {
            setNodes(newNodes)
            setEdges(newEdges)
          }}
          onNodeClick={handleNodeClick}
          onAddNode={handleAddNode}
          onDeleteNode={handleDeleteNode}
        />
      ) : (
        <div className="dialogue-editor-placeholder">
          <p>В этой сцене пока нет блоков</p>
          <button onClick={handleAddNode} className="add-node-btn">
            Добавить первый блок
          </button>
        </div>
      )}

      {showNodeEditor && (
        <NodeEditor
          node={selectedNode}
          onUpdate={handleNodeUpdate}
          onClose={() => {
            setShowNodeEditor(false)
            setSelectedNode(null)
          }}
          onDeleteOption={handleDeleteOption}
          characters={[]}
          sprites={sprites}
          music={music}
          allNodes={nodes}
        />
      )}
    </div>
  )
}

export default SceneBuilder