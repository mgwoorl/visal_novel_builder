"""
Pydantic схемы для валидации данных модуля сцен.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SceneBase(BaseModel):
    """Базовая схема сцены."""
    name: str
    background_url: Optional[str] = None
    background_type: str = "image"
    order_index: int = 0


class SceneCreate(SceneBase):
    """Схема для создания сцены."""
    project_id: int


class SceneUpdate(BaseModel):
    """Схема для обновления сцены."""
    name: Optional[str] = None
    background_url: Optional[str] = None
    background_type: Optional[str] = None
    order_index: Optional[int] = None


class SceneNodeBase(BaseModel):
    """Базовая схема узла сцены."""
    node_uuid: str
    position_x: float
    position_y: float
    width: Optional[float] = None
    height: Optional[float] = None
    character_name: Optional[str] = None
    text: Optional[str] = None
    sprite_file: Optional[str] = None
    music_file: Optional[str] = None
    is_start: bool = False


class SceneNodeCreate(SceneNodeBase):
    """Схема для создания узла."""
    scene_id: int


class SceneNodeResponse(SceneNodeBase):
    """Схема для ответа с данными узла."""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NodeOptionBase(BaseModel):
    """Базовая схема опции узла."""
    node_uuid: str
    option_uuid: str
    option_text: str
    target_type: str
    target_node_uuid: Optional[str] = None
    points: int = 0
    sort_order: int


class NodeOptionCreate(NodeOptionBase):
    """Схема для создания опции."""
    pass


class NodeOptionResponse(NodeOptionBase):
    """Схема для ответа с данными опции."""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SceneEdgeBase(BaseModel):
    """Базовая схема связи между узлами."""
    scene_id: int
    edge_uuid: str
    source_node_uuid: str
    source_handle: str
    target_node_uuid: str


class SceneEdgeCreate(SceneEdgeBase):
    """Схема для создания связи."""
    pass


class SceneEdgeResponse(SceneEdgeBase):
    """Схема для ответа с данными связи."""
    created_at: datetime

    class Config:
        from_attributes = True


class SceneResponse(SceneBase):
    """Схема для ответа с данными сцены."""
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SceneDetailResponse(SceneBase):
    """Схема для ответа с полными данными сцены."""
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    nodes: List[SceneNodeResponse] = []
    edges: List[SceneEdgeResponse] = []

    class Config:
        from_attributes = True