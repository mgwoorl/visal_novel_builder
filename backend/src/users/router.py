"""
Маршруты для работы с пользователями.
Включает аутентификацию, управление профилем, администрирование пользователей и групп.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from src.database import get_db
from src.users import crud, schemas
from src.logger import setup_logger

router = APIRouter(prefix="/users", tags=["users"])

# Инициализация логгера для роутера пользователей
logger = setup_logger(__name__, 'users_router.log')


async def get_current_user_from_token(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Извлекает текущего пользователя из JWT токена.
    Используется как зависимость для защищенных endpoints.
    
    Args:
        authorization: Заголовок Authorization с Bearer токеном
        db: Сессия БД
        
    Returns:
        models.User: Текущий пользователь
        
    Raises:
        HTTPException 401: Если токен отсутствует или невалидный
    """
    if not authorization:
        logger.warning("Попытка доступа без токена")
        raise HTTPException(status_code=401, detail="Требуется токен авторизации")

    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer':
        logger.warning(f"Неверная схема авторизации: {scheme}")
        raise HTTPException(status_code=401, detail="Неверная схема авторизации")

    payload = crud.decode_access_token(token)
    if not payload:
        logger.warning("Токен невалидный или истек")
        raise HTTPException(status_code=401, detail="Токен невалидный или истек")

    user_id = payload.get("user_id")
    if not user_id:
        logger.warning("В токене отсутствует user_id")
        raise HTTPException(status_code=401, detail="Невалидный токен")

    user = crud.get_user_by_id(db, user_id)
    if not user:
        logger.warning(f"Пользователь из токена не найден: id={user_id}")
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    return user


def require_role(roles: list):
    """
    Создает зависимость для проверки роли пользователя.
    
    Args:
        roles: Список допустимых ролей
        
    Returns:
        Callable: Функция-зависимость для FastAPI
    """
    async def role_checker(current_user = Depends(get_current_user_from_token)):
        if current_user.role not in roles:
            logger.warning(
                f"Доступ запрещен: {current_user.email} (роль: {current_user.role}), "
                f"требуются роли: {roles}"
            )
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return current_user
    return role_checker


@router.post("/login", response_model=schemas.LoginResponse)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Аутентификация пользователя по email и паролю.
    При успехе возвращает JWT токен и данные пользователя.
    """
    logger.info(f"Попытка входа: {login_data.email}")

    if not login_data.email or not login_data.password:
        return schemas.LoginResponse(
            success=False,
            message="Email и пароль обязательны"
        )

    user = crud.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        return schemas.LoginResponse(
            success=False,
            message="Неверный email или пароль"
        )

    # Создание JWT токена
    access_token = crud.create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "role": user.role
        }
    )

    logger.info(f"Успешный вход: {user.email} (роль: {user.role})")

    return schemas.LoginResponse(
        success=True,
        user=schemas.UserResponse.model_validate(user),
        access_token=access_token,
        message="Вход выполнен успешно"
    )


@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user(current_user=Depends(get_current_user_from_token)):
    """Возвращает данные текущего авторизованного пользователя."""
    logger.debug(f"Запрос профиля: {current_user.email}")
    return current_user


@router.get("/{user_id}", response_model=schemas.UserResponse)
async def get_user_by_id(
    user_id: int,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает данные пользователя по ID."""
    logger.debug(f"Запрос пользователя по id: {user_id}")
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return schemas.UserResponse.model_validate(user)


