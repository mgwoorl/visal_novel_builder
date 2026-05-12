"""
Централизованная система логирования для всего backend.
Все модули используют этот файл для единообразного вывода логов в консоль и файлы.
"""
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

LOG_DIR = Path("./logs")
LOG_DIR.mkdir(exist_ok=True)

class ColoredFormatter(logging.Formatter):
    """Форматтер с цветами для консольного вывода."""
    COLORS = {
        'DEBUG': '\033[36m',
        'INFO': '\033[32m',
        'WARNING': '\033[33m',
        'ERROR': '\033[31m',
        'CRITICAL': '\033[35m',
    }
    RESET = '\033[0m'

    def format(self, record):
        log_message = super().format(record)
        color = self.COLORS.get(record.levelname, '')
        return f"{color}{log_message}{self.RESET}"

def setup_logger(name: str, log_file: str = None) -> logging.Logger:
    """
    Настраивает и возвращает логгер с указанным именем.
    Автоматически добавляет обработчики для консоли, файла модуля и файла ошибок.
    
    Args:
        name: Имя логгера (обычно __name__ модуля)
        log_file: Имя файла для записи логов модуля (без пути, сохраняется в LOG_DIR)
    
    Returns:
        Настроенный экземпляр logging.Logger
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # Формат для файловых логов
    file_formatter = logging.Formatter(
        '[%(asctime)s][%(levelname)-8s][%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    # Формат для консоли с цветами
    console_formatter = ColoredFormatter(
        '[%(asctime)s][%(levelname)-8s][%(name)s] %(message)s',
        datefmt='%H:%M:%S'
    )

    # Консольный обработчик (INFO и выше)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # Файловый обработчик для конкретного модуля (DEBUG и выше)
    if log_file:
        file_handler = RotatingFileHandler(
            LOG_DIR / log_file,
            maxBytes=10 * 1024 * 1024,  # 10 МБ
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    # Общий файл для всех ошибок (ERROR и выше)
    error_handler = RotatingFileHandler(
        LOG_DIR / 'errors.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    logger.addHandler(error_handler)

    return logger