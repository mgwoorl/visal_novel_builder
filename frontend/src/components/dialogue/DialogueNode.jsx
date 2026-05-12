import React, { memo, useContext } from 'react'
import { Handle, Position } from 'reactflow'
import { FiTrash2, FiMessageSquare, FiStar, FiPlay, FiMusic } from 'react-icons/fi'

const DeleteContext = React.createContext(null)

export const DeleteProvider = ({ children, onDelete }) => {
  return (
    <DeleteContext.Provider value={onDelete}>
      {children}
    </DeleteContext.Provider>
  )
}

export const useDelete = () => useContext(DeleteContext)

export const DialogueNode = memo(({ id, data, selected }) => {
  const isStart = data?.isStart || false
  const options = data?.options || []
  const onDelete = useDelete()

  const handleDelete = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete) {
      onDelete(id)
    }
  }

  return (
    <div 
      className={`dialogue-node ${selected ? 'selected' : ''} ${isStart ? 'start-node' : 'regular-node'}`}
    >
      {!isStart && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="node-handle node-handle-target"
        />
      )}
      
      <div className={`node-header ${isStart ? 'start-header' : 'regular-header'}`}>
        <span className="node-title">
          {isStart ? (
            <>
              <FiPlay className="node-icon" /> СТАРТ
            </>
          ) : (
            <>
              <FiMessageSquare className="node-icon" /> {data.characterName || 'ДИАЛОГ'}
            </>
          )}
        </span>
        
        {!isStart && (
          <button 
            className="node-delete-btn"
            onClick={handleDelete}
            title="Удалить блок"
          >
            <FiTrash2 />
          </button>
        )}
      </div>

      <div className="node-content">
        <div className="node-text">
          {data.text || 'Нажмите чтобы добавить текст'}
        </div>

        {data.musicFile && (
          <div className="node-music-indicator">
            <FiMusic />
          </div>
        )}

        {options.length > 0 && (
          <div className="node-options">
            {options.map((opt, idx) => (
              <div key={`${id}-opt-${idx}-${opt.id}`} className="node-option-item">
                <span className="option-number">{idx + 1}</span>
                <span className="option-text">{opt.text}</span>
                {opt.points > 0 && (
                  <span className="option-points-badge">
                    <FiStar /> +{opt.points}
                  </span>
                )}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`opt-${opt.id}`}
                  className="node-handle node-handle-source"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})