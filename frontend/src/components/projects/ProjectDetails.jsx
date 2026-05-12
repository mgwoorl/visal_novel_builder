import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProject } from '../../context/ProjectContext'
import api from '../../utils/api'
import { 
  FiArrowLeft, FiEdit, FiPlay, FiRefreshCw, FiStar, 
  FiFilm, FiUser, FiTag, FiBookOpen, FiEye, FiEyeOff,
  FiAward, FiBarChart2, FiUsers, FiTrendingUp,
  FiSearch, FiX, FiChevronRight, FiChevronLeft
} from 'react-icons/fi'

const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button className={`analytics-tab ${active ? 'active' : ''}`} onClick={onClick}>
    <Icon size={16} />
    <span>{label}</span>
    {count !== undefined && <span className="tab-count-badge">{count}</span>}
  </button>
)

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="analytics-search">
    <FiSearch size={14} />
    <input
      type="text"
      placeholder={placeholder || "Поиск..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button onClick={() => onChange('')} className="search-clear-btn">
        <FiX size={14} />
      </button>
    )}
  </div>
)

const Breadcrumb = ({ items, onNavigate }) => (
  <div className="analytics-breadcrumb">
    {items.map((item, index) => (
      <React.Fragment key={index}>
        {index > 0 && <FiChevronRight size={14} className="breadcrumb-arrow" />}
        {index < items.length - 1 ? (
          <button className="breadcrumb-link" onClick={() => onNavigate(index)}>
            {item.icon && <item.icon size={14} />}
            {item.label}
          </button>
        ) : (
          <span className="breadcrumb-current">
            {item.icon && <item.icon size={14} />}
            {item.label}
          </span>
        )}
      </React.Fragment>
    ))}
  </div>
)

const RankBadge = ({ rank }) => {
  if (rank === 1) return <span className="rank-badge gold">1</span>
  if (rank === 2) return <span className="rank-badge silver">2</span>
  if (rank === 3) return <span className="rank-badge bronze">3</span>
  return <span className="rank-badge normal">{rank}</span>
}

