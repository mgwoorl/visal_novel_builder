import React, { useState, useEffect } from 'react'

export const StudentList = () => {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setStudents([
        { id: 1, last_name: 'Иванов', first_name: 'Петр', email: 'ivanov@mail.ru', statuses: ['Стажёр', 'Знаток'], playthroughs: 5 },
        { id: 2, last_name: 'Петрова', first_name: 'Анна', email: 'petrova@mail.ru', statuses: ['Стажёр'], playthroughs: 2 },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) return <div>Загрузка...</div>

  return (
    <div className="student-list">
      <h2>Список студентов</h2>
      <table className="students-table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Email</th>
            <th>Статусы</th>
            <th>Прохождений</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id}>
              <td>{student.last_name} {student.first_name}</td>
              <td>{student.email}</td>
              <td>
                {student.statuses.map(s => (
                  <span key={s} className="status-badge">{s}</span>
                ))}
              </td>
              <td>{student.playthroughs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}