"""
CRUD операции для работы с проектами.
Содержит бизнес-логику создания, обновления, публикации проектов,
управления статусами, группами и аналитикой.
"""
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from src.projects import models, schemas
from src.users import crud as users_crud
from src.scenes import crud as scenes_crud
from src.users.models import Status, UserStatus, Group
from src.projects.exceptions import (
    ProjectNotFoundError, ProjectValidationError, StatusNotFoundError
)
from src.logger import setup_logger

# Инициализация логгера
logger = setup_logger(__name__, 'projects.log')


def get_project(db: Session, project_id: int) -> Optional[models.Project]:
    """Возвращает проект по ID."""
    if not project_id:
        return None
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    logger.debug(f"Поиск проекта по id: {project_id} → {'найден' if project else 'не найден'}")
    return project


def get_projects_by_owner(db: Session, owner_id: int) -> List[models.Project]:
    """Возвращает все проекты преподавателя."""
    if not owner_id:
        return []
    projects = db.query(models.Project).filter(models.Project.owner_id == owner_id).all()
    logger.debug(f"Проекты преподавателя id={owner_id}: найдено {len(projects)}")
    return projects


def get_published_projects(db: Session) -> List[models.Project]:
    """Возвращает все опубликованные проекты."""
    projects = db.query(models.Project).filter(models.Project.is_published == True).all()
    logger.debug(f"Опубликованные проекты: {len(projects)}")
    return projects


def get_available_projects_for_user(db: Session, user_id: int) -> List[dict]:
    """
    Возвращает проекты доступные для студента.
    Учитывает требуемые статусы и ограничения по группам.
    """
    logger.info(f"Получение доступных проектов для пользователя id={user_id}")

    user = users_crud.get_user_by_id(db, user_id)
    if not user:
        return []

    # Получаем статусы пользователя
    user_statuses = db.query(UserStatus).filter(UserStatus.user_id == user_id).all()
    user_status_ids = [us.status_id for us in user_statuses]
    user_group_id = user.group_id

    # Все опубликованные проекты
    all_published = db.query(models.Project).filter(
        models.Project.is_published == True
    ).all()

    available_projects = []

    for project in all_published:
        # Проверка требуемых статусов
        required_statuses = db.query(models.ProjectRequiredStatus).filter(
            models.ProjectRequiredStatus.project_id == project.id
        ).all()
        required_status_ids = [rs.status_id for rs in required_statuses]

        if required_status_ids:
            has_any_required = any(sid in user_status_ids for sid in required_status_ids)
            if not has_any_required:
                continue

        # Проверка ограничений по группам
        project_groups = db.query(models.ProjectGroup).filter(
            models.ProjectGroup.project_id == project.id
        ).all()

        if project_groups:
            project_group_ids = [pg.group_id for pg in project_groups]
            if user_group_id not in project_group_ids:
                continue

        # Информация о награде
        reward_status = None
        if project.reward_status_id:
            status = db.query(Status).filter(Status.id == project.reward_status_id).first()
            if status:
                reward_status = status.name

        # Список требуемых статусов (имена)
        required_names = []
        for rs in required_statuses:
            status = db.query(Status).filter(Status.id == rs.status_id).first()
            if status:
                required_names.append(status.name)

        # Список групп (имена)
        group_names = []
        for pg in project_groups:
            group = db.query(Group).filter(Group.id == pg.group_id).first()
            if group:
                group_names.append(group.name)

        # Сцены проекта
        scenes = scenes_crud.get_project_scenes(db, project.id)

        project_dict = {
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'cover_url': project.cover_url,
            'owner_id': project.owner_id,
            'is_published': project.is_published,
            'min_points': project.min_points,
            'reward_status': reward_status,
            'created_at': project.created_at,
            'updated_at': project.updated_at,
            'scenes_count': len(scenes),
            'scenes': [{
                'id': scene.id,
                'name': scene.name,
                'background_url': scene.background_url,
                'background_type': scene.background_type,
                'order_index': scene.order_index
            } for scene in scenes],
            'required_statuses': required_names,
            'groups': group_names
        }
        available_projects.append(project_dict)

    logger.info(f"Доступно проектов: {len(available_projects)} из {len(all_published)}")
    return available_projects


