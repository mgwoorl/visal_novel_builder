import React, { useCallback, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

import { DialogueNode, DeleteProvider } from './DialogueNode'

const nodeTypes = { dialogue: DialogueNode }

export const DialogueEditor = ({ 
  nodes = [], 
  edges = [], 
  onChange, 
  onNodeClick,
  onAddNode,
  onDeleteNode
}) => {
  console.log('DialogueEditor получил onDeleteNode:', !!onDeleteNode)

  // Определяем стартовые блоки
  useEffect(() => {
    const nodesWithTargets = new Set(edges.map(e => e.target))
    
    if (nodes.length === 0) return
    
    const updatedNodes = nodes.map((node, index) => {
      const isStart = index === 0 && !nodesWithTargets.has(node.id)
      return {
        ...node,
        data: {
          ...node.data,
          isStart
        }
      }
    })
    
    const needsUpdate = nodes.some((node, i) => 
      node.data?.isStart !== updatedNodes[i].data.isStart
    )
    
    if (needsUpdate) {
      onChange(updatedNodes, edges)
    }
  }, [nodes, edges, onChange])

  // Отключаем стандартное удаление через клавиатуру
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  const onNodesChange = useCallback(
    (changes) => {
      // Фильтруем изменения, удаляя те, которые пытаются удалить узлы
      const filteredChanges = changes.filter(change => change.type !== 'remove')
      onChange(applyNodeChanges(filteredChanges, nodes), edges)
    },
    [nodes, edges, onChange]
  )

  const onEdgesChange = useCallback(
    (changes) => onChange(nodes, applyEdgeChanges(changes, edges)),
    [nodes, edges, onChange]
  )

  const onConnect = useCallback(
    (params) => {
      // Проверяем, есть ли уже связь от этого источника
      const existingEdge = edges.find(
        edge => edge.source === params.source && edge.sourceHandle === params.sourceHandle
      )
      
      if (existingEdge) {
        // Если уже есть связь, удаляем её и создаём новую
        const newEdges = edges.filter(e => e.id !== existingEdge.id)
        onChange(
          nodes,
          addEdge({ 
            ...params, 
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#48bb78', strokeWidth: 2 }
          }, newEdges)
        )
      } else {
        // Если нет, просто добавляем новую
        onChange(
          nodes,
          addEdge({ 
            ...params, 
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#48bb78', strokeWidth: 2 }
          }, edges)
        )
      }
    },
    [nodes, edges, onChange]
  )

  return (
    <DeleteProvider onDelete={onDeleteNode}>
      <div className="dialogue-editor">
        <div className="editor-toolbar">
          <button onClick={onAddNode} className="add-node-btn">
            Добавить блок
          </button>
          <div className="toolbar-hint">
            Для удаления используйте кнопку ✕ на блоке
          </div>
        </div>
        <div style={{ height: 'calc(100% - 50px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            deleteKeyCode={null}
          >
            <Background color="#aaa" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </DeleteProvider>
  )
}