"""
CRUD операции для работы с пользователями.
Содержит бизнес-логику для управления пользователями, аутентификации и авторизации.
"""
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from dotenv import load_dotenv

from src.users import models, schemas
from src.users.exceptions import (
    UserNotFoundError, UserAuthenticationError, UserPermissionError,
    UserValidationError, EmailAlreadyExistsError, CannotDeleteYourselfError,
    CannotChangeSuperAdminError, InvalidRoleError
)
from src.logger import setup_logger

load_dotenv()

# Настройка логгера для модуля пользователей
logger = setup_logger(__name__, 'users.log')

# Конфигурация безопасности
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

logger.info(f"Users module initialized (token_expiry={ACCESS_TOKEN_EXPIRE_MINUTES}min)")


def get_password_hash(password: str) -> str:
    """
    Хеширует пароль с использованием sha256_crypt.
    
    Args:
        password: Пароль в открытом виде
        
    Returns:
        str: Хешированный пароль
        
    Raises:
        UserValidationError: Если пароль пустой
    """
    if not password:
        logger.error("Attempt to hash empty password")
        raise UserValidationError("Password cannot be empty")
    
    logger.debug("Hashing password")
    hashed = pwd_context.hash(password)
    logger.debug(f"Password hashed (length: {len(hashed)})")
    return hashed


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет соответствие пароля его хешу.
    
    Args:
        plain_password: Пароль в открытом виде
        hashed_password: Хешированный пароль
        
    Returns:
        bool: True если пароль верный
    """
    if not plain_password or not hashed_password:
        logger.debug("Empty password or hash in verification")
        return False
    
    result = pwd_context.verify(plain_password, hashed_password)
    
    if result:
        logger.debug("Password verification: SUCCESS")
    else:
        logger.debug("Password verification: FAILED")
    
    return result


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Создает JWT токен доступа.
    
    Args:
        data: Данные для включения в токен (должен содержать 'user_id')
        expires_delta: Срок действия токена (по умолчанию из конфига)
        
    Returns:
        str: Закодированный JWT токен
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    logger.debug(
        f"Creating access token for user_id={data.get('user_id')}, "
        f"expires at {expire.isoformat()}"
    )
    
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"Token created (length: {len(token)})")
    
    return token


def decode_access_token(token: str) -> Optional[dict]:
    """
    Декодирует и проверяет JWT токен.
    
    Args:
        token: JWT токен
        
    Returns:
        Optional[dict]: Данные токена или None если токен невалидный
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.debug(f"Token decoded successfully: user_id={payload.get('user_id')}")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except JWTError as e:
        logger.warning(f"Invalid token: {str(e)}")
        return None


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """
    Ищет пользователя по email.
    
    Args:
        db: Сессия БД
        email: Email пользователя
        
    Returns:
        Optional[models.User]: Найденный пользователь или None
    """
    if not email:
        logger.debug("Empty email provided for user lookup")
        return None
    
    logger.debug(f"Looking up user by email: {email}")
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if user:
        logger.debug(f"User found: id={user.id}, role={user.role}")
    else:
        logger.debug(f"User not found: {email}")
    
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    """
    Ищет пользователя по ID.
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        
    Returns:
        Optional[models.User]: Найденный пользователь или None
    """
    if not user_id:
        logger.debug("Empty user_id provided for lookup")
        return None
    
    logger.debug(f"Looking up user by id: {user_id}")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if user:
        logger.debug(f"User found: email={user.email}, role={user.role}")
    else:
        logger.debug(f"User not found: id={user_id}")
    
    return user


def get_all_users(db: Session) -> List[models.User]:
    """
    Возвращает всех пользователей, отсортированных по дате создания.
    
    Args:
        db: Сессия БД
        
    Returns:
        List[models.User]: Список всех пользователей
    """
    logger.debug("Fetching all users")
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    logger.info(f"Retrieved {len(users)} users")
    return users


