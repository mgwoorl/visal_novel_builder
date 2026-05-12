"""
Главный модуль FastAPI приложения Visual Novel Builder.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
import os
import time
from dotenv import load_dotenv

from src.logger import setup_logger
from src.database import engine, BaseDBModel, init_db
from src.users.router import router as users_router
from src.users import crud as users_crud
from src.projects.router import router as projects_router
from src.scenes.router import router as scenes_router
from src.scenes.execution_router import router as scenes_execution_router
from src.playthroughs.router import router as playthroughs_router
from src.database import SessionLocal

load_dotenv()

logger = setup_logger(__name__, 'app.log')
logger.info("=" * 50)
logger.info("Запуск Visual Novel Builder API")
logger.info("База данных: MySQL")

# НЕ вызываем init_db() здесь - будет вызвано в startup_event

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app = FastAPI(title="Visual Novel Builder API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)
logger.info(f"CORS настроен для {len(origins)} источников")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Логирует метод, путь, статус и время выполнения каждого запроса."""
    start_time = time.time()
    if request.method != "OPTIONS":
        logger.debug(f"→ {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        if request.method != "OPTIONS":
            logger.debug(f"← {request.method} {request.url.path} → {response.status_code} ({duration:.3f}с)")
            if duration > 1.0:
                logger.warning(f"Медленный запрос: {request.method} {request.url.path} занял {duration:.3f}с")
        return response
    except Exception as e:
        logger.error(f"Ошибка запроса {request.method} {request.url.path}: {str(e)}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    response = JSONResponse(content={"detail": "OK"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
logger.info(f"Статические файлы: /uploads → {UPLOAD_DIR.absolute()}")

app.include_router(users_router)
app.include_router(projects_router)
app.include_router(scenes_router)
app.include_router(scenes_execution_router)
app.include_router(playthroughs_router)
logger.info("Все роутеры подключены")

@app.get("/")
async def root():
    return {
        "message": "Visual Novel Builder API",
        "status": "running",
        "version": "1.0.0",
        "documentation": "/docs"
    }

@app.get("/health")
async def health():
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        db_status = "connected"
    except Exception as e:
        logger.error(f"Ошибка подключения к БД: {str(e)}")
        db_status = "disconnected"
    return {"status": "healthy" if db_status == "connected" else "degraded", "database": db_status, "timestamp": time.time()}

def bootstrap_super_admin():
    """Создает учетную запись супер-админа при первом запуске."""
    db = SessionLocal()
    try:
        if users_crud.is_super_admin_exists(db):
            logger.info("Супер-админ уже существует")
            return
        email = os.getenv("SUPER_ADMIN_EMAIL", "admin@example.com")
        password = os.getenv("SUPER_ADMIN_PASSWORD", "admin123")
        first_name = os.getenv("SUPER_ADMIN_FIRST_NAME", "Super")
        last_name = os.getenv("SUPER_ADMIN_LAST_NAME", "Admin")
        from src.users import schemas
        admin_data = schemas.UserCreate(
            email=email, password=password,
            first_name=first_name, last_name=last_name,
            patronymic="", role="super_admin"
        )
        admin = users_crud.create_user(db, admin_data)
        logger.info(f"Супер-админ создан: {admin.email}")
    except Exception as e:
        logger.error(f"Ошибка создания супер-админа: {str(e)}", exc_info=True)
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    """Действия при запуске приложения."""
    logger.info("Инициализация приложения...")
    # Создаем таблицы при старте
    init_db()
    bootstrap_super_admin()
    logger.info("Приложение готово к работе")
    logger.info("=" * 50)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Приложение останавливается")