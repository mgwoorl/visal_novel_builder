"""
CRUD операции для работы со сценами.
Включает конвертацию данных между форматом ReactFlow и БД.
"""
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

from src.scenes import models, schemas
from src.logger import setup_logger

logger = setup_logger(__name__, 'scenes.log')


def get_background_type_from_url(url: str) -> str:
    """Определяет тип фона по расширению файла."""
    if not url:
        return "image"
    video_extensions = ['.mp4', '.webm', '.ogg', '.mov']
    ext = Path(url).suffix.lower()
    return "video" if ext in video_extensions else "image"


def get_scene(db: Session, scene_id: int) -> Optional[models.Scene]:
    """Возвращает сцену по ID."""
    scene = db.query(models.Scene).filter(models.Scene.id == scene_id).first()
    logger.debug(f"Поиск сцены id={scene_id} → {'найдена' if scene else 'не найдена'}")
    return scene


def get_project_scenes(db: Session, project_id: int) -> List[models.Scene]:
    """Возвращает все сцены проекта, отсортированные по order_index."""
    scenes = db.query(models.Scene).filter(
        models.Scene.project_id == project_id
    ).order_by(models.Scene.order_index).all()
    logger.debug(f"Сцены проекта id={project_id}: найдено {len(scenes)}")
    return scenes


def create_scene(db: Session, project_id: int, name: str = "Новая сцена") -> models.Scene:
    """Создаёт новую сцену в проекте."""
    max_order = db.query(models.Scene).filter(
        models.Scene.project_id == project_id
    ).count()

    db_scene = models.Scene(project_id=project_id, name=name, order_index=max_order)
    db.add(db_scene)
    db.commit()
    db.refresh(db_scene)
    logger.info(f"Сцена создана: id={db_scene.id}, name={db_scene.name}")
    return db_scene


def update_scene(db: Session, scene_id: int, scene_update: schemas.SceneUpdate) -> Optional[models.Scene]:
    """Обновляет информацию о сцене."""
    db_scene = get_scene(db, scene_id)
    if not db_scene:
        return None

    update_data = scene_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_scene, field):
            setattr(db_scene, field, value)

    db_scene.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_scene)
    logger.info(f"Сцена обновлена: id={scene_id}")
    return db_scene


def delete_scene(db: Session, scene_id: int) -> bool:
    """Удаляет сцену и все связанные данные."""
    db_scene = get_scene(db, scene_id)
    if not db_scene:
        return False

    db.delete(db_scene)
    db.commit()
    logger.info(f"Сцена удалена: id={scene_id}")
    return True


def get_nodes_by_scene(db: Session, scene_id: int) -> List[models.SceneNode]:
    """Возвращает все узлы сцены."""
    return db.query(models.SceneNode).filter(models.SceneNode.scene_id == scene_id).all()


def get_node_by_uuid(db: Session, node_uuid: str) -> Optional[models.SceneNode]:
    """Возвращает узел по UUID."""
    return db.query(models.SceneNode).filter(models.SceneNode.node_uuid == node_uuid).first()


def get_options_by_node(db: Session, node_uuid: str) -> List[models.NodeOption]:
    """Возвращает все опции узла, отсортированные по sort_order."""
    return db.query(models.NodeOption).filter(
        models.NodeOption.node_uuid == node_uuid
    ).order_by(models.NodeOption.sort_order).all()


def get_edges_by_scene(db: Session, scene_id: int) -> List[models.SceneEdge]:
    """Возвращает все связи сцены."""
    return db.query(models.SceneEdge).filter(models.SceneEdge.scene_id == scene_id).all()


def delete_node(db: Session, node_uuid: str) -> bool:
    """Удаляет узел по его UUID."""
    db_node = get_node_by_uuid(db, node_uuid)
    if not db_node:
        return False
    db.delete(db_node)
    db.commit()
    return True


def delete_option(db: Session, option_uuid: str) -> bool:
    """Удаляет опцию по её UUID."""
    db_option = db.query(models.NodeOption).filter(
        models.NodeOption.option_uuid == option_uuid
    ).first()
    if not db_option:
        return False
    db.delete(db_option)
    db.commit()
    return True


