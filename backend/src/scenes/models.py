"""
Модели SQLAlchemy для модуля сцен.
Таблицы: scenes, scene_nodes, node_options, scene_edges.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class Scene(BaseDBModel):
    """
    Таблица сцен проекта.
    Сцена содержит фон, порядковый номер и набор узлов диалога.
    """
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    background_url = Column(String(500), nullable=True)
    background_type = Column(String(20), default="image")
    use_video_audio = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    project = relationship("Project", back_populates="scenes")
    nodes = relationship("SceneNode", back_populates="scene", cascade="all, delete-orphan")
    edges = relationship("SceneEdge", back_populates="scene", cascade="all, delete-orphan")


class SceneNode(BaseDBModel):
    """
    Таблица узлов сцены (диалоговых блоков).
    Каждый узел содержит текст персонажа, спрайт, музыку и опции.
    """
    __tablename__ = "scene_nodes"

    node_uuid = Column(String(100), primary_key=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    character_name = Column(String(255), nullable=True)
    text = Column(Text, nullable=True)
    sprite_file = Column(String(500), nullable=True)
    music_file = Column(String(500), nullable=True)
    loop_music = Column(Boolean, default=False)
    is_start = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    scene = relationship("Scene", back_populates="nodes")
    options = relationship("NodeOption", back_populates="node", cascade="all, delete-orphan")


class NodeOption(BaseDBModel):
    """
    Таблица опций узла (вариантов ответа).
    Содержит текст опции, баллы, тип перехода и целевой узел.
    """
    __tablename__ = "node_options"

    option_uuid = Column(String(100), primary_key=True)
    node_uuid = Column(String(100), ForeignKey("scene_nodes.node_uuid"), nullable=False)
    option_text = Column(String(500), nullable=False)
    target_type = Column(String(20), nullable=False)
    target_node_uuid = Column(String(100), nullable=True)
    points = Column(Integer, default=0)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    node = relationship("SceneNode", back_populates="options")


class SceneEdge(BaseDBModel):
    """
    Таблица связей между узлами сцены.
    Определяет направления переходов между диалоговыми блоками.
    """
    __tablename__ = "scene_edges"

    edge_uuid = Column(String(100), primary_key=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    source_node_uuid = Column(String(100), nullable=False)
    source_handle = Column(String(100), nullable=False)
    target_node_uuid = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    scene = relationship("Scene", back_populates="edges")