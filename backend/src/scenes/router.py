"""
Основные маршруты для работы со сценами.
CRUD операции: создание, чтение, обновление, удаление сцен.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.projects import crud as projects_crud
from src.projects.models import Project
from src.users.router import get_current_user_from_token
from src.scenes import crud, schemas
from src.logger import setup_logger

router = APIRouter(prefix="/scenes", tags=["scenes"])

logger = setup_logger(__name__, 'scenes_router.log')


def check_project_access(db: Session, project_id: int, user) -> bool:
    """
    Проверяет имеет ли пользователь доступ к проекту.
    Только владелец-преподаватель имеет полный доступ.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False
    if project.owner_id != user.id:
        return False
    return True


@router.post("/", response_model=schemas.SceneResponse)
def create_scene(
    project_id: int = Query(...),
    scene_data: schemas.SceneCreate = None,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Создаёт новую сцену в проекте."""
    logger.info(f"Создание сцены в проекте id={project_id} пользователем {current_user.email}")

    if not check_project_access(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    name = "Новая сцена"
    if scene_data and hasattr(scene_data, 'name'):
        name = scene_data.name

    scene = crud.create_scene(db, project_id, name)
    logger.info(f"Сцена создана: id={scene.id}")
    return scene


@router.get("/project/{project_id}", response_model=List[schemas.SceneResponse])
def get_project_scenes(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает все сцены проекта."""
    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    logger.debug(f"Запрос сцен проекта id={project_id}")
    return crud.get_project_scenes(db, project_id)


@router.get("/{scene_id}")
def get_scene(
    scene_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает сцену по ID."""
    scene = crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")
    return scene


@router.get("/{scene_id}/full")
def get_full_scene(
    scene_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает полные данные сцены со всеми узлами и связями."""
    logger.debug(f"Запрос полных данных сцены id={scene_id}")

    scene_data = crud.get_full_scene(db, scene_id)
    if not scene_data:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    return scene_data


@router.put("/{scene_id}")
def update_scene(
    scene_id: int,
    scene_update: schemas.SceneUpdate,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Обновляет основную информацию сцены."""
    scene = crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    logger.info(f"Обновление сцены id={scene_id}")
    updated = crud.update_scene(db, scene_id, scene_update)
    return updated


@router.put("/{scene_id}/full")
def save_full_scene(
    scene_id: int,
    scene_data: dict,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Сохраняет полные данные сцены (узлы, опции, связи)."""
    scene = crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    logger.info(f"Сохранение полной сцены id={scene_id}: {len(scene_data.get('nodes', []))} узлов")

    updated = crud.save_full_scene(db, scene_id, scene_data)
    if not updated:
        raise HTTPException(status_code=500, detail="Ошибка сохранения сцены")

    return updated


@router.delete("/{scene_id}")
def delete_scene(
    scene_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Удаляет сцену."""
    scene = crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    logger.info(f"Удаление сцены id={scene_id}")
    crud.delete_scene(db, scene_id)
    return {"message": "Сцена удалена"}


@router.delete("/{scene_id}/nodes/{node_id}")
def delete_scene_node(
    scene_id: int,
    node_id: str,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Удаляет узел сцены и все связанные с ним опции и связи."""
    scene = crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    logger.info(f"Удаление узла {node_id} из сцены {scene_id}")

    # Удаление связей узла
    crud.delete_edges_by_node(db, node_id, scene_id)
    # Удаление самого узла
    result = crud.delete_node(db, node_id)

    if not result:
        raise HTTPException(status_code=404, detail="Узел не найден")

    return {"message": "Узел удален"}


@router.delete("/{scene_id}/nodes/{node_id}/options/{option_id}")
def delete_node_option(
    scene_id: int,
    node_id: str,
    option_id: str,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Удаляет опцию узла."""
    scene = crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    logger.info(f"Удаление опции {option_id} из узла {node_id}")

    result = crud.delete_option(db, option_id)
    if not result:
        raise HTTPException(status_code=404, detail="Опция не найдена")

    return {"message": "Опция удалена"}