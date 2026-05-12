import React, { useState, useEffect, useRef } from 'react'
import { 
  FiX, FiStar, FiMusic, FiRefreshCw,
  FiVolume2, FiMaximize2, FiMinimize2, FiEye, FiEyeOff
} from 'react-icons/fi'
import { useProject } from '../../context/ProjectContext'

const ProjectPreview = ({ project, onClose, hidePoints = false }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [executionState, setExecutionState] = useState(null)
  const [showStart, setShowStart] = useState(true)
  const [showEnd, setShowEnd] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const [history, setHistory] = useState([])
  const [answers, setAnswers] = useState([])
  const [currentMusic, setCurrentMusic] = useState(null)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideDialog, setHideDialog] = useState(false)
  
  const audioRef = useRef(new Audio())
  const videoRef = useRef(null)
  const answersListRef = useRef(null)
  const containerRef = useRef(null)
  const textContainerRef = useRef(null)
  const optionsContainerRef = useRef(null)
  
  const { startSceneExecution, selectOption } = useProject()
  
  const scenes = project?.scenes || []
  const currentScene = scenes[currentSceneIndex]

  useEffect(() => {
    if (textContainerRef.current && !hideDialog) {
      const hasScroll = textContainerRef.current.scrollHeight > textContainerRef.current.clientHeight
      textContainerRef.current.style.overflowY = hasScroll ? 'auto' : 'visible'
    }
  }, [executionState?.current_node?.text, hideDialog])

  useEffect(() => {
    if (optionsContainerRef.current && !hideDialog) {
      const hasScroll = optionsContainerRef.current.scrollHeight > optionsContainerRef.current.clientHeight
      optionsContainerRef.current.style.overflowY = hasScroll ? 'auto' : 'visible'
    }
  }, [executionState?.current_node?.options, hideDialog])

  const getFullUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `http://localhost:8000${url}`
  }

  const videoAudioEnabled = currentScene?.use_video_audio === true

  useEffect(() => {
    const audio = audioRef.current
    audio.volume = 0.7
    audio.loop = false
    
    audio.oncanplay = () => {}
    audio.onerror = (e) => console.error('Audio error:', e)
    
    return () => {
      audio.pause()
      audio.src = ''
      audio.loop = false
    }
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (answersListRef.current) {
      answersListRef.current.scrollTop = answersListRef.current.scrollHeight
    }
  }, [answers])

  useEffect(() => {
    if (!showStart && currentScene && !executionState && !loading) {
      startExecution()
    }
  }, [currentSceneIndex, showStart])

  const startExecution = async () => {
    if (!currentScene) return
    setLoading(true)
    setError(null)
    
    try {
      const result = await startSceneExecution(currentScene.id)
      
      if (result.success && result.execution) {
        const newAnswers = result.execution.context?.answers || []
        const newPoints = result.execution.context?.total_points || 0
        
        const mergedAnswers = [...answers, ...newAnswers]
        const mergedPoints = totalPoints + newPoints
        
        setExecutionState({
          ...result.execution,
          context: { ...result.execution.context, answers: mergedAnswers, total_points: mergedPoints }
        })
        
        setTotalPoints(mergedPoints)
        setAnswers(mergedAnswers)
        
        const musicFile = result.execution.current_node?.music_file
        const shouldLoop = result.execution.current_node?.loopMusic === true
        
        if (musicFile) {
          playMusic(musicFile, shouldLoop)
        } else {
          stopMusic()
        }
        
        if (result.execution.status === 'end') {
          setShowEnd(true)
        }
      } else {
        setError(result.error || 'Scene execution error')
      }
    } catch (err) {
      setError('Server connection error')
    } finally {
      setLoading(false)
    }
  }

  const playMusic = (musicFile, shouldLoop = false) => {
    if (!musicFile || !project?.music) return
    
    const music = project.music.find(m => m.filename === musicFile || m.name === musicFile)
    if (!music) return
    
    const musicUrl = getFullUrl(music.url)
    
    if (musicUrl === currentMusic) {
      audioRef.current.loop = shouldLoop
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => setIsMusicPlaying(true)).catch(e => console.error('Error resuming music:', e))
      }
      return
    }
    
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    audioRef.current.src = musicUrl
    audioRef.current.loop = shouldLoop
    audioRef.current.load()
    
    audioRef.current.play()
      .then(() => {
        setIsMusicPlaying(true)
        setCurrentMusic(musicUrl)
      })
      .catch(e => {
        console.error('Error playing music:', e)
        setIsMusicPlaying(false)
      })
  }

  const stopMusic = () => {
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    audioRef.current.loop = false
    setIsMusicPlaying(false)
    setCurrentMusic(null)
  }

  const playBackgroundVideo = () => {
    if (!currentScene?.background_url || currentScene?.background_type !== 'video') return
    if (!videoRef.current) return
    
    const videoUrl = getFullUrl(currentScene.background_url)
    if (!videoUrl) return
    
    videoRef.current.src = videoUrl
    videoRef.current.load()
    videoRef.current.muted = !videoAudioEnabled
    videoRef.current.play().catch(e => console.log('Video error:', e))
  }

  useEffect(() => {
    if (!showStart && currentScene && currentScene.background_type === 'video') {
      playBackgroundVideo()
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
    }
  }, [currentScene, showStart, videoAudioEnabled])

  useEffect(() => {
    return () => {
      stopMusic()
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
    }
  }, [])

  const handleChoice = async (option) => {
    if (!executionState || loading) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await selectOption(
        currentScene.id,
        executionState.current_node.id,
        option.id,
        {
          total_points: totalPoints,
          visited_nodes: history.map(h => h.nodeId),
          answers: answers
        }
      )
      
      if (result.success && result.execution) {
        const execution = result.execution
        
        if (executionState?.current_node) {
          setHistory(prev => [...prev, { sceneIndex: currentSceneIndex, nodeId: executionState.current_node.id }])
        }
        
        setExecutionState(execution)
        
        if (execution.context) {
          const newAnswers = execution.context.answers || []
          const newPoints = execution.context.total_points || 0
          setAnswers(newAnswers)
          setTotalPoints(newPoints)
        }
        
        if (execution.status === 'end') {
          stopMusic()
          setShowEnd(true)
        } else if (execution.status === 'next_scene') {
          stopMusic()
          if (currentSceneIndex + 1 < scenes.length) {
            setCurrentSceneIndex(currentSceneIndex + 1)
            setExecutionState(null)
          } else {
            stopMusic()
            setShowEnd(true)
          }
        } else if (execution.current_node) {
          const musicFile = execution.current_node.music_file
          const shouldLoop = execution.current_node.loopMusic === true
          if (musicFile) {
            playMusic(musicFile, shouldLoop)
          } else {
            stopMusic()
          }
        }
      } else {
        setError(result.error || 'Option selection error')
      }
    } catch (err) {
      setError('Server connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleStartScene = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowStart(false)
  }

  const reset = () => {
    setCurrentSceneIndex(0)
    setShowStart(true)
    setShowEnd(false)
    setTotalPoints(0)
    setHistory([])
    setAnswers([])
    setExecutionState(null)
    setError(null)
    stopMusic()
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
  }

  const handleClose = () => {
    stopMusic()
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
    if (onClose) onClose()
  }

  const getSpriteUrl = (spriteFile) => {
    if (!spriteFile || !project?.sprites) return null
    const sprite = project.sprites.find(s => s.filename === spriteFile || s.name === spriteFile)
    if (!sprite) return null
    return getFullUrl(sprite.url)
  }

  const MusicIndicator = () => {
    if (!isMusicPlaying) return null
    return (
      <div className="music-indicator">
        <FiMusic className="music-note" />
        <FiMusic className="music-note" />
        <FiMusic className="music-note" />
      </div>
    )
  }

  const currentBackgroundUrl = currentScene?.background_url ? getFullUrl(currentScene.background_url) : null
  const currentNode = executionState?.current_node
  const currentSpriteUrl = currentNode?.sprite_file ? getSpriteUrl(currentNode.sprite_file) : null

  if (showEnd) {
    return (
      <div className="preview-overlay">
        <div className="preview-container" ref={containerRef}>
          <div className="preview-header">
            <h3>The End</h3>
            <div className="preview-controls">
              <button onClick={toggleFullscreen} className="fullscreen-btn" type="button">
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              <button onClick={handleClose} className="close-preview" type="button"><FiX /></button>
            </div>
          </div>
          <div className="preview-end-content">
            <div className="end-card">
              <h2>THE END</h2>
              <div className="results-summary">
                <p className="total-points"><FiStar /> Total points: <strong>{hidePoints ? '?' : totalPoints}</strong></p>
                <p className="answers-count">Answers: {answers.length}</p>
              </div>
              <div className="answers-list-container">
                <h4>Your answers</h4>
                <div className="answers-list-scrollable" ref={answersListRef}>
                  {answers.map((ans, idx) => (
                    <div key={idx} className="answer-item">
                      <span className="answer-text">{ans.text}</span>
                      <span className="answer-points">{hidePoints ? '*' : `+${ans.points}`}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="end-buttons">
                <button onClick={reset} className="restart-btn" type="button"><FiRefreshCw /> Restart</button>
                <button onClick={handleClose} className="close-end-btn" type="button"><FiX /> Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentScene) {
    return (
      <div className="preview-overlay">
        <div className="preview-container">
          <div className="preview-header">
            <h3>Preview</h3>
            <button onClick={handleClose} className="close-preview" type="button"><FiX /></button>
          </div>
          <div className="preview-empty"><p>No scenes in project</p></div>
        </div>
      </div>
    )
  }

  if (showStart) {
    return (
      <div className="preview-overlay">
        <div className="preview-container" ref={containerRef}>
          <div className="preview-header">
            <h3>Preview</h3>
            <div className="preview-controls">
              <MusicIndicator />
              {currentScene?.background_type === 'video' && videoAudioEnabled && (
                <div className="video-audio-indicator" title="Video audio enabled"><FiVolume2 /></div>
              )}
              <span className="points-display"><FiStar /> {hidePoints ? '?' : totalPoints}</span>
              <button onClick={() => setHideDialog(!hideDialog)} className="hide-dialog-btn" type="button">
                {hideDialog ? <FiEye /> : <FiEyeOff />}
              </button>
              <button onClick={toggleFullscreen} className="fullscreen-btn" type="button">
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
              <button onClick={handleClose} className="close-preview" type="button"><FiX /></button>
            </div>
          </div>
          <div className="preview-start">
            <div className="start-card">
              <h2>{currentScene.name}</h2>
              {currentBackgroundUrl && (
                currentScene.background_type === 'video' ? (
                  <video ref={videoRef} src={currentBackgroundUrl} className="start-background-video" autoPlay loop muted={!videoAudioEnabled} playsInline />
                ) : (
                  <img src={currentBackgroundUrl} alt="" className="start-background" />
                )
              )}
              {error && <div className="error-message">{error}</div>}
              <button onClick={handleStartScene} className="start-btn" disabled={loading} type="button">
                {loading ? 'Loading...' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="preview-overlay">
      <div className="preview-container" ref={containerRef}>
        <div className="preview-header">
          <h3>{currentScene.name}</h3>
          <div className="preview-controls">
            <MusicIndicator />
            {currentScene?.background_type === 'video' && videoAudioEnabled && (
              <div className="video-audio-indicator" title="Video audio enabled"><FiVolume2 /></div>
            )}
            <span className="points-display"><FiStar /> {hidePoints ? '?' : totalPoints}</span>
            <button onClick={() => setHideDialog(!hideDialog)} className="hide-dialog-btn" type="button">
              {hideDialog ? <FiEye /> : <FiEyeOff />}
            </button>
            <button onClick={toggleFullscreen} className="fullscreen-btn" type="button">
              {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
            </button>
            <button onClick={handleClose} className="close-preview" type="button"><FiX /></button>
          </div>
        </div>
        
        {error && <div className="error-message" style={{ margin: '10px' }}>{error}</div>}
        
        <div className="preview-scene">
          <div className="preview-background-container">
            {currentBackgroundUrl && (
              currentScene.background_type === 'video' ? (
                <video ref={videoRef} src={currentBackgroundUrl} className="preview-bg-video" autoPlay loop muted={!videoAudioEnabled} playsInline />
              ) : (
                <img src={currentBackgroundUrl} alt="" className="preview-bg" />
              )
            )}
          </div>
          
          {currentSpriteUrl && (
            <div className="preview-sprite-container">
              <img src={currentSpriteUrl} alt="character" className="preview-sprite"
                onError={(e) => { e.target.style.display = 'none' }} />
            </div>
          )}
          
          {!hideDialog && currentNode && (
            <div className="preview-dialog">
              {currentNode.character_name && (
                <div className="preview-character-name">{currentNode.character_name}</div>
              )}
              
              <div className="preview-text-container" ref={textContainerRef}>
                <div className="preview-text">{currentNode.text || '...'}</div>
              </div>

              {currentNode.options && currentNode.options.length > 0 && (
                <div className="preview-options-container" ref={optionsContainerRef}>
                  <div className="preview-options">
                    {currentNode.options.map((opt, idx) => (
                      <button key={opt.id} onClick={() => handleChoice(opt)} disabled={loading}
                        className={`preview-option ${opt.target_type}`} type="button">
                        <span className="option-number">{idx + 1}</span>
                        <span className="option-text">{opt.text}</span>
                        {opt.points > 0 && !hidePoints && (
                          <span className="option-points-badge"><FiStar /> +{opt.points}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {loading && <div className="loading-indicator">Loading...</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectPreview