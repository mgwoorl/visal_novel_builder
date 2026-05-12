"""
Маршруты для работы с проектами.
Включает CRUD операции, загрузку файлов, управление статусами и группами,
получение аналитики.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
import uuid
import shutil
import json
from pathlib import Path
from typing import Optional, List

from src.database import get_db
from src.users.router import get_current_user_from_token
from src.users import crud as users_crud
from src.projects import crud as projects_crud
from src.projects import schemas
from src.scenes import crud as scenes_crud
from src.logger import setup_logger

router = APIRouter(prefix="/projects", tags=["projects"])

# Инициализация логгера
logger = setup_logger(__name__, 'projects_router.log')

UPLOAD_DIR = Path("./uploads/projects")


def get_files_in_directory(directory: Path) -> list:
    """
    Сканирует директорию и возвращает список файлов с метаданными.
    Определяет тип файла по расширению (image, video, audio).
    """
    if not directory.exists():
        return []

    files = []
    video_extensions = ['.mp4', '.webm', '.ogg', '.mov']
    audio_extensions = ['.mp3', '.wav', '.ogg', '.m4a']

    for file_path in directory.glob("*"):
        if file_path.is_file():
            ext = file_path.suffix.lower()
            file_type = "image"
            if ext in video_extensions:
                file_type = "video"
            elif ext in audio_extensions:
                file_type = "audio"

            files.append({
                "id": str(uuid.uuid4()),
                "name": file_path.name,
                "url": f"/uploads/projects/{directory.parent.name}/{directory.name}/{file_path.name}",
                "type": file_type,
                "size": file_path.stat().st_size
            })
    return files


def get_project_dict(db: Session, project) -> dict:
    """Формирует словарь с полными данными проекта."""
    scenes = scenes_crud.get_project_scenes(db, project.id)

    # Получение имен требуемых статусов
    required_names = []
    for rs in project.required_statuses:
        status = db.query(users_crud.models.Status).filter(
            users_crud.models.Status.id == rs.status_id
        ).first()
        if status:
            required_names.append(status.name)

    # Получение имени статуса-награды
    reward_status_name = None
    if project.reward_status_id:
        status = db.query(users_crud.models.Status).filter(
            users_crud.models.Status.id == project.reward_status_id
        ).first()
        if status:
            reward_status_name = status.name

    # Получение групп
    groups = projects_crud.get_project_groups(db, project.id)
    group_names = [g.name for g in groups]
    group_ids = [g.id for g in groups]

    return {
        'id': project.id,
        'title': project.title,
        'description': project.description,
        'cover_url': project.cover_url,
        'owner_id': project.owner_id,
        'is_published': project.is_published,
        'min_points': project.min_points,
        'reward_status': reward_status_name,
        'created_at': project.created_at,
        'updated_at': project.updated_at,
        'scenes_count': len(scenes),
        'required_statuses': required_names,
        'groups': group_names,
        'group_ids': group_ids,
        'scenes': [{
            'id': scene.id,
            'name': scene.name,
            'background_url': scene.background_url,
            'background_type': scene.background_type,
            'order_index': scene.order_index
        } for scene in scenes]
    }


@router.get("/")
def get_projects(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Возвращает проекты в зависимости от роли пользователя.
    Преподаватели видят свои проекты, студенты - доступные им опубликованные.
    """
    logger.debug(f"Запрос проектов от: {current_user.email} (роль: {current_user.role})")

    if current_user.role == "teacher":
        projects = projects_crud.get_projects_by_owner(db, current_user.id)
        return [get_project_dict(db, p) for p in projects]
    else:
        return projects_crud.get_available_projects_for_user(db, current_user.id)


@router.get("/my")
def get_my_projects(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает проекты текущего преподавателя."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только для преподавателей")

    logger.debug(f"Мои проекты: {current_user.email}")
    projects = projects_crud.get_projects_by_owner(db, current_user.id)
    return [get_project_dict(db, p) for p in projects]


