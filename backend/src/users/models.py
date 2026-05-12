"""
Модели SQLAlchemy для модуля пользователей.
Таблицы: users, groups, statuses, user_statuses.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class Status(BaseDBModel):
    """
    Таблица статусов, которые могут получить пользователи за прохождение проектов.
    """
    __tablename__ = "statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    required_in_projects = relationship(
        "ProjectRequiredStatus",
        back_populates="status",
        cascade="all, delete-orphan"
    )
    awarded_to_users = relationship(
        "UserStatus",
        back_populates="status",
        cascade="all, delete-orphan"
    )


class Group(BaseDBModel):
    """
    Таблица учебных групп для организации студентов.
    """
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    users = relationship("User", back_populates="group")
    project_links = relationship(
        "ProjectGroup",
        back_populates="group",
        cascade="all, delete-orphan"
    )


class User(BaseDBModel):
    """
    Таблица пользователей системы.
    Поддерживает роли: student, teacher, admin, super_admin.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    last_name = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=False)
    patronymic = Column(String(100), nullable=True)
    password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    group = relationship("Group", back_populates="users")
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    statuses = relationship("UserStatus", back_populates="user", cascade="all, delete-orphan")
    playthroughs = relationship("Playthrough", back_populates="user", cascade="all, delete-orphan")


class UserStatus(BaseDBModel):
    """
    Таблица связи пользователей и полученных ими статусов.
    Хранит информацию о том, за какое прохождение получен статус.
    """
    __tablename__ = "user_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status_id = Column(Integer, ForeignKey("statuses.id", ondelete="CASCADE"), nullable=False)
    playthrough_id = Column(
        Integer,
        ForeignKey("playthroughs.id", ondelete="SET NULL"),
        nullable=True
    )
    earned_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    user = relationship("User", back_populates="statuses")
    status = relationship("Status", back_populates="awarded_to_users")
    playthrough = relationship("Playthrough")