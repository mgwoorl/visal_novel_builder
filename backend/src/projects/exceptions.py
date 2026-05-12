"""
Кастомные исключения для модуля проектов.
"""
from fastapi import HTTPException, status


class ProjectNotFoundError(HTTPException):
    """Проект не найден (404)."""
    def __init__(self, detail: str = "Проект не найден"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ProjectAccessDeniedError(HTTPException):
    """Доступ к проекту запрещен (403)."""
    def __init__(self, detail: str = "Доступ к проекту запрещен"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ProjectValidationError(HTTPException):
    """Ошибка валидации проекта (400)."""
    def __init__(self, detail: str = "Ошибка валидации проекта"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ProjectPublishError(HTTPException):
    """Ошибка публикации проекта (400)."""
    def __init__(self, detail: str = "Нельзя опубликовать проект без сцен"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class FileNotFoundError(HTTPException):
    """Файл не найден (404)."""
    def __init__(self, detail: str = "Файл не найден"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class FileUploadError(HTTPException):
    """Ошибка загрузки файла (400)."""
    def __init__(self, detail: str = "Ошибка загрузки файла"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class FileTypeNotAllowedError(HTTPException):
    """Недопустимый тип файла (400)."""
    def __init__(self, detail: str = "Недопустимый тип файла"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class StatusNotFoundError(HTTPException):
    """Статус не найден (404)."""
    def __init__(self, detail: str = "Статус не найден"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class StatusExistsError(HTTPException):
    """Статус уже существует (400)."""
    def __init__(self, detail: str = "Статус уже существует"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)