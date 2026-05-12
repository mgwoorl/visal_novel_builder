"""
Маршруты для работы с прохождениями.
Включает начало прохождения, завершение, получение истории и ответов.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.users.router import get_current_user_from_token
from src.users import crud as users_crud
from src.projects import crud as projects_crud
from src.playthroughs import crud, schemas
from src.logger import setup_logger

router = APIRouter(prefix="/playthroughs", tags=["playthroughs"])

logger = setup_logger(__name__, 'playthroughs_router.log')


@router.post("/start", response_model=schemas.StartPlaythroughResponse)
def start_playthrough(
    project_id: int = Query(...),
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Начинает новое прохождение проекта для студента.
    Проверяет что проект опубликован и доступен пользователю.
    """
    logger.info(f"Начало прохождения: user={current_user.id}, project={project_id}")

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только студенты могут проходить проекты")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if not project.is_published:
        raise HTTPException(status_code=403, detail="Проект не опубликован")

    # Проверка доступности проекта для студента
    available = projects_crud.get_available_projects_for_user(db, current_user.id)
    available_ids = [p['id'] for p in available]
    if project.id not in available_ids:
        raise HTTPException(status_code=403, detail="Проект недоступен")

    # Проверка существующего активного прохождения
    active = crud.get_active_playthrough(db, current_user.id, project_id)
    if active:
        logger.info(f"Найдено активное прохождение: id={active.id}")
        raise HTTPException(
            status_code=400,
            detail="У вас уже есть активное прохождение этого проекта"
        )

    # Создание нового прохождения
    playthrough = crud.create_playthrough(db, current_user.id, project_id)
    logger.info(f"Создано новое прохождение: id={playthrough.id}")

    return schemas.StartPlaythroughResponse(
        success=True,
        playthrough_id=playthrough.id,
        message="Прохождение начато"
    )


@router.post("/{playthrough_id}/complete", response_model=schemas.CompletePlaythroughResponse)
def complete_playthrough(
    playthrough_id: int,
    request_data: schemas.CompletePlaythroughRequest,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Завершает прохождение, сохраняет ответы и начисляет статус при выполнении условий.
    """
    logger.info(
        f"Завершение прохождения: id={playthrough_id}, "
        f"баллы={request_data.total_points}, ответов={len(request_data.answers)}"
    )

    playthrough = crud.get_playthrough(db, playthrough_id)
    if not playthrough:
        raise HTTPException(status_code=404, detail="Прохождение не найдено")

    if playthrough.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    if playthrough.is_completed:
        raise HTTPException(status_code=400, detail="Прохождение уже завершено")

    # Преобразование ответов в список словарей
    answers_list = []
    for ans in request_data.answers:
        answers_list.append({
            'scene_id': ans.scene_id,
            'node_id': ans.node_id,
            'option_id': ans.option_id,
            'text': ans.text,
            'points': ans.points
        })

    reward_status = crud.complete_playthrough(
        db,
        playthrough_id,
        request_data.total_points,
        answers_list
    )

    return schemas.CompletePlaythroughResponse(
        success=True,
        reward_status=reward_status,
        total_points=request_data.total_points,
        message="Прохождение завершено"
    )


@router.get("/completed", response_model=schemas.CompletedProjectsResponse)
def get_completed_projects(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Возвращает список ID проектов, которые пользователь успешно завершил.
    """
    logger.debug(f"Запрос завершенных проектов: user={current_user.id}")

    playthroughs = db.query(crud.models.Playthrough).filter(
        crud.models.Playthrough.user_id == current_user.id,
        crud.models.Playthrough.is_completed == True
    ).all()

    completed_ids = list(set([p.project_id for p in playthroughs]))
    logger.debug(f"Завершенных проектов: {len(completed_ids)}")
    return schemas.CompletedProjectsResponse(completed_ids=completed_ids)


@router.get("/{playthrough_id}/answers")
def get_playthrough_answers(
    playthrough_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Возвращает все ответы прохождения с информацией о сценах и узлах.
    Доступно студенту-владельцу и преподавателям.
    """
    from src.scenes.models import SceneNode, Scene

    logger.debug(f"Запрос ответов прохождения: id={playthrough_id}")

    playthrough = crud.get_playthrough(db, playthrough_id)
    if not playthrough:
        raise HTTPException(status_code=404, detail="Прохождение не найдено")

    # Проверка прав доступа
    if playthrough.user_id != current_user.id and current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    answers = crud.get_playthrough_answers(db, playthrough_id)

    # Сбор информации о сценах и узлах
    scene_map = {}
    node_map = {}

    for answer in answers:
        if answer.scene_id and answer.scene_id not in scene_map:
            scene = db.query(Scene).filter(Scene.id == answer.scene_id).first()
            if scene:
                scene_map[answer.scene_id] = {"name": scene.name, "order": scene.order_index}

        if answer.node_id and answer.node_id not in node_map:
            node = db.query(SceneNode).filter(SceneNode.node_uuid == answer.node_id).first()
            if node:
                node_map[answer.node_id] = node.text or ""

    # Формирование результата
    result = []
    for a in answers:
        scene_info = scene_map.get(a.scene_id, {"name": f"Сцена {a.scene_id}", "order": a.scene_id})
        node_text = node_map.get(a.node_id, "")

        result.append({
            "id": a.id,
            "playthrough_id": a.playthrough_id,
            "scene_id": a.scene_id,
            "scene_name": scene_info["name"],
            "scene_order": scene_info["order"],
            "node_id": a.node_id,
            "node_text": node_text[:100] if node_text else "",
            "option_id": a.option_id,
            "option_text": a.option_text,
            "points_earned": a.points_earned,
            "order_index": a.order_index,
            "answered_at": a.answered_at
        })

    return result