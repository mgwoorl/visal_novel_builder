"""
Маршруты для выполнения сцен (движок визуальной новеллы).
Поддерживает запуск сцены с указанием стартового узла для восстановления прогресса.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Optional
from pydantic import BaseModel

from src.database import get_db
from src.scenes import crud
from src.engine.graph_engine import GraphFactory, ExecutionContext, GraphExecutionEngine
from src.logger import setup_logger

router = APIRouter(prefix="/scenes/execute", tags=["scenes-execution"])

logger = setup_logger(__name__, 'execution.log')
engine = GraphExecutionEngine()


class SelectOptionRequest(BaseModel):
    """Запрос на выбор варианта ответа."""
    node_id: str
    option_id: str
    context_data: Dict = {}


class StartExecutionRequest(BaseModel):
    """Запрос на запуск выполнения сцены."""
    start_node_id: Optional[str] = None


@router.post("/{scene_id}/start")
def start_scene_execution(
    scene_id: int,
    request: StartExecutionRequest = StartExecutionRequest(),
    db: Session = Depends(get_db)
):
    """
    Запускает выполнение сцены с указанного узла или со стартового.
    
    Args:
        scene_id: ID сцены
        request: Параметры запуска (start_node_id для восстановления прогресса)
        db: Сессия БД
        
    Returns:
        dict: Результат выполнения с информацией о текущем узле
    """
    logger.info(f"Запуск сцены id={scene_id}, start_node_id={request.start_node_id}")

    # Загрузка данных сцены
    scene_data = crud.get_full_scene(db, scene_id)
    if not scene_data:
        logger.error(f"Сцена не найдена: id={scene_id}")
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    try:
        # Создание графа из данных сцены
        graph = GraphFactory.from_reactflow(scene_data)
        logger.debug(f"Граф создан: {len(graph.nodes)} узлов, {len(graph.edges)} связей")

        start_node_id = request.start_node_id

        # Проверка существования указанного узла
        if start_node_id:
            target_node = graph.get_node_by_id(start_node_id)
            if not target_node:
                logger.error(f"Узел {start_node_id} не найден в сцене {scene_id}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Узел {start_node_id} не найден в сцене"
                )
            logger.info(f"Восстановление прогресса: начало с узла {start_node_id}")

        # Создание контекста выполнения
        context = ExecutionContext(
            project_id=scene_data.get('project_id', 0),
            scene_id=scene_id
        )

        # Выполнение графа
        result = engine.traverse_graph(graph, context, start_node_id=start_node_id)

        logger.info(
            f"Результат выполнения: status={result.get('status')}, "
            f"узел={result.get('current_node', {}).get('id')}, "
            f"has_options={result.get('has_options')}"
        )

        return {
            'success': True,
            'scene_id': scene_id,
            'execution': result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка выполнения сцены: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{scene_id}/select")
def select_option(
    scene_id: int,
    request: SelectOptionRequest,
    db: Session = Depends(get_db)
):
    """
    Обрабатывает выбор варианта ответа пользователем.
    
    Args:
        scene_id: ID сцены
        request: Данные выбора (node_id, option_id, context_data)
        db: Сессия БД
        
    Returns:
        dict: Результат обработки с информацией о следующем узле или действии
    """
    logger.info(
        f"Выбор опции: сцена={scene_id}, "
        f"узел={request.node_id}, опция={request.option_id}"
    )

    # Загрузка данных сцены
    scene_data = crud.get_full_scene(db, scene_id)
    if not scene_data:
        logger.error(f"Сцена не найдена: id={scene_id}")
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    try:
        # Создание графа
        graph = GraphFactory.from_reactflow(scene_data)

        # Восстановление контекста из данных пользователя
        context = ExecutionContext.from_dict(
            request.context_data,
            project_id=scene_data.get('project_id', 0),
            scene_id=scene_id
        )

        logger.debug(
            f"Контекст восстановлен: points={context.total_points}, "
            f"answers={len(context.answers)}"
        )

        # Обработка выбора
        result = engine.select_option(graph, context, request.node_id, request.option_id)

        logger.info(f"Результат выбора: action={result.get('action')}")

        # Обработка результата в зависимости от типа действия
        if result.get('action') == 'node':
            # Переход к следующему узлу
            next_result = engine.traverse_graph(
                graph,
                context,
                start_node_id=result['target_node_id']
            )
            logger.info(f"Переход к узлу: {result['target_node_id']}")
            return {
                'success': True,
                'execution': next_result
            }

        elif result.get('action') == 'end':
            # Завершение новеллы
            logger.info("Новелла завершена")
            return {
                'success': True,
                'execution': {
                    'status': 'end',
                    'message': result.get('message', 'Завершение новеллы'),
                    'context': result['context']
                }
            }

        elif result.get('action') == 'next_scene':
            # Переход к следующей сцене
            logger.info("Переход к следующей сцене")
            return {
                'success': True,
                'execution': {
                    'status': 'next_scene',
                    'message': result.get('message', 'Переход к следующей сцене'),
                    'context': result['context']
                }
            }

        else:
            logger.error(f"Неизвестное действие: {result.get('action')}")
            raise HTTPException(
                status_code=400,
                detail=result.get('error', 'Неизвестная ошибка')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обработки выбора: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))