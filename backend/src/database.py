"""
Настройка подключения к базе данных MySQL через синхронный драйвер pymysql.
"""
import pymysql
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

from src.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__, 'database.log')

# URL подключения
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:password@localhost:3306/visual_novel_db"
)

logger.info("Инициализация синхронного подключения к MySQL")

# Создаем синхронный движок с минимальными настройками
engine = create_engine(
    DATABASE_URL,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
BaseDBModel = Base

def get_db():
    """Генератор синхронных сессий БД."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Создает таблицы если их нет."""
    try:
        from src.users.models import User, Group, Status, UserStatus
        from src.projects.models import Project, ProjectRequiredStatus, ProjectGroup
        from src.scenes.models import Scene, SceneNode, NodeOption, SceneEdge
        from src.playthroughs.models import Playthrough, PlaythroughAnswer
        
        BaseDBModel.metadata.create_all(bind=engine)
        logger.info("Таблицы БД созданы успешно")
    except Exception as e:
        logger.error(f"Ошибка создания таблиц: {str(e)}", exc_info=True)
        raise