def get_all_groups(db: Session) -> List[models.Group]:
    """
    Возвращает все группы.
    
    Args:
        db: Сессия БД
        
    Returns:
        List[models.Group]: Список групп
    """
    logger.debug("Fetching all groups")
    groups = db.query(models.Group).order_by(models.Group.name).all()
    logger.info(f"Retrieved {len(groups)} groups")
    return groups


def get_group_by_id(db: Session, group_id: int) -> Optional[models.Group]:
    """
    Ищет группу по ID.
    
    Args:
        db: Сессия БД
        group_id: ID группы
        
    Returns:
        Optional[models.Group]: Найденная группа или None
    """
    if not group_id:
        return None
    
    logger.debug(f"Looking up group by id: {group_id}")
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    
    if group:
        logger.debug(f"Group found: {group.name}")
    else:
        logger.debug(f"Group not found: id={group_id}")
    
    return group


def create_user(db: Session, user_data: schemas.UserCreate) -> models.User:
    """
    Создает нового пользователя с проверками валидации.
    
    Args:
        db: Сессия БД
        user_data: Данные для создания пользователя
        
    Returns:
        models.User: Созданный пользователь
        
    Raises:
        EmailAlreadyExistsError: Если email уже используется
        UserValidationError: Если данные невалидны
        InvalidRoleError: Если роль невалидна
    """
    logger.info(
        f"Creating user: {user_data.email} "
        f"(role={user_data.role}, group={user_data.group_id})"
    )
    
    # Валидация
    if not user_data.email or not user_data.password:
        logger.error("Missing required fields (email or password)")
        raise UserValidationError("Email and password are required")
    
    existing = get_user_by_email(db, user_data.email)
    if existing:
        logger.warning(f"User already exists: {user_data.email}")
        raise EmailAlreadyExistsError()
    
    if len(user_data.password) < 4:
        logger.warning(f"Password too short for user: {user_data.email}")
        raise UserValidationError("Password must be at least 4 characters")
    
    if user_data.role not in ["student", "teacher", "admin", "super_admin"]:
        logger.error(f"Invalid role: {user_data.role}")
        raise InvalidRoleError()
    
    # Создание пользователя
    hashed_password = get_password_hash(user_data.password)
    
    db_user = models.User(
        email=user_data.email,
        last_name=user_data.last_name,
        first_name=user_data.first_name,
        patronymic=user_data.patronymic or "",
        password=hashed_password,
        role=user_data.role,
        group_id=user_data.group_id if user_data.role == "student" else None
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"User created: id={db_user.id}, email={db_user.email}")
    
    # Назначение статуса "Стажёр" новому пользователю
    logger.debug("Assigning starter status 'Стажёр'")
    starter_status = db.query(models.Status).filter(models.Status.name == "Стажёр").first()
    
    if not starter_status:
        logger.info("Creating starter status 'Стажёр'")
        starter_status = models.Status(name="Стажёр")
        db.add(starter_status)
        db.commit()
        db.refresh(starter_status)
        logger.info(f"Starter status created: id={starter_status.id}")
    
    existing_status = db.query(models.UserStatus).filter(
        models.UserStatus.user_id == db_user.id,
        models.UserStatus.status_id == starter_status.id
    ).first()
    
    if not existing_status:
        user_status = models.UserStatus(
            user_id=db_user.id,
            status_id=starter_status.id,
            playthrough_id=None
        )
        db.add(user_status)
        db.commit()
        logger.debug(f"Starter status assigned to user {db_user.id}")
    
    return db_user