def delete_edges_by_node(db: Session, node_uuid: str, scene_id: int) -> int:
    """Удаляет все связи, связанные с узлом."""
    edges = db.query(models.SceneEdge).filter(
        (models.SceneEdge.source_node_uuid == node_uuid) |
        (models.SceneEdge.target_node_uuid == node_uuid),
        models.SceneEdge.scene_id == scene_id
    ).all()

    count = len(edges)
    for edge in edges:
        db.delete(edge)
    db.commit()
    return count


def convert_reactflow_to_db(scene_id: int, reactflow_data: dict) -> dict:
    """
    Преобразует данные из формата ReactFlow в формат БД.
    Разделяет узлы, опции и связи.
    """
    result = {'nodes': [], 'options': [], 'edges': []}

    for node in reactflow_data.get('nodes', []):
        db_node = {
            'scene_id': scene_id,
            'node_uuid': node['id'],
            'position_x': node['position']['x'],
            'position_y': node['position']['y'],
            'width': node.get('width'),
            'height': node.get('height'),
            'character_name': node['data'].get('characterName'),
            'text': node['data'].get('text'),
            'sprite_file': node['data'].get('spriteFile'),
            'music_file': node['data'].get('musicFile'),
            'loop_music': node['data'].get('loopMusic', False),
            'is_start': node['data'].get('isStart', False)
        }
        result['nodes'].append(db_node)

        for idx, opt in enumerate(node['data'].get('options', [])):
            db_option = {
                'node_uuid': node['id'],
                'option_uuid': opt['id'],
                'option_text': opt['text'],
                'target_type': opt.get('targetType', 'node'),
                'target_node_uuid': opt.get('targetNodeId'),
                'points': opt.get('points', 0),
                'sort_order': idx
            }
            result['options'].append(db_option)

    for edge in reactflow_data.get('edges', []):
        db_edge = {
            'scene_id': scene_id,
            'edge_uuid': edge['id'],
            'source_node_uuid': edge['source'],
            'source_handle': edge['sourceHandle'],
            'target_node_uuid': edge['target']
        }
        result['edges'].append(db_edge)

    return result


def convert_db_to_reactflow(scene: models.Scene, nodes: List[models.SceneNode],
                            edges: List[models.SceneEdge], options: List[models.NodeOption]) -> dict:
    """
    Преобразует данные из формата БД в формат ReactFlow.
    Группирует опции по узлам.
    """
    options_by_node = {}
    for opt in options:
        if opt.node_uuid not in options_by_node:
            options_by_node[opt.node_uuid] = []
        options_by_node[opt.node_uuid].append({
            'id': opt.option_uuid,
            'text': opt.option_text,
            'targetType': opt.target_type,
            'targetNodeId': opt.target_node_uuid,
            'points': opt.points,
            'sort_order': opt.sort_order
        })

    # Сортировка опций
    for node_uuid in options_by_node:
        options_by_node[node_uuid].sort(key=lambda x: x.get('sort_order', 0))

    # Формирование узлов
    rf_nodes = []
    for node in nodes:
        node_options = options_by_node.get(node.node_uuid, [])
        rf_node = {
            'id': node.node_uuid,
            'type': 'dialogue',
            'position': {
                'x': float(node.position_x) if node.position_x is not None else 0,
                'y': float(node.position_y) if node.position_y is not None else 0
            },
            'data': {
                'characterName': node.character_name or '',
                'text': node.text or '',
                'spriteFile': node.sprite_file or '',
                'musicFile': node.music_file or '',
                'loopMusic': bool(node.loop_music) if node.loop_music is not None else False,
                'isStart': bool(node.is_start) if node.is_start is not None else False,
                'options': node_options
            }
        }
        if node.width is not None:
            rf_node['width'] = float(node.width)
        if node.height is not None:
            rf_node['height'] = float(node.height)
        rf_nodes.append(rf_node)

    # Формирование связей
    rf_edges = []
    for edge in edges:
        rf_edge = {
            'id': edge.edge_uuid,
            'source': edge.source_node_uuid,
            'sourceHandle': edge.source_handle,
            'target': edge.target_node_uuid,
            'targetHandle': 'in',
            'markerEnd': {'type': 'arrowclosed'},
            'style': {'stroke': '#48bb78', 'strokeWidth': 2}
        }
        rf_edges.append(rf_edge)

    return {
        'id': scene.id,
        'name': scene.name,
        'background_url': scene.background_url,
        'background_type': scene.background_type,
        'use_video_audio': scene.use_video_audio if hasattr(scene, 'use_video_audio') else False,
        'order_index': scene.order_index,
        'nodes': rf_nodes,
        'edges': rf_edges
    }


