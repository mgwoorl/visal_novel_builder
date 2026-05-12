"""
Pydantic схемы для валидации данных модуля прохождений.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StartPlaythroughResponse(BaseModel):
    """Схема для ответа при начале прохождения."""
    success: bool
    playthrough_id: int
    message: str


class AnswerItem(BaseModel):
    """Схема для одного ответа в прохождении."""
    scene_id: int
    node_id: str
    option_id: str
    text: str
    points: int = 0


class CompletePlaythroughRequest(BaseModel):
    """Схема для запроса завершения прохождения."""
    total_points: int
    answers: List[AnswerItem]


class CompletePlaythroughResponse(BaseModel):
    """Схема для ответа при завершении прохождения."""
    success: bool
    reward_status: Optional[str] = None
    total_points: int
    message: str


class PlaythroughHistoryResponse(BaseModel):
    """Схема для ответа с историей прохождений."""
    id: int
    project_id: int
    project_title: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_points: int
    is_completed: bool


class CompletedProjectsResponse(BaseModel):
    """Схема для ответа с ID пройденных проектов."""
    completed_ids: List[int]


class PlaythroughAnswerResponse(BaseModel):
    """Схема для ответа с данными ответа прохождения."""
    id: int
    playthrough_id: int
    scene_id: int
    node_id: str
    option_id: str
    option_text: str
    points_earned: int
    order_index: int
    answered_at: datetime

    class Config:
        from_attributes = True