"""
Исключения для модуля пользователей.
"""

from fastapi import HTTPException, status


class UserNotFoundError(HTTPException):
    def __init__(self, detail: str = "User not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class UserAuthenticationError(HTTPException):
    def __init__(self, detail: str = "Invalid credentials"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class UserPermissionError(HTTPException):
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class UserValidationError(HTTPException):
    def __init__(self, detail: str = "Validation error"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class EmailAlreadyExistsError(HTTPException):
    def __init__(self, detail: str = "Email already exists"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class CannotDeleteYourselfError(HTTPException):
    def __init__(self, detail: str = "Cannot delete yourself"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class CannotChangeSuperAdminError(HTTPException):
    def __init__(self, detail: str = "Cannot change super admin role"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class InvalidRoleError(HTTPException):
    def __init__(self, detail: str = "Invalid role"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)