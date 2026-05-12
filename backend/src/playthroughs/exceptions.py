"""
Кастомные исключения для модуля прохождений.
"""
from fastapi import HTTPException, status


class PlaythroughNotFoundError(HTTPException):
    """Прохождение не найдено (404)."""
    def __init__(self, detail: str = "Прохождение не найдено"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class PlaythroughAccessDeniedError(HTTPException):
    """Доступ к прохождению запрещен (403)."""
    def __init__(self, detail: str = "Доступ к прохождению запрещен"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class PlaythroughAlreadyCompletedError(HTTPException):
    """Прохождение уже завершено (400)."""
    def __init__(self, detail: str = "Прохождение уже завершено"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class PlaythroughNotAvailableError(HTTPException):
    """Проект недоступен для прохождения (403)."""
    def __init__(self, detail: str = "Проект недоступен для прохождения"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)