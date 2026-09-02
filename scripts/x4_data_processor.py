import argparse
import os
import xml.etree.ElementTree as ET
import json
import glob
import sys
import re
from collections import defaultdict
from pathlib import Path

try:
    from processor.i18n import get_i18n_registry
    from processor.path_utils import get_library_xml
    from processor.versioning import get_target_versions, load_version_config, merge_version_config
    from processor.step1_map.service import process_map_for_version
    from processor.dlc_tag import build_ware_dlc_tag_map
except ModuleNotFoundError:
    from scripts.processor.i18n import get_i18n_registry  # type: ignore
    from scripts.processor.path_utils import get_library_xml  # type: ignore
    from scripts.processor.versioning import get_target_versions, load_version_config, merge_version_config  # type: ignore
    from scripts.processor.step1_map.service import process_map_for_version  # type: ignore
    from scripts.processor.dlc_tag import build_ware_dlc_tag_map  # type: ignore

# 动态导入 terraforming 模块 (目录名 x4-game 含 hyphen, 不可直接 import)
import importlib
_process_terraforming = None
def _get_process_terraforming():
    global _process_terraforming
    if _process_terraforming is not None:
        return _process_terraforming
    try:
        mod = importlib.import_module("scripts.x4-game.terraforming.build")
    except ModuleNotFoundError:
        try:
            mod = importlib.import_module("x4-game.terraforming.build")
        except ModuleNotFoundError:
            raise ImportError("Cannot import x4-game.terraforming. Run from project root.")
    _process_terraforming = mod.process_terraforming
    return _process_terraforming

_process_research = None
def _get_process_research():
    global _process_research
    if _process_research is not None:
        return _process_research
    try:
        mod = importlib.import_module("scripts.x4-game.research.build")
    except ModuleNotFoundError:
        try:
            mod = importlib.import_module("x4-game.research.build")
        except ModuleNotFoundError:
            raise ImportError("Cannot import x4-game.research. Run from project root.")
    _process_research = mod.process_research
    return _process_research

_process_blueprints = None
def _get_process_blueprints():
    global _process_blueprints
    if _process_blueprints is not None:
        return _process_blueprints
    try:
        mod = importlib.import_module("scripts.x4-game.blueprints.build")
    except ModuleNotFoundError:
        try:
            mod = importlib.import_module("x4-game.blueprints.build")
        except ModuleNotFoundError:
            raise ImportError("Cannot import x4-game.blueprints. Run from project root.")
    _process_blueprints = mod.process_blueprints
    return _process_blueprints

_process_factions = None
def _get_process_factions():
    global _process_factions
    if _process_factions is not None:
        return _process_factions
    try:
        mod = importlib.import_module("scripts.x4-game.factions.build")
    except ModuleNotFoundError:
        try:
            mod = importlib.import_module("x4-game.factions.build")
        except ModuleNotFoundError:
            raise ImportError("Cannot import x4-game.factions. Run from project root.")
    _process_factions = mod.process_factions
    return _process_factions

# =============================================================================
# ⚙️ 项目配置
# =============================================================================
_config = load_version_config()

# 全局路径变量（由 apply_runtime_config 填充）
X4_UNPACKED_DATA_PATH = ""
OUTPUT_VERSION_DIR = ""


def apply_runtime_config(effective_config):
    """应用运行时配置，设置全局路径变量"""
    global X4_UNPACKED_DATA_PATH
    global OUTPUT_VERSION_DIR

    # 拼接基础路径
    base_path = os.path.join(str(effective_config['raw_assets_dir']), str(effective_config['folder_name']))
    OUTPUT_VERSION_DIR = os.path.join(str(effective_config['processed_assets_dir']), str(effective_config['folder_name']))

    X4_UNPACKED_DATA_PATH = base_path


def default_version_item(config):
    """获取默认版本配置项"""
    current_version = config.get("current_version")
    current_beta = bool(config.get("beta", False))
    for version_item in config.get("versions", []):
        if str(version_item.get("version")) == str(current_version) and bool(version_item.get("beta", False)) == current_beta:
            return merge_version_config(config, version_item)
    print("" + "!" * 60)
    print("❌ 错误：未找到默认版本配置。")
    print("!" * 60 + "")
    sys.exit(1)


# 初始化默认版本配置
apply_runtime_config(default_version_item(_config))


X4_LANG_CONFIG = {
    '044': {'iso': 'en',    'name': 'English'},
    '086': {'iso': 'zh-CN', 'name': '简体中文'},
    '088': {'iso': 'zh-TW', 'name': '繁體中文'},
    '049': {'iso': 'de',    'name': 'Deutsch'},
    '033': {'iso': 'fr',    'name': 'Français'},
    '039': {'iso': 'it',    'name': 'Italiano'},
    '034': {'iso': 'es',    'name': 'Español'},
    '007': {'iso': 'ru',    'name': 'Русский'},
    '081': {'iso': 'ja',    'name': '日本語'},
    '082': {'iso': 'ko',    'name': '한국어'},
    '055': {'iso': 'pt-BR', 'name': 'Português (Brasil)'},
    '048': {'iso': 'pl',    'name': 'Polski'}
}

SPECIAL_TYPE_MAPPING = {
    'moduletypes_processing': 'processingmodule',
    'moduletypes_venture': 'ventureplatform'
}

SLOT_TAG_I18N_TARGETS = {
    "standard",
    "advanced",
    "xenon",
    "mining",
    "missile",
    "highpower"
}

DLC_I18N_PAGE_ID = "1021"
DLC_I18N_TARGETS = [
    {"id": "ego_dlc_split", "lookup": "Split Vendetta", "dependencyVersion": "600"},
    {"id": "ego_dlc_terran", "lookup": "Cradle of Humanity", "dependencyVersion": "600"},
    {"id": "ego_dlc_pirate", "lookup": "Tides of Avarice", "dependencyVersion": "600"},
    {"id": "ego_dlc_boron", "lookup": "Kingdom End", "dependencyVersion": "600"},
    {"id": "ego_dlc_timelines", "lookup": "Timelines", "dependencyVersion": "700"},
    {"id": "ego_dlc_mini_01", "lookup": "Hyperion Pack", "dependencyVersion": "750"},
    {"id": "ego_dlc_mini_02", "lookup": "Envoy Pack", "dependencyVersion": "800"},
]


def format_dependency_version(raw_version):
    raw = str(raw_version).strip()
    if not raw.isdigit() or len(raw) < 2:
        return raw
    major = raw[:-2] or "0"
    minor = raw[-2:].rstrip("0")
    minor = minor or "0"
    return f"{int(major)}.{minor}"

# =============================================================================