def update_user(db: Session, user_id: int, user_update: dict) -> Optional[models.User]:
    """
    Обновляет данные пользователя.
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        user_update: Словарь с полями для обновления
        
    Returns:
        Optional[models.User]: Обновленный пользователь
        
    Raises:
        UserNotFoundError: Если пользователь не найден
        EmailAlreadyExistsError: Если новый email занят
    """
    logger.info(f"Updating user: id={user_id}, fields={list(user_update.keys())}")
    
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        logger.error(f"User not found for update: id={user_id}")
        raise UserNotFoundError()
    
    if 'email' in user_update and user_update['email'] != db_user.email:
        logger.debug(f"Email change requested: {db_user.email} -> {user_update['email']}")
        existing = get_user_by_email(db, user_update['email'])
        if existing and existing.id != user_id:
            logger.warning(f"Email already taken: {user_update['email']}")
            raise EmailAlreadyExistsError()
    
    for field, value in user_update.items():
        if field == 'password':
            if not value or len(str(value)) < 4:
                logger.warning("Attempt to set short password")
                raise UserValidationError("Password must be at least 4 characters")
            logger.debug("Updating password")
            db_user.password = get_password_hash(str(value))
        elif hasattr(db_user, field):
            old_value = getattr(db_user, field)
            setattr(db_user, field, value)
            logger.debug(f"Field updated: {field}: {old_value} -> {value}")
    
    db_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"User updated successfully: id={user_id}")
    return db_user


def update_user_role(db: Session, user_id: int, new_role: str) -> Optional[models.User]:
    """
    Изменяет роль пользователя.
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        new_role: Новая роль
        
    Returns:
        Optional[models.User]: Обновленный пользователь
        
    Raises:
        UserNotFoundError: Если пользователь не найден
        CannotChangeSuperAdminError: Если пытаются изменить супер-админа
        InvalidRoleError: Если роль невалидна
    """
    logger.info(f"Changing role for user {user_id}: -> {new_role}")
    
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()
    
    if db_user.role == "super_admin":
        logger.warning(f"Attempt to change super_admin role: user={user_id}")
        raise CannotChangeSuperAdminError()
    
    if new_role not in ["admin", "teacher", "student"]:
        logger.error(f"Invalid role: {new_role}")
        raise InvalidRoleError()
    
    old_role = db_user.role
    db_user.role = new_role
    
    if new_role != "student":
        db_user.group_id = None
        logger.debug("Group cleared (not a student)")
    
    db_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"Role changed: user={user_id}, {old_role} -> {new_role}")
    return db_user


def update_user_password(db: Session, user_id: int, new_password: str) -> Optional[models.User]:
    """
    Изменяет пароль пользователя.
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        new_password: Новый пароль
        
    Returns:
        Optional[models.User]: Обновленный пользователь
        
    Raises:
        UserValidationError: Если пароль слишком короткий
        UserNotFoundError: Если пользователь не найден
    """
    logger.info(f"Password change for user {user_id}")
    
    if not new_password or len(new_password) < 4:
        logger.warning(f"Password too short: user={user_id}")
        raise UserValidationError("Password must be at least 4 characters")
    
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()
    
    db_user.password = get_password_hash(new_password)
    db_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"Password changed: user={user_id}")
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    """
    Аутентифицирует пользователя по email и паролю.
    
    Args:
        db: Сессия БД
        email: Email пользователя
        password: Пароль
        
    Returns:
        Optional[models.User]: Пользователь или None при неудаче
    """
    logger.info(f"Authentication attempt: {email}")
    
    if not email or not password:
        logger.warning("Empty email or password for authentication")
        return None
    
    user = get_user_by_email(db, email)
    if not user:
        logger.warning(f"User not found: {email}")
        return None
    
    if verify_password(password, user.password):
        logger.info(f"Authentication successful: {email} (role={user.role})")
        return user
    
    logger.warning(f"Authentication failed (wrong password): {email}")
    return None


def delete_user(db: Session, user_id: int) -> bool:
    """
    Удаляет пользователя.
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        
    Returns:
        bool: True если удален
        
    Raises:
        UserNotFoundError: Если пользователь не найден
        UserPermissionError: Если пытаются удалить супер-админа
    """
    logger.info(f"Deleting user: id={user_id}")
    
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()
    
    if db_user.role == "super_admin":
        logger.error(f"Attempt to delete super_admin: id={user_id}")
        raise UserPermissionError("Cannot delete super admin")
    
    email = db_user.email
    db.delete(db_user)
    db.commit()
    
    logger.info(f"User deleted: id={user_id}, email={email}")
    return True