def get_full_scene(db: Session, scene_id: int) -> Optional[dict]:
    """Загружает полные данные сцены в формате ReactFlow."""
    scene = get_scene(db, scene_id)
    if not scene:
        return None

    nodes = get_nodes_by_scene(db, scene_id)
    edges = get_edges_by_scene(db, scene_id)

    all_options = []
    for node in nodes:
        options = get_options_by_node(db, node.node_uuid)
        all_options.extend(options)

    return convert_db_to_reactflow(scene, nodes, edges, all_options)


def save_full_scene(db: Session, scene_id: int, reactflow_data: dict) -> Optional[dict]:
    """
    Сохраняет полную сцену: обновляет существующие записи,
    удаляет лишние, создает новые.
    """
    db_scene = get_scene(db, scene_id)
    if not db_scene:
        return None

    logger.info(f"Сохранение сцены id={scene_id}: {len(reactflow_data.get('nodes', []))} узлов")

    # Обновление данных сцены
    if 'name' in reactflow_data:
        db_scene.name = reactflow_data['name']
    if 'background_url' in reactflow_data:
        db_scene.background_url = reactflow_data['background_url']
        db_scene.background_type = get_background_type_from_url(reactflow_data['background_url'])
    if 'use_video_audio' in reactflow_data:
        db_scene.use_video_audio = reactflow_data['use_video_audio']

    db_scene.updated_at = datetime.utcnow()

    # Существующие узлы и связи
    existing_nodes = {node.node_uuid for node in get_nodes_by_scene(db, scene_id)}
    existing_edges = {edge.edge_uuid for edge in get_edges_by_scene(db, scene_id)}

    # Новые данные из ReactFlow
    new_data = convert_reactflow_to_db(scene_id, reactflow_data)
    new_node_uuids = {node['node_uuid'] for node in new_data['nodes']}
    new_edge_uuids = {edge['edge_uuid'] for edge in new_data['edges']}

    # Удаление лишних узлов
    nodes_to_delete = existing_nodes - new_node_uuids
    for node_uuid in nodes_to_delete:
        db.query(models.SceneNode).filter(models.SceneNode.node_uuid == node_uuid).delete()

    # Удаление лишних связей
    edges_to_delete = existing_edges - new_edge_uuids
    for edge_uuid in edges_to_delete:
        db.query(models.SceneEdge).filter(models.SceneEdge.edge_uuid == edge_uuid).delete()

    # Обновление или создание узлов
    for node_data in new_data['nodes']:
        existing_node = db.query(models.SceneNode).filter(
            models.SceneNode.node_uuid == node_data['node_uuid']
        ).first()
        if existing_node:
            for key, value in node_data.items():
                if key not in ['node_uuid', 'scene_id', 'created_at']:
                    setattr(existing_node, key, value)
            existing_node.updated_at = datetime.utcnow()
        else:
            db.add(models.SceneNode(**node_data))

    # Обновление или создание опций
    for opt_data in new_data['options']:
        existing_opt = db.query(models.NodeOption).filter(
            models.NodeOption.option_uuid == opt_data['option_uuid']
        ).first()
        if existing_opt:
            for key, value in opt_data.items():
                if key not in ['option_uuid', 'created_at']:
                    setattr(existing_opt, key, value)
            existing_opt.updated_at = datetime.utcnow()
        else:
            db.add(models.NodeOption(**opt_data))

    # Обновление или создание связей
    for edge_data in new_data['edges']:
        existing_edge = db.query(models.SceneEdge).filter(
            models.SceneEdge.edge_uuid == edge_data['edge_uuid']
        ).first()
        if existing_edge:
            for key, value in edge_data.items():
                if key not in ['edge_uuid', 'scene_id', 'created_at']:
                    setattr(existing_edge, key, value)
        else:
            db.add(models.SceneEdge(**edge_data))

    db.commit()
    logger.info(f"Сцена id={scene_id} сохранена успешно")
    return get_full_scene(db, scene_id)