export const ProjectDetails = ({ project, onBack }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getUserById, getCompletedProjects } = useProject()
  const [isCompleted, setIsCompleted] = useState(false)
  const [ownerName, setOwnerName] = useState('Неизвестен')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  
  // Состояния аналитики
  const [analytics, setAnalytics] = useState(null)
  const [analyticsTab, setAnalyticsTab] = useState('leaderboard')
  const [leaderboardSearch, setLeaderboardSearch] = useState('')
  const [leaderboardSort, setLeaderboardSort] = useState('points-desc')
  const [studentsSearch, setStudentsSearch] = useState('')
  const [studentsSort, setStudentsSort] = useState('points-desc')
  
  // Навигация
  const [viewMode, setViewMode] = useState('main')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentPlaythroughs, setStudentPlaythroughs] = useState([])
  const [selectedPlaythrough, setSelectedPlaythrough] = useState(null)
  const [playthroughAnswers, setPlaythroughAnswers] = useState([])
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [studentInfo, setStudentInfo] = useState(null)

  useEffect(() => {
    const loadOwner = async () => {
      if (project.owner_id) {
        const result = await getUserById(project.owner_id)
        if (result.success && result.user) {
          setOwnerName(`${result.user.last_name} ${result.user.first_name}`.trim() || 'Неизвестен')
        }
      }
    }
    loadOwner()
  }, [project.owner_id])

  useEffect(() => {
    if (user?.role === 'student' && project.id) {
      getCompletedProjects().then(result => {
        if (result.success) setIsCompleted(result.completed_ids.includes(project.id))
      })
    }
  }, [project.id])

  const loadAnalytics = async () => {
    if (showAnalytics) {
      resetAll()
      setShowAnalytics(false)
      return
    }
    setLoadingAnalytics(true)
    try {
      const response = await api.get(`/projects/${project.id}/analytics`)
      setAnalytics(response.data)
      setShowAnalytics(true)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const resetAll = () => {
    setViewMode('main')
    setSelectedStudent(null)
    setStudentPlaythroughs([])
    setSelectedPlaythrough(null)
    setPlaythroughAnswers([])
  }

  const navigateTo = (level) => {
    if (level === 0) {
      // Назад к главному виду аналитики
      setViewMode('main')
      setSelectedStudent(null)
      setStudentPlaythroughs([])
      setSelectedPlaythrough(null)
      setPlaythroughAnswers([])
    } else if (level === 1) {
      // Если мы в answers, возвращаемся к прохождениям студента
      if (viewMode === 'answers' && selectedStudent) {
        setViewMode('student')
        setSelectedPlaythrough(null)
        setPlaythroughAnswers([])
      }
    }
  }

  const openStudent = async (entry) => {
    setLoadingStudent(true)
    setStudentInfo(entry)
    try {
      const response = await api.get(`/projects/${project.id}/student/${entry.user_id}/playthroughs`)
      setStudentPlaythroughs(response.data)
      setSelectedStudent(entry.user_id)
      setViewMode('student')
    } catch (error) {
      console.error('Failed to load student:', error)
    } finally {
      setLoadingStudent(false)
    }
  }

  const openAnswers = async (playthroughId) => {
    setLoadingAnswers(true)
    try {
      const response = await api.get(`/playthroughs/${playthroughId}/answers`)
      setPlaythroughAnswers(response.data)
      setSelectedPlaythrough(playthroughId)
      setViewMode('answers')
    } catch (error) {
      console.error('Failed to load answers:', error)
    } finally {
      setLoadingAnswers(false)
    }
  }

  const handlePlayClick = () => {
    navigate(user?.role === 'teacher' ? `/projects/edit/${project.id}` : `/projects/play/${project.id}`)
  }

  const coverUrl = project.cover_url?.startsWith('http') ? project.cover_url : project.cover_url ? `http://localhost:8000${project.cover_url}` : null
  const isTeacher = user?.role === 'teacher'
  const description = project.description || ''

  // Фильтрация
  const filteredLeaderboard = useMemo(() => {
    if (!analytics?.leaderboard) return []
    let data = [...analytics.leaderboard]
    if (leaderboardSearch.trim()) {
      const s = leaderboardSearch.toLowerCase()
      data = data.filter(e => e.student_name.toLowerCase().includes(s) || e.student_email.toLowerCase().includes(s))
    }
    sortData(data, leaderboardSort)
    return data
  }, [analytics, leaderboardSearch, leaderboardSort])

  const filteredStudents = useMemo(() => {
    if (!analytics?.students_list) return []
    let data = [...analytics.students_list]
    if (studentsSearch.trim()) {
      const s = studentsSearch.toLowerCase()
      data = data.filter(e => e.student_name.toLowerCase().includes(s) || e.student_email.toLowerCase().includes(s))
    }
    sortStudents(data, studentsSort)
    return data
  }, [analytics, studentsSearch, studentsSort])

  function sortData(data, sort) {
    switch(sort) {
      case 'points-asc': data.sort((a, b) => a.total_points - b.total_points); break
      case 'points-desc': data.sort((a, b) => b.total_points - a.total_points); break
      case 'name-asc': data.sort((a, b) => a.student_name.localeCompare(b.student_name)); break
      case 'name-desc': data.sort((a, b) => b.student_name.localeCompare(a.student_name)); break
    }
  }

  function sortStudents(data, sort) {
    switch(sort) {
      case 'points-asc': data.sort((a, b) => a.best_points - b.best_points); break
      case 'points-desc': data.sort((a, b) => b.best_points - a.best_points); break
      case 'name-asc': data.sort((a, b) => a.student_name.localeCompare(b.student_name)); break
      case 'name-desc': data.sort((a, b) => b.student_name.localeCompare(a.student_name)); break
      case 'attempts-desc': data.sort((a, b) => b.attempts - a.attempts); break
      case 'attempts-asc': data.sort((a, b) => a.attempts - b.attempts); break
    }
  }

  return (
    <div className="project-details-page">
      <div className="project-details-container">
        <div className="details-header">
          <button onClick={onBack || (() => navigate('/projects'))} className="back-button">
            <FiArrowLeft /> Назад к новеллам
          </button>
        </div>

        {/* Hero секция */}
        <div className="details-hero">
          <div className="details-cover">
            {coverUrl ? <img src={coverUrl} alt={project.title} /> : (
              <div className="details-cover-placeholder"><FiBookOpen /><span>Нет обложки</span></div>
            )}
            {isTeacher && (
              <div className={`cover-badge ${project.is_published ? 'published-badge' : 'draft-badge'}`}>
                {project.is_published ? <><FiEye /> Опубликован</> : <><FiEyeOff /> Черновик</>}
              </div>
            )}
            {isCompleted && !isTeacher && (
              <div className="cover-badge completed-badge"><FiStar /> Пройдено</div>
            )}
          </div>
          <div className="details-info">
            <h1 className="details-project-title">{project.title}</h1>
            <div className="details-author"><FiUser /> Автор: {ownerName}</div>
            <div className="details-stats-grid">
              <div className="stat-item"><FiFilm className="stat-icon" /><div className="stat-content"><span className="stat-label">Сцен</span><span className="stat-value">{project.scenes?.length || 0}</span></div></div>
              {project.min_points > 0 && <div className="stat-item"><FiStar className="stat-icon" /><div className="stat-content"><span className="stat-label">Мин. баллы</span><span className="stat-value">{project.min_points}</span></div></div>}
              {!isTeacher && project.reward_status && <div className="stat-item reward"><FiAward className="stat-icon" /><div className="stat-content"><span className="stat-label">Статус</span><span className="stat-value">{project.reward_status}</span></div></div>}
            </div>
            {project.required_statuses?.length > 0 && (
              <div className="details-required-statuses">
                <FiTag className="required-icon" /><span className="required-label">Требуемые статусы:</span>
                <div className="status-tags">{project.required_statuses.map(s => <span key={s} className="status-tag">{s}</span>)}</div>
              </div>
            )}
            {project.groups?.length > 0 && (
              <div className="details-required-statuses" style={{ marginTop: '12px' }}>
                <FiUsers className="required-icon" /><span className="required-label">Группы:</span>
                <div className="status-tags">{project.groups.map(g => <span key={g} className="status-tag">{g}</span>)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Описание */}
        {description && (
          <div className="details-section">
            <h3>Описание</h3>
            <p className="full-description">{description.split('\n').map((line, i) => <React.Fragment key={i}>{line}{i < description.split('\n').length - 1 && <br />}</React.Fragment>)}</p>
          </div>
        )}

        {/* Кнопки действий */}
        <div className="details-actions">
          {isTeacher ? (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handlePlayClick} className="edit-btn-large"><FiEdit /> Редактировать</button>
              <button onClick={loadAnalytics} className={`play-btn-large ${showAnalytics ? 'active-analytics' : ''}`} disabled={loadingAnalytics}>
                <FiBarChart2 /> {loadingAnalytics ? 'Загрузка...' : showAnalytics ? 'Скрыть аналитику' : 'Аналитика'}
              </button>
            </div>
          ) : (
            <button onClick={handlePlayClick} className={`play-btn-large ${isCompleted ? 'replay' : ''}`}>
              {isCompleted ? <><FiRefreshCw /> Играть снова</> : <><FiPlay /> Играть</>}
            </button>
          )}
        </div>

        {/* Аналитика */}
        {showAnalytics && analytics && (
          <div className="details-section">
            {/* Хлебные крошки */}
            {viewMode !== 'main' && (
              <Breadcrumb
                items={[
                  { label: 'Аналитика', icon: FiBarChart2 },
                  ...(viewMode === 'student' || viewMode === 'answers' ? [{ label: studentInfo?.student_name || 'Студент', icon: FiUser }] : []),
                  ...(viewMode === 'answers' ? [{ label: 'Ответы', icon: FiEye }] : []),
                ]}
                onNavigate={(index) => {
                  if (index === 0) navigateTo(0)
                  if (index === 1 && viewMode === 'answers') navigateTo(1)
                }}
              />
            )}

            {/* Карточки статистики */}
            <div className="analytics-summary-cards">
              <div className="analytics-card"><FiUsers className="analytics-icon" /><div className="analytics-value">{analytics.total_students}</div><div className="analytics-label">Студентов прошло</div></div>
              <div className="analytics-card"><FiTrendingUp className="analytics-icon" /><div className="analytics-value">{analytics.total_playthroughs}</div><div className="analytics-label">Всего прохождений</div></div>
              <div className="analytics-card"><FiStar className="analytics-icon" /><div className="analytics-value">{analytics.average_points}</div><div className="analytics-label">Средний балл</div></div>
            </div>

            {/* Основной вид */}
            {viewMode === 'main' && (
              <>
                <div className="analytics-tabs">
                  <TabButton active={analyticsTab === 'leaderboard'} onClick={() => setAnalyticsTab('leaderboard')} icon={FiAward} label="Топ-10" count={analytics.leaderboard?.length} />
                  <TabButton active={analyticsTab === 'students'} onClick={() => setAnalyticsTab('students')} icon={FiUsers} label="Студенты" count={analytics.students_list?.length} />
                </div>

                {analyticsTab === 'leaderboard' && (
                  <>
                    <div className="analytics-tab-description">
                      Лучшие результаты студентов. Учитывается только лучшая попытка каждого студента.
                    </div>
                    <div className="analytics-controls">
                      <SearchBar value={leaderboardSearch} onChange={setLeaderboardSearch} placeholder="Поиск по имени или email..." />
                      <select className="analytics-sort-select" value={leaderboardSort} onChange={(e) => setLeaderboardSort(e.target.value)}>
                        <option value="points-desc">По баллам ↓</option>
                        <option value="points-asc">По баллам ↑</option>
                        <option value="name-asc">По имени А-Я</option>
                        <option value="name-desc">По имени Я-А</option>
                      </select>
                    </div>
                    <div className="leaderboard-table">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '60px' }}>Место</th>
                            <th>Студент</th>
                            <th>Баллы</th>
                            <th>Попыток</th>
                            <th>Дата</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeaderboard.map(entry => (
                            <tr key={entry.playthrough_id}>
                              <td style={{ textAlign: 'center' }}><RankBadge rank={entry.rank} /></td>
                              <td>
                                <button className="student-link-btn" onClick={() => openStudent(entry)} title="Посмотреть все прохождения">
                                  {entry.student_name}
                                </button>
                              </td>
                              <td><strong>{entry.total_points}</strong></td>
                              <td>{entry.attempts}</td>
                              <td>{entry.completed_at ? new Date(entry.completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                              <td>
                                <button className="view-answers-btn" onClick={() => openAnswers(entry.playthrough_id)} title="Посмотреть ответы">
                                  <FiEye size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="analytics-tab-hint">
                      Нажмите на имя студента, чтобы увидеть все его попытки. Нажмите на <FiEye size={12} /> чтобы посмотреть ответы.
                    </div>
                  </>
                )}

                {analyticsTab === 'students' && (
                  <>
                    <div className="analytics-tab-description">
                      Список всех студентов, проходивших новеллу. Показан лучший результат каждого.
                    </div>
                    <div className="analytics-controls">
                      <SearchBar value={studentsSearch} onChange={setStudentsSearch} placeholder="Поиск по имени или email..." />
                      <select className="analytics-sort-select" value={studentsSort} onChange={(e) => setStudentsSort(e.target.value)}>
                        <option value="points-desc">По баллам ↓</option>
                        <option value="points-asc">По баллам ↑</option>
                        <option value="name-asc">По имени А-Я</option>
                        <option value="name-desc">По имени Я-А</option>
                        <option value="attempts-desc">По попыткам ↓</option>
                        <option value="attempts-asc">По попыткам ↑</option>
                      </select>
                    </div>
                    <div className="leaderboard-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Студент</th>
                            <th>Email</th>
                            <th>Лучший балл</th>
                            <th>Попыток</th>
                            <th>Последнее</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map(entry => (
                            <tr key={entry.user_id}>
                              <td>
                                <button className="student-link-btn" onClick={() => openStudent(entry)} title="Посмотреть все прохождения">
                                  {entry.student_name}
                                </button>
                              </td>
                              <td>{entry.student_email}</td>
                              <td><strong>{entry.best_points}</strong></td>
                              <td>{entry.attempts}</td>
                              <td>{entry.last_completed_at ? new Date(entry.last_completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                              <td>
                                <button className="view-answers-btn" onClick={() => openAnswers(entry.last_playthrough_id)} title="Посмотреть ответы">
                                  <FiEye size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="analytics-tab-hint">
                      Нажмите на имя студента, чтобы увидеть все его попытки. Нажмите на <FiEye size={12} /> чтобы посмотреть ответы лучшей попытки.
                    </div>
                  </>
                )}
              </>
            )}

            {/* Просмотр прохождений студента */}
            {viewMode === 'student' && selectedStudent && (
              <>
                <div className="analytics-tab-description">
                  Все завершенные прохождения студента <strong>{studentInfo?.student_name}</strong>. 
                  Нажмите на <FiEye size={12} /> чтобы посмотреть детальные ответы.
                </div>
                {loadingStudent ? (
                  <div className="loading-files">Загрузка...</div>
                ) : (
                  <div className="leaderboard-table">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Баллы</th>
                          <th>Дата</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentPlaythroughs.map((p, index) => (
                          <tr key={p.playthrough_id}>
                            <td>{index + 1}</td>
                            <td><strong>{p.total_points}</strong></td>
                            <td>{p.completed_at ? new Date(p.completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                            <td>
                              <button className="view-answers-btn" onClick={() => openAnswers(p.playthrough_id)} title="Посмотреть ответы">
                                <FiEye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Просмотр ответов */}
            {viewMode === 'answers' && selectedPlaythrough && (
              <>
                <div className="analytics-tab-description">
                  Ответы студента на каждый вопрос. Показан текст выбранного варианта, сцена и контекст вопроса.
                </div>
                {loadingAnswers ? (
                  <div className="loading-files">Загрузка ответов...</div>
                ) : (
                  <div className="answers-detail-list">
                    {playthroughAnswers.map((answer, index) => (
                      <div key={answer.id || index} className="answer-detail-card">
                        <div className="answer-detail-number">#{answer.order_index + 1}</div>
                        <div className="answer-detail-body">
                          <div className="answer-detail-question">
                            <span className="answer-label">Сцена: {answer.scene_name}</span>
                            {answer.node_text && (
                              <span className="answer-label context-label" title={answer.node_text}>
                                "{answer.node_text.substring(0, 80)}{answer.node_text.length > 80 ? '...' : ''}"
                              </span>
                            )}
                          </div>
                          <div className="answer-detail-chosen">
                            <FiChevronRight size={14} />
                            <span>{answer.option_text}</span>
                          </div>
                          <div className="answer-detail-points">
                            <FiStar size={12} /> {answer.points_earned} баллов
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}