"""
Кастомные исключения для модуля сцен.
"""
from fastapi import HTTPException, status


class SceneNotFoundError(HTTPException):
    """Сцена не найдена (404)."""
    def __init__(self, detail: str = "Сцена не найдена"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class SceneAccessDeniedError(HTTPException):
    """Доступ к сцене запрещен (403)."""
    def __init__(self, detail: str = "Доступ к сцене запрещен"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class SceneValidationError(HTTPException):
    """Ошибка валидации сцены (400)."""
    def __init__(self, detail: str = "Ошибка валидации сцены"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class NodeNotFoundError(HTTPException):
    """Узел не найден (404)."""
    def __init__(self, detail: str = "Узел не найден"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class OptionNotFoundError(HTTPException):
    """Опция не найдена (404)."""
    def __init__(self, detail: str = "Опция не найдена"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class SceneSaveError(HTTPException):
    """Ошибка сохранения сцены (500)."""
    def __init__(self, detail: str = "Ошибка сохранения сцены"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)