class X4PrecisionLoader:
    def __init__(self, raw_data_path, output_root, config):
        self.raw_path = raw_data_path
        self.output_root = output_root
        self.config = config
        
        self.valid_macros = {}       
        self.all_modules = []        
        self.ships_data = []
        self.equipments_data = []
        self.shipgroups_data = []
        self.wares_data = []         
        self.i18n_data = {}         
        self.recipes = {} 
        self.race_consumption = {}  # 种群消耗速率 (每人每小时) race -> {idle, busy} -> wareId -> perPersonPerHour
        self.module_groups_result = []  # 模块分组结果 (合并 types 和 waregroups)
        self.ware_tier_map = {}     # 缓存物品层级映射
        self.all_methods = set()
        self.colors_db = {}
        self.mappings_db = {}
        self.ware_index = {}
        self.component_to_ware = {}
        self.ship_connections = {}
        self.ship_connections_raw = {}
        self.ship_macros = {}
        self.loadouts_map = {}
        self.shipgroup_by_macro = {}
        self.ship_type_counts = defaultdict(int)
        self.ship_type_name_map = {}
        self.ship_type_key_map = {}
        self.ship_types_data = []
        self.ship_type_class_map = defaultdict(set)
        self.ship_races_data = []
        self.ship_slot_tags_by_type = defaultdict(set)
        self.equipment_component_tags_by_name = defaultdict(set)
        self.equipment_type_counts = defaultdict(int)
        self.equipment_type_name_map = {}
        self.equipment_type_key_map = {}
        self.equipment_types_data = []
        self.slot_tag_counts = defaultdict(int)
        self.slot_tag_name_map = {}
        self.slot_tag_key_map = {}
        self.slot_tags_data = []
        self.dlc_name_map = {}
        self.dlc_key_map = {}
        self.dlcs_data = []
        self.missiles_data = []  # 从 wares 导出的 missiles
        self.missile_macro_ids_from_ware = set()  # 记录从 ware 导出的 missile macro id
        self.bullets_data = []
        self.drones_data = []     # ship_xs, ship_s
        self.consumables_data = [] # mine, satellite, scanner, countermeasure, etc.
        self.ship_max_stats = {}  # ship class max statistics from defaults.xml
        self.ware_dlc_tags = {}

        # 颜色相关数据库（版本专用）
        self.regionyields_db = {}  # 8.0: ware_id → {effect_r, effect_g, effect_b}
        self.resource_map_colors = {}  # 9.0: ware_id → {color_id, color_rgb}

        # 收集需要翻译的原始名称 (Raw Key)
        self.needed_raw_names = set()
        self.i18n_registry = get_i18n_registry()
        self.i18n_registry.configure(self.raw_path, X4_LANG_CONFIG)

        if not os.path.exists(self.raw_path):
            print(f"❌ 错误: 找不到解包目录: {self.raw_path}")
            sys.exit(1)

    # =======================================================
    # 1. 构建数据库 (Wares)
    # =======================================================
    def build_database(self):
        print(f"📖 [1/5] 解析 wares.xml...")
        self.ware_dlc_tags = build_ware_dlc_tag_map(Path(self.raw_path) / "libraries" / "wares", self.config.get("dlc_order", []))
        # 从配置中提取模块类型原始 Key
        for raw_key in self.config.get('module_types', {}).values():
            self.needed_raw_names.add(raw_key)
        wares_path = get_library_xml(self.raw_path, "wares")
        try:
            tree = ET.parse(wares_path)
            root = tree.getroot()
            count = 0
            
            for ware in root.findall('ware'):
                w_id = ware.get('id')
                tags = ware.get('tags', '')
                transport = ware.get('transport')
                raw_name = ware.get('name', '')
                group = ware.get('group', '')
                production_tags = set()
                production_methods = 0
                production_noplayerbuild = 0
                production_method_tags = {}
                comp_node = ware.find('component')
                if w_id:
                    self.ware_index[w_id] = {
                        "id": w_id,
                        "nameId": raw_name,
                        "group": group,
                        "tags": tags,
                        "production_tags": [],
                        "production_methods": 0,
                        "production_noplayerbuild": 0,
                        "production_method_tags": {},
                        "transport": transport
                    }
                if comp_node is not None and comp_node.get('ref'):
                    ref = comp_node.get('ref')
                    if ref and ref not in self.component_to_ware:
                        self.component_to_ware[ref] = w_id
                
                # 手动修正: BoGas 在游戏数据中被归类为 refined，但实际属于 agricultural
                if w_id == 'bogas':
                    group = 'agricultural'
                
                # 提取配方
                for prod in ware.findall('production'):
                    method = prod.get('method', 'default')
                    method_tags = self._split_tags(prod.get('tags', ''))
                    for t in method_tags:
                        production_tags.add(t)
                    production_methods += 1
                    production_method_tags.setdefault(method, set()).update(method_tags)
                    if "noplayerbuild" in method_tags:
                        production_noplayerbuild += 1
                    self.all_methods.add(method)
                    bonus = 0.0
                    eff_node = prod.find("./effects/effect[@type='work']")
                    if eff_node is not None:
                        bonus = float(eff_node.get('product', 0))

                    recipe = {
                        "time": float(prod.get('time', 1)),
                        "amount": float(prod.get('amount', 1)),
                        "bonus": bonus,
                        "inputs": {r.get('ware'): float(r.get('amount')) for r in prod.findall('primary/ware')}
                    }
                    self.recipes.setdefault(w_id, {})[method] = recipe

                if w_id and (production_tags or production_methods):
                    self.ware_index[w_id]["production_tags"] = sorted(production_tags)
                    self.ware_index[w_id]["production_methods"] = production_methods
                    self.ware_index[w_id]["production_noplayerbuild"] = production_noplayerbuild
                    self.ware_index[w_id]["production_method_tags"] = {
                        m: sorted(list(tags)) for m, tags in production_method_tags.items()
                    }

                # 筛选逻辑
                is_valid = False
                
                # C. 工人消耗 (Food/Medical)
                if transport == 'workunit' and w_id in ('workunit_idle', 'workunit_busy'):
                    state = 'busy' if w_id == 'workunit_busy' else 'idle'
                    for prod in ware.findall('production'):
                        method = prod.get('method', 'default')
                        p_time = float(prod.get('time', 600))
                        p_amount = float(prod.get('amount', 200))
                        consumables = {}
                        for r in prod.findall('primary/ware'):
                            c_ware = r.get('ware')
                            c_amount = float(r.get('amount'))
                            consumables[c_ware] = c_amount / (p_amount * p_time) * 3600
                        if method not in self.race_consumption:
                            self.race_consumption[method] = {}
                        self.race_consumption[method][state] = consumables

                # A. 商品
                if transport in {'container', 'solid', 'liquid', 'condensate'} and 'module' not in tags:
                    p_node = ware.find('price')
                    volume = int(ware.get('volume') or 0)
                    if p_node is not None:
                        is_valid = True
                        self.wares_data.append({
                            "id": w_id, 
                            "nameId": raw_name, # 原始引用 Key
                            "group": group,
                            "name": raw_name,   # ⚠️ 占位，稍后注入英文
                            "dlc_tag": self.ware_dlc_tags.get(w_id, "base"),
                            "transport": transport,
                            "price": int(p_node.get('average') or 0),
                            "volume": volume,
                            "minPrice": int(p_node.get('min') or 0),
                            "maxPrice": int(p_node.get('max') or 0)
                        })

                # B. 模块
                if 'module' in tags:
                    comp = ware.find('component')
                    if comp is not None and comp.get('ref'):
                        ref = comp.get('ref')
                        m_prod = ware.find("./production[@method='default']")
                        is_valid = True
                        self.valid_macros[ref] = {
                            "module_ware_id": w_id, 
                            "name_id": raw_name, 
                            "build_cost": {r.get('ware'): int(r.get('amount')) for r in m_prod.findall('primary/ware')} if m_prod is not None else {},
                            "build_time": float(m_prod.get('time', 0)) if m_prod is not None else 0
                        }

                if is_valid and raw_name:
                    self.needed_raw_names.add(raw_name)
                    count += 1
                    
            self.needed_raw_names.add("{20102,2011}")
            print(f"   ✅ 从 {count} 个物品中收集到 {len(self.needed_raw_names)} 个原始 Key。")
            
            # 计算 Tier 层级 
            self._calculate_tiers()
            # 注入 Tier 到 wares_data 
            for item in self.wares_data:
                item['tier'] = self.ware_tier_map.get(item['id'], 0)
                
            print(f"   ℹ️  发现生产方式: {sorted(list(self.all_methods))}")

        except Exception as e: print(f"   ❌ XML Error: {e}")

    # =======================================================
    # 1.1 计算物品生产层级 (Tier)
    # =======================================================
    def _calculate_tiers(self):
        def get_tier(ware_id, visited=None):
            if visited is None: visited = set()
            if ware_id in self.ware_tier_map: return self.ware_tier_map[ware_id]
            if ware_id in visited: return 0  # 防止循环引用
            
            recipe_group = self.recipes.get(ware_id)
            if not recipe_group:
                self.ware_tier_map[ware_id] = 0
                return 0
            
            visited.add(ware_id)
            max_input_tier = -1
            for method, recipe in recipe_group.items():
                for input_id in recipe['inputs']:
                    max_input_tier = max(max_input_tier, get_tier(input_id, visited))
            
            tier = max_input_tier + 1 if max_input_tier >= 0 else 0
            self.ware_tier_map[ware_id] = tier
            return tier

        for ware in self.wares_data:
            get_tier(ware['id'])

    # =======================================================
    # 1.2 加载颜色库
    # =======================================================
    def load_colors(self):
        print(f"🎨 [1.2/5] 解析 colors/final.xml...")
        colors_path = get_library_xml(self.raw_path, "colors")
        if not os.path.exists(colors_path):
            print(f"   ⚠️ 警告: 找不到颜色定义文件: {colors_path}")
            return 

        try:
            tree = ET.parse(colors_path)
            root = tree.getroot()
            
            # 1. 解析基础颜色定义 (RGBA -> Hex) 
            color_defs = {}
            for c in root.findall(".//colors/color"):
                c_id = c.get('id')
                r, g, b = int(c.get('r', 0)), int(c.get('g', 0)), int(c.get('b', 0))
                color_defs[c_id] = f"#{r:02X}{g:02X}{b:02X}"
            
            self.colors_db = color_defs
            # 2. 解析 Mapping 映射 
            self.mappings_db = {m.get('id'): m.get('ref') for m in root.findall(".//mappings/mapping")}
            print(f"   ✅ 加载了 {len(color_defs)} 个颜色定义和 {len(self.mappings_db)} 个映射。")
        except Exception as e:
            print(f"   ❌ Colors XML Error: {e}")

    # =======================================================
    # 1.3 加载 8.0 regionyields 颜色（版本专用）
    # =======================================================
    def load_regionyields_colors(self):
        """8.0 Diplomacy: 从 regionyields/final.xml 提取资源颜色 effect_r/g/b"""
        print(f"🎨 [1.3/5] 解析 regionyields/final.xml (8.0 颜色)...")
        regionyields_path = get_library_xml(self.raw_path, "regionyields")
        if not os.path.exists(regionyields_path):
            print(f"   ⚠️ 警告：找不到 regionyields 文件：{regionyields_path}")
            return

        try:
            tree = ET.parse(regionyields_path)
            root = tree.getroot()

            for res in root.findall(".//resource"):
                ware_id = res.get('ware')
                if ware_id:
                    r = int(res.get('effect_r', 0))
                    g = int(res.get('effect_g', 0))
                    b = int(res.get('effect_b', 0))
                    self.regionyields_db[ware_id] = {
                        'r': r,
                        'g': g,
                        'b': b,
                        'color_rgb': f"#{r:02X}{g:02X}{b:02X}"
                    }

            print(f"   ✅ 加载了 {len(self.regionyields_db)} 个资源颜色 (8.0 regionyields)。")
        except Exception as e:
            print(f"   ❌ Regionyields XML Error: {e}")

    # =======================================================
    # 1.4 加载 9.0 resource_map 颜色映射（版本专用）
    # =======================================================
    def load_resource_map_colors(self):
        """9.0 Empire: 从 colors/final.xml 提取 resource_map_{ware_id} → color → RGB"""
        print(f"🎨 [1.4/5] 解析 resource_map 映射 (9.0 颜色)...")
        colors_path = get_library_xml(self.raw_path, "colors")
        if not os.path.exists(colors_path):
            print(f"   ⚠️ 警告：找不到颜色定义文件：{colors_path}")
            return

        try:
            tree = ET.parse(colors_path)
            root = tree.getroot()

            # 1. 解析颜色定义
            color_defs = {}
            for c in root.findall(".//colors/color"):
                c_id = c.get('id')
                r, g, b = int(c.get('r', 0)), int(c.get('g', 0)), int(c.get('b', 0))
                color_defs[c_id] = f"#{r:02X}{g:02X}{b:02X}"

            # 2. 解析 resource_map_* 映射
            # 特殊映射: mapping_id 后缀 → 实际 ware_id
            resource_map_to_ware_id = {
                'scrap': 'rawscrap',
                'khaakscrap': 'rawkhaakscrap'
            }
            for m in root.findall(".//mappings/mapping"):
                mapping_id = m.get('id')
                if mapping_id and mapping_id.startswith('resource_map_'):
                    # 提取 ware_id: resource_map_ore → ore
                    extracted_id = mapping_id.replace('resource_map_', '')
                    ware_id = resource_map_to_ware_id.get(extracted_id, extracted_id)
                    color_ref = m.get('ref')
                    if color_ref and color_ref in color_defs:
                        self.resource_map_colors[ware_id] = {
                            'color_id': color_ref,
                            'color_rgb': color_defs[color_ref]
                        }

            print(f"   ✅ 加载了 {len(self.resource_map_colors)} 个资源颜色映射 (9.0 resource_map)。")
        except Exception as e:
            print(f"   ❌ Colors XML Error: {e}")

    def _get_module_colors(self, m_type, m_group=None):
        # 优先处理远征组逻辑 
        if m_group and 'venture' in m_group.lower(): 
            # 特殊映射处理 
            if 'dock' in m_type.lower(): m_type = 'venturedock' 
            elif 'connection' in m_type.lower(): m_type = 'ventureconnection' 
            else: m_type = 'ventureplatform' 

        # 内部映射逻辑: 模块类型 -> Holomap Mapping ID 
        type_to_mapping = {
            'production': 'holomap_component_production',
            'storage': 'holomap_component_storage',
            'habitation': 'holomap_component_habitation',
            'defencemodule': 'holomap_component_defence',
            'defense': 'holomap_component_defence',
            'dockarea': 'holomap_component_dockingbay',
            'pier': 'holomap_component_pier',
            'connectionmodule': 'holomap_component_connection',
            'processingmodule': 'holomap_component_processing',
            'ventureplatform': 'holomap_component_ventureplatform',
            'welfaremodule': 'holomap_component_welfare',
            'buildmodule': 'holomap_component_build',
            'radar': 'holomap_component_radar'
        }
        mapping_id = type_to_mapping.get(m_type, f"holomap_component_{m_type}")
        color_id = self.mappings_db.get(mapping_id, self.mappings_db.get('holomap_component_base', 'grey_160'))
        hex_color = self.colors_db.get(color_id, "#A0A0A0")
        return color_id, hex_color

    # =======================================================
    # 1.5 处理模块分组 (Module Groups - 合并 Waregroups 和 ModuleTypes)
    # =======================================================
    def process_module_groups(self):
        print(f"📦 [1.5/5] 解析 waregroups/final.xml 并合并配置...")
        wg_path = get_library_xml(self.raw_path, "waregroups")
        
        # 1. 解析 XML 中的 Waregroups
        if os.path.exists(wg_path):
            try:
                tree = ET.parse(wg_path)
                root = tree.getroot()
                count = 0
                for group in root.findall('group'):
                    g_id = group.get('id')
                    g_name = group.get('name', '')
                    color_id, hex_color = self._get_module_colors("production", g_id)
                    # 忽略 icon, 只保留 id 和 name
                    self.module_groups_result.append({
                        "id": g_id,
                        "nameId": g_name,
                        "type": "production",
                        "name": g_name, # 占位
                        "color": color_id,
                        "color_rgb": hex_color
                    })
                    if g_name: self.needed_raw_names.add(g_name)
                    count += 1
                print(f"   ✅ 解析了 {count} 个商品组。")
            except Exception as e:
                print(f"   ❌ Waregroups XML Error: {e}")

        # 2. 合并配置文件中的 Module Types
        count_types = 0
        for m_type, raw_key in self.config.get('module_types', {}).items():
            color_id, hex_color = self._get_module_colors(m_type, m_type)
            # 避免重复 (如果配置里的 key 和 group id 冲突，优先保留 xml 的? 或者 append 即可，这里简单 append)
            self.module_groups_result.append({
                "id": m_type,
                "nameId": raw_key,
                "type": m_type,
                "name": raw_key, # 占位
                "color": color_id,
                "color_rgb": hex_color
            })
            if raw_key: self.needed_raw_names.add(raw_key)
            count_types += 1
        print(f"   ✅ 合并了 {count_types} 个基础模块类型配置。")


    # =======================================================
    # 2. 扫描资产 (Assets) -> 改为读取聚合库
    # =======================================================
    def scan_assets(self):
        print(f"🔍 [2/5] 从 module_macros.xml 读取宏定义...")
        macro_race_set = set()
        macro_method_set = set()
        unmapped_types = defaultdict(list)
        macros_path = os.path.join(self.raw_path, "libraries", "module_macros.xml")
        
        if not os.path.exists(macros_path):
            print(f"❌ 错误: 找不到宏定义文件: {macros_path}")
            sys.exit(1)

        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()
            
            # Distiller 生成的 macros_final.xml 根节点为 <macros>，子节点为 <macro>
            # 不再需要 glob 扫描文件，直接遍历 XML 树
            
            count = 0
            # 遍历所有 macro 节点
            for macro in root.findall('macro'):
                fname = macro.get('name')
                
                # 过滤：只处理我们在 wares.xml 中识别到的模块
                if fname not in self.valid_macros:
                    continue
                    
                m_class = macro.get('class')
                info = self.valid_macros[fname]
                
                # Check build availability
                build_node = macro.find('properties/build')
                is_player_bp = (build_node is not None)
                
                wf_node = macro.find('properties/workforce')
                wf_val = int(wf_node.get('max') or wf_node.get('amount') or 0) if wf_node is not None else 0
                wf_cap = int(wf_node.get('capacity') or 0) if wf_node is not None else 0

                module_data = {
                    "id": info['module_ware_id'],
                    "macroId": fname,
                    "wareId": info['module_ware_id'], 
                    "nameId": info['name_id'], 
                    "name": info['name_id'], 
                    "dlc_tag": self.ware_dlc_tags.get(info['module_ware_id'], "base"),
                    "type": m_class, 
                    "group": m_class, 
                    "method": "none",
                    "race": "default",
                    "isPlayerBlueprint": is_player_bp,
                    "buildTime": info['build_time'], 
                    "buildCost": info['build_cost'],
                    "tier": 0,
                    "cycleTime": 0,
                    "workforce": { "capacity": wf_cap, "needed": wf_val, "maxBonus": 0 },
                    "outputs": {}, 
                    "inputs": {},
                    "dockingCount": 0,
                    "buildProcessorCount": 0,
                    "buildShipClasses": [],
                }
                
                # 初始颜色分配 
                module_data['color'], module_data['color_rgb'] = self._get_module_colors(m_class)

                # Count build processors for build modules
                if m_class == 'buildmodule':
                    bp_connections = macro.findall("./connections/connection[@ref='buildprocessorconnection']")
                    module_data['buildProcessorCount'] = len(bp_connections)
                    builder = macro.find('properties/builder')
                    if builder is not None:
                        classes_raw = builder.get('classes', '')
                        module_data['buildShipClasses'] = [c for c in classes_raw.split() if c]

                # Fix: Check identification tag for specific module types
                ident = macro.find('properties/identification')
                if ident is not None:
                    # 提取真实制造商种族
                    maker_race = ident.get('makerrace')
                    if maker_race:
                        macro_race_set.add(maker_race)
                        module_data['race'] = maker_race

                    # 标记不可建造种族
                    non_player_races = {'xenon', 'khaak', 'unknown'}
                    module_data['isPlayerBlueprint'] = is_player_bp and (module_data['race'] not in non_player_races)
                    raw_type = ident.get('type')
                    if raw_type:
                        if raw_type in SPECIAL_TYPE_MAPPING:
                            module_data['group'] = SPECIAL_TYPE_MAPPING[raw_type]
                        else:
                            unmapped_types[raw_type].append(fname)
                        module_data['color'], module_data['color_rgb'] = self._get_module_colors(raw_type, module_data.get('group'))

                if m_class == 'production':
                    prod_tag = macro.find('properties/production')
                    if prod_tag is not None:
                        # Fix: Handle multiple outputs via <queue> tags (e.g. Scrap Recycler)
                        production_configs = []
                        queue_tag = prod_tag.find('queue')
                        
                        # Strategy 1: <queue><item ware="..."/></queue>
                        if queue_tag is not None and len(queue_tag.findall('item')) > 0:
                            for item in queue_tag.findall('item'):
                                production_configs.append((item.get('ware'), item.get('method', 'default')))
                        
                        # Strategy 2: <queue ware="..." method="..."/>
                        elif queue_tag is not None and queue_tag.get('ware'):
                            production_configs.append((queue_tag.get('ware'), queue_tag.get('method', 'default')))
                        
                        # Strategy 3: <production wares="..." method="..."/> (Fallback)
                        else:
                            p_wares = prod_tag.get('wares')
                            if p_wares:
                                production_configs.append((p_wares, prod_tag.get('method', 'default')))
                        
                        for p_id, p_method in production_configs:
                            macro_method_set.add(p_method)
                            module_data['method'] = p_method
                            # Update Group info based on first valid ware
                            if 'group' not in module_data or module_data['group'] == module_data['type']:
                                target_ware = next((w for w in self.wares_data if w['id'] == p_id), None)
                                if target_ware and target_ware.get('group'):
                                    module_data["group"] = target_ware['group']
                            
                            recipe = self.recipes.get(p_id, {}).get(p_method)
                            if not recipe:
                                recipe = self.recipes.get(p_id, {}).get('default')
                            if recipe:
                                factor = 3600 / recipe['time']
                                module_data["cycleTime"] = recipe['time']
                                module_data["outputs"][p_id] = module_data["outputs"].get(p_id, 0) + round(recipe['amount'] * factor, 2)
                                for k, v in recipe['inputs'].items():
                                    module_data["inputs"][k] = module_data["inputs"].get(k, 0) + round(v * factor, 2)
                                module_data["workforce"]["maxBonus"] = max(module_data["workforce"]["maxBonus"], recipe['bonus'])
                        
                        # 计算模块 Tier: 取所有产物中最高的 Tier 
                        module_data['tier'] = max([self.ware_tier_map.get(p_id, 0) for p_id, _ in production_configs] or [0])
                    
                if m_class == 'storage':
                    cargo = macro.find('properties/cargo')
                    if cargo is not None: 
                        # cargo max 可能是 tags="container" max="10000" 这种形式
                        # [Modified] Extract both max (capacity) and tags (type)
                        cap = int(cargo.get('max', 0))
                        tags = cargo.get('tags', '')
                        
                        # Simple mapping for primary tag
                        c_type = 'container'
                        if 'liquid' in tags: c_type = 'liquid'
                        elif 'solid' in tags: c_type = 'solid'
                        
                        module_data['cargo'] = {
                            "capacity": cap,
                            "type": c_type
                        }

                if m_class == 'pier':
                    # 统计 pier 宏中 <connections> 下 <connection> 节点数量
                    # 作为泊位连接数量输出为 dockingCount
                    connections_node = macro.find('connections')
                    if connections_node is not None:
                        module_data['dockingCount'] = len(connections_node.findall('connection'))

                self.all_modules.append(module_data)
                count += 1
            

            if unmapped_types:
                print("⚠️  [警告] 发现未映射的模块类型 (Identification Type):")
                for u_type, macros in unmapped_types.items():
                    sample = ", ".join(macros[:5])
                    if len(macros) > 5: sample += f" ... (+{len(macros)-5} more)"
                    print(f"   - {u_type}: Found in {len(macros)} macros ({sample})")
            print(f"   ℹ️  Macros中使用的种族生产方式: {sorted(list(macro_race_set))}")
            print(f"   ℹ️  Macros中使用的生产方式: {sorted(list(macro_method_set))}")
            print(f"   ✅ 解析完成: 从聚合库中提取 {count} 个模块数据。")

        except Exception as e: 
            print(f"   ❌ Macro Parse Error: {e}")

    # =======================================================
    # 2.1 解析飞船与装备数据
    # =======================================================
    def parse_ship_and_equipment_data(self):
        print(f"🚀 [2.1/5] 解析 ship/equipment 数据...")
        self.shipgroup_by_macro = self._load_shipgroups()
        self.ship_connections = self._load_ship_connections()
        self.ship_connections_raw = self._load_ship_connections_raw()
        self.ship_macros = self._load_ship_macros()
        self.ship_connection_macros = self._load_ship_connection_macros()
        self.ship_defaults = self._load_ship_defaults()
        self.loadouts_map = self._load_loadouts(self.ship_macros, self.ship_connections)
        self.equipment_component_tags_by_name = self._load_equipment_component_tags()
        self._build_ships(self.ship_macros, self.ship_connections, self.loadouts_map, self.shipgroup_by_macro, self.ship_connection_macros, self.ship_defaults)
        self._build_equipments()

    def _split_tags(self, tags_str):
        return [t for t in tags_str.split() if t]

    def _collect_slot_tag_counts(self, tags):
        for tag in tags or []:
            if tag in SLOT_TAG_I18N_TARGETS:
                self.slot_tag_counts[tag] += 1

    def _detect_equipment_types(self, tags):
        types = []
        if "engine" in tags: types.append("engine")
        if "shield" in tags: types.append("shield")
        if "weapon" in tags or "primaryweapon" in tags: types.append("weapon")
        if "turret" in tags: types.append("turret")
        if "thruster" in tags: types.append("thruster")
        return types

    def _normalize_group(self, group, name):
        group_key = (group or "").strip()
        if not group_key:
            return name, True
        return group_key, False

    def _extract_ship_race(self, ship_name):
        if not ship_name:
            return None
        parts = ship_name.split('_')
        abbrev = parts[1] if len(parts) > 1 else None
        if not abbrev:
            return None
        abbrev = abbrev.lower()
        race_map = {
            "arg": "argon",
            "tel": "teladi",
            "par": "paranid",
            "spl": "split",
            "ter": "terran",
            "bor": "boron",
            "xen": "xenon",
            "kha": "khaak",
            "pir": "pirates",
            "yak": "yaki",
            "atf": "terran",
            "gen": "generic"
        }
        return race_map.get(abbrev, abbrev)

    def _build_drone_tags(self, purpose_primary, cargo_entries, build_engine_macro=None):
        tags = []
        if purpose_primary == 'build':
            if build_engine_macro == 'engine_gen_xs_repairdrone_01_macro':
                return []
            return ['build']
        if purpose_primary == 'mine':
            tags.append(purpose_primary)
            cargo_types = {entry.get('type') for entry in (cargo_entries or [])}
            if 'liquid' in cargo_types:
                tags.append('liquid')
            if 'solid' in cargo_types:
                tags.append('solid')
        return tags

    def _build_ship_connection_storage(self, ship_entry, ship_macro_info, ship_connection_macros):
        """从 ship_connection_macros 构建 storage/dockarea/shipstorage"""
        connection_macro_refs = ship_macro_info.get('connectionMacroRefs', [])
        storage_list = []      # [{type, capacity}]
        dockarea_list = []     # [{size, capacity}]
        shipstorage_list = []  # [{size, capacity}]

        def process_macro(macro_ref, visited=None):
            if visited is None:
                visited = set()
            if macro_ref in visited:
                return
            visited.add(macro_ref)

            macro_info = ship_connection_macros.get(macro_ref)
            if not macro_info:
                return
            macro_class = macro_info.get('class')

            if macro_class == "storage":
                for item in macro_info.get('storage', []):
                    storage_list.append(item)
            elif macro_class == "dockingbay":
                for item in macro_info.get('dockarea', []):
                    dockarea_list.append(item)
                for item in macro_info.get('shipstorage', []):
                    shipstorage_list.append(item)
            elif macro_class == "dockarea":
                dockingbay_refs = macro_info.get('dockingbayRefs', [])
                for db_ref in dockingbay_refs:
                    process_macro(db_ref, visited)

        for macro_ref in connection_macro_refs:
            process_macro(macro_ref)

        # 合并 entries
        def merge_entries(entries, key):
            merged = {}
            for entry in entries:
                val = entry.get(key)
                if val:
                    merged[val] = merged.get(val, 0) + entry.get('capacity', 1)
            return [{key: k, "capacity": v} for k, v in merged.items()] if merged else []

        ship_entry["cargo"] = merge_entries(storage_list, 'type')
        ship_entry["dockarea"] = merge_entries(dockarea_list, 'size')
        ship_entry["shipstorage"] = merge_entries(shipstorage_list, 'size')

    def _extract_type_size(self, tags, types):
        size = None
        for t in tags:
            if t in {"small", "medium", "large", "extralarge"}:
                size = t
                break
            if t == "xl":
                size = "extralarge"
                break
        equip_type = types[0] if types else None
        return equip_type, size

    def _build_cost(self, ware_id):
        if not ware_id: return {}
        recipe_group = self.recipes.get(ware_id, {})
        cost = {}
        for method, recipe in recipe_group.items():
            cost[method] = recipe.get('inputs', {})
        return cost

    def _build_time_by_method(self, ware_id):
        if not ware_id: return {}
        recipe_group = self.recipes.get(ware_id, {})
        build_time = {}
        for method, recipe in recipe_group.items():
            build_time[method] = recipe.get('time', 0)
        return build_time

    def _build_methods(self, ware_info):
        ware_id = ware_info.get("id")
        if not ware_id:
            return []
        recipe_group = self.recipes.get(ware_id, {})
        method_tags = ware_info.get("production_method_tags", {})
        build = []
        for method, recipe in recipe_group.items():
            tags = method_tags.get(method, [])
            build.append({
                "method": method,
                "noplayerbuild": "noplayerbuild" in tags,
                "cost": recipe.get("inputs", {}),
                "time": recipe.get("time", 0)
            })
        return build

    def _extract_equipment_size_from_id(self, equip_id):
        if not equip_id:
            return None
        parts = equip_id.split('_')
        for p in parts:
            if p in {"small", "medium", "large", "extralarge"}:
                return p
            if p in {"s", "m", "l", "xl"}:
                return {"s": "small", "m": "medium", "l": "large", "xl": "extralarge"}[p]
        return None

    def _load_ship_connections_raw(self):
        connections_path = os.path.join(self.raw_path, "libraries", "ship_components.xml")
        mapping = {}
        if not os.path.exists(connections_path):
            print(f"   ⚠️ 警告: 找不到 ship connections 文件: {connections_path}")
            return mapping
        try:
            tree = ET.parse(connections_path)
            root = tree.getroot()
            comp_count = 0
            conn_count = 0
            for comp in root.findall('component'):
                comp_name = comp.get('name')
                if not comp_name:
                    continue
                connections = []
                for conn in comp.findall('./connections/connection'):
                    name = conn.get('name')
                    if not name:
                        continue
                    connections.append({
                        "name": name,
                        "tags": self._split_tags(conn.get('tags', ''))
                    })
                    conn_count += 1
                if connections:
                    mapping[comp_name] = connections
                    comp_count += 1
            print(f"   ✅ 读取 {comp_count} 个 ship components（原始连接点 {conn_count}）。")
        except Exception as e:
            print(f"   ❌ Ship connections XML Error: {e}")
        return mapping

    def _load_equipment_component_tags(self):
        equipment_components_path = os.path.join(self.raw_path, "libraries", "equipment_components.xml")
        mapping = defaultdict(set)
        if not os.path.exists(equipment_components_path):
            print(f"   ⚠️ 警告: 找不到 equipment components 文件: {equipment_components_path}")
            return mapping
        try:
            tree = ET.parse(equipment_components_path)
            root = tree.getroot()
            comp_count = 0
            conn_count = 0
            for comp in root.findall('component'):
                comp_name = comp.get('name')
                if not comp_name:
                    continue
                for conn in comp.findall('./connections/connection'):
                    tags = self._split_tags(conn.get('tags', ''))
                    if tags:
                        mapping[comp_name].update(tags)
                        conn_count += 1
                if comp_name in mapping:
                    comp_count += 1
            print(f"   ✅ 读取 {comp_count} 个 equipment components, {conn_count} 个连接点标签。")
        except Exception as e:
            print(f"   ❌ Equipment components XML Error: {e}")
        return mapping

    def _has_cockpit_connection(self, comp_ref):
        if not comp_ref:
            return False
        for conn in self.ship_connections_raw.get(comp_ref, []):
            tags = conn.get('tags', [])
            name = (conn.get('name') or '').lower()
            if "cockpit" in tags or "bridge" in tags:
                return True
            if "cockpit" in name or "bridge" in name:
                return True
        return False

    def _crew_capacity_gt0(self, ship_info):
        crew = ship_info.get('crew')
        if not crew:
            return False
        capacity = crew.get('capacity')
        return int(capacity or 0) > 0

    def _load_shipgroups(self):
        shipgroups_path = get_library_xml(self.raw_path, "shipgroups")
        mapping = {}
        if not os.path.exists(shipgroups_path):
            print(f"   ⚠️ 警告: 找不到 shipgroups 文件: {shipgroups_path}")
            return mapping
        try:
            tree = ET.parse(shipgroups_path)
            root = tree.getroot()
            for group in root.findall('group'):
                group_name = group.get('name')
                if not group_name: continue
                for sel in group.findall('select'):
                    macro = sel.get('macro')
                    if macro:
                        mapping[macro] = group_name
            print(f"   ✅ 读取 {len(mapping)} 条 shipgroup 映射。")
        except Exception as e:
            print(f"   ❌ Shipgroups XML Error: {e}")
        return mapping

    def _load_ship_connections(self):
        connections_path = os.path.join(self.raw_path, "libraries", "ship_components.xml")
        mapping = {}
        if not os.path.exists(connections_path):
            print(f"   ⚠️ 警告: 找不到 ship connections 文件: {connections_path}")
            return mapping
        try:
            tree = ET.parse(connections_path)
            root = tree.getroot()
            comp_count = 0
            conn_count = 0
            for comp in root.findall('component'):
                comp_name = comp.get('name')
                if not comp_name: continue
                connections = []
                for conn in comp.findall('./connections/connection'):
                    name = conn.get('name')
                    if not name: continue
                    tags = self._split_tags(conn.get('tags', ''))
                    types = self._detect_equipment_types(tags)
                    if not types:
                        continue
                    group_key, is_implicit = self._normalize_group(conn.get('group'), name)
                    connections.append({
                        "name": name,
                        "group": group_key,
                        "isImplicitGroup": is_implicit,
                        "tags": tags,
                        "types": types
                    })
                    conn_count += 1
                if connections:
                    mapping[comp_name] = connections
                    comp_count += 1
            print(f"   ✅ 读取 {comp_count} 个 ship components, {conn_count} 个装配连接点。")
        except Exception as e:
            print(f"   ❌ Ship connections XML Error: {e}")
        return mapping

    def _load_ship_connection_macros(self):
        """加载 ship_connection_macros.xml 中的 storage/dockingbay/dockarea 数据"""
        macros_path = os.path.join(self.raw_path, "libraries", "ship_connection_macros.xml")
        mapping = {}
        if not os.path.exists(macros_path):
            print(f"   ⚠️ 警告: 找不到 ship_connection_macros 文件: {macros_path}")
            return mapping
        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()
            for macro in root.findall('macro'):
                name = macro.get('name')
                if not name:
                    continue
                macro_class = macro.get('class')
                props = macro.find('properties')
                if props is None:
                    continue
                info = {"class": macro_class}
                if macro_class == "storage":
                    # storage: [{type: container/liquid/solid, capacity: Value}]
                    cargo_node = props.find('cargo')
                    if cargo_node is not None:
                        tags = self._split_tags(cargo_node.get('tags', ''))
                        max_val = int(cargo_node.get('max') or 0)
                        for cargo_type in tags:
                            info.setdefault("storage", []).append({
                                "type": cargo_type,
                                "capacity": max_val
                            })
                elif macro_class == "dockingbay":
                    # dockingbay: [{size: dock_xs/s/m/l/xl, capacity: Value}]
                    dock_node = props.find('dock')
                    docksize_node = props.find('docksize')
                    if dock_node is not None and docksize_node is not None:
                        capacity = int(dock_node.get('capacity') or 1)
                        storage_flag = dock_node.get('storage', '0') == '1'
                        size_tags = self._split_tags(docksize_node.get('tags', ''))
                        for size in size_tags:
                            entry = {"size": size, "capacity": capacity}
                            if storage_flag:
                                info.setdefault("shipstorage", []).append(entry)
                            else:
                                info.setdefault("dockarea", []).append(entry)
                elif macro_class == "dockarea":
                    # dockarea: 收集 connections 中的 dockingbay 引用
                    connections_node = macro.find('connections')
                    if connections_node is not None:
                        dockingbay_refs = []
                        for conn in connections_node.findall('connection'):
                            macro_ref = conn.find('macro')
                            if macro_ref is not None and macro_ref.get('ref'):
                                dockingbay_refs.append(macro_ref.get('ref'))
                        if dockingbay_refs:
                            info["dockingbayRefs"] = dockingbay_refs
                mapping[name] = info
            print(f"   ✅ 读取 {len(mapping)} 个 ship connection macros 的 storage/dockingbay/dockarea 数据。")
        except Exception as e:
            print(f"   ❌ Ship connection macros XML Error: {e}")
        return mapping

    def _load_ship_defaults(self):
        """加载 defaults/final.xml 中各 ship class 的默认属性"""
        defaults_path = get_library_xml(self.raw_path, "defaults")
        mapping = {}
        if not os.path.exists(defaults_path):
            print(f"   ⚠️ 警告: 找不到 defaults 文件: {defaults_path}")
            return mapping
        try:
            tree = ET.parse(defaults_path)
            root = tree.getroot()
            for dataset in root.findall('dataset'):
                class_name = dataset.get('class')
                if not class_name or not class_name.startswith('ship_'):
                    continue
                props = dataset.find('properties')
                if props is None:
                    continue

                info = {}
                # radar range
                radar_node = props.find('radar')
                if radar_node is not None:
                    info['radarRange'] = int(radar_node.get('range') or 0)

                # storage (countermeasure, deployable)
                storage_node = props.find('storage')
                if storage_node is not None:
                    info['countermeasure'] = int(storage_node.get('countermeasure') or 0)
                    info['deployable'] = int(storage_node.get('deployable') or 0)

                # docksize
                docksize_node = props.find('docksize')
                if docksize_node is not None:
                    info['docksize'] = docksize_node.get('tag')

                if info:
                    mapping[class_name] = info

            print(f"   ✅ 读取 {len(mapping)} 个 ship class 的默认属性。")
        except Exception as e:
            print(f"   ❌ Ship defaults XML Error: {e}")
        return mapping

    def _load_ship_max_statistics(self):
        """加载 defaults/final.xml 中各 ship class 的最大统计数据 (statistics.max)"""
        defaults_path = get_library_xml(self.raw_path, "defaults")
        mapping = {}
        if not os.path.exists(defaults_path):
            print(f"   ⚠️ 警告：找不到 defaults 文件：{defaults_path}")
            return mapping

        try:
            tree = ET.parse(defaults_path)
            root = tree.getroot()
            for dataset in root.findall('dataset'):
                class_name = dataset.get('class')
                if not class_name or class_name not in ('ship_xl', 'ship_l', 'ship_m', 'ship_s'):
                    continue

                props = dataset.find('properties')
                if props is None:
                    continue

                stats = props.find('statistics')
                if stats is None:
                    continue

                max_node = stats.find('max')
                if max_node is None:
                    continue

                info = {}

                # hull
                hull = max_node.find('hull')
                if hull is not None:
                    info['hull'] = float(hull.get('value', 0))

                # weapon
                weapon = max_node.find('weapon')
                if weapon is not None:
                    info['weapon_burst'] = float(weapon.get('burst', 0))
                    info['weapon_sustained'] = float(weapon.get('sustained', 0))

                # 外层 shield (始终保留)
                shield_node = max_node.find('shield')
                if shield_node is not None:
                    info['shield_value'] = float(shield_node.get('value', 0))
                    info['shield_delay'] = float(shield_node.get('delay', 0))
                    info['shield_rate'] = float(shield_node.get('rate', 0))

                # 外层 turret (始终保留)
                turret_node = max_node.find('turret')
                if turret_node is not None:
                    info['turret_value'] = float(turret_node.get('burst', 0))
                    info['turret_sustained_value'] = float(turret_node.get('sustained', 0))

                # groups (始终设置 group_shield_* 和 turret_*)
                groups = max_node.find('groups')
                if groups is not None:
                    # groups.shield -> group_shield_* (始终设置)
                    group_shield = groups.find('shield')
                    if group_shield is not None:
                        gs_value = float(group_shield.get('value', 0))
                        if gs_value > 0:
                            info['group_shield_value'] = gs_value
                            info['group_shield_delay'] = float(group_shield.get('delay', 0))
                            info['group_shield_rate'] = float(group_shield.get('rate', 0))
                        else:
                            # groups.shield.value = 0，使用外层的值
                            info['group_shield_value'] = info.get('shield_value', 0)
                            info['group_shield_delay'] = info.get('shield_delay', 0)
                            info['group_shield_rate'] = info.get('shield_rate', 0)
                    else:
                        # 没有 groups.shield，使用外层的值
                        info['group_shield_value'] = info.get('shield_value', 0)
                        info['group_shield_delay'] = info.get('shield_delay', 0)
                        info['group_shield_rate'] = info.get('shield_rate', 0)

                    # groups.turret -> turret_* (始终设置)
                    group_turret = groups.find('turret')
                    if group_turret is not None:
                        gt_burst = float(group_turret.get('burst', 0))
                        if gt_burst > 0:
                            info['turret_burst'] = gt_burst
                            info['turret_sustained'] = float(group_turret.get('sustained', 0))
                        else:
                            info['turret_burst'] = info.get('turret_value', 0)
                            info['turret_sustained'] = info.get('turret_sustained_value', 0)
                    else:
                        info['turret_burst'] = info.get('turret_value', 0)
                        info['turret_sustained'] = info.get('turret_sustained_value', 0)
                else:
                    # 没有 groups 节点，使用外层的值
                    info['group_shield_value'] = info.get('shield_value', 0)
                    info['group_shield_delay'] = info.get('shield_delay', 0)
                    info['group_shield_rate'] = info.get('shield_rate', 0)
                    info['turret_burst'] = info.get('turret_value', 0)
                    info['turret_sustained'] = info.get('turret_sustained_value', 0)

                # dock
                dock = max_node.find('dock')
                if dock is not None:
                    info['dock_ship_m'] = int(dock.get('ship_m', 0))
                    info['dock_ship_s'] = int(dock.get('ship_s', 0))

                # engine
                engine = max_node.find('engine')
                if engine is not None:
                    info['engine_forward'] = float(engine.get('forward', 0))
                    info['engine_acceleration'] = float(engine.get('acceleration', 0))
                    info['engine_yaw'] = float(engine.get('yaw', 0))
                    info['engine_pitch'] = float(engine.get('pitch', 0))
                    info['engine_roll'] = float(engine.get('roll', 0))

                # boost
                boost = max_node.find('boost')
                if boost is not None:
                    info['boost_speed'] = float(boost.get('speed', 0))
                    info['boost_acceleration'] = float(boost.get('acceleration', 0))
                    info['boost_duration'] = float(boost.get('duration', 0))
                    info['boost_recharge'] = float(boost.get('recharge', 0))

                # travel
                travel = max_node.find('travel')
                if travel is not None:
                    info['travel_speed'] = float(travel.get('speed', 0))
                    info['travel_acceleration'] = float(travel.get('acceleration', 0))
                    info['travel_charge_time'] = float(travel.get('chargetime', 0))

                # thruster
                thruster = max_node.find('thruster')
                if thruster is not None:
                    horizontal = thruster.find('horizontal')
                    if horizontal is not None:
                        info['thruster_horizontal_speed'] = float(horizontal.get('speed', 0))
                        info['thruster_horizontal_acceleration'] = float(horizontal.get('acceleration', 0))
                    vertical = thruster.find('vertical')
                    if vertical is not None:
                        info['thruster_vertical_speed'] = float(vertical.get('speed', 0))
                        info['thruster_vertical_acceleration'] = float(vertical.get('acceleration', 0))

                # capacity
                capacity = max_node.find('capacity')
                if capacity is not None:
                    info['capacity_crew'] = int(capacity.get('crew', 0))
                    info['capacity_container'] = int(capacity.get('container', 0))
                    info['capacity_solid'] = int(capacity.get('solid', 0))
                    info['capacity_liquid'] = int(capacity.get('liquid', 0))
                    info['capacity_condensate'] = int(capacity.get('condensate', 0))
                    info['capacity_ship_m'] = int(capacity.get('ship_m', 0))
                    info['capacity_ship_s'] = int(capacity.get('ship_s', 0))
                    info['capacity_unit'] = int(capacity.get('unit', 0))
                    info['capacity_missile'] = int(capacity.get('missile', 0))
                    info['capacity_countermeasure'] = int(capacity.get('countermeasure', 0))
                    info['capacity_deployable'] = int(capacity.get('deployable', 0))

                # radar (in max)
                radar = max_node.find('radar')
                if radar is not None:
                    info['radar_range'] = float(radar.get('range', 0))

                if info:
                    mapping[class_name] = info

        except Exception as e:
            print(f"   ❌ Ship max statistics XML Error: {e}")
        if mapping:
            print(f"   ✅ 读取 {len(mapping)} 个 ship class 的最大统计数据。")
        return mapping

    def _load_ship_macros(self):
        macros_path = os.path.join(self.raw_path, "libraries", "ship_macros.xml")
        mapping = {}
        if not os.path.exists(macros_path):
            print(f"   ⚠️ 警告: 找不到 ship macros 文件: {macros_path}")
            return mapping
        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()
            for macro in root.findall('macro'):
                name = macro.get('name')
                if not name: continue
                if macro.get('class') == 'ship_xs':
                    continue
                comp_node = macro.find('component')
                if comp_node is None or not comp_node.get('ref'):
                    continue
                comp_ref = comp_node.get('ref')
                props = macro.find('properties')
                ship_node = props.find('ship') if props is not None else None
                storage_node = props.find('storage') if props is not None else None
                people_node = props.find('people') if props is not None else None
                hull_node = props.find('hull') if props is not None else None
                physics_node = props.find('physics') if props is not None else None
                thruster_node = props.find('thruster') if props is not None else None
                radar_node = props.find('radar') if props is not None else None
                purpose_node = props.find('purpose') if props is not None else None

                storage = None
                if storage_node is not None:
                    storage = {
                        "missile": int(storage_node.get('missile') or 0),
                        "unit": int(storage_node.get('unit') or 0)
                    }

                crew = None
                if people_node is not None:
                    crew = {
                        "capacity": int(people_node.get('capacity') or 0)
                    }

                physics = None
                if physics_node is not None:
                    drag = physics_node.find('drag')
                    accfactors = physics_node.find('accfactors')
                    physics = {
                        "mass": float(physics_node.get('mass') or 0),
                        "drag": {
                            "forward": float(drag.get('forward') or 0) if drag is not None else 0,
                            "reverse": float(drag.get('reverse') or 0) if drag is not None else 0,
                            "horizontal": float(drag.get('horizontal') or 0) if drag is not None else 0,
                            "vertical": float(drag.get('vertical') or 0) if drag is not None else 0,
                            "pitch": float(drag.get('pitch') or 0) if drag is not None else 0,
                            "yaw": float(drag.get('yaw') or 0) if drag is not None else 0,
                            "roll": float(drag.get('roll') or 0) if drag is not None else 0
                        },
                        "accfactors": {
                            "horizontal": float(accfactors.get('horizontal') or 1) if accfactors is not None else 1,
                            "vertical": float(accfactors.get('vertical') or 1) if accfactors is not None else 1
                        }
                    }

                thruster_tags = []
                if thruster_node is not None:
                    thruster_tags = self._split_tags(thruster_node.get('tags', ''))

                radar_range = None
                if radar_node is not None:
                    radar_range = int(radar_node.get('range') or 0)

                # 收集所有 connections 中的 macro 引用
                connection_macro_refs = []
                connections_node = macro.find('connections')
                if connections_node is not None:
                    for conn in connections_node.findall('connection'):
                        macro_ref = conn.find('macro')
                        if macro_ref is not None and macro_ref.get('ref'):
                            connection_macro_refs.append(macro_ref.get('ref'))

                mapping[name] = {
                    "id": name,
                    "class": macro.get('class'),
                    "component": comp_ref,
                    "shipType": ship_node.get('type') if ship_node is not None else None,
                    "purposePrimary": purpose_node.get('primary') if purpose_node is not None else None,
                    "storage": storage,
                    "crew": crew,
                    "hull": int(hull_node.get('max') or 0) if hull_node is not None else 0,
                    "physics": physics,
                    "thrusterTags": thruster_tags,
                    "radarRange": radar_range,
                    "connectionMacroRefs": connection_macro_refs
                }
            print(f"   ✅ 读取 {len(mapping)} 个 ship macros。")
        except Exception as e:
            print(f"   ❌ Ship macros XML Error: {e}")
        return mapping

    def _load_loadouts(self, ship_macros, ship_connections):
        loadouts_path = get_library_xml(self.raw_path, "loadouts")
        mapping = {}
        if not os.path.exists(loadouts_path):
            print(f"   ⚠️ 警告: 找不到 loadouts 文件: {loadouts_path}")
            return mapping

        def normalize_equip_type(tag_name):
            tag = tag_name.lower()
            if tag.endswith('s'):
                tag = tag[:-1]
            return tag

        def add_entry(ship_macro, group_key, equip_type, macro_id, count, optional):
            if not ship_macro or not group_key or not equip_type or not macro_id:
                return
            ship_entry = mapping.setdefault(ship_macro, {})
            group_entry = ship_entry.setdefault(group_key, {})
            type_entry = group_entry.setdefault(equip_type, {})
            if macro_id not in type_entry:
                type_entry[macro_id] = {"count": 0, "optional": 0}
            type_entry[macro_id]["count"] += count
            if optional:
                type_entry[macro_id]["optional"] += count

        try:
            tree = ET.parse(loadouts_path)
            root = tree.getroot()
            for loadout in root.findall('loadout'):
                ship_macro = loadout.get('macro')
                if not ship_macro: continue
                comp_ref = ship_macros.get(ship_macro, {}).get('component')
                connection_map = {}
                if comp_ref and comp_ref in ship_connections:
                    for conn in ship_connections[comp_ref]:
                        connection_map[conn['name']] = conn['group']

                macros_node = loadout.find('macros')
                if macros_node is not None:
                    for entry in list(macros_node):
                        equip_type = normalize_equip_type(entry.tag)
                        macro_id = entry.get('macro')
                        path = (entry.get('path') or "").strip()
                        conn_name = path.split('/')[-1].strip() if path else ''
                        group_key = connection_map.get(conn_name, conn_name) if conn_name else None
                        count = 1
                        optional = entry.get('optional') == '1'
                        add_entry(ship_macro, group_key, equip_type, macro_id, count, optional)

                groups_node = loadout.find('groups')
                if groups_node is not None:
                    for entry in list(groups_node):
                        equip_type = normalize_equip_type(entry.tag)
                        macro_id = entry.get('macro')
                        group_key = entry.get('group')
                        if not group_key: 
                            continue
                        count = int(entry.get('exact') or 1)
                        optional = entry.get('optional') == '1'
                        add_entry(ship_macro, group_key, equip_type, macro_id, count, optional)

            print(f"   ✅ 读取 {len(mapping)} 个 loadout 配置。")
        except Exception as e:
            print(f"   ❌ Loadouts XML Error: {e}")
        return mapping

    def _build_ships(self, ship_macros, ship_connections, loadouts_map, shipgroup_by_macro, ship_connection_macros=None, ship_defaults=None):
        if ship_connection_macros is None:
            ship_connection_macros = {}
        if ship_defaults is None:
            ship_defaults = {}
        ship_slot_extract_failures = []
        debug_macros = ['ship_tel_s_racer_01_a_macro', 'ship_tel_s_racer_01_a']
        for ship_macro, info in ship_macros.items():
            if ship_macro in debug_macros:
                print(f"\n🔍 [DEBUG] Processing {ship_macro}")
                print(f"   info keys: {list(info.keys())}")
                print(f"   component: {info.get('component')}")
                print(f"   class: {info.get('class')}")
                print(f"   crew: {info.get('crew')}")
            
            comp_ref = info.get('component')
            ship_class = info.get('class')
            defaults = ship_defaults.get(ship_class, {})
            ware_id = self.component_to_ware.get(ship_macro)
            
            if ship_macro in debug_macros:
                print(f"   ware_id from component_to_ware: {ware_id}")
            
            if not ware_id:
                if ship_macro in debug_macros:
                    print(f"   ❌ Filtered: no ware_id found")
                continue
            ware_info = self.ware_index.get(ware_id, {})
            
            if ship_macro in debug_macros:
                print(f"   ware_info transport: {ware_info.get('transport')}")
                print(f"   ware_info tags: {ware_info.get('tags')}")
            
            if ware_info.get('transport') != 'ship':
                if ship_macro in debug_macros:
                    print(f"   ❌ Filtered: transport != 'ship'")
                continue
            tags = self._split_tags(ware_info.get('tags', ''))
            if "noblueprint" in tags:
                if ship_macro in debug_macros:
                    print(f"   ❌ Filtered: noblueprint in tags")
                continue
            name_id = ware_info.get('nameId', ware_id)
            if name_id:
                self.needed_raw_names.add(name_id)
            ship_entry = {
                "id": ware_id,
                "macro": ship_macro,
                "nameId": name_id,
                "name": name_id,
                "dlc_tag": self.ware_dlc_tags.get(ware_id, "base"),
                "class": info.get('class'),
                "type": None,
                "purposePrimary": info.get('purposePrimary'),
                "droneTags": [],
                "race": self._extract_ship_race(ship_macro),
                "shipgroup": shipgroup_by_macro.get(ship_macro),
                "noplayerblueprint": "noplayerblueprint" in tags,
                "production": self._build_methods(ware_info),
                "slots": {}
            }
            production = ship_entry["production"]
            ship_entry["noplayerbuild"] = (not production) or all(p.get("noplayerbuild") for p in production)
            
            crew_ok = self._crew_capacity_gt0(info)
            cockpit_ok = self._has_cockpit_connection(comp_ref)
            
            if ship_macro in debug_macros:
                print(f"   crew_capacity_gt0: {crew_ok}")
                print(f"   has_cockpit_connection: {cockpit_ok}")
            
            if not crew_ok or not cockpit_ok:
                if ship_macro in debug_macros:
                    print(f"   ❌ Filtered: crew_ok={crew_ok}, cockpit_ok={cockpit_ok}")
                continue
            ship_type = info.get('shipType')
            ship_entry["type"] = ship_type
            if ship_type:
                self.ship_type_counts[ship_type] += 1
                ship_class = info.get('class')
                if ship_class:
                    self.ship_type_class_map[ship_type].add(ship_class)

            # 构建 storage/dockarea/shipstorage
            self._build_ship_connection_storage(ship_entry, info, ship_connection_macros)
            ship_entry["droneTags"] = self._build_drone_tags(
                ship_entry.get("purposePrimary"),
                ship_entry.get("cargo", [])
            )

            # storage: 总是包含 countermeasure 和 deployable，默认为 0
            if info.get('storage') is not None:
                storage_data = dict(info.get('storage'))  # 复制一份
                storage_data['countermeasure'] = defaults.get('countermeasure', 0)
                storage_data['deployable'] = defaults.get('deployable', 0)
                ship_entry["storage"] = storage_data
            if info.get('crew') is not None:
                ship_entry["crew"] = info.get('crew')
            if info.get('hull') is not None:
                ship_entry["hull"] = info.get('hull')
            if info.get('physics') is not None:
                ship_entry["physics"] = info.get('physics')

            # radarRange: 当前数据优先，defaults 备用
            # radarRange: 当前数据优先，defaults 备用，默认为 0
            radar_range = info.get('radarRange') or defaults.get('radarRange') or 0
            ship_entry["radarRange"] = radar_range

            groups = {}
            group_types = defaultdict(list)
            for conn in ship_connections.get(comp_ref, []):
                group_key = conn['group']
                group_info = groups.setdefault(group_key, {
                    "group": group_key,
                    "isImplicitGroup": False,
                    "mandatory": False,
                    "connection": None,
                    "shieldConnection": None
                })
                group_info["isImplicitGroup"] = group_info["isImplicitGroup"] or conn.get('isImplicitGroup', False)
                conn_type, conn_size = self._extract_type_size(conn['tags'], conn['types'])
                group_info["mandatory"] = group_info["mandatory"] or ("mandatory" in conn['tags'])
                missing_fields = []
                if not conn_type:
                    missing_fields.append("type")
                if not conn_size:
                    missing_fields.append("size")
                if missing_fields:
                    ship_slot_extract_failures.append({
                        "shipMacro": ship_macro,
                        "shipId": ware_id,
                        "group": group_key,
                        "connection": conn.get("name"),
                        "missing": missing_fields,
                        "tags": conn.get("tags", []),
                        "types": conn.get("types", [])
                    })
                    continue
                tag_blacklist = {conn_type, conn_size}
                filtered_tags = sorted([
                    t for t in conn['tags']
                    if t not in tag_blacklist
                    and t not in {"platformcollision", "envmap_cockpit"}
                    and not t.startswith("symmetry")
                ])
                self._collect_slot_tag_counts(filtered_tags)
                conn_key = tuple(filtered_tags)
                if conn_type == "shield":
                    if group_info["shieldConnection"] is None:
                        group_info["shieldConnection"] = {
                            "size": conn_size,
                            "tags": filtered_tags,
                            "count": 0
                        }
                    group_info["shieldConnection"]["count"] += 1
                else:
                    if group_info["connection"] is None:
                        group_info["connection"] = {
                            "size": conn_size,
                            "tags": filtered_tags,
                            "count": 0
                        }
                    else:
                        # merge tags if they differ
                        merged_tags = set(group_info["connection"]["tags"]) | set(filtered_tags)
                        group_info["connection"]["tags"] = sorted(merged_tags)
                        if group_info["connection"].get("size") is None:
                            group_info["connection"]["size"] = conn_size
                    group_info["connection"]["count"] += 1
                for t in conn['types']:
                    if t not in group_types[group_key]:
                        group_types[group_key].append(t)

            slots_by_type = {}
            for group_key, group_info in groups.items():
                slot_types = group_types.get(group_key, [])
                if not slot_types:
                    continue
                primary_type = next((t for t in slot_types if t != "shield"), slot_types[0])
                shield = group_info.pop("shieldConnection", None)
                if shield:
                    if primary_type == "shield":
                        # For shield slots, the connection itself is the shield.
                        group_info["connection"] = shield
                    else:
                        if group_info["connection"] is None:
                            group_info["connection"] = {"size": shield.get("size"), "tags": [], "count": 0}
                        group_info["connection"]["shield"] = shield

                slots_by_type.setdefault(primary_type, []).append(group_info)

            thruster_tags = info.get("thrusterTags") or []
            if thruster_tags:
                size = self._extract_type_size(thruster_tags, ["thruster"])[1]
                if not size:
                    ship_slot_extract_failures.append({
                        "shipMacro": ship_macro,
                        "shipId": ware_id,
                        "group": "thruster",
                        "connection": "thruster",
                        "missing": ["size"],
                        "tags": thruster_tags,
                        "types": ["thruster"]
                    })
                    continue
                tag_blacklist = {"thruster", size}
                if size == "extralarge":
                    tag_blacklist.add("xl")
                filtered_tags = [
                    t for t in thruster_tags
                    if t not in tag_blacklist
                    and t not in {"platformcollision", "envmap_cockpit"}
                    and not t.startswith("symmetry")
                ]
                self._collect_slot_tag_counts(filtered_tags)
                thruster_group = {
                    "group": "thruster",
                    "isImplicitGroup": True,
                    "mandatory": ("mandatory" in thruster_tags),
                    "connection": {
                        "size": size,
                        "tags": filtered_tags,
                        "count": 1
                    },
                    "equipments": {}
                }
                slots_by_type.setdefault("thruster", []).append(thruster_group)

            slot_order = ["engine", "thruster", "shield", "weapon", "turret"]
            ship_entry["slots"] = []
            for slot_type in slot_order:
                if slot_type in slots_by_type:
                    size_rank = {"extralarge": 0, "large": 1, "medium": 2, "small": 3}
                    sorted_groups = sorted(
                        slots_by_type[slot_type],
                        key=lambda group_info: (
                            size_rank.get((group_info.get("connection") or {}).get("size"), 99),
                            (group_info.get("group") or "").lower(),
                            group_info.get("group") or ""
                        )
                    )
                    counts = defaultdict(int)
                    for group_info in sorted_groups:
                        conn = group_info.get("connection")
                        if not conn:
                            continue
                        size = conn.get("size")
                        if size:
                            counts[size] += conn.get("count", 0)
                        for tag in conn.get("tags", []):
                            if tag:
                                self.ship_slot_tags_by_type[slot_type].add(tag)
                    ship_entry["slots"].append({
                        "type": slot_type,
                        "count": dict(counts),
                        "groups": sorted_groups
                    })

            self.ships_data.append(ship_entry)

        print(f"   ✅ 生成 {len(self.ships_data)} 条 ships 数据。")
        if ship_slot_extract_failures:
            print(f"   ⚠️ 飞船 slot 提取失败 {len(ship_slot_extract_failures)} 条 (type/size, no fallback)。")
            for failure in ship_slot_extract_failures:
                missing = "/".join(failure["missing"])
                tags_text = ", ".join(failure["tags"]) if failure["tags"] else "(none)"
                types_text = ", ".join(failure["types"]) if failure["types"] else "(none)"
                conn_name = failure["connection"] or "(unnamed)"
                print(
                    f"      - {failure['shipMacro']} (id={failure['shipId']}, group={failure['group']}, conn={conn_name}): "
                    f"missing={missing}; tags=[{tags_text}]; types=[{types_text}]"
                )
        else:
            print("   ✅ 飞船 slot 提取失败 0 条 (type/size, no fallback)。")
        print("   📌 槽位类型标签汇总:")
        report_order = ["engine", "thruster", "shield", "weapon", "turret"]
        all_slot_types = list(self.ship_slot_tags_by_type.keys())
        ordered_types = [t for t in report_order if t in self.ship_slot_tags_by_type]
        ordered_types.extend(sorted([t for t in all_slot_types if t not in report_order]))
        for slot_type in ordered_types:
            tags = sorted(self.ship_slot_tags_by_type.get(slot_type, set()))
            print(f"      - {slot_type:<8}: {', '.join(tags) if tags else '(none)'}")

        race_noplayerblueprint = defaultdict(lambda: False)
        race_noplayerbuild = defaultdict(lambda: False)
        race_has_ship = set()
        for ship in self.ships_data:
            race = ship.get('race')
            if not race:
                continue
            race_has_ship.add(race)
            if ship.get('noplayerblueprint', False):
                race_noplayerblueprint[race] = True
            if ship.get('noplayerbuild', False):
                race_noplayerbuild[race] = True
        self.ship_races_data = [
            {
                "id": race,
                "noplayerblueprint": race_noplayerblueprint.get(race, False),
                "noplayerbuild": race_noplayerbuild.get(race, False)
            }
            for race in sorted(race_has_ship)
        ]

    def _build_equipments(self):
        macros_path = os.path.join(self.raw_path, "libraries", "equipment_macros.xml")
        if not os.path.exists(macros_path):
            print(f"   ⚠️ 警告: 找不到 equipment macros 文件: {macros_path}")
            return

        class_to_type = {
            "engine": "engine",
            "shieldgenerator": "shield",
            "weapon": "weapon",
            "turret": "turret",
            "missilelauncher": "weapon",
            "missileturret": "turret"
        }
        def detect_equip_type(macro_name, m_class):
            if macro_name and macro_name.startswith("thruster_"):
                return "thruster"
            return class_to_type.get(m_class)

        def parse_ident(props):
            if props is None: return {}
            ident = props.find('identification')
            if ident is None: return {}
            return {
                "mk": ident.get('mk'),
                "race": ident.get('makerrace')
            }

        def parse_hull_integrated(props):
            if props is None:
                return True
            hull = props.find('hull')
            if hull is None:
                return True
            value = (hull.get('integrated') or '').strip().lower()
            if value in {'1', 'true', 'yes'}:
                return True
            if value in {'0', 'false', 'no'}:
                return False
            return True

        def derive_slot_tags(component_ref):
            # slotTags 来源链路:
            # equipment(ware id) -> macro -> macro.component.ref -> equipment_components.xml component(name) -> connection tags
            if not component_ref:
                return []
            return sorted(self.equipment_component_tags_by_name.get(component_ref, set()))

        def extract_type_size_from_slot_tags(slot_tags):
            type_map = {
                "engine": "engine",
                "shield": "shield",
                "weapon": "weapon",
                "primaryweapon": "weapon",
                "turret": "turret",
                "thruster": "thruster"
            }
            size_map = {
                "small": "small",
                "medium": "medium",
                "large": "large",
                "extralarge": "extralarge",
                "s": "small",
                "m": "medium",
                "l": "large",
                "xl": "extralarge"
            }
            derived_type = None
            derived_size = None
            cleaned_slot_tags = []
            for tag in slot_tags:
                if tag == "component":
                    continue
                mapped_type = type_map.get(tag)
                if mapped_type and derived_type is None:
                    derived_type = mapped_type
                    continue
                mapped_size = size_map.get(tag)
                if mapped_size and derived_size is None:
                    derived_size = mapped_size
                    continue
                cleaned_slot_tags.append(tag)
            return derived_type, derived_size, cleaned_slot_tags

        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()
            slot_extract_failures = []
            for macro in root.findall('macro'):
                macro_name = macro.get('name')
                m_class = macro.get('class')
                detected_type = detect_equip_type(macro_name, m_class)
                if not macro_name or not detected_type:
                    continue
                ware_id = self.component_to_ware.get(macro_name)
                if not ware_id:
                    continue
                ware_info = self.ware_index.get(ware_id, {})
                name_id = ware_info.get('nameId', ware_id)
                if name_id:
                    self.needed_raw_names.add(name_id)

                props = macro.find('properties')
                ident_info = parse_ident(props)
                hull_integrated = parse_hull_integrated(props)
                macro_component_ref = None
                macro_component = macro.find('component')
                if macro_component is not None:
                    macro_component_ref = macro_component.get('ref')
                raw_tags = self._split_tags(ware_info.get('tags', ''))
                raw_slot_tags = derive_slot_tags(macro_component_ref)
                # 跳过宇航服相关装备，且不计入提取失败统计
                if "spacesuit" in raw_slot_tags:
                    continue
                filtered_tags = [tag for tag in raw_tags if tag != "noplayerblueprint"]
                no_player_blueprint = "noplayerblueprint" in raw_tags
                equip_type, equip_size, slot_tags = extract_type_size_from_slot_tags(raw_slot_tags)
                self._collect_slot_tag_counts(slot_tags)

                missing_fields = []
                if not equip_type:
                    missing_fields.append("type")
                if not equip_size:
                    missing_fields.append("size")
                if missing_fields:
                    slot_extract_failures.append({
                        "macro": macro_name,
                        "id": ware_id,
                        "class": m_class,
                        "missing": missing_fields,
                        "slotTagsRaw": raw_slot_tags,
                        "slotTagsCleaned": slot_tags
                    })
                    continue

                equipment = {
                    "id": ware_id,
                    "nameId": name_id,
                    "name": name_id,
                    "dlc_tag": self.ware_dlc_tags.get(ware_id, "base"),
                    "type": equip_type,
                    "class": m_class,
                    "mk": ident_info.get('mk'),
                    "race": ident_info.get('race'),
                    "tags": filtered_tags,
                    "noplayerblueprint": no_player_blueprint,
                    "slotTags": slot_tags,
                    "ammunitionTags": [],
                    "integrated": hull_integrated,
                    "size": equip_size,
                    "cost": self._build_cost(ware_id),
                    "buildTime": self._build_time_by_method(ware_id)
                }

                # 提取各类型装备数据到顶层
                if equip_type == "engine" and props is not None:
                    thrust = props.find('thrust')
                    boost = props.find('boost')
                    travel = props.find('travel')
                    if thrust is not None:
                        equipment["thrust"] = {
                            "forward": float(thrust.get('forward') or 0),
                            "reverse": float(thrust.get('reverse') or 0)
                        }
                    if boost is not None:
                        equipment["boost"] = {
                            "duration": float(boost.get('duration') or 0),
                            "recharge": float(boost.get('recharge') or 0),
                            "thrust": float(boost.get('thrust') or 0),
                            "acceleration": float(boost.get('acceleration') or 0)
                        }
                    if travel is not None:
                        equipment["travel"] = {
                            "charge": float(travel.get('charge') or 0),
                            "thrust": float(travel.get('thrust') or 0),
                            "attack": float(travel.get('attack') or 0),
                            "release": float(travel.get('release') or 0)
                        }

                if equip_type == "thruster" and props is not None:
                    thrust = props.find('thrust')
                    if thrust is not None:
                        equipment["thrust"] = {
                            "pitch": float(thrust.get('pitch') or 0),
                            "yaw": float(thrust.get('yaw') or 0),
                            "roll": float(thrust.get('roll') or 0),
                            "strafe": float(thrust.get('strafe') or 0)
                        }

                if equip_type == "shield" and props is not None:
                    recharge = props.find('recharge')
                    if recharge is not None:
                        equipment["recharge"] = {
                            "max": float(recharge.get('max') or 0),
                            "rate": float(recharge.get('rate') or 0),
                            "delay": float(recharge.get('delay') or 0)
                        }

                if equip_type in {"weapon", "turret"} and props is not None:
                    bullet = props.find('bullet')
                    heat = props.find('heat')
                    ammunition = props.find('ammunition')
                    if bullet is not None:
                        equipment["bullet"] = bullet.get('class')
                    if heat is not None:
                        equipment["heat"] = {
                            "overheat": float(heat.get('overheat') or 0),
                            "cooldelay": float(heat.get('cooldelay') or 0),
                            "coolrate": float(heat.get('coolrate') or 0)
                        }
                    if ammunition is not None:
                        equipment["ammunitionTags"] = self._split_tags(ammunition.get('tags', ''))

                self.equipments_data.append(equipment)
                self.equipment_type_counts[equip_type] += 1

            print(f"   ✅ 生成 {len(self.equipments_data)} 条 equipments 数据。")
            if slot_extract_failures:
                print(f"   ⚠️ slotTags 提取失败 {len(slot_extract_failures)} 条 (type/size)。")
                for failure in slot_extract_failures:
                    missing = "/".join(failure["missing"])
                    raw_tags_text = ", ".join(failure["slotTagsRaw"]) if failure["slotTagsRaw"] else "(none)"
                    cleaned_tags_text = ", ".join(failure["slotTagsCleaned"]) if failure["slotTagsCleaned"] else "(none)"
                    print(
                        f"      - {failure['macro']} (id={failure['id']}, class={failure['class']}): "
                        f"missing={missing}; rawTags=[{raw_tags_text}]; cleanedTags=[{cleaned_tags_text}]"
                    )
            else:
                print("   ✅ slotTags 提取失败 0 条 (type/size)。")
        except Exception as e:
            print(f"   ❌ Equipment macros XML Error: {e}")

    # =======================================================
    # 2.5 构建无人机和消耗品数据 (Drones/Consumables)
    # =======================================================
    def _build_drones_and_consumables(self):
        print(f"\n🛸 [2.5/5] 构建无人机和消耗品数据...")

        macros_path = os.path.join(self.raw_path, "libraries", "equipment_macros.xml")
        if not os.path.exists(macros_path):
            print(f"   ⚠️ 警告: 找不到 equipment macros 文件: {macros_path}")
            return

        # class 到类型/分类的映射
        drone_classes = {'ship_xs', 'ship_s'}
        consumable_classes = {'mine', 'satellite', 'scanner', 'countermeasure', 'navbeacon', 'resourceprobe'}

        def derive_drone_cargo(props, purpose_primary):
            # 仅基于 XML 属性推导 cargo，不依赖宏名字符串
            storage_node = props.find('storage') if props is not None else None
            unit_capacity = int(storage_node.get('unit') or 0) if storage_node is not None else 0
            if purpose_primary == 'trade':
                return [{"type": "container", "capacity": unit_capacity}]
            if purpose_primary != 'mine':
                return []
            gatherrate = props.find('gatherrate') if props is not None else None
            gas = float(gatherrate.get('gas') or 0) if gatherrate is not None else 0
            if gas > 0:
                return [{"type": "liquid", "capacity": unit_capacity}]
            return [{"type": "solid", "capacity": unit_capacity}]

        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()

            for macro in root.findall('macro'):
                macro_name = macro.get('name')
                m_class = macro.get('class')

                # 跳过已处理的类型
                if m_class in {'engine', 'shieldgenerator', 'weapon', 'turret',
                               'missilelauncher', 'missileturret', 'missile'}:
                    continue

                # 获取 ware_id
                ware_id = self.component_to_ware.get(macro_name)
                if not ware_id:
                    continue

                ware_info = self.ware_index.get(ware_id, {})
                name_id = ware_info.get('nameId', ware_id)
                if name_id:
                    self.needed_raw_names.add(name_id)

                props = macro.find('properties')
                ident_info = {}
                purpose_primary = None
                if props is not None:
                    ident = props.find('identification')
                    if ident is not None:
                        ident_info = {
                            "mk": ident.get('mk'),
                            "race": ident.get('makerrace'),
                            "deployable": ident.get('deployable', '0') == '1'
                        }
                    purpose = props.find('purpose')
                    if purpose is not None:
                        purpose_primary = purpose.get('primary')

                noplayerblueprint = 'noplayerblueprint' in self._split_tags(ware_info.get('tags', ''))

                item = {
                    "id": ware_id,
                    "nameId": name_id,
                    "name": name_id,
                    "dlc_tag": self.ware_dlc_tags.get(ware_id, "base"),
                    "macro": macro_name,
                    "class": m_class,
                    "mk": ident_info.get('mk'),
                    "race": ident_info.get('race'),
                    "deployable": ident_info.get('deployable', False),
                    "tags": self._split_tags(ware_info.get('tags', '')),
                    "cost": self._build_cost(ware_id),
                    "buildTime": self._build_time_by_method(ware_id)
                }

                # 根据 class 分类
                if m_class in drone_classes:
                    drone_cargo = derive_drone_cargo(props, purpose_primary)
                    build_engine_macro = None
                    if props is not None:
                        build_engine = props.find('./loadouts/loadout/macros/engine')
                        if build_engine is not None:
                            build_engine_macro = build_engine.get('macro')
                    item["purposePrimary"] = purpose_primary
                    item["droneTags"] = self._build_drone_tags(purpose_primary, drone_cargo, build_engine_macro)
                    item["noplayerblueprint"] = noplayerblueprint
                    item["cargo"] = drone_cargo
                    self.drones_data.append(item)
                elif m_class in consumable_classes:
                    self.consumables_data.append(item)

            print(f"   ✅ 生成 {len(self.drones_data)} 条 drones 数据。")
            print(f"   ✅ 生成 {len(self.consumables_data)} 条 consumables 数据。")
        except Exception as e:
            print(f"   ❌ Drones/Consumables XML Error: {e}")

    # =======================================================
    # 2.6 构建导弹数据 (Missiles)
    # =======================================================
    def _build_missiles(self):
        print(f"\n🚀 [2.5/5] 构建导弹数据 (missiles.json)...")
        # 从 equipment_macros.xml 读取 missile class 的数据
        macros_path = os.path.join(self.raw_path, "libraries", "equipment_macros.xml")
        if not os.path.exists(macros_path):
            print(f"   ⚠️ 警告: 找不到 equipment macros 文件: {macros_path}")
            return

        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()
            for macro in root.findall('macro'):
                macro_name = macro.get('name')
                m_class = macro.get('class')

                if m_class != 'missile':
                    continue

                props = macro.find('properties')
                if props is None:
                    continue

                # 获取 ware 信息
                ware_id = self.component_to_ware.get(macro_name)
                if not ware_id:
                    continue

                ware_info = self.ware_index.get(ware_id, {})
                name_id = ware_info.get('nameId', ware_id)
                if name_id:
                    self.needed_raw_names.add(name_id)

                missile = {
                    "id": ware_id,
                    "nameId": name_id,
                    "name": name_id,
                    "dlc_tag": self.ware_dlc_tags.get(ware_id, "base"),
                    "macro": macro_name,
                    "class": m_class,
                    "tags": self._split_tags(ware_info.get('tags', '')),
                    "missileTags": [],
                    "cost": self._build_cost(ware_id),
                    "buildTime": self._build_time_by_method(ware_id),
                    "amount": 0,
                    "lifetime": 0,
                    "range": 0,
                    "explosive": 0,
                    "reload": 0,
                    "hull": 0,
                    "resilience": 0,
                    "ammunition": 0
                }

                # 读取 missile 属性
                missile_node = props.find('missile')
                if missile_node is not None:
                    missile["amount"] = int(missile_node.get('amount') or 0)
                    missile["lifetime"] = float(missile_node.get('lifetime') or 0)
                    missile["range"] = float(missile_node.get('range') or 0)
                    missile["missileTags"] = self._split_tags(missile_node.get('tags', ''))

                # 读取爆炸伤害
                explosion_node = props.find('explosiondamage')
                if explosion_node is not None:
                    missile["explosive"] = float(explosion_node.get('value') or 0)

                # 读取 reload
                reload_node = props.find('reload')
                if reload_node is not None:
                    missile["reload"] = float(reload_node.get('time') or 0)

                # 读取 hull
                hull_node = props.find('hull')
                if hull_node is not None:
                    missile["hull"] = float(hull_node.get('max') or 0)

                # 读取 countermeasure
                countermeasure_node = props.find('countermeasure')
                if countermeasure_node is not None:
                    missile["resilience"] = float(countermeasure_node.get('resilience') or 0)

                # 读取 ammo
                ammo_node = props.find('ammunition')
                if ammo_node is not None:
                    missile["ammunition"] = int(ammo_node.get('value') or 0)

                self.missiles_data.append(missile)

            print(f"   ✅ 生成 {len(self.missiles_data)} 条 missiles 数据。")
        except Exception as e:
            print(f"   ❌ Missiles XML Error: {e}")

    # =======================================================
    # 2.6 构建子弹/导弹宏数据 (Bullets)
    # =======================================================
    def _build_bullets(self):
        print(f"\n💥 [2.6/5] 构建子弹/导弹宏数据 (bullet.json)...")
        bullet_macros_path = os.path.join(self.raw_path, "libraries", "bullet_macros.xml")
        if not os.path.exists(bullet_macros_path):
            print(f"   ⚠️ 警告: 找不到 bullet_macros 文件: {bullet_macros_path}")
            return

        try:
            tree = ET.parse(bullet_macros_path)
            root = tree.getroot()
            for macro in root.findall('macro'):
                macro_name = macro.get('name')
                m_class = macro.get('class')

                props = macro.find('properties')

                bullet = {
                    "id": macro_name,
                    "speed": 0,
                    "lifetime": 0,
                    "range": 0,
                    "reload": 0,
                    "damage": 0,
                    "repair": 0,
                    "chargetime": 0,    # 充能时间，默认0
                    "amount": 1,        # 弹片数，默认1
                    "barrelamount": 1,  # 炮管数，默认1
                    "shotHeat": 0,      # 子弹=heat.value(单发热量), beam=heat.initial(初始热量)
                    "heat": 0,          # 子弹=0, beam=每秒持续热量
                    "ammo": 1,          # 弹匣数量，默认1
                    "ammoreload": 0     # 弹匣重装时间，默认0
                }

                # 提取伤害属性（只导出 bullet 类型，missile 类型已在 missiles.json 中）
                if props is not None:
                    bullet_node = props.find('bullet')
                    heat_node = props.find('heat')
                    reload_node = props.find('reload')
                    damage_node = props.find('damage')
                    ammo_node = props.find('ammunition')

                    # 速度判断：光速 ≈ 299792500，beam类
                    speed = 0
                    lifetime = 0

                    if bullet_node is not None:
                        speed = float(bullet_node.get('speed') or 0)
                        lifetime = float(bullet_node.get('lifetime') or 0)
                        bullet["speed"] = speed
                        bullet["lifetime"] = lifetime

                        # chargetime: 充能时间
                        bullet["chargetime"] = float(bullet_node.get('chargetime') or 0)

                        # amount: 弹片数（霰弹类）
                        bullet["amount"] = int(bullet_node.get('amount') or 1)
                        # barrelamount: 炮管数（默认1）
                        bullet["barrelamount"] = int(bullet_node.get('barrelamount') or 1)

                        # range: Beam直接使用range属性，子弹=lifetime×speed
                        # 注意：range处理独立于ammo节点，与ammunition无关
                        bullet_range = bullet_node.get('range')
                        if bullet_range:
                            bullet["range"] = float(bullet_range)
                        else:
                            # 子弹：range = lifetime × speed
                            bullet["range"] = lifetime * speed

                    # ammo: 弹匣数量和重装时间
                    if ammo_node is not None:
                        ammo_val = int(ammo_node.get('value') or 0)
                        if ammo_val > 0:
                            bullet["ammo"] = ammo_val
                        bullet["ammoreload"] = float(ammo_node.get('reload') or 0)

                    # 热量处理
                    # 区分beam和子弹：光速 = 299792500（容差1000）
                    is_beam = abs(speed - 299792500) <= 1000
                    bullet["type"] = "beam" if is_beam else "bullet"

                    if heat_node is not None:
                        heat_initial = float(heat_node.get('initial') or 0)
                        heat_value = float(heat_node.get('value') or 0)

                        if is_beam:
                            # Beam: shotHeat=heat.initial(初始热量), heat=heat.value(每秒热量)
                            bullet["shotHeat"] = heat_initial
                            bullet["heat"] = heat_value
                            # Beam的range已经在上面处理
                        else:
                            # 子弹: shotHeat=heat.value(单发热量), heat=0
                            bullet["shotHeat"] = heat_value
                            bullet["heat"] = 0

                    if reload_node is not None:
                        # XML 中 reload 可能用 time 或 rate 属性
                        # 统一转换为 time: time = 1/rate
                        reload_time = reload_node.get('time')
                        reload_rate = reload_node.get('rate')
                        if reload_time:
                            bullet["reload"] = float(reload_time)
                        elif reload_rate:
                            bullet["reload"] = 1.0 / float(reload_rate) if float(reload_rate) != 0 else 0
                        else:
                            bullet["reload"] = 0

                    if damage_node is not None:
                        bullet["damage"] = float(damage_node.get('value') or 0)
                        bullet["repair"] = float(damage_node.get('repair') or 0)

                    self.bullets_data.append(bullet)

            print(f"   ✅ 生成 {len(self.bullets_data)} 条 bullets 数据。")
        except Exception as e:
            print(f"   ❌ Bullets macros XML Error: {e}")

    # =======================================================
    # 3. 语言提取 (Backend Translation)
    # =======================================================
    def process_map_data(self):
        print(f"\n🗺️ [2.5/5] 生成地图数据并合并 nameId...")

        # 从 config 获取版本号
        version_str = str(self.config.get("version", ""))

        # 调用统一的 Map 处理服务
        result = process_map_for_version(
            raw_assets_dir=X4_UNPACKED_DATA_PATH,
            processed_assets_dir=OUTPUT_VERSION_DIR,
            folder_name="",  # base_path 已经包含 folder_name
            version=version_str,
            i18n_registry=self.i18n_registry,  # 使用已配置好的 registry
            factions_list=getattr(self, 'factions_data', None),
        )

        # 收集 nameId 到 needed_raw_names
        name_ids = result.get("name_ids", set())
        self.needed_raw_names.update(name_ids)

    def extract_and_resolve_languages(self):
        print(f"\n🌍 [3/5] 构建翻译数据库...")
        self.i18n_registry.collect_many(self.needed_raw_names)

        for x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            exported = self.i18n_registry.export_collected(iso)
            self.i18n_data[iso] = exported
            if not exported:
                continue

            t_file = os.path.join(self.raw_path, "t", f"0001-L{x4_id}.xml")
            if not os.path.exists(t_file):
                t_file = os.path.join(self.raw_path, "t", f"0001-l{x4_id}.xml")

            if iso == 'en' and not self.ship_type_name_map and os.path.exists(t_file):
                self.ship_type_name_map = self._load_ship_types_from_locale(t_file)
                self._build_ship_type_key_map()
            if iso == 'en' and not self.equipment_type_name_map and os.path.exists(t_file):
                self.equipment_type_name_map = self._load_equipment_types_from_locale(t_file)
                self._build_equipment_type_key_map()
            if iso == 'en' and not self.slot_tag_name_map and os.path.exists(t_file):
                self.slot_tag_name_map = self._load_slot_tags_from_locale(t_file)
                self._build_slot_tag_key_map()
            if iso == 'en' and not self.dlc_name_map and os.path.exists(t_file):
                self.dlc_name_map = self._load_dlc_names_from_locale(t_file)
                self._build_dlc_key_map()

            print(f"  ✅ [Done]  {iso:6} ({x4_id}) -> {len(exported)} 条")
            if iso == 'en' and os.path.exists(t_file):
                self.ship_type_name_map = self._load_ship_types_from_locale(t_file)
                self.equipment_type_name_map = self._load_equipment_types_from_locale(t_file)
                self.slot_tag_name_map = self._load_slot_tags_from_locale(t_file)
                self.dlc_name_map = self._load_dlc_names_from_locale(t_file)

    def refresh_exported_i18n(self):
        """在后续步骤新增 nameId 后，刷新内存中的多语言导出结果。"""
        self.i18n_registry.collect_many(self.needed_raw_names)
        for _x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            self.i18n_data[iso] = self.i18n_registry.export_collected(iso)

    def _resolve_name(self, raw_name, lang_db, depth=0):
        return self.i18n_registry.get_name(raw_name, "en")

    def _load_ship_types_from_locale(self, t_file):
        if not t_file or not os.path.exists(t_file):
            return {}
        try:
            tree = ET.parse(t_file)
            root = tree.getroot()
            page = root.find(".//page[@id='20221']")
            if page is None:
                return {}
            type_map = {}
            for t in page.findall('t'):
                t_id = t.get('id')
                if not t_id: 
                    continue
                text = "".join(t.itertext()).strip()
                if not text:
                    continue
                type_map[t_id] = text
            return type_map
        except Exception:
            return {}

    def _load_equipment_types_from_locale(self, t_file):
        if not t_file or not os.path.exists(t_file):
            return {}
        try:
            tree = ET.parse(t_file)
            root = tree.getroot()
            page = root.find(".//page[@id='20109']")
            if page is None:
                return {}
            type_map = {}
            for t in page.findall('t'):
                t_id = t.get('id')
                if not t_id:
                    continue
                text = "".join(t.itertext()).strip()
                if not text:
                    continue
                type_map[t_id] = text
            return type_map
        except Exception:
            return {}

    def _load_slot_tags_from_locale(self, t_file):
        if not t_file or not os.path.exists(t_file):
            return {}
        try:
            tree = ET.parse(t_file)
            root = tree.getroot()
            page = root.find(".//page[@id='20228']")
            if page is None:
                return {}
            tag_map = {}
            for t in page.findall('t'):
                t_id = t.get('id')
                if not t_id:
                    continue
                text = "".join(t.itertext()).strip()
                if not text:
                    continue
                tag_map[t_id] = text
            return tag_map
        except Exception:
            return {}

    def _load_dlc_names_from_locale(self, t_file):
        if not t_file or not os.path.exists(t_file):
            return {}
        try:
            tree = ET.parse(t_file)
            root = tree.getroot()
            page = root.find(f".//page[@id='{DLC_I18N_PAGE_ID}']")
            if page is None:
                return {}
            dlc_map = {}
            for t in page.findall('t'):
                t_id = t.get('id')
                if not t_id:
                    continue
                text = "".join(t.itertext()).strip()
                if not text:
                    continue
                dlc_map[t_id] = text
            return dlc_map
        except Exception:
            return {}

    def _build_ship_type_key_map(self):
        if not self.ship_type_name_map:
            return
        def norm(text):
            return re.sub(r"\s+", "", text.lower())
        value_index = {}
        for key, text in self.ship_type_name_map.items():
            value_index[norm(text)] = key
        lookup_overrides = {
            "resupplier": "Auxiliary",
            "largeminer": "Miner",
            "expeditionary": "Expeditionary Ship"
        }
        for ship_type in self.ship_type_counts.keys():
            lookup_text = lookup_overrides.get(ship_type, ship_type)
            key = value_index.get(norm(lookup_text))
            if key:
                self.ship_type_key_map[ship_type] = f"{{20221,{key}}}"
                self.needed_raw_names.add(f"{{20221,{key}}}")

    def _build_equipment_type_key_map(self):
        if not self.equipment_type_name_map:
            return
        def norm(text):
            return re.sub(r"\s+", "", text.lower())
        value_index = {}
        for key, text in self.equipment_type_name_map.items():
            value_index[norm(text)] = key
        lookup_overrides = {
            "shield": "Shield Generator"
        }
        for equip_type in self.equipment_type_counts.keys():
            lookup_text = lookup_overrides.get(equip_type, equip_type)
            key = value_index.get(norm(lookup_text))
            if key:
                self.equipment_type_key_map[equip_type] = f"{{20109,{key}}}"
                self.needed_raw_names.add(f"{{20109,{key}}}")

    def _build_slot_tag_key_map(self):
        if not self.slot_tag_name_map:
            return
        def norm(text):
            return re.sub(r"[\s\-_]+", "", text.lower())
        value_index = {}
        for key, text in self.slot_tag_name_map.items():
            value_index[norm(text)] = key
        lookup_overrides = {
            "highpower": "High-Energy"
        }
        for slot_tag in SLOT_TAG_I18N_TARGETS:
            lookup_text = lookup_overrides.get(slot_tag, slot_tag)
            key = value_index.get(norm(lookup_text))
            if key:
                self.slot_tag_key_map[slot_tag] = f"{{20228,{key}}}"
                self.needed_raw_names.add(f"{{20228,{key}}}")

    def _build_dlc_key_map(self):
        if not self.dlc_name_map:
            return
        def norm(text):
            return re.sub(r"\s+", "", text.lower())
        value_index = {}
        for key, text in self.dlc_name_map.items():
            value_index[norm(text)] = key
        for item in DLC_I18N_TARGETS:
            lookup_text = item["lookup"]
            key = value_index.get(norm(lookup_text))
            if key:
                raw_key = f"{{{DLC_I18N_PAGE_ID},{key}}}"
                self.dlc_key_map[item["id"]] = raw_key
                self.needed_raw_names.add(raw_key)

    def analyze_ship_types(self):
        print(f"\n🛸 [4.1.1/5] 分析船只类型映射 (page 20221)...")
        self._build_ship_type_key_map()
        print(f"-" * 85)
        print(f"{'Ship Type':<20} | {'i18n Key':<15} | {'状态':<10} | {'计数'}")
        print(f"-" * 85)
        for ship_type, count in sorted(self.ship_type_counts.items()):
            key = self.ship_type_key_map.get(ship_type)
            status = "✅ 已匹配" if key else "❌ 缺失"
            print(f"{ship_type:<20} | {str(key or '---'):<15} | {status:<10} | {count}")
        for ship_type, key in self.ship_type_key_map.items():
            self.ship_types_data.append({
                "id": ship_type,
                "nameId": key,
                "name": key,
                "class": sorted(list(self.ship_type_class_map.get(ship_type, [])))
            })

    def analyze_equipment_types(self):
        print(f"\n🛠️ [4.1.2/5] 分析装备类型映射 (page 20109)...")
        self._build_equipment_type_key_map()
        print(f"-" * 85)
        print(f"{'Equip Type':<20} | {'i18n Key':<15} | {'状态':<10} | {'计数'}")
        print(f"-" * 85)
        for equip_type, count in sorted(self.equipment_type_counts.items()):
            key = self.equipment_type_key_map.get(equip_type)
            status = "✅ 已匹配" if key else "❌ 缺失"
            print(f"{equip_type:<20} | {str(key or '---'):<15} | {status:<10} | {count}")
        for equip_type, key in self.equipment_type_key_map.items():
            self.equipment_types_data.append({
                "id": equip_type,
                "nameId": key,
                "name": key
            })

    def analyze_slot_tags(self):
        print(f"\n🏷️ [4.1.3/5] 分析 slot tags 映射 (page 20228)...")
        self._build_slot_tag_key_map()
        self.slot_tags_data = []
        print(f"-" * 95)
        print(f"{'Slot Tag':<20} | {'Lookup':<20} | {'i18n Key':<15} | {'状态':<10} | {'计数'}")
        print(f"-" * 95)
        lookup_overrides = {
            "highpower": "High-Energy"
        }
        ordered_tags = ["standard", "advanced", "xenon", "mining", "missile", "highpower"]
        for slot_tag in ordered_tags:
            lookup_text = lookup_overrides.get(slot_tag, slot_tag)
            key = self.slot_tag_key_map.get(slot_tag)
            count = self.slot_tag_counts.get(slot_tag, 0)
            status = "✅ 已匹配" if key else "❌ 缺失"
            print(f"{slot_tag:<20} | {lookup_text:<20} | {str(key or '---'):<15} | {status:<10} | {count}")
            self.slot_tags_data.append({
                "id": slot_tag,
                "nameId": key or "",
                "name": key or "",
                "count": count
            })

    def analyze_dlcs(self):
        print(f"\n🧩 [4.1.4/5] 分析 DLC 映射 (page {DLC_I18N_PAGE_ID})...")
        self._build_dlc_key_map()
        self.dlcs_data = []
        print(f"-" * 105)
        print(f"{'DLC ID':<20} | {'Lookup':<20} | {'i18n Key':<15} | {'状态':<10} | {'English'}")
        print(f"-" * 105)
        for item in DLC_I18N_TARGETS:
            dlc_id = item["id"]
            lookup_text = item["lookup"]
            key = self.dlc_key_map.get(dlc_id)
            status = "✅ 已匹配" if key else "❌ 缺失"
            print(f"{dlc_id:<20} | {lookup_text:<20} | {str(key or '---'):<15} | {status:<10} | {lookup_text}")
            self.dlcs_data.append({
                "id": dlc_id,
                "nameId": key or "",
                "name": key or lookup_text,
                "dependencyVersion": format_dependency_version(item["dependencyVersion"])
            })

    # =======================================================
    # 🆕 4. 注入英文名称到数据对象
    # =======================================================
    def inject_english_names(self):
        print(f"\n💉 [4/5] 将英文结果注入 name 字段...")
        
        # 获取英文数据，如果没生成则为空
        en_map = self.i18n_data.get('en', {})
        
        if not en_map:
            print("   ⚠️ 警告: 未找到 'en' 语言包，name 字段将保持原始ID。")
            return

        # 更新商品数据
        count_wares = 0
        for item in self.wares_data:
            raw_key = item['nameId']
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_wares += 1
        
        # 更新模块数据
        count_mods = 0
        for item in self.all_modules:
            raw_key = item['nameId']
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_mods += 1

        # 更新商品组数据
        count_wg = 0
        for item in self.module_groups_result:
            raw_key = item['nameId']
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_wg += 1

        # 更新 ship/equipment/shipgroup 数据
        count_ships = 0
        for item in self.ships_data:
            raw_key = item.get('nameId')
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_ships += 1

        count_equips = 0
        for item in self.equipments_data:
            raw_key = item.get('nameId')
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_equips += 1

        count_ship_types = 0
        for item in self.ship_types_data:
            raw_key = item.get('nameId')
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
        # 更新装备类型数据
        for item in self.equipment_types_data:
            raw_key = item.get('nameId')
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_ship_types += 1
        
        count_slot_tags = 0
        for item in self.slot_tags_data:
            raw_key = item.get('nameId')
            if raw_key and raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_slot_tags += 1

        count_dlcs = 0
        for item in self.dlcs_data:
            raw_key = item.get('nameId')
            if raw_key and raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_dlcs += 1
        
        # terraforming 数据
        count_tf = 0
        if hasattr(self, 'terraforming_data') and self.terraforming_data is not None:
            tf_data = self.terraforming_data
            for section in ['stats', 'projectGroups', 'projects', 'deliveryShips']:
                for item in tf_data.get(section, []):
                    for key in ('nameId', 'descriptionId', 'inactiveTextId'):
                        raw_key = item.get(key)
                        if raw_key and raw_key in en_map:
                            item[key.replace('Id', '')] = en_map[raw_key]
                            count_tf += 1
            for item in tf_data.get('stats', []):
                for r in item.get('ranges', []):
                    raw_key = r.get('descriptionId')
                    if raw_key and raw_key in en_map:
                        r['description'] = en_map[raw_key]
                        count_tf += 1
        
        # research 数据
        count_rs = 0
        if hasattr(self, 'research_data') and self.research_data is not None:
            for item in self.research_data.get('items', []):
                for key in ('nameId', 'descriptionId'):
                    raw_key = item.get(key)
                    if raw_key and raw_key in en_map:
                        item[key.replace('Id', '')] = en_map[raw_key]
                        count_rs += 1
        
        # blueprints 数据
        count_bp = 0
        if hasattr(self, 'blueprints_data') and self.blueprints_data is not None:
            for group in ('blueprints', 'classes', 'types'):
                for item in self.blueprints_data.get(group, []):
                    raw_key = item.get('nameId')
                    if raw_key and raw_key in en_map:
                        item['name'] = en_map[raw_key]
                        count_bp += 1

        # factions 数据
        count_fac = 0
        if hasattr(self, 'factions_data') and self.factions_data is not None:
            for faction in self.factions_data:
                raw_key = faction.get('nameId')
                if raw_key and raw_key in en_map:
                    faction['name'] = en_map[raw_key]
                    count_fac += 1
                for l in faction.get('licences', []):
                    raw_key = l.get('nameId')
                    if raw_key and raw_key in en_map:
                        l['name'] = en_map[raw_key]
                        count_fac += 1
        
        print(f"   ✅ 更新了 {count_wares} 个商品, {count_mods} 个模块, {count_wg} 个模块分组, {count_ships} 个飞船, {count_equips} 个装备, {count_ship_types} 个船只类型, {count_slot_tags} 个 slot tag, {count_dlcs} 个 DLC, {count_tf} 个 terraforming, {count_rs} 个 research, {count_bp} 个 blueprints, {count_fac} 个 factions/licences 的英文名称。")

    # =======================================================
    # 🆕 4.1. 模块类型分析
    # =======================================================
    def analyze_module_types(self):
        print(f"📊 [4.1/5] 分析模块类型配置...")
        config_types = self.config.get('module_types', {})
        
        # 统计实际类型及其 Page ID
        actual_types = defaultdict(lambda: defaultdict(int))
        for module in self.all_modules:
            m_type = module.get("type", "unknown")
            name_id = module.get("nameId", "")
            match = re.search(r'\{(\d+),', name_id)
            page_id = match.group(1) if match else "Other"
            actual_types[m_type][page_id] += 1

        config_keys = set(config_types.keys())
        json_keys = set(actual_types.keys())

        # 打印对比结果
        print(f"-" * 85)
        print(f"{'Module Type':<20} | {'Page ID 分布':<15} | {'状态':<10} | {'现有配置 Key'}")
        print(f"-" * 85)

        all_keys = sorted(json_keys | config_keys)
        missing_in_config = []

        for k in all_keys:
            status = "✅ 已配置" if k in config_keys else "❌ 缺失"
            pages = ", ".join([f"{p}({c})" for p, c in actual_types.get(k, {}).items()]) or "N/A"
            config_val = config_types.get(k, "---")
            
            if k in json_keys and k not in config_keys:
                missing_in_config.append(k)

            print(f"{k:<20} | {pages:<15} | {status:<10} | {config_val}")

        if missing_in_config:
            print(f"⚠️  配置文件中缺失的项 (建议添加):")
            for m in missing_in_config:
                print(f"  - \"{m}\": \"{{待定ID}}\"")
        else:
            print(f"   ✅ 所有模块类型均已配置。")

    # =======================================================
    # 4.2 生成 res.json
    # =======================================================
    def generate_res_data(self):
        print(f"\n🏷️ [4.2/5] 生成 res.json (T0资源)...")
        data_dir = os.path.join(self.output_root, "data")
        if not os.path.exists(data_dir): os.makedirs(data_dir)

        # 1. Filter T0 wares
        t0_wares = [w for w in self.wares_data if w.get('tier') == 0]
        print(f"   ℹ️  Found {len(t0_wares)} Tier 0 wares.")

        res_list = []

        for ware in t0_wares:
            w_id = ware['id']
            # Default English name
            en_name = ware.get('name', w_id)

            # Construct res.json entry
            # Base entry
            entry = {
                "id": w_id
            }

            # 3. 添加颜色信息（根据版本选择不同来源）
            color_info = None
            if w_id == 'energycells':
                # energycells 使用手动挑选的颜色
                if self.regionyields_db:  # 8.0
                    color_info = {"color_id": "magenta_bright", "color_rgb": "#FF66FF"}
                elif self.resource_map_colors:  # 9.0
                    color_info = {"color_id": "magenta_bright", "color_rgb": "#FF66FF"}
            elif w_id in self.regionyields_db:  # 8.0: 从 regionyields 获取
                color_info = self.regionyields_db[w_id]
            elif w_id in self.resource_map_colors:  # 9.0: 从 resource_map 获取
                color_info = self.resource_map_colors[w_id]

            if color_info:
                if 'color_id' in color_info:
                    entry['color'] = color_info['color_id']
                if 'color_rgb' in color_info:
                    entry['color_rgb'] = color_info['color_rgb']
                # 8.0 特有：单独的 r, g, b 字段
                if 'r' in color_info:
                    entry['color_r'] = color_info['r']
                    entry['color_g'] = color_info['g']
                    entry['color_b'] = color_info['b']

            # Process all available languages
            for iso, lang_map in self.i18n_data.items():
                # Resolve full name first
                raw_key = ware.get('nameId')
                full_name = lang_map.get(raw_key, en_name)

                # Assign to res.json field
                # Use name_{iso} for all languages, no abbreviations
                entry[f"name_{iso}"] = full_name

            res_list.append(entry)

        # Write res.json
        res_path = os.path.join(data_dir, "res.json")
        with open(res_path, 'w', encoding='utf-8') as f:
            json.dump(res_list, f, indent=2, ensure_ascii=False)
        print(f"   ✅ Written res.json with {len(res_list)} items.")

    def _build_ship_slots_maxes(self):
        ship_class_order = ["ship_s", "ship_m", "ship_l", "ship_xl"]
        slot_order = ["engine", "shield", "thruster", "turret", "weapon"]
        size_order = ["small", "medium", "large", "extralarge"]

        maxes = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

        for ship in self.ships_data:
            ship_class = ship.get("class")
            if ship_class not in ship_class_order:
                continue

            for slot in ship.get("slots", []):
                slot_type = slot.get("type")
                if slot_type not in slot_order:
                    continue

                count_map = slot.get("count") or {}
                for size, count in count_map.items():
                    if size not in size_order:
                        continue
                    n = int(count or 0)
                    if n > maxes[ship_class][slot_type][size]:
                        maxes[ship_class][slot_type][size] = n

        result = {}
        for ship_class in ship_class_order:
            items = []
            slot_map = maxes.get(ship_class, {})
            for slot_type in slot_order:
                size_map = slot_map.get(slot_type, {})
                for size in size_order:
                    count = int(size_map.get(size, 0))
                    if count <= 0:
                        continue
                    items.append({
                        "slot": slot_type,
                        "size": size,
                        "count": count
                    })
            result[ship_class] = items

        return result

    # =======================================================
    # 5. 保存结果
    # =======================================================
    def save(self):
        print(f"\n💾 [5/5] 保存结果...")
        data_dir = os.path.join(self.output_root, "data")
        locales_dir = os.path.join(self.output_root, "locales")
        
        if not os.path.exists(data_dir): os.makedirs(data_dir)
        if not os.path.exists(locales_dir): os.makedirs(locales_dir)

        # 保存数据 (此时 data 对象里已经有了正确的 name 字段)
        with open(os.path.join(data_dir, "modules.json"), 'w', encoding='utf-8') as f:
            json.dump(self.all_modules, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "wares.json"), 'w', encoding='utf-8') as f:
            json.dump(self.wares_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "module_groups.json"), 'w', encoding='utf-8') as f:
            json.dump(self.module_groups_result, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "consumption.json"), 'w', encoding='utf-8') as f:
            json.dump(self.race_consumption, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "ships.json"), 'w', encoding='utf-8') as f:
            json.dump(self.ships_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "ship_slots.json"), 'w', encoding='utf-8') as f:
            json.dump(self._build_ship_slots_maxes(), f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "default_maxes.json"), 'w', encoding='utf-8') as f:
            json.dump(self.ship_max_stats, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "equipments.json"), 'w', encoding='utf-8') as f:
            json.dump(self.equipments_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "ship_types.json"), 'w', encoding='utf-8') as f:
            json.dump(self.ship_types_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "ship_races.json"), 'w', encoding='utf-8') as f:
            json.dump(self.ship_races_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "equipment_types.json"), 'w', encoding='utf-8') as f:
            json.dump(self.equipment_types_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "slot_tags.json"), 'w', encoding='utf-8') as f:
            json.dump(self.slot_tags_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "dlcs.json"), 'w', encoding='utf-8') as f:
            json.dump(self.dlcs_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "missiles.json"), 'w', encoding='utf-8') as f:
            json.dump(self.missiles_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "bullets.json"), 'w', encoding='utf-8') as f:
            json.dump(self.bullets_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "drones.json"), 'w', encoding='utf-8') as f:
            json.dump(self.drones_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "consumables.json"), 'w', encoding='utf-8') as f:
            json.dump(self.consumables_data, f, indent=2, ensure_ascii=False)

        # terraforming 数据
        if hasattr(self, 'terraforming_data') and self.terraforming_data is not None:
            with open(os.path.join(data_dir, "terraforming.json"), 'w', encoding='utf-8') as f:
                json.dump(self.terraforming_data, f, indent=2, ensure_ascii=False)

        # research 数据
        if hasattr(self, 'research_data') and self.research_data is not None:
            with open(os.path.join(data_dir, "research.json"), 'w', encoding='utf-8') as f:
                json.dump(self.research_data, f, indent=2, ensure_ascii=False)

        # blueprints 数据
        if hasattr(self, 'blueprints_data') and self.blueprints_data is not None:
            with open(os.path.join(data_dir, "blueprints.json"), 'w', encoding='utf-8') as f:
                json.dump(self.blueprints_data, f, indent=2, ensure_ascii=False)

        # factions 数据
        if hasattr(self, 'factions_data') and self.factions_data is not None:
            with open(os.path.join(data_dir, "factions.json"), 'w', encoding='utf-8') as f:
                json.dump(self.factions_data, f, indent=2, ensure_ascii=False)

        # 保存语言包
        available_languages = []
        for x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            if iso in self.i18n_data and len(self.i18n_data[iso]) > 0:
                with open(os.path.join(locales_dir, f"{iso}.json"), 'w', encoding='utf-8') as f:
                    json.dump(dict(sorted(self.i18n_data[iso].items())), f, indent=2, ensure_ascii=False)
                available_languages.append({"code": iso, "name": conf['name'], "x4_id": x4_id})

        with open(os.path.join(data_dir, "languages.json"), 'w', encoding='utf-8') as f:
            json.dump(available_languages, f, indent=2, ensure_ascii=False)
        print("🎉 全部完成！")


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="X4 数据处理脚本")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--all-versions", action="store_true", help="处理配置中的所有版本")
    mode_group.add_argument("--version", type=str, help="处理指定版本号，例如 8.0 或 9.0")
    flavor_group = parser.add_mutually_exclusive_group()
    flavor_group.add_argument("--beta", action="store_true", help="选择 beta 版本")
    flavor_group.add_argument("--stable", action="store_true", help="选择 stable 版本")
    return parser.parse_args()


