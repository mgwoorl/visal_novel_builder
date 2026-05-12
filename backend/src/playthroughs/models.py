"""
Модели SQLAlchemy для модуля прохождений.
Таблицы: playthroughs, playthrough_answers.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class Playthrough(BaseDBModel):
    """
    Таблица прохождений проектов пользователями.
    Хранит информацию о начале, завершении, баллах и прогрессе.
    """
    __tablename__ = "playthroughs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    total_points = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    user = relationship("User", back_populates="playthroughs")
    project = relationship("Project")
    answers = relationship(
        "PlaythroughAnswer",
        back_populates="playthrough",
        cascade="all, delete-orphan"
    )


class PlaythroughAnswer(BaseDBModel):
    """
    Таблица ответов пользователя в прохождении.
    Каждая запись соответствует одному выбору варианта ответа.
    """
    __tablename__ = "playthrough_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    playthrough_id = Column(Integer, ForeignKey("playthroughs.id", ondelete="CASCADE"), nullable=False)
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String(100), nullable=False)
    option_id = Column(String(100), nullable=False)
    option_text = Column(Text, nullable=False)
    points_earned = Column(Integer, default=0)
    order_index = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    playthrough = relationship("Playthrough", back_populates="answers")
    scene = relationship("Scene")