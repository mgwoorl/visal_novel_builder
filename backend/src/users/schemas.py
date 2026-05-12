"""
Pydantic схемы для валидации данных модуля пользователей.
Используются для валидации входящих запросов и форматирования ответов.
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    """Схема для создания нового пользователя."""
    email: EmailStr
    last_name: str
    first_name: str
    patronymic: Optional[str] = ""
    password: str
    role: str = "student"
    group_id: Optional[int] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        """Проверяет что роль входит в список допустимых."""
        allowed = ['student', 'teacher', 'admin', 'super_admin']
        if v not in allowed:
            raise ValueError(f'Роль должна быть одной из: {allowed}')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Проверяет минимальную длину пароля."""
        if len(v) < 4:
            raise ValueError('Пароль должен быть не менее 4 символов')
        return v


class UserLogin(BaseModel):
    """Схема для входа пользователя в систему."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Схема для ответа с данными пользователя (без пароля)."""
    id: int
    email: str
    last_name: str
    first_name: str
    patronymic: Optional[str] = ""
    role: str
    group_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Схема для ответа при входе в систему."""
    success: bool
    user: Optional[UserResponse] = None
    access_token: Optional[str] = None
    message: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Схема для смены пароля (требует старый пароль)."""
    old_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    """Схема для сброса пароля администратором."""
    new_password: str


class GroupCreate(BaseModel):
    """Схема для создания новой группы."""
    name: str
    description: Optional[str] = ""


class GroupUpdate(BaseModel):
    """Схема для обновления данных группы."""
    name: Optional[str] = None
    description: Optional[str] = None


class GroupResponse(BaseModel):
    """Схема для ответа с данными группы."""
    id: int
    name: str
    description: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True