@router.get("/me/statuses")
async def get_user_statuses(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает статусы текущего пользователя."""
    logger.info(f"Запрос статусов пользователя: {current_user.email}")
    statuses = crud.get_user_statuses(db, current_user.id)
    return statuses


@router.post("/change-password")
async def change_password(
    request: schemas.ChangePasswordRequest,
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Изменяет пароль текущего пользователя (требует старый пароль)."""
    logger.info(f"Смена пароля для пользователя: {current_user.email}")

    if not request.old_password or not request.new_password:
        raise HTTPException(status_code=400, detail="Старый и новый пароли обязательны")

    if not crud.verify_password(request.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Неверный старый пароль")

    if len(request.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 4 символов")

    crud.update_user_password(db, current_user.id, request.new_password)
    return {"message": "Пароль успешно изменен"}


@router.get("/groups", response_model=List[schemas.GroupResponse])
async def get_groups(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Возвращает список всех групп."""
    logger.debug("Запрос списка групп")
    groups = crud.get_all_groups(db)
    return [schemas.GroupResponse.model_validate(g) for g in groups]


@router.post("/groups", response_model=schemas.GroupResponse)
async def create_group(
    group_data: schemas.GroupCreate,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Создает новую группу (только для админов и супер-админов)."""
    logger.info(f"Создание группы: {group_data.name}")

    if not group_data.name or not group_data.name.strip():
        raise HTTPException(status_code=400, detail="Название группы обязательно")

    existing = db.query(crud.models.Group).filter(
        crud.models.Group.name == group_data.name.strip()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Группа с таким названием уже существует")

    group = crud.create_group(db, group_data.name.strip(), group_data.description or "")
    return schemas.GroupResponse.model_validate(group)


@router.put("/groups/{group_id}", response_model=schemas.GroupResponse)
async def update_group(
    group_id: int,
    group_data: schemas.GroupUpdate,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Обновляет данные группы (только для админов)."""
    logger.info(f"Обновление группы: id={group_id}")

    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    name = group_data.name.strip() if group_data.name else group.name
    description = group_data.description if group_data.description is not None else group.description or ""

    updated = crud.update_group(db, group_id, name, description)
    return schemas.GroupResponse.model_validate(updated)


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Удаляет группу (только для админов)."""
    logger.info(f"Удаление группы: id={group_id}")

    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    crud.delete_group(db, group_id)
    return {"message": "Группа удалена"}


@router.get("/admin/users", response_model=List[schemas.UserResponse])
async def get_all_users(
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Возвращает список всех пользователей (только для админов)."""
    logger.info(f"Запрос всех пользователей от: {current_user.email}")
    users = crud.get_all_users(db)
    return [schemas.UserResponse.model_validate(u) for u in users]


@router.post("/admin/users", response_model=schemas.UserResponse)
async def create_user_by_admin(
    user_data: schemas.UserCreate,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Создает нового пользователя через админ-панель."""
    logger.info(f"Создание пользователя админом: {user_data.email}")

    if user_data.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Только супер-админ может создавать супер-админов")

    try:
        new_user = crud.create_user(db, user_data)
        return schemas.UserResponse.model_validate(new_user)
    except Exception as e:
        logger.error(f"Ошибка создания пользователя: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/users/{user_id}")
async def update_user(
    user_id: int,
    user_update: dict,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Обновляет данные пользователя через админ-панель."""
    logger.info(f"Обновление пользователя админом: id={user_id}")

    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if target_user.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя изменить супер-админа")

    if 'role' in user_update and user_update['role'] != 'student':
        user_update['group_id'] = None

    try:
        updated = crud.update_user(db, user_id, user_update)
        return schemas.UserResponse.model_validate(updated)
    except Exception as e:
        logger.error(f"Ошибка обновления пользователя: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    new_role: str,
    current_user=Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """Изменяет роль пользователя (только для супер-админа)."""
    logger.info(f"Изменение роли пользователя {user_id} на {new_role}")

    try:
        crud.update_user_role(db, user_id, new_role)
        return {"message": f"Роль изменена на {new_role}"}
    except Exception as e:
        logger.error(f"Ошибка изменения роли: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Удаляет пользователя (только для админов)."""
    logger.info(f"Удаление пользователя админом: id={user_id}")

    if current_user.id == user_id:
        raise HTTPException(status_code=403, detail="Нельзя удалить самого себя")

    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if target_user.role == "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя удалить супер-админа")

    if current_user.role == "admin" and target_user.role == "admin":
        raise HTTPException(status_code=403, detail="Админ не может удалить другого админа")

    crud.delete_user(db, user_id)
    return {"message": "Пользователь удален"}


@router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    request: schemas.ResetPasswordRequest,
    current_user=Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Сбрасывает пароль пользователя (только для админов)."""
    logger.info(f"Сброс пароля для пользователя: id={user_id}")

    if not request.new_password or len(request.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 4 символов")

    target_user = crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    crud.update_user_password(db, user_id, request.new_password)
    return {"message": "Пароль успешно сброшен"}


@router.get("/student/profile")
async def get_student_profile(
    current_user=Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Возвращает профиль студента с информацией о прохождениях.
    Включает завершенные и активные прохождения, полученные статусы.
    """
    logger.info(f"Запрос профиля студента: {current_user.email}")

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только для студентов")

    from src.playthroughs.models import Playthrough
    from src.projects.models import Project

    # Информация о группе
    group_name = None
    if current_user.group_id:
        group = db.query(crud.models.Group).filter(
            crud.models.Group.id == current_user.group_id
        ).first()
        if group:
            group_name = group.name

    # Все прохождения пользователя
    playthroughs = db.query(Playthrough).filter(
        Playthrough.user_id == current_user.id
    ).all()

    # Статистика по проектам
    project_stats = {}
    for p in playthroughs:
        if p.project_id not in project_stats:
            project = db.query(Project).filter(Project.id == p.project_id).first()
            if project:
                project_stats[p.project_id] = {
                    "project_id": p.project_id,
                    "project_title": project.title,
                    "attempts": 0,
                    "best_points": 0,
                    "completed_attempts": 0,
                    "has_active": False,
                    "active_playthrough_id": None
                }
            else:
                continue

        stats = project_stats[p.project_id]
        stats["attempts"] += 1

        if p.is_completed:
            stats["completed_attempts"] += 1
            if p.total_points > stats["best_points"]:
                stats["best_points"] = p.total_points
        else:
            stats["has_active"] = True
            stats["active_playthrough_id"] = p.id

    completed_projects = []
    active_projects = []

    for stats in project_stats.values():
        if stats["completed_attempts"] > 0:
            completed_projects.append(stats)
        if stats["has_active"]:
            active_projects.append(stats)

    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "last_name": current_user.last_name,
            "first_name": current_user.first_name,
            "patronymic": current_user.patronymic or "",
            "group_name": group_name,
            "created_at": current_user.created_at
        },
        "completed_projects": completed_projects,
        "active_projects": active_projects
    }