@router.post("/")
def create_project(
    title: str = Form(...),
    description: str = Form(""),
    min_points: int = Form(0),
    reward_status: str = Form("Стажёр"),
    required_statuses: str = Form("[]"),
    group_ids: str = Form("[]"),
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Создает новый проект (только для преподавателей)."""
    logger.info(f"Создание проекта: '{title}' пользователем {current_user.email}")

    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только преподаватели могут создавать проекты")

    # Парсинг JSON строк в списки
    try:
        required_list = json.loads(required_statuses) if required_statuses else []
    except json.JSONDecodeError:
        required_list = []

    try:
        groups_list = json.loads(group_ids) if group_ids else []
        groups_list = [int(g) for g in groups_list]
    except (json.JSONDecodeError, ValueError):
        groups_list = []

    project_data = schemas.ProjectCreate(
        title=title,
        description=description,
        min_points=min_points,
        reward_status=reward_status,
        required_statuses=required_list,
        group_ids=groups_list
    )
    project = projects_crud.create_project(db, project_data, current_user.id)

    # Создание папок для ресурсов проекта
    project_dir = UPLOAD_DIR / str(project.id)
    for folder in ['backgrounds', 'sprites', 'music', 'covers']:
        (project_dir / folder).mkdir(parents=True, exist_ok=True)

    logger.info(f"Проект создан: id={project.id}")
    return get_project_dict(db, project)


@router.get("/{project_id}")
def get_project(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает детальную информацию о проекте."""
    logger.debug(f"Запрос проекта id={project_id} от {current_user.email}")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    # Проверка доступа
    if current_user.role == "student":
        available = projects_crud.get_available_projects_for_user(db, current_user.id)
        available_ids = [p['id'] for p in available]
        if project.id not in available_ids:
            raise HTTPException(status_code=403, detail="Проект недоступен")
    elif current_user.role == "teacher" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return get_project_dict(db, project)


@router.put("/{project_id}")
def update_project(
    project_id: int,
    project_data: schemas.ProjectUpdate,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Обновляет проект (только для владельца-преподавателя)."""
    logger.info(f"Обновление проекта id={project_id} пользователем {current_user.email}")

    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только преподаватели могут редактировать проекты")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Проверка публикации
    if project_data.is_published:
        scenes = scenes_crud.get_project_scenes(db, project_id)
        if not scenes or len(scenes) == 0:
            raise HTTPException(status_code=400, detail="Нельзя опубликовать проект без сцен")

    updated = projects_crud.update_project(db, project_id, project_data)
    return get_project_dict(db, updated)


@router.get("/{project_id}/files")
def get_project_files(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает список всех файлов проекта по категориям."""
    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    # Проверка доступа
    if current_user.role == "student":
        available = projects_crud.get_available_projects_for_user(db, current_user.id)
        available_ids = [p['id'] for p in available]
        if project.id not in available_ids:
            raise HTTPException(status_code=403, detail="Проект недоступен")
    elif project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return {
        "backgrounds": get_files_in_directory(UPLOAD_DIR / str(project_id) / "backgrounds"),
        "sprites": get_files_in_directory(UPLOAD_DIR / str(project_id) / "sprites"),
        "music": get_files_in_directory(UPLOAD_DIR / str(project_id) / "music"),
        "covers": get_files_in_directory(UPLOAD_DIR / str(project_id) / "covers")
    }


@router.post("/{project_id}/upload/{resource_type}")
async def upload_resource(
    project_id: int,
    resource_type: str,
    file: UploadFile = File(...),
    custom_name: Optional[str] = Form(None),
    replace: Optional[str] = Form("false"),
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Загружает файл ресурса в проект."""
    logger.info(f"Загрузка файла: проект={project_id}, тип={resource_type}, файл={file.filename}")

    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только преподаватели могут загружать файлы")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Допустимые типы файлов
    allowed_types = {
        'backgrounds': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov'],
        'sprites': ['.png', '.gif', '.webp', '.jpg', '.jpeg'],
        'music': ['.mp3', '.wav', '.ogg', '.m4a'],
        'covers': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    }

    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_types.get(resource_type, []):
        raise HTTPException(status_code=400, detail=f"Недопустимый тип файла. Разрешены: {allowed_types[resource_type]}")

    # Формирование имени файла
    if custom_name:
        filename = f"{custom_name}{ext}"
    else:
        filename = f"{uuid.uuid4()}{ext}"

    project_dir = UPLOAD_DIR / str(project_id) / resource_type
    project_dir.mkdir(parents=True, exist_ok=True)

    file_path = project_dir / filename

    # Обработка конфликта имен
    if file_path.exists():
        if replace == "true":
            file_path.unlink()
        else:
            counter = 1
            base_name = custom_name or Path(file.filename).stem
            while file_path.exists():
                new_filename = f"{base_name}_{counter}{ext}"
                file_path = project_dir / new_filename
                counter += 1
            filename = file_path.name

    # Сохранение файла
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Файл сохранен: {file_path}")
    except Exception as e:
        logger.error(f"Ошибка сохранения файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {str(e)}")

    # Определение типа файла
    video_extensions = ['.mp4', '.webm', '.ogg', '.mov']
    audio_extensions = ['.mp3', '.wav', '.m4a']
    file_type = "image"
    if ext in video_extensions:
        file_type = "video"
    elif ext in audio_extensions or resource_type == "music":
        file_type = "audio"

    return {
        "id": str(uuid.uuid4()),
        "name": filename,
        "url": f"/uploads/projects/{project_id}/{resource_type}/{filename}",
        "type": file_type,
        "size": file_path.stat().st_size
    }


@router.delete("/{project_id}/files/{resource_type}/{file_name}")
async def delete_resource(
    project_id: int,
    resource_type: str,
    file_name: str,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Удаляет файл ресурса из проекта."""
    logger.info(f"Удаление файла: проект={project_id}, тип={resource_type}, файл={file_name}")

    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только преподаватели могут удалять файлы")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    file_path = UPLOAD_DIR / str(project_id) / resource_type / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")

    try:
        file_path.unlink()
        logger.info(f"Файл удален: {file_path}")
        return {"message": "Файл удален"}
    except Exception as e:
        logger.error(f"Ошибка удаления файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка удаления файла: {str(e)}")


@router.put("/{project_id}/files/{resource_type}/{old_filename}")
async def rename_file(
    project_id: int,
    resource_type: str,
    old_filename: str,
    request: dict,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Переименовывает файл ресурса."""
    new_name = request.get('new_name')
    if not new_name:
        raise HTTPException(status_code=400, detail="Новое имя обязательно")

    logger.info(f"Переименование файла: {old_filename} → {new_name}")

    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только преподаватели могут переименовывать файлы")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    old_file_path = UPLOAD_DIR / str(project_id) / resource_type / old_filename
    if not old_file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")

    new_file_path = UPLOAD_DIR / str(project_id) / resource_type / new_name
    if new_file_path.exists():
        raise HTTPException(status_code=400, detail="Файл с таким именем уже существует")

    try:
        old_file_path.rename(new_file_path)

        # Обновление ссылок в сценах
        if resource_type in ['sprites', 'music']:
            scenes = scenes_crud.get_project_scenes(db, project_id)
            for scene in scenes:
                nodes = scenes_crud.get_nodes_by_scene(db, scene.id)
                for node in nodes:
                    updated = False
                    if resource_type == 'sprites' and node.sprite_file == old_filename:
                        node.sprite_file = new_name
                        updated = True
                    elif resource_type == 'music' and node.music_file == old_filename:
                        node.music_file = new_name
                        updated = True
                    if updated:
                        db.commit()

        logger.info(f"Файл переименован: {old_filename} → {new_name}")
        return {"message": "Файл переименован", "new_name": new_name}
    except Exception as e:
        logger.error(f"Ошибка переименования: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка переименования: {str(e)}")


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Удаляет проект вместе со всеми файлами."""
    logger.info(f"Удаление проекта id={project_id} пользователем {current_user.email}")

    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только преподаватели могут удалять проекты")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Удаление папки с файлами
    project_dir = UPLOAD_DIR / str(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir)

    projects_crud.delete_project(db, project_id)
    return {"message": "Проект удален"}


@router.get("/statuses/all")
def get_all_statuses(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает список всех статусов."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    statuses = projects_crud.get_all_statuses(db)
    return statuses


@router.post("/statuses/add")
def add_status(
    status_data: dict,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Добавляет новый статус."""
    status_name = status_data.get('name')
    if not status_name:
        raise HTTPException(status_code=400, detail="Название статуса обязательно")

    logger.info(f"Добавление статуса: {status_name}")

    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    status = db.query(users_crud.models.Status).filter(
        users_crud.models.Status.name == status_name
    ).first()

    if not status:
        status = users_crud.models.Status(name=status_name)
        db.add(status)
        db.commit()
        db.refresh(status)

    return {"id": status.id, "name": status.name, "description": status.description}


@router.get("/{project_id}/groups")
def get_project_groups(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает группы проекта."""
    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    groups = users_crud.get_project_groups(db, project_id)
    return [{"id": g.id, "name": g.name} for g in groups]


@router.put("/{project_id}/groups")
def update_project_groups(
    project_id: int,
    group_ids: List[int],
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Обновляет группы проекта."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    users_crud.update_project_groups(db, project_id, group_ids)
    return {"message": "Группы проекта обновлены"}


@router.get("/{project_id}/analytics")
def get_project_analytics(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает аналитику по проекту для преподавателя."""
    logger.info(f"Запрос аналитики проекта id={project_id}")

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return projects_crud.get_project_analytics(db, project_id)


@router.get("/{project_id}/student/{student_id}/playthroughs")
def get_student_playthroughs(
    project_id: int,
    student_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает все прохождения конкретного студента по проекту."""
    from src.playthroughs.models import Playthrough
    from src.users.models import User

    project = projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.owner_id != current_user.id and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")

    playthroughs = db.query(Playthrough).filter(
        Playthrough.project_id == project_id,
        Playthrough.user_id == student_id,
        Playthrough.is_completed == True
    ).order_by(Playthrough.completed_at.desc()).all()

    return [{
        "playthrough_id": p.id,
        "total_points": p.total_points,
        "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        "student_name": f"{student.last_name} {student.first_name}"
    } for p in playthroughs]