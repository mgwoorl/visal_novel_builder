"""
Модуль движка обработки графов диалогов.
Содержит модели данных и логику для выполнения визуальных новелл.
Включает: граф сцены, контекст выполнения, движок выполнения, фабрику графов.
"""
from typing import Dict, List, Any, Optional, Set, Tuple
from pydantic import BaseModel, validator
from enum import Enum
import hashlib
import json
import networkx as nx
from datetime import datetime

from src.logger import setup_logger

logger = setup_logger(__name__, 'graph_engine.log')


class TargetType(str, Enum):
    """Тип перехода при выборе опции пользователем."""
    NODE = "node"
    NEXT_SCENE = "next_scene"
    NOVEL_END = "novel_end"


class NodeOption(BaseModel):
    """Вариант ответа в узле диалога."""
    id: str
    text: str
    target_type: TargetType
    target_node_id: Optional[str] = None
    points: int = 0

    class Config:
        frozen = True


class DialogueNodeData(BaseModel):
    """Содержимое узла диалога: персонаж, текст, спрайт, музыка, опции."""
    character_name: str = ""
    text: str = ""
    sprite_file: str = ""
    music_file: str = ""
    is_start: bool = False
    options: List[NodeOption] = []

    def deduplicate_options(self) -> 'DialogueNodeData':
        """Удаляет дублирующиеся опции по их ID."""
        seen_ids = set()
        unique_options = []
        for opt in self.options:
            if opt.id not in seen_ids:
                seen_ids.add(opt.id)
                unique_options.append(opt)

        return DialogueNodeData(
            character_name=self.character_name,
            text=self.text,
            sprite_file=self.sprite_file,
            music_file=self.music_file,
            is_start=self.is_start,
            options=unique_options
        )


class NodePosition(BaseModel):
    """Координаты узла на холсте редактора."""
    x: float
    y: float


class SceneNode(BaseModel):
    """Узел графа сцены."""
    id: str
    type: str = "dialogue"
    position: NodePosition
    data: DialogueNodeData
    width: Optional[float] = None
    height: Optional[float] = None

    def deduplicate_options(self) -> 'SceneNode':
        """Создаёт копию узла с уникальными опциями."""
        return SceneNode(
            id=self.id,
            type=self.type,
            position=self.position,
            data=self.data.deduplicate_options(),
            width=self.width,
            height=self.height
        )


class SceneEdge(BaseModel):
    """Связь между узлами в графе сцены."""
    id: str
    source: str
    source_handle: str
    target: str