def run_for_config(effective_config):
    """处理单个版本配置"""
    apply_runtime_config(effective_config)
    loader = X4PrecisionLoader(X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR, effective_config)
    loader.build_database()
    loader.load_colors()  # 加载颜色定义
    loader.load_regionyields_colors()  # 8.0: 从 regionyields 加载颜色
    loader.load_resource_map_colors()  # 9.0: 从 resource_map 加载颜色
    loader.process_module_groups()
    loader.scan_assets()
    loader.parse_ship_and_equipment_data()
    loader.ship_max_stats = loader._load_ship_max_statistics()
    loader._build_missiles()
    loader._build_drones_and_consumables()
    loader._build_bullets()
    _get_process_factions()(loader)   # factions 派系数据（含 licences）- 地图之前
    loader.process_map_data()
    loader.extract_and_resolve_languages()
    _get_process_terraforming()(loader)  # terraforming 数据解析
    _get_process_research()(loader)     # research 数据解析
    _get_process_blueprints()(loader)   # blueprints 蓝图数据
    loader.analyze_ship_types()
    loader.analyze_equipment_types()
    loader.analyze_slot_tags()
    loader.analyze_dlcs()
    loader.refresh_exported_i18n()
    loader.inject_english_names()  # 新增步骤
    loader.analyze_module_types()
    loader.generate_res_data()  # 新增步骤：生成资源元数据及缩写
    loader.save()


def main():
    """主函数：支持多版本处理"""
    args = parse_args()
    target_versions = get_target_versions(_config, args)
    print(f"🧭 计划处理 {len(target_versions)} 个版本。")
    for version_item in target_versions:
        effective_config = merge_version_config(_config, version_item)
        version_label = effective_config.get("version")
        flavor = "beta" if effective_config.get("beta", False) else "stable"
        folder_name = effective_config.get("folder_name", "")
        print(f"\n🚀 版本开始：{version_label} ({flavor}) -> {folder_name}")
        run_for_config(effective_config)


if __name__ == "__main__":
    main()