def create_project(db: Session, project_data: schemas.ProjectCreate, owner_id: int) -> models.Project:
    """
    Создает новый проект.
    
    Args:
        db: Сессия БД
        project_data: Данные проекта
        owner_id: ID создателя (преподавателя)
        
    Returns:
        models.Project: Созданный проект
    """
    logger.info(f"Создание проекта: '{project_data.title}' владельцем id={owner_id}")

    if not project_data.title:
        raise ProjectValidationError("Название проекта обязательно")

    # Обработка статуса-награды
    reward_status_id = None
    if project_data.reward_status:
        status = db.query(Status).filter(Status.name == project_data.reward_status).first()
        if not status:
            status = Status(name=project_data.reward_status)
            db.add(status)
            db.commit()
            db.refresh(status)
        reward_status_id = status.id

    db_project = models.Project(
        title=project_data.title,
        description=project_data.description,
        min_points=project_data.min_points,
        reward_status_id=reward_status_id,
        owner_id=owner_id,
        is_published=False
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Добавление требуемых статусов
    if project_data.required_statuses:
        for status_name in project_data.required_statuses:
            status = db.query(Status).filter(Status.name == status_name).first()
            if status:
                add_required_status(db, db_project.id, status_name)

    # Добавление групп
    if project_data.group_ids:
        for group_id in project_data.group_ids:
            group = db.query(Group).filter(Group.id == group_id).first()
            if group:
                add_project_group(db, db_project.id, group_id)

    logger.info(f"Проект создан: id={db_project.id}, title={db_project.title}")
    return db_project


def update_project(db: Session, project_id: int, project_update: schemas.ProjectUpdate) -> Optional[models.Project]:
    """Обновляет данные проекта."""
    logger.info(f"Обновление проекта: id={project_id}")

    db_project = get_project(db, project_id)
    if not db_project:
        raise ProjectNotFoundError()

    update_data = project_update.model_dump(exclude_unset=True)

    # Обработка статуса-награды
    if 'reward_status' in update_data and update_data['reward_status']:
        status = db.query(Status).filter(Status.name == update_data['reward_status']).first()
        if not status:
            status = Status(name=update_data['reward_status'])
            db.add(status)
            db.commit()
            db.refresh(status)
        db_project.reward_status_id = status.id

    # Обновление полей
    for field, value in update_data.items():
        if field in ['reward_status', 'required_statuses', 'group_ids']:
            continue
        if hasattr(db_project, field) and value is not None:
            setattr(db_project, field, value)

    # Обновление требуемых статусов
    if 'required_statuses' in update_data and update_data['required_statuses'] is not None:
        db.query(models.ProjectRequiredStatus).filter(
            models.ProjectRequiredStatus.project_id == project_id
        ).delete()
        for status_name in update_data['required_statuses']:
            status = db.query(Status).filter(Status.name == status_name).first()
            if status:
                add_required_status(db, project_id, status_name)

    # Обновление групп
    if 'group_ids' in update_data and update_data['group_ids'] is not None:
        db.query(models.ProjectGroup).filter(
            models.ProjectGroup.project_id == project_id
        ).delete()
        for group_id in update_data['group_ids']:
            group = db.query(Group).filter(Group.id == group_id).first()
            if group:
                add_project_group(db, project_id, group_id)

    db_project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_project)
    logger.info(f"Проект обновлен: id={project_id}")
    return db_project


def delete_project(db: Session, project_id: int) -> bool:
    """Удаляет проект."""
    logger.info(f"Удаление проекта: id={project_id}")

    db_project = get_project(db, project_id)
    if not db_project:
        raise ProjectNotFoundError()

    db.delete(db_project)
    db.commit()
    logger.info(f"Проект удален: id={project_id}")
    return True


def add_required_status(db: Session, project_id: int, status_name: str) -> Optional[models.ProjectRequiredStatus]:
    """Добавляет требуемый статус для доступа к проекту."""
    status = db.query(Status).filter(Status.name == status_name).first()
    if not status:
        status = Status(name=status_name)
        db.add(status)
        db.commit()
        db.refresh(status)

    existing = db.query(models.ProjectRequiredStatus).filter(
        models.ProjectRequiredStatus.project_id == project_id,
        models.ProjectRequiredStatus.status_id == status.id
    ).first()

    if existing:
        return existing

    required_status = models.ProjectRequiredStatus(project_id=project_id, status_id=status.id)
    db.add(required_status)
    db.commit()
    db.refresh(required_status)
    return required_status


def remove_required_status(db: Session, project_id: int, status_name: str) -> bool:
    """Удаляет требуемый статус."""
    status = db.query(Status).filter(Status.name == status_name).first()
    if not status:
        return False

    db.query(models.ProjectRequiredStatus).filter(
        models.ProjectRequiredStatus.project_id == project_id,
        models.ProjectRequiredStatus.status_id == status.id
    ).delete()
    db.commit()
    return True