def create_group(db: Session, name: str, description: str = "") -> models.Group:
    """
    Создает новую группу.
    
    Args:
        db: Сессия БД
        name: Название группы
        description: Описание группы
        
    Returns:
        models.Group: Созданная группа
        
    Raises:
        UserValidationError: Если группа с таким именем уже существует
    """
    logger.info(f"Creating group: {name}")
    
    if not name or not name.strip():
        raise UserValidationError("Group name is required")
    
    existing = db.query(models.Group).filter(models.Group.name == name.strip()).first()
    if existing:
        logger.warning(f"Group already exists: {name}")
        raise UserValidationError("Group with this name already exists")
    
    group = models.Group(name=name.strip(), description=description)
    db.add(group)
    db.commit()
    db.refresh(group)
    
    logger.info(f"Group created: id={group.id}, name={group.name}")
    return group


def update_group(db: Session, group_id: int, name: str, description: str) -> Optional[models.Group]:
    """Обновляет группу."""
    logger.info(f"Updating group: id={group_id}")
    
    group = get_group_by_id(db, group_id)
    if not group:
        raise UserNotFoundError("Group not found")
    
    if name and name.strip():
        existing = db.query(models.Group).filter(
            models.Group.name == name.strip(),
            models.Group.id != group_id
        ).first()
        if existing:
            raise UserValidationError("Group with this name already exists")
        group.name = name.strip()
    
    group.description = description or ""
    db.commit()
    db.refresh(group)
    
    logger.info(f"Group updated: id={group_id}")
    return group


def delete_group(db: Session, group_id: int) -> bool:
    """Удаляет группу."""
    logger.info(f"Deleting group: id={group_id}")
    
    group = get_group_by_id(db, group_id)
    if not group:
        raise UserNotFoundError("Group not found")
    
    db.delete(group)
    db.commit()
    
    logger.info(f"Group deleted: id={group_id}")
    return True


def get_super_admin(db: Session) -> Optional[models.User]:
    """Возвращает супер-админа."""
    return db.query(models.User).filter(models.User.role == "super_admin").first()


def is_super_admin_exists(db: Session) -> bool:
    """Проверяет существование супер-админа."""
    exists = db.query(models.User).filter(models.User.role == "super_admin").first() is not None
    logger.debug(f"Super admin exists: {exists}")
    return exists


def get_user_statuses(db: Session, user_id: int) -> List[dict]:
    """
    Возвращает статусы пользователя с информацией о проектах.
    
    Args:
        db: Сессия БД
        user_id: ID пользователя
        
    Returns:
        List[dict]: Список статусов с дополнительной информацией
    """
    logger.info(f"Fetching statuses for user {user_id}")
    
    statuses = db.query(models.UserStatus).filter(
        models.UserStatus.user_id == user_id
    ).order_by(models.UserStatus.earned_at.desc()).all()
    
    result = []
    for us in statuses:
        status = db.query(models.Status).filter(models.Status.id == us.status_id).first()
        if status:
            project_title = None
            if us.playthrough_id:
                from src.playthroughs.models import Playthrough
                from src.projects.models import Project
                
                playthrough = db.query(Playthrough).filter(
                    Playthrough.id == us.playthrough_id
                ).first()
                
                if playthrough:
                    project = db.query(Project).filter(
                        Project.id == playthrough.project_id
                    ).first()
                    if project:
                        project_title = project.title
            
            result.append({
                "name": status.name,
                "earned_at": us.earned_at,
                "playthrough_id": us.playthrough_id,
                "project_title": project_title
            })
    
    logger.info(f"Found {len(result)} statuses for user {user_id}")
    return result