class SceneGraph(BaseModel):
    """
    Полный граф сцены со всеми узлами и связями.
    Поддерживает построение networkx графа, валидацию и поиск путей.
    """
    id: int
    name: str
    background_url: Optional[str] = None
    nodes: List[SceneNode]
    edges: List[SceneEdge]

    _graph: Optional[nx.DiGraph] = None
    _option_map: Dict[str, Dict[str, str]] = {}

    class Config:
        arbitrary_types_allowed = True

    @validator('edges')
    def validate_edges(cls, v, values):
        """Проверяет что все связи ссылаются на существующие узлы."""
        if 'nodes' not in values:
            return v
        node_ids = {node.id for node in values['nodes']}
        for edge in v:
            if edge.source not in node_ids:
                raise ValueError(f"Связь {edge.id} ссылается на несуществующий узел {edge.source}")
            if edge.target not in node_ids:
                raise ValueError(f"Связь {edge.id} ссылается на несуществующий узел {edge.target}")
        return v

    def deduplicate_all_options(self) -> 'SceneGraph':
        """Удаляет дубликаты опций во всех узлах графа."""
        deduped_nodes = [node.deduplicate_options() for node in self.nodes]
        return SceneGraph(
            id=self.id,
            name=self.name,
            background_url=self.background_url,
            nodes=deduped_nodes,
            edges=self.edges
        )

    def build_graph(self) -> nx.DiGraph:
        """Строит направленный граф networkx из узлов и связей."""
        if self._graph is not None:
            return self._graph

        G = nx.DiGraph()
        self._option_map = {}

        for node in self.nodes:
            G.add_node(node.id, data=node)
            self._option_map[node.id] = {}
            for opt in node.data.options:
                if opt.target_type == TargetType.NODE and opt.target_node_id:
                    self._option_map[node.id][opt.id] = opt.target_node_id

        for edge in self.edges:
            G.add_edge(edge.source, edge.target, id=edge.id, handle=edge.source_handle)

        self._graph = G
        return G

    def get_node_by_id(self, node_id: str) -> Optional[SceneNode]:
        """Возвращает узел по его ID."""
        for node in self.nodes:
            if node.id == node_id:
                return node
        return None

    def get_start_node(self) -> Optional[SceneNode]:
        """
        Определяет стартовый узел графа.
        Приоритет: узел с флагом is_start, узел без входящих связей, первый узел.
        """
        if not self.nodes:
            return None

        # Поиск узла с флагом is_start
        for node in self.nodes:
            if node.data.is_start:
                logger.debug(f"Стартовый узел найден по флагу is_start: {node.id}")
                return node

        # Поиск узла без входящих связей
        if self.edges:
            G = self.build_graph()
            sources = [n for n in G.nodes() if G.in_degree(n) == 0]
            if sources:
                logger.debug(f"Стартовый узел найден по in_degree: {sources[0]}")
                return self.get_node_by_id(sources[0])

        # Первый узел в списке
        logger.debug(f"Используется первый узел как стартовый: {self.nodes[0].id}")
        return self.nodes[0]

    def get_option_target(self, node_id: str, option_id: str) -> Optional[str]:
        """
        Определяет целевой узел для опции.
        Сначала проверяет target_node_id в опции, затем ищет связь в edges.
        """
        node = self.get_node_by_id(node_id)
        if node:
            for opt in node.data.options:
                if opt.id == option_id and opt.target_type == TargetType.NODE:
                    if opt.target_node_id:
                        return opt.target_node_id
                    break

        # Поиск через edges
        if self.edges:
            G = self.build_graph()
            for _, target, data in G.out_edges(node_id, data=True):
                handle = data.get('handle', '')
                # Нормализация handle (убираем двойной префикс opt-opt-)
                if handle.startswith('opt-opt-'):
                    handle = handle[4:]
                if handle == f"opt-{option_id}" or handle == option_id:
                    return target

        return None

    def validate_graph(self) -> Tuple[bool, List[str]]:
        """
        Проверяет корректность графа:
        - Наличие узлов
        - Отсутствие дубликатов опций
        - Достижимость всех узлов от стартового
        - Все опции ведут к существующим узлам
        """
        errors = []

        if not self.nodes:
            return True, ["Сцена не содержит узлов"]

        # Проверка дубликатов опций
        for node in self.nodes:
            seen = set()
            for opt in node.data.options:
                if opt.id in seen:
                    errors.append(f"Дублируется опция {opt.id} в узле {node.id}")
                seen.add(opt.id)

        G = self.build_graph()
        start_node = self.get_start_node()

        # Проверка достижимости
        if start_node and len(self.nodes) > 1:
            reachable = set(nx.descendants(G, start_node.id))
            reachable.add(start_node.id)
            unreachable = set(G.nodes()) - reachable
            if unreachable:
                errors.append(f"Обнаружены недостижимые узлы: {', '.join(unreachable)}")

        # Проверка целей опций
        for node in self.nodes:
            for opt in node.data.options:
                if opt.target_type == TargetType.NODE:
                    target = self.get_option_target(node.id, opt.id)
                    if not target:
                        errors.append(
                            f"Опция '{opt.text}' в узле {node.id} не ведёт к существующему узлу"
                        )

        return len(errors) == 0, errors


