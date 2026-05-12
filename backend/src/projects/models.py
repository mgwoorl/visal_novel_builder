"""
Модели SQLAlchemy для модуля проектов.
Таблицы: projects, project_required_statuses, project_groups.
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class ProjectRequiredStatus(BaseDBModel):
    """
    Таблица связи проектов и требуемых статусов.
    Определяет какие статусы нужны студенту для доступа к проекту.
    """
    __tablename__ = "project_required_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    status_id = Column(Integer, ForeignKey("statuses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    project = relationship("Project", back_populates="required_statuses")
    status = relationship("Status")


class ProjectGroup(BaseDBModel):
    """
    Таблица связи проектов и групп.
    Определяет каким группам доступен проект.
    """
    __tablename__ = "project_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    project = relationship("Project", back_populates="group_links")
    group = relationship("Group", back_populates="project_links")


class Project(BaseDBModel):
    """
    Таблица проектов (визуальных новелл).
    Создаются преподавателями, проходятся студентами.
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    cover_url = Column(String(500), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_published = Column(Boolean, default=False)
    min_points = Column(Integer, default=0)
    reward_status_id = Column(Integer, ForeignKey("statuses.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    owner = relationship("User", back_populates="projects")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")
    required_statuses = relationship(
        "ProjectRequiredStatus",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    reward_status = relationship("Status", foreign_keys=[reward_status_id])
    group_links = relationship(
        "ProjectGroup",
        back_populates="project",
        cascade="all, delete-orphan"
    )

    @property
    def groups(self):
        """Возвращает список групп, связанных с проектом."""
        return [link.group for link in self.group_links]