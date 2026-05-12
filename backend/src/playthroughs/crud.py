"""
CRUD операции для работы с прохождениями.
Содержит бизнес-логику создания, обновления прогресса, завершения и начисления статусов.
"""
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from src.playthroughs import models, schemas
from src.users import crud as users_crud
from src.projects import crud as projects_crud
from src.users.models import Status, UserStatus
from src.scenes.models import SceneNode
from src.logger import setup_logger

logger = setup_logger(__name__, 'playthroughs.log')


def get_playthrough(db: Session, playthrough_id: int) -> Optional[models.Playthrough]:
    """Возвращает прохождение по ID."""
    result = db.query(models.Playthrough).filter(models.Playthrough.id == playthrough_id).first()
    logger.debug(f"Поиск прохождения id={playthrough_id} → {'найдено' if result else 'не найдено'}")
    return result


def get_active_playthrough(db: Session, user_id: int, project_id: int) -> Optional[models.Playthrough]:
    """
    Возвращает активное (незавершенное) прохождение пользователя для проекта.
    Используется для проверки возможности создания нового прохождения.
    """
    logger.info(f"Поиск активного прохождения: user={user_id}, project={project_id}")

    result = db.query(models.Playthrough).filter(
        models.Playthrough.user_id == user_id,
        models.Playthrough.project_id == project_id,
        models.Playthrough.is_completed == False
    ).order_by(models.Playthrough.started_at.desc()).first()

    if result:
        logger.info(f"Найдено активное прохождение: id={result.id}")
    else:
        logger.info("Активных прохождений не найдено")

    return result


def get_user_playthroughs(db: Session, user_id: int) -> List[models.Playthrough]:
    """Возвращает все прохождения пользователя."""
    result = db.query(models.Playthrough).filter(
        models.Playthrough.user_id == user_id
    ).order_by(models.Playthrough.created_at.desc()).all()
    logger.debug(f"Прохождения пользователя id={user_id}: найдено {len(result)}")
    return result


def create_playthrough(db: Session, user_id: int, project_id: int) -> models.Playthrough:
    """Создаёт новое прохождение."""
    logger.info(f"Создание прохождения: user={user_id}, project={project_id}")

    playthrough = models.Playthrough(
        user_id=user_id,
        project_id=project_id,
        started_at=datetime.utcnow(),
        total_points=0,
        is_completed=False
    )
    db.add(playthrough)
    db.commit()
    db.refresh(playthrough)
    logger.info(f"Прохождение создано: id={playthrough.id}")
    return playthrough


def complete_playthrough(db: Session, playthrough_id: int, total_points: int, answers: List[dict]) -> Optional[str]:
    """
    Завершает прохождение, сохраняет ответы и начисляет статус при выполнении условий.
    
    Args:
        db: Сессия БД
        playthrough_id: ID прохождения
        total_points: Итоговое количество баллов
        answers: Список ответов пользователя
        
    Returns:
        Optional[str]: Название полученного статуса или None если условия не выполнены
    """
    logger.info(f"Завершение прохождения: id={playthrough_id}, баллы={total_points}, ответов={len(answers)}")

    db_playthrough = get_playthrough(db, playthrough_id)
    if not db_playthrough:
        logger.error(f"Прохождение не найдено: id={playthrough_id}")
        return None

    if db_playthrough.is_completed:
        logger.warning(f"Прохождение уже завершено: id={playthrough_id}")
        return None

    # Обновление данных прохождения
    db_playthrough.total_points = total_points
    db_playthrough.completed_at = datetime.utcnow()
    db_playthrough.is_completed = True

    # Сохранение ответов
    for idx, answer in enumerate(answers):
        scene_id = answer.get('scene_id')
        node_id = answer.get('node_id', '')
        option_id = answer.get('option_id', '')
        option_text = answer.get('text', '')
        points_earned = answer.get('points', 0)

        # Если scene_id не передан, пытаемся определить по node_id
        if not scene_id and node_id:
            node = db.query(SceneNode).filter(SceneNode.node_uuid == node_id).first()
            if node:
                scene_id = node.scene_id

        if scene_id:
            db_answer = models.PlaythroughAnswer(
                playthrough_id=playthrough_id,
                scene_id=scene_id,
                node_id=str(node_id),
                option_id=str(option_id),
                option_text=str(option_text),
                points_earned=points_earned,
                order_index=idx
            )
            db.add(db_answer)

    # Проверка условий получения статуса
    project = projects_crud.get_project(db, db_playthrough.project_id)
    reward_status = None

    if project and project.reward_status_id and total_points >= project.min_points:
        status = db.query(Status).filter(Status.id == project.reward_status_id).first()
        if status:
            existing = db.query(UserStatus).filter(
                UserStatus.user_id == db_playthrough.user_id,
                UserStatus.status_id == status.id
            ).first()

            if not existing:
                user_status = UserStatus(
                    user_id=db_playthrough.user_id,
                    status_id=status.id,
                    playthrough_id=playthrough_id
                )
                db.add(user_status)
                reward_status = status.name
                logger.info(f"Статус '{status.name}' выдан пользователю {db_playthrough.user_id}")
            else:
                reward_status = f"{status.name} (уже имеется)"
                logger.info(f"Статус '{status.name}' уже был у пользователя {db_playthrough.user_id}")

    db.commit()
    logger.info(f"Прохождение завершено: id={playthrough_id}, награда={reward_status}")
    return reward_status


def add_answer(db: Session, playthrough_id: int, answer_data: dict) -> models.PlaythroughAnswer:
    """Добавляет отдельный ответ в прохождение."""
    answer = models.PlaythroughAnswer(
        playthrough_id=playthrough_id,
        scene_id=answer_data.get('scene_id'),
        node_id=answer_data.get('node_id'),
        option_id=answer_data.get('option_id'),
        option_text=answer_data.get('text', ''),
        points_earned=answer_data.get('points', 0),
        order_index=answer_data.get('order_index', 0)
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


def get_playthrough_answers(db: Session, playthrough_id: int) -> List[models.PlaythroughAnswer]:
    """Возвращает все ответы прохождения, отсортированные по порядку."""
    answers = db.query(models.PlaythroughAnswer).filter(
        models.PlaythroughAnswer.playthrough_id == playthrough_id
    ).order_by(models.PlaythroughAnswer.order_index).all()
    logger.debug(f"Ответы прохождения id={playthrough_id}: найдено {len(answers)}")
    return answers