class NodeCache:
    """Кэш результатов выполнения узлов для оптимизации повторных вычислений."""

    def __init__(self):
        self._cache: Dict[str, Any] = {}

    def _hash_node(self, node: SceneNode) -> str:
        """Создаёт MD5 хеш на основе содержимого узла."""
        data = {
            'character_name': node.data.character_name,
            'text': node.data.text,
            'sprite_file': node.data.sprite_file,
            'music_file': node.data.music_file,
            'options': [
                {'id': opt.id, 'text': opt.text, 'target_type': opt.target_type, 'points': opt.points}
                for opt in node.data.options
            ]
        }
        content = json.dumps(data, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def get(self, node: SceneNode) -> Optional[Any]:
        """Извлекает результат из кэша."""
        return self._cache.get(self._hash_node(node))

    def set(self, node: SceneNode, result: Any):
        """Сохраняет результат в кэш."""
        self._cache[self._hash_node(node)] = result

    def clear(self):
        """Очищает кэш."""
        self._cache.clear()


class ExecutionContext:
    """
    Контекст выполнения сцены.
    Хранит состояние прохождения: баллы, ответы, посещенные узлы, переменные.
    """

    def __init__(self, project_id: int, scene_id: int):
        self.project_id = project_id
        self.scene_id = scene_id
        self.variables: Dict[str, Any] = {}
        self.total_points: int = 0
        self.visited_nodes: List[str] = []
        self.answers: List[Dict] = []
        self.processed_options: Set[str] = set()

    def add_answer(self, node_id: str, option: NodeOption):
        """
        Добавляет ответ пользователя в историю.
        Предотвращает дублирование через отслеживание обработанных опций.
        """
        option_key = f"{node_id}:{option.id}"
        if option_key in self.processed_options:
            logger.debug(f"Повторный ответ пропущен: {option_key}")
            return

        self.processed_options.add(option_key)
        self.answers.append({
            'node_id': node_id,
            'option_id': option.id,
            'text': option.text,
            'points': option.points,
            'timestamp': datetime.utcnow().isoformat()
        })
        self.visited_nodes.append(node_id)
        self.total_points += option.points
        logger.debug(f"Ответ добавлен: '{option.text}' (+{option.points} баллов)")

    def set_variable(self, name: str, value: Any):
        """Сохраняет переменную в контексте."""
        self.variables[name] = value

    def get_variable(self, name: str, default: Any = None) -> Any:
        """Извлекает переменную из контекста."""
        return self.variables.get(name, default)

    def to_dict(self) -> Dict:
        """Сериализует контекст в словарь для передачи на фронтенд."""
        return {
            'total_points': self.total_points,
            'visited_nodes': self.visited_nodes,
            'answers': self.answers,
            'variables': self.variables
        }

    @classmethod
    def from_dict(cls, data: Dict, project_id: int, scene_id: int) -> 'ExecutionContext':
        """Восстанавливает контекст из словаря (при выборе опции)."""
        context = cls(project_id, scene_id)
        context.total_points = data.get('total_points', 0)
        context.visited_nodes = data.get('visited_nodes', [])
        context.answers = data.get('answers', [])

        for answer in context.answers:
            option_key = f"{answer['node_id']}:{answer['option_id']}"
            context.processed_options.add(option_key)

        logger.debug(f"Контекст восстановлен: {len(context.answers)} ответов, {context.total_points} баллов")
        return context


class GraphExecutionEngine:
    """
    Движок выполнения диалоговых графов.
    Управляет навигацией по узлам, обработкой выборов и кэшированием.
    """

    def __init__(self):
        self.cache = NodeCache()

    def execute_node(self, node: SceneNode, context: ExecutionContext) -> Dict:
        """
        Подготавливает узел для отображения.
        Возвращает словарь с данными узла: текст, опции, спрайт, музыка.
        """
        cached = self.cache.get(node)
        if cached:
            logger.debug(f"Использован кэшированный узел: {node.id}")
            return cached

        unique_options = []
        seen = set()
        for opt in node.data.options:
            if opt.id not in seen:
                seen.add(opt.id)
                unique_options.append(opt)

        result = {
            'id': node.id,
            'character_name': node.data.character_name,
            'text': node.data.text,
            'sprite_file': node.data.sprite_file,
            'music_file': node.data.music_file,
            'is_start': node.data.is_start,
            'options': [
                {
                    'id': opt.id,
                    'text': opt.text,
                    'target_type': opt.target_type,
                    'points': opt.points
                }
                for opt in unique_options
            ]
        }

        self.cache.set(node, result)
        logger.debug(f"Узел выполнен: {node.id}")
        return result

    def traverse_graph(
        self,
        graph: SceneGraph,
        context: ExecutionContext,
        start_node_id: Optional[str] = None
    ) -> Dict:
        """
        Обходит граф и возвращает состояние текущего узла.
        
        Args:
            graph: Граф сцены
            context: Контекст выполнения
            start_node_id: ID узла для старта. Если None - начинается со стартового узла.
                          Используется для восстановления прогресса.
        
        Returns:
            Dict с информацией о текущем узле, опциях, путях и статусе
        """
        graph = graph.deduplicate_all_options()

        if not graph.nodes:
            logger.warning("Сцена не содержит узлов")
            return {
                'error': 'Сцена не содержит узлов',
                'status': 'empty',
                'current_node': None,
                'context': context.to_dict(),
                'has_options': False,
                'has_paths': False
            }

        # Определение стартового узла
        if start_node_id:
            logger.info(f"Запуск с указанного узла: {start_node_id}")
            current = graph.get_node_by_id(start_node_id)
            if not current:
                logger.warning(f"Узел {start_node_id} не найден, используется стартовый узел")
                current = graph.get_start_node()
        else:
            logger.debug("Запуск со стартового узла по умолчанию")
            current = graph.get_start_node()

        if not current:
            logger.error("Стартовый узел не найден")
            return {
                'error': 'Стартовый узел не найден',
                'status': 'error',
                'current_node': None,
                'context': context.to_dict(),
                'has_options': False,
                'has_paths': False
            }

        logger.info(f"Выполнение узла: {current.id} (is_start={current.data.is_start}, опций={len(current.data.options)})")

        # Выполнение узла
        node_state = self.execute_node(current, context)

        # Валидация графа
        is_valid, errors = graph.validate_graph()

        # Проверка наличия путей из текущего узла
        has_paths = False

        if graph.edges:
            G = graph.build_graph()
            if list(G.out_edges(current.id)):
                has_paths = True

        if not has_paths:
            for opt in current.data.options:
                if opt.target_type in (TargetType.NEXT_SCENE, TargetType.NOVEL_END):
                    has_paths = True
                    break

        result = {
            'current_node': node_state,
            'context': context.to_dict(),
            'has_options': len(current.data.options) > 0,
            'has_paths': has_paths,
            'status': 'active' if has_paths else 'end',
            'validation_errors': errors if not is_valid else []
        }

        logger.info(f"Результат обхода: status={result['status']}, has_paths={has_paths}")
        return result

    def select_option(
        self,
        graph: SceneGraph,
        context: ExecutionContext,
        node_id: str,
        option_id: str
    ) -> Dict:
        """
        Обрабатывает выбор пользователя.
        
        Args:
            graph: Граф сцены
            context: Контекст выполнения
            node_id: ID текущего узла
            option_id: ID выбранной опции
            
        Returns:
            Dict с действием (node/next_scene/end) и обновленным контекстом
        """
        graph = graph.deduplicate_all_options()

        node = graph.get_node_by_id(node_id)
        if not node:
            logger.error(f"Узел не найден: {node_id}")
            return {'error': 'Узел не найден', 'status': 'error'}

        # Поиск выбранной опции
        selected = None
        seen = set()
        for opt in node.data.options:
            if opt.id not in seen:
                seen.add(opt.id)
                if opt.id == option_id:
                    selected = opt
                    break

        if not selected:
            logger.error(f"Опция не найдена: {option_id} в узле {node_id}")
            return {'error': 'Опция не найдена', 'status': 'error'}

        # Добавление ответа в контекст
        context.add_answer(node_id, selected)
        logger.info(f"Выбрана опция: '{selected.text}' (+{selected.points} баллов, переход={selected.target_type})")

        # Обработка в зависимости от типа перехода
        if selected.target_type == TargetType.NOVEL_END:
            logger.info("Переход: завершение новеллы")
            return {
                'action': 'end',
                'message': 'Завершение новеллы',
                'context': context.to_dict()
            }

        if selected.target_type == TargetType.NEXT_SCENE:
            logger.info("Переход: следующая сцена")
            return {
                'action': 'next_scene',
                'message': 'Переход к следующей сцене',
                'context': context.to_dict()
            }

        if selected.target_type == TargetType.NODE:
            # Поиск целевого узла
            target = graph.get_option_target(node_id, option_id)
            if not target:
                target = selected.target_node_id

            if target:
                logger.info(f"Переход: узел {target}")
                return {
                    'action': 'node',
                    'target_node_id': target,
                    'context': context.to_dict()
                }

            logger.warning(f"Целевой узел не найден для опции {option_id}")
            return {
                'action': 'end',
                'message': 'Целевой узел не найден',
                'context': context.to_dict()
            }

        logger.error(f"Неизвестный тип перехода: {selected.target_type}")
        return {'error': 'Неизвестный тип опции', 'status': 'error'}


class GraphFactory:
    """Фабрика для создания графов из разных источников данных."""

    @staticmethod
    def from_reactflow(scene_data: dict) -> SceneGraph:
        """
        Создаёт граф из данных формата ReactFlow (фронтенд редактора).
        """
        logger.debug(f"Создание графа из данных ReactFlow: {scene_data.get('name', 'Без названия')}")

        nodes = []
        for node in scene_data.get('nodes', []):
            options_dict = {}
            for opt in node['data'].get('options', []):
                if opt['id'] not in options_dict:
                    options_dict[opt['id']] = NodeOption(
                        id=opt['id'],
                        text=opt['text'],
                        target_type=opt.get('targetType', 'node'),
                        target_node_id=opt.get('targetNodeId'),
                        points=opt.get('points', 0)
                    )

            scene_node = SceneNode(
                id=node['id'],
                type=node.get('type', 'dialogue'),
                position=NodePosition(x=node['position']['x'], y=node['position']['y']),
                data=DialogueNodeData(
                    character_name=node['data'].get('characterName', ''),
                    text=node['data'].get('text', ''),
                    sprite_file=node['data'].get('spriteFile', ''),
                    music_file=node['data'].get('musicFile', ''),
                    is_start=node['data'].get('isStart', False),
                    options=list(options_dict.values())
                ),
                width=node.get('width'),
                height=node.get('height')
            )
            nodes.append(scene_node)

        edges = [
            SceneEdge(
                id=edge['id'],
                source=edge['source'],
                source_handle=edge['sourceHandle'],
                target=edge['target']
            )
            for edge in scene_data.get('edges', [])
        ]

        graph = SceneGraph(
            id=scene_data['id'],
            name=scene_data['name'],
            background_url=scene_data.get('background_url'),
            nodes=nodes,
            edges=edges
        )

        logger.debug(f"Граф создан: {len(nodes)} узлов, {len(edges)} связей")
        return graph.deduplicate_all_options()

    @staticmethod
    def from_db(scene_record, nodes_records, edges_records, options_records) -> SceneGraph:
        """
        Создаёт граф из записей базы данных.
        """
        logger.debug(f"Создание графа из БД: scene_id={scene_record.id}")

        options_by_node = {}
        for opt in options_records:
            if opt.node_uuid not in options_by_node:
                options_by_node[opt.node_uuid] = {}
            options_by_node[opt.node_uuid][opt.option_uuid] = NodeOption(
                id=opt.option_uuid,
                text=opt.option_text,
                target_type=opt.target_type,
                target_node_id=opt.target_node_uuid,
                points=opt.points
            )

        nodes = []
        for node in nodes_records:
            node_options = list(options_by_node.get(node.node_uuid, {}).values())
            scene_node = SceneNode(
                id=node.node_uuid,
                type='dialogue',
                position=NodePosition(x=node.position_x or 0, y=node.position_y or 0),
                data=DialogueNodeData(
                    character_name=node.character_name or '',
                    text=node.text or '',
                    sprite_file=node.sprite_file or '',
                    music_file=node.music_file or '',
                    is_start=node.is_start or False,
                    options=node_options
                ),
                width=node.width,
                height=node.height
            )
            nodes.append(scene_node)

        edges = [
            SceneEdge(
                id=edge.edge_uuid,
                source=edge.source_node_uuid,
                source_handle=edge.source_handle,
                target=edge.target_node_uuid
            )
            for edge in edges_records
        ]

        graph = SceneGraph(
            id=scene_record.id,
            name=scene_record.name,
            background_url=scene_record.background_url,
            nodes=nodes,
            edges=edges
        )

        logger.debug(f"Граф из БД: {len(nodes)} узлов, {len(edges)} связей")
        return graph.deduplicate_all_options()