def add_project_group(db: Session, project_id: int, group_id: int) -> Optional[models.ProjectGroup]:
    """Добавляет группу к проекту."""
    existing = db.query(models.ProjectGroup).filter(
        models.ProjectGroup.project_id == project_id,
        models.ProjectGroup.group_id == group_id
    ).first()

    if existing:
        return existing

    project_group = models.ProjectGroup(project_id=project_id, group_id=group_id)
    db.add(project_group)
    db.commit()
    db.refresh(project_group)
    return project_group


def remove_project_group(db: Session, project_id: int, group_id: int) -> bool:
    """Удаляет группу из проекта."""
    db.query(models.ProjectGroup).filter(
        models.ProjectGroup.project_id == project_id,
        models.ProjectGroup.group_id == group_id
    ).delete()
    db.commit()
    return True


def get_project_groups(db: Session, project_id: int) -> List:
    """Возвращает группы проекта."""
    group_links = db.query(models.ProjectGroup).filter(
        models.ProjectGroup.project_id == project_id
    ).all()

    groups = []
    for link in group_links:
        group = db.query(Group).filter(Group.id == link.group_id).first()
        if group:
            groups.append(group)

    return groups


def get_all_statuses(db: Session) -> List[dict]:
    """Возвращает все статусы."""
    statuses = db.query(Status).order_by(Status.name).all()
    return [{'id': s.id, 'name': s.name, 'description': s.description or ''} for s in statuses]


def get_project_analytics(db: Session, project_id: int) -> dict:
    """
    Возвращает аналитику по проекту: количество прохождений, студентов,
    средний балл, таблицу лидеров.
    """
    from src.playthroughs.models import Playthrough
    from src.users.models import User

    logger.info(f"Получение аналитики проекта: id={project_id}")

    scenes = scenes_crud.get_project_scenes(db, project_id)

    playthroughs = db.query(Playthrough).filter(
        Playthrough.project_id == project_id,
        Playthrough.is_completed == True
    ).all()

    if not playthroughs:
        return {
            "total_playthroughs": 0,
            "total_students": 0,
            "average_points": 0,
            "max_points": 0,
            "leaderboard": [],
            "students_list": [],
            "scenes_map": {}
        }

    # Группировка по студентам (лучшая попытка)
    student_playthroughs = {}
    for p in playthroughs:
        if p.user_id not in student_playthroughs:
            student_playthroughs[p.user_id] = []
        student_playthroughs[p.user_id].append(p)

    student_best = {}
    for uid, pts in student_playthroughs.items():
        best = max(pts, key=lambda p: p.total_points)
        student_best[uid] = best

    best_playthroughs = list(student_best.values())
    total_students = len(student_best)
    total_playthroughs = len(playthroughs)
    points_list = [p.total_points for p in best_playthroughs]
    average_points = sum(points_list) / len(points_list) if points_list else 0
    max_points = max(points_list) if points_list else 0

    # Таблица лидеров (топ-10)
    leaderboard = []
    sorted_best = sorted(best_playthroughs, key=lambda p: p.total_points, reverse=True)

    for rank, p in enumerate(sorted_best[:10], 1):
        user = db.query(User).filter(User.id == p.user_id).first()
        if user:
            leaderboard.append({
                "rank": rank,
                "student_name": f"{user.last_name} {user.first_name}",
                "student_email": user.email,
                "total_points": p.total_points,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
                "playthrough_id": p.id,
                "user_id": user.id,
                "attempts": len(student_playthroughs[p.user_id])
            })

    # Список всех студентов
    students_list = []
    for uid, best in student_best.items():
        user = db.query(User).filter(User.id == uid).first()
        if user:
            students_list.append({
                "user_id": user.id,
                "student_name": f"{user.last_name} {user.first_name}",
                "student_email": user.email,
                "best_points": best.total_points,
                "attempts": len(student_playthroughs[uid]),
                "last_playthrough_id": best.id,
                "last_completed_at": best.completed_at.isoformat() if best.completed_at else None
            })

    logger.info(f"Аналитика проекта {project_id}: {total_students} студентов, {total_playthroughs} прохождений")

    return {
        "total_playthroughs": total_playthroughs,
        "total_students": total_students,
        "average_points": round(average_points, 1),
        "max_points": max_points,
        "leaderboard": leaderboard,
        "students_list": students_list,
        "scenes_map": {}
    }