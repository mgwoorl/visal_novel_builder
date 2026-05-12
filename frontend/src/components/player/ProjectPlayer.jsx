import React, { useState, useEffect, useRef, useCallback } from 'react'
import { FiX, FiStar, FiMusic, FiMaximize2, FiMinimize2, FiAward } from 'react-icons/fi'
import { useProject } from '../../context/ProjectContext'

export const ProjectPlayer = ({ project, onClose, hidePoints = false }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [executionState, setExecutionState] = useState(null)
  const [showStart, setShowStart] = useState(true)
  const [showEnd, setShowEnd] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const [answers, setAnswers] = useState([]) // НАКАПЛИВАЕМ ВСЕ ОТВЕТЫ ЗДЕСЬ
  const [currentMusic, setCurrentMusic] = useState(null)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [endResult, setEndResult] = useState(null)
  const [playthroughId, setPlaythroughId] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const audioRef = useRef(new Audio())
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const initDoneRef = useRef(false)
  const processingRef = useRef(false)
  
  // Храним ВСЕ ответы здесь (не сбрасываются при смене сцены)
  const allAnswersRef = useRef([])
  const allPointsRef = useRef(0)

  const { startSceneExecution, selectOption, startPlaythrough, completePlaythrough } = useProject()

  const scenes = project?.scenes || []
  const currentScene = scenes[currentSceneIndex]

  const getFullUrl = useCallback((url) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    return `http://localhost:8000${url}`
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    audio.volume = 0.7
    audio.loop = false
    return () => { audio.pause(); audio.src = '' }
  }, [])

  const playMusic = useCallback((musicFile, shouldLoop = false) => {
    if (!musicFile || !project?.music) return
    const music = project.music?.find(m => m.filename === musicFile || m.name === musicFile)
    if (!music) return
    const musicUrl = getFullUrl(music.url)
    if (!musicUrl) return
    const audio = audioRef.current
    if (musicUrl === currentMusic && !audio.paused) return
    audio.pause(); audio.currentTime = 0
    audio.src = musicUrl; audio.loop = shouldLoop; audio.load()
    audio.play().then(() => { setIsMusicPlaying(true); setCurrentMusic(musicUrl) }).catch(() => {})
  }, [project, currentMusic, getFullUrl])

  const stopMusic = useCallback(() => {
    audioRef.current.pause(); audioRef.current.currentTime = 0
    setIsMusicPlaying(false); setCurrentMusic(null)
  }, [])

  const getSpriteUrl = useCallback((spriteFile) => {
    if (!spriteFile || !project?.sprites?.length) return null
    const searchName = spriteFile.split('/').pop()
    const sprite = project.sprites.find(s => {
      const urlName = s.url ? s.url.split('/').pop() : ''
      return urlName === searchName || s.filename === searchName || s.name === searchName
    })
    return sprite ? getFullUrl(sprite.url) : null
  }, [project, getFullUrl])

  // Инициализация
  useEffect(() => {
    if (initDoneRef.current) return
    initDoneRef.current = true
    const init = async () => {
      setIsInitializing(true)
      try {
        const result = await startPlaythrough(project.id)
        if (result.success) setPlaythroughId(result.playthrough_id)
        else setError(result.error || 'Ошибка начала прохождения')
      } catch (err) { setError('Ошибка подключения к серверу') }
      finally { setIsInitializing(false) }
    }
    init()
  }, [project.id])

  // Авто-выполнение сцены
  useEffect(() => {
    if (!showStart && currentScene && !executionState && !loading && !isInitializing && playthroughId) {
      executeCurrentScene()
    }
  }, [currentSceneIndex, showStart, isInitializing, playthroughId])

  const executeCurrentScene = async () => {
    if (!currentScene) return
    setLoading(true); setError(null)
    try {
      const result = await startSceneExecution(currentScene.id)
      if (result.success && result.execution) {
        setExecutionState(result.execution)
        
        // НЕ сбрасываем баллы и ответы - они накапливаются
        const ctx = result.execution.context || {}
        // Используем ref для хранения общих баллов
        // Баллы из контекста ДОБАВЛЯЕМ к общим (они могут быть из новой сцены)
        
        const node = result.execution.current_node
        if (node?.music_file) playMusic(node.music_file, node.loopMusic === true)
        
        if (result.execution.status === 'end' || !result.execution.has_paths) {
          await finishPlaythrough()
        }
      } else setError(result.error || 'Ошибка загрузки сцены')
    } catch (err) { setError('Ошибка соединения с сервером') }
    finally { setLoading(false) }
  }

  const handleChoice = async (option) => {
    if (!executionState || loading || processingRef.current || !playthroughId) return
    processingRef.current = true; setLoading(true); setError(null)
    
    const currentNode = executionState.current_node
    if (!currentNode) { processingRef.current = false; setLoading(false); return }

    try {
      // Отправляем ВСЕ накопленные ответы
      const allAnswers = [...allAnswersRef.current]
      
      const result = await selectOption(currentScene.id, currentNode.id, option.id, {
        total_points: allPointsRef.current,
        visited_nodes: [],
        answers: allAnswers
      })

      if (result.success && result.execution) {
        const execution = result.execution
        
        // Добавляем новые ответы из контекста к общим
        if (execution.context) {
          const newAnswers = execution.context.answers || []
          const newPoints = execution.context.total_points || 0
          
          // Находим действительно новые ответы (которых еще нет в allAnswers)
          const existingIds = new Set(allAnswers.map(a => `${a.node_id}:${a.option_id}`))
          const trulyNew = newAnswers.filter(a => !existingIds.has(`${a.node_id}:${a.option_id}`))
          
          // Добавляем scene_id к новым ответам
          const answersWithScene = trulyNew.map(a => ({
            ...a,
            scene_id: a.scene_id || currentScene.id
          }))
          
          allAnswersRef.current = [...allAnswers, ...answersWithScene]
          allPointsRef.current = newPoints // Бэкенд уже суммирует
          
          setAnswers(allAnswersRef.current)
          setTotalPoints(allPointsRef.current)
          
          console.log('[ProjectPlayer] Answers updated:', {
            total: allAnswersRef.current.length,
            points: allPointsRef.current,
            newInContext: newAnswers.length,
            trulyNew: trulyNew.length
          })
        }
        
        setExecutionState(execution)

        // next_scene ДОЛЖЕН быть перед проверкой has_paths!
        if (execution.status === 'next_scene') {
          console.log('[ProjectPlayer] NEXT_SCENE')
          stopMusic()
          const nextIndex = currentSceneIndex + 1
          if (nextIndex < scenes.length) {
            setCurrentSceneIndex(nextIndex)
            setExecutionState(null)
          } else {
            await finishPlaythrough()
          }
          processingRef.current = false; setLoading(false)
          return
        }

        if (execution.status === 'end' || !execution.has_paths) {
          console.log('[ProjectPlayer] END')
          stopMusic()
          await finishPlaythrough()
          processingRef.current = false; setLoading(false)
          return
        }

        console.log('[ProjectPlayer] Normal transition')
        const node = execution.current_node
        if (node?.music_file) playMusic(node.music_file, node.loopMusic === true)
        else stopMusic()
        
      } else setError(result.error || 'Ошибка обработки выбора')
    } catch (err) { setError('Ошибка соединения с сервером') }
    finally { processingRef.current = false; setLoading(false) }
  }

  const finishPlaythrough = async () => {
    if (!playthroughId) return
    setLoading(true)
    
    const finalAnswers = allAnswersRef.current
    const finalPoints = allPointsRef.current
    
    console.log('[ProjectPlayer] Finishing:', {
      playthroughId,
      points: finalPoints,
      answersCount: finalAnswers.length,
      answers: finalAnswers
    })
    
    try {
      const formattedAnswers = finalAnswers.map((ans, idx) => ({
        scene_id: ans.scene_id || currentScene?.id || 1,
        node_id: ans.node_id || '',
        option_id: ans.option_id || '',
        text: ans.text || '',
        points: ans.points || 0
      }))
      
      const result = await completePlaythrough(playthroughId, finalPoints, formattedAnswers)
      
      console.log('[ProjectPlayer] Complete result:', result)
      
      setEndResult({
        earned: result.success && !!result.reward_status,
        status_name: result.reward_status || null,
        total_points: finalPoints,
        answers_count: formattedAnswers.length
      })
      setShowEnd(true)
      stopMusic()
    } catch (err) {
      console.error('[ProjectPlayer] Finish error:', err)
      setEndResult({
        earned: false,
        status_name: null,
        total_points: finalPoints,
        answers_count: finalAnswers.length
      })
      setShowEnd(true)
      stopMusic()
    } finally { setLoading(false) }
  }

  const handleStart = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setShowStart(false) }, [])
  const handleClose = useCallback(() => { stopMusic(); if (onClose) onClose() }, [stopMusic, onClose])
  const handleEndClose = useCallback(() => { stopMusic(); if (onClose) onClose() }, [stopMusic, onClose])

  const bgUrl = currentScene?.background_url ? getFullUrl(currentScene.background_url) : null
  const isVideoBg = currentScene?.background_type === 'video'
  const currentNode = executionState?.current_node
  const spriteUrl = currentNode?.sprite_file ? getSpriteUrl(currentNode.sprite_file) : null

  if (isInitializing) return <div className="preview-overlay"><div className="loading-screen" style={{ background: '#1a1a2e' }}><div className="loader"></div><p style={{ color: '#fff' }}>Подготовка к прохождению...</p></div></div>

  if (showEnd) return (
    <div className="preview-overlay">
      <div className="preview-container" ref={containerRef} style={{ height: 'auto', maxHeight: '90vh' }}>
        <div className="preview-header"><h3>Прохождение завершено</h3><div className="preview-controls"><button onClick={toggleFullscreen} className="fullscreen-btn">{isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}</button><button onClick={handleEndClose} className="close-preview"><FiX /></button></div></div>
        <div className="preview-end-content" style={{ padding: '40px', background: '#1a1a2e' }}>
          <div className="end-card" style={{ background: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>КОНЕЦ</h2>
            {endResult?.earned ? (
              <div style={{ background: '#d1fae5', color: '#065f46', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}><FiAward size={24} style={{ marginRight: '8px' }} />Получен статус: <strong>{endResult.status_name}</strong></div>
            ) : (
              <div style={{ background: '#fef3c7', color: '#92400e', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>Статус не получен</div>
            )}
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <p><FiStar style={{ color: '#f59e0b', marginRight: '8px' }} />Баллов: <strong>{hidePoints ? '?' : (endResult?.total_points || totalPoints)}</strong></p>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>Ответов: {endResult?.answers_count || answers.length}</p>
            </div>
            <button onClick={handleEndClose} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!currentScene) return <div className="preview-overlay"><div className="preview-container"><div className="preview-header"><h3>Прохождение</h3><button onClick={handleEndClose} className="close-preview"><FiX /></button></div><div className="preview-empty"><p>В проекте нет сцен</p></div></div></div>

  if (showStart) return (
    <div className="preview-overlay">
      <div className="preview-container" ref={containerRef}>
        <div className="preview-header"><h3>{currentScene.name}</h3><div className="preview-controls"><button onClick={toggleFullscreen} className="fullscreen-btn">{isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}</button><button onClick={handleClose} className="close-preview"><FiX /></button></div></div>
        <div className="preview-start"><div className="start-card"><h2>{currentScene.name}</h2>{error && <div className="error-message">{error}</div>}<button onClick={handleStart} className="start-btn" disabled={loading}>{loading ? 'Загрузка...' : 'Начать'}</button></div></div>
      </div>
    </div>
  )

  return (
    <div className="preview-overlay">
      <div className="preview-container" ref={containerRef}>
        <div className="preview-header"><h3>{currentScene.name}</h3><div className="preview-controls">{isMusicPlaying && <div className="music-indicator"><FiMusic className="music-note" /><FiMusic className="music-note" /><FiMusic className="music-note" /></div>}<span className="points-display"><FiStar /> {hidePoints ? '?' : totalPoints}</span><button onClick={toggleFullscreen} className="fullscreen-btn">{isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}</button><button onClick={handleClose} className="close-preview"><FiX /></button></div></div>
        <div className="preview-scene">
          <div className="preview-background-container">{bgUrl && (isVideoBg ? <video ref={videoRef} src={bgUrl} className="preview-bg-video" autoPlay loop muted playsInline /> : <img src={bgUrl} alt="" className="preview-bg" />)}</div>
          {spriteUrl && <div className="preview-sprite-container"><img src={spriteUrl} alt="" className="preview-sprite" onError={(e) => { e.target.style.display = 'none' }} /></div>}
          {currentNode && (
            <div className="preview-dialog">
              {currentNode.character_name && <div className="preview-character-name">{currentNode.character_name}</div>}
              <div className="preview-text">{currentNode.text || '...'}</div>
              {currentNode.options?.length > 0 && (
                <div className="preview-options">
                  {currentNode.options.map((opt, idx) => (
                    <button key={opt.id} onClick={() => handleChoice(opt)} disabled={loading} className={`preview-option ${opt.target_type || 'node'}`}>
                      <span className="option-number">{idx + 1}</span><span className="option-text">{opt.text}</span>
                      {opt.points > 0 && !hidePoints && <span className="option-points-badge"><FiStar /> +{opt.points}</span>}
                    </button>
                  ))}
                </div>
              )}
              {loading && <div className="loading-indicator">Загрузка...</div>}
              {error && <div className="error-message" style={{ marginTop: '10px' }}>{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectPlayer