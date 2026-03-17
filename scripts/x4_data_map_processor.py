import argparse
import bisect
import json
import math
import os
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

try:
    from processor.i18n import get_i18n_registry
    from processor.versioning import get_target_versions, load_version_config, merge_version_config
except ModuleNotFoundError:
    from scripts.processor.i18n import get_i18n_registry  # type: ignore
    from scripts.processor.versioning import get_target_versions, load_version_config, merge_version_config  # type: ignore

_config = load_version_config()

X4_UNPACKED_DATA_PATH = ""
OUTPUT_VERSION_DIR = ""
DEFAULT_MAP_DIR = ""
DEFAULT_OUTPUT = ""
DEFAULT_MAPDEFAULTS = ""
DEFAULT_GOD_XML = ""
DEFAULT_FACTIONS_XML = ""
DEFAULT_COLORS_XML = ""
DEFAULT_REGION_DEFINITIONS_XML = ""
DEFAULT_REGIONOBJECTGROUPS_XML = ""
DEFAULT_REGIONYIELDS_XML = ""
DEFAULT_FACTIONS_OUTPUT = ""
DEFAULT_REGIONS_OUTPUT = ""
DEFAULT_REGIONYIELDS_OUTPUT = ""
DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT = ""
DEFAULT_RESOURCEAREAS_OUTPUT = ""


def apply_runtime_config(effective_config: Dict[str, object]) -> None:
    global X4_UNPACKED_DATA_PATH
    global OUTPUT_VERSION_DIR
    global DEFAULT_MAP_DIR
    global DEFAULT_OUTPUT
    global DEFAULT_MAPDEFAULTS
    global DEFAULT_GOD_XML
    global DEFAULT_FACTIONS_XML
    global DEFAULT_COLORS_XML
    global DEFAULT_REGION_DEFINITIONS_XML
    global DEFAULT_REGIONOBJECTGROUPS_XML
    global DEFAULT_REGIONYIELDS_XML
    global DEFAULT_FACTIONS_OUTPUT
    global DEFAULT_REGIONS_OUTPUT
    global DEFAULT_REGIONYIELDS_OUTPUT
    global DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT
    global DEFAULT_RESOURCEAREAS_OUTPUT

    X4_UNPACKED_DATA_PATH = os.path.join(str(effective_config["raw_assets_dir"]), str(effective_config["folder_name"]))
    OUTPUT_VERSION_DIR = os.path.join(str(effective_config["processed_assets_dir"]), str(effective_config["folder_name"]))
    DEFAULT_MAP_DIR = str(Path(X4_UNPACKED_DATA_PATH) / "maps" / "xu_ep2_universe")
    DEFAULT_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "maps.json")
    DEFAULT_MAPDEFAULTS = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "mapdefaults_final.xml")
    DEFAULT_GOD_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "god_final.xml")
    DEFAULT_FACTIONS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "factions_final.xml")
    DEFAULT_COLORS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "colors_final.xml")
    DEFAULT_REGION_DEFINITIONS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "region_definitions_final.xml")
    DEFAULT_REGIONOBJECTGROUPS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "regionobjectgroups_final.xml")
    DEFAULT_REGIONYIELDS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "regionyields_final.xml")
    DEFAULT_FACTIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "factions.json")
    DEFAULT_REGIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regions.json")
    DEFAULT_REGIONYIELDS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regionyields.json")
    DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regionyield_definitions.json")
    DEFAULT_RESOURCEAREAS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "resourceareas.json")


def default_version_item(config: Dict[str, object]) -> Dict[str, object]:
    current_version = config.get("current_version")
    current_beta = bool(config.get("beta", False))
    for version_item in config.get("versions", []):
        if str(version_item.get("version")) == str(current_version) and bool(version_item.get("beta", False)) == current_beta:
            return merge_version_config(config, version_item)
    raise SystemExit("未找到默认版本配置。")


apply_runtime_config(default_version_item(_config))


CLUSTER_MACRO_RE = re.compile(r"Cluster_(\d+)_macro", re.IGNORECASE)
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
ZONE_MACRO_RE = re.compile(r"Zone\d+_Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
SHCON_ZONE_RE = re.compile(r"tzoneCluster_(\d+)_Sector(\d+)SHCon(\d+)_GateZone_macro", re.IGNORECASE)
CLUSTER_GATE_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)[a-z]?", re.IGNORECASE)
REGION_CONNECTION_RES = (
    re.compile(r"C(\d+)S(\d+)_", re.IGNORECASE),
    re.compile(r"Cluster(\d+)_Sector(\d+)_", re.IGNORECASE),
)
REGION_REF_RES = (
    re.compile(r"region_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
    re.compile(r"region(\d+)_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
)
ZONE_HIGHWAY_MACRO_RE = re.compile(r"Highway(\d+)_Cluster_?(\d+)_(?:Sector|S)(\d+)_macro", re.IGNORECASE)
SEC_HIGHWAY_MACRO_RE = re.compile(r"SuperHighway(\d+)_Cluster_?(\d+)_macro", re.IGNORECASE)


OWNER_COLORS = {
    "teladi": "#c6c000",
    "argon": "#0077cc",
    "antigone": "#00e5ff",
    "boron": "#63b3ff",
    "terran": "#2f7fd3",
    "pioneers": "#7ec8ff",
    "split": "#c00000",
    "freesplit": "#b26b00",
    "holyorder": "#b000b8",
    "paranid": "#d100d1",
    "hatikvah": "#7a4ea3",
    "kaori": "#8a6ad9",
    "loanshark": "#c58f00",
    "riptide": "#c58f00",
    "xenon": "#9a0000",
    "neutral": "#4b5563",
    "ownerless": "#4b5563",
    "scaleplate": "#4b5563",
    "scavenger": "#4b5563",
}


# =============================================================================
# 版本分流：资源模型检测
# =============================================================================

def detect_map_resource_model(version_str: str) -> str:
    """
    根据游戏版本号判定资源模型类型。

    规则：主版本号 < 9 使用 'regions' 模型，>= 9 使用 'resourceareas' 模型。

    Args:
        version_str: 版本字符串，如 "8.0", "9.0", "9.0-Empire-beta"

    Returns:
        "regions" 或 "resourceareas"
    """
    if not version_str:
        return "regions"
    # 提取主版本号
    match = re.match(r"(\d+)", str(version_str))
    if not match:
        return "regions"
    major_version = int(match.group(1))
    return "resourceareas" if major_version >= 9 else "regions"


# =============================================================================
# 9.0+ 资源区定义解析 (resourceareas model)
# =============================================================================

def migrate_resourcearea_definitions(regionyields_xml_path: Path) -> Dict[str, dict]:
    """
    解析 9.0+ 版本的 regionyields_final.xml，提取 definition 节点。

    该版本使用 <definition> 元素定义资源区模板，而非旧版的 <resource><yield> 结构。

    Args:
        regionyields_xml_path: regionyields_final.xml 文件路径

    Returns:
        按 definition id 索引的定义字典
    """
    if not regionyields_xml_path.exists():
        return {}
    root = parse_xml(regionyields_xml_path)
    definitions: Dict[str, dict] = {}

    for def_node in root.findall("./definition[@id]"):
        def_id = (def_node.get("id") or "").strip()
        if not def_id:
            continue

        # 基础标识
        ware = (def_node.get("ware") or "").strip()
        tag = (def_node.get("tag") or "").strip()  # verylow/low/medium/high/veryhigh

        # 产能参数
        yield_val = as_float(def_node.get("yield"), 0.0)
        respawn_delay = as_float(def_node.get("respawndelay"), 0.0)  # 分钟

        # 展示参数
        rating = as_float(def_node.get("rating"), 0.0)
        scaneffect = (def_node.get("scaneffect") or "").strip()
        scaneffectintensity = as_float(def_node.get("scaneffectintensity"), 0.0)
        scaneffectcolor = (def_node.get("scaneffectcolor") or "").strip()

        # 类型系数：矿物用 objectyieldfactor，气体用 gatherspeedfactor
        objectyieldfactor = as_float(def_node.get("objectyieldfactor"), None)
        gatherspeedfactor = as_float(def_node.get("gatherspeedfactor"), None)

        # 尺寸参数：从 boundary/size/@r 读取半径
        radius = 0.0
        boundary_node = def_node.find("./boundary[@class='sphere']/size")
        if boundary_node is not None:
            radius = as_float(boundary_node.get("r"), 0.0)

        # 派生字段：从 id 命名中提取尺寸
        size = ""
        if "_tiny_" in def_id:
            size = "tiny"
        elif "_small_" in def_id:
            size = "small"
        elif "_medium_" in def_id:
            size = "medium"
        elif "_large_" in def_id:
            size = "large"

        # 派生字段：可持续产量/小时 = yield / respawnDelay * 60
        sustainable_yield_per_hour = 0.0
        if respawn_delay > 0:
            sustainable_yield_per_hour = yield_val / respawn_delay * 60.0

        definition: Dict[str, object] = {
            "id": def_id,
            "ware": ware,
            "tag": tag,
            "size": size,
            "radius": radius,
            "yield": yield_val,
            "respawnDelay": respawn_delay,
            "rating": rating,
            "sustainableYieldPerHour": sustainable_yield_per_hour,
        }

        # 可选字段
        if scaneffect:
            definition["scaneffect"] = scaneffect
        if scaneffectintensity > 0:
            definition["scaneffectintensity"] = scaneffectintensity
        if scaneffectcolor:
            definition["scaneffectcolor"] = scaneffectcolor
        if objectyieldfactor is not None:
            definition["objectyieldfactor"] = objectyieldfactor
        if gatherspeedfactor is not None:
            definition["gatherspeedfactor"] = gatherspeedfactor

        definitions[def_id] = definition

    return definitions


def migrate_sector_resourceareas(mapdefaults_xml_path: Path) -> Dict[str, List[dict]]:
    """
    解析 mapdefaults_final.xml 中各 sector 的 resourceareas 引用。

    Args:
        mapdefaults_xml_path: mapdefaults_final.xml 文件路径

    Returns:
        按 sector macro 索引的资源区引用列表
    """
    if not mapdefaults_xml_path.exists():
        return {}
    root = parse_xml(mapdefaults_xml_path)
    sector_resource_areas: Dict[str, List[dict]] = {}

    for dataset in root.findall("./dataset[@macro]"):
        macro = (dataset.get("macro") or "").strip().lower()
        if not macro:
            continue
        # 只处理 sector macro
        if not SECTOR_MACRO_RE.fullmatch(macro):
            continue

        resourceareas_node = dataset.find("./properties/resourceareas")
        if resourceareas_node is None:
            continue

        areas: List[dict] = []
        for area_node in resourceareas_node.findall("./resourcearea[@ref]"):
            ref = (area_node.get("ref") or "").strip()
            amount = as_float(area_node.get("amount"), 0.0)
            if ref:
                areas.append({
                    "ref": ref,
                    "amount": int(amount) if amount > 0 else 1,
                })

        if areas:
            sector_resource_areas[macro] = areas

    return sector_resource_areas


def build_sector_resource_summaries_from_resourceareas(
    sector_resource_areas: Dict[str, List[dict]],
    definitions: Dict[str, dict],
) -> Dict[str, List[dict]]:
    """
    从 resourceareas 数据聚合出 sector 级资源摘要，兼容现有 maps.json 的 sector.resources 结构。

    Args:
        sector_resource_areas: sector 的资源区引用
        definitions: 资源区定义模板

    Returns:
        按 sector macro 索引的资源摘要列表
    """
    TAG_LEVEL_MAP: Dict[str, int] = {
        "verylow": 1,
        "low": 2,
        "medium": 3,
        "high": 4,
        "veryhigh": 5,
    }

    summaries: Dict[str, List[dict]] = {}

    for sector_macro, areas in sector_resource_areas.items():
        by_ware: Dict[str, dict] = {}

        for area in areas:
            ref = area.get("ref", "")
            amount = area.get("amount", 1)
            definition = definitions.get(ref, {})

            ware = definition.get("ware", "")
            if not ware:
                continue

            tag = definition.get("tag", "medium")
            yield_val = as_float(definition.get("yield"), 0.0)
            respawn_delay = as_float(definition.get("respawnDelay"), 0.0)
            sustainable_yield = as_float(definition.get("sustainableYieldPerHour"), 0.0)
            level = TAG_LEVEL_MAP.get(tag, 3)

            entry = by_ware.setdefault(ware, {
                "ware": ware,
                "amount": 0,
                "max_yield": 0.0,
                "max_level": 0,
                "max_tag": "",
                "total_sustainable_yield": 0.0,
            })

            entry["amount"] += amount
            if yield_val > entry["max_yield"]:
                entry["max_yield"] = yield_val
                entry["max_level"] = level
                entry["max_tag"] = tag
            if respawn_delay > 0:
                entry["total_sustainable_yield"] += sustainable_yield * amount

        # 转换为兼容格式
        resources: List[dict] = []
        for ware, entry in sorted(by_ware.items()):
            resources.append({
                "ware": ware,
                "yield": entry["max_tag"],
                "level": entry["max_level"],
                "totalYield": int(entry["max_yield"] * entry["amount"]),
                "sustainableYieldPerHour": int(entry["total_sustainable_yield"]),
            })

        summaries[sector_macro] = resources

    return summaries


def build_resourceareas_json_payload(
    flat_rows: List[dict],
) -> List[dict]:
    """
    将扁平的 resourceareas 数组转换为按 cluster_id + sector_id 分组的结构。

    Args:
        flat_rows: 扁平的 resourcearea 记录列表，每条包含 cluster_id, sector_id 等字段

    Returns:
        分组后的数组，每组包含 cluster_id, sector_id, areas 三个字段
    """
    from collections import defaultdict
    grouped: Dict[Tuple[str, str], List[dict]] = defaultdict(list)

    for row in flat_rows:
        key = (row.get("cluster_id", ""), row.get("sector_id", ""))
        # 移除 cluster_id 和 sector_id 后放入 areas
        area = {k: v for k, v in row.items() if k not in ("cluster_id", "sector_id")}
        grouped[key].append(area)

    result: List[dict] = []
    for (cluster_id, sector_id), areas in sorted(grouped.items()):
        result.append({
            "cluster_id": cluster_id,
            "sector_id": sector_id,
            "areas": areas,
        })
    return result


def resolve_sector_macro_from_region_connection(connection_name: str) -> Optional[str]:
    for pattern in REGION_CONNECTION_RES:
        match = pattern.search(connection_name)
        if match is None:
            continue
        cluster_num = int(match.group(1))
        sector_num = int(match.group(2))
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None


def resolve_sector_macro_from_region_ref(region_ref: str) -> Optional[str]:
    """从 region ref 解析 sector"""
    for pattern in REGION_REF_RES:
        match = pattern.search(region_ref)
        if match is None:
            continue
        groups = match.groups()
        if len(groups) == 3:
            # region(\d+)_cluster_(\d+)_sector_(\d+) 格式
            cluster_num = int(groups[1])
            sector_num = int(groups[2])
        else:
            # region_cluster_(\d+)_sector_(\d+) 格式
            cluster_num = int(groups[0])
            sector_num = int(groups[1])
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract and normalize X4 universe map data from distilled XML.")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--all-versions", action="store_true", help="处理配置中的所有版本")
    mode_group.add_argument("--version", type=str, help="处理指定版本号，例如 8.0 或 9.0")
    flavor_group = parser.add_mutually_exclusive_group()
    flavor_group.add_argument("--beta", action="store_true", help="选择 beta 版本")
    flavor_group.add_argument("--stable", action="store_true", help="选择 stable 版本")
    parser.add_argument("--map-dir")
    parser.add_argument("--mapdefaults-xml")
    parser.add_argument("--god-xml")
    parser.add_argument("--factions-xml")
    parser.add_argument("--colors-xml")
    parser.add_argument("--region-definitions-xml")
    parser.add_argument("--regionobjectgroups-xml")
    parser.add_argument("--regionyields-xml")
    parser.add_argument("--factions-output")
    parser.add_argument("--regions-output")
    parser.add_argument("--regionyields-output")
    parser.add_argument("--output")
    return parser.parse_args()


def as_float(value: Optional[str], default: float = 0.0) -> float:
    return float(value) if value is not None else default


def round_significant(value: float, sig_digits: int = 5) -> float:
    """
    四舍五入到指定有效数字。
    如果整数部分超过 sig_digits 位，则直接取整。
    """
    if value == 0:
        return 0
    abs_val = abs(value)
    # 计算整数部分位数
    int_digits = int(math.floor(math.log10(abs_val))) + 1
    if int_digits > sig_digits:
        # 整数部分超过 sig_digits 位，直接取整
        return round(value)
    # 否则保留 sig_digits 有效数字
    return round(value, sig_digits - int_digits)


def round_to_int(value: float) -> int:
    """四舍五入到整数。"""
    return round(value)


def pos_from(parent: Optional[ET.Element]) -> Dict[str, float]:
    """获取 2D 坐标 (x, z)，兼容旧代码"""
    position = None
    if parent is not None:
        position = parent.find("./offset/position")
    if position is None:
        return {"x": 0.0, "z": 0.0}
    return {"x": as_float(position.get("x")), "z": as_float(position.get("z"))}


def pos3d_from(parent: Optional[ET.Element]) -> Dict[str, float]:
    """获取 3D 坐标 (x, y, z)"""
    position = None
    if parent is not None:
        position = parent.find("./offset/position")
    if position is None:
        return {"x": 0.0, "y": 0.0, "z": 0.0}
    return {
        "x": as_float(position.get("x"), 0.0),
        "y": as_float(position.get("y"), 0.0),
        "z": as_float(position.get("z"), 0.0),
    }


def vec_add(left: Dict[str, float], right: Dict[str, float]) -> Dict[str, float]:
    """2D 向量加法 (x, z)"""
    return {"x": left["x"] + right["x"], "z": left["z"] + right["z"]}


def vec_add_3d(left: Dict[str, float], right: Dict[str, float]) -> Dict[str, float]:
    """3D 向量加法"""
    return {
        "x": left.get("x", 0.0) + right.get("x", 0.0),
        "y": left.get("y", 0.0) + right.get("y", 0.0),
        "z": left.get("z", 0.0) + right.get("z", 0.0),
    }


def cluster_world_to_axial(pos: Dict[str, float]) -> Dict[str, int]:
    q = round(pos["x"] / 15000000.0)
    r = round((pos["z"] - 8660000.0 * q) / 17320000.0)
    return {"q": int(q), "r": int(r)}


def axial_to_pixel_flat(q: int, r: int, size: float = 1.0) -> Dict[str, float]:
    return {
        "x": size * 1.5 * q,
        "y": size * math.sqrt(3.0) * (r + q / 2.0),
    }


def centered_local_positions(points: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
    if not points:
        return {}
    avg_x = sum(point["x"] for point in points.values()) / len(points)
    avg_z = sum(point["z"] for point in points.values()) / len(points)
    return {
        key: {"x": point["x"] - avg_x, "z": point["z"] - avg_z}
        for key, point in points.items()
    }


def unit_vec(x: float, y: float) -> Tuple[float, float]:
    length = math.hypot(x, y)
    if length <= 1e-6:
        return (0.0, 0.0)
    return (x / length, y / length)


def template_positions_ratio(sector_count: int, variant: int = 0) -> Dict[str, Dict[str, float]]:
    s = math.sqrt(3.0) / 4.0
    if sector_count == 1:
        return {"single": {"x": 0.0, "y": 0.0}}
    if sector_count == 2:
        templates = [
            {"upper": {"x": -0.25, "y": -s}, "lower": {"x": 0.25, "y": s}},
            {"upper": {"x": 0.25, "y": -s}, "lower": {"x": -0.25, "y": s}},
        ]
        return templates[variant % len(templates)]
    if sector_count == 3:
        templates = [
            {
                "left": {"x": -0.5, "y": 0.0},
                "center": {"x": 0.25, "y": s},
                "upper_right": {"x": 0.25, "y": -s},
            },
            {
                "upper_left": {"x": -0.25, "y": -s},
                "lower_left": {"x": -0.25, "y": s},
                "right": {"x": 0.5, "y": 0.0},
            },
        ]
        return templates[variant % len(templates)]
    raise ValueError(f"Unsupported sector count: {sector_count}")


def best_slot_assignment(local_positions: Dict[str, Dict[str, float]], slots: Dict[str, Dict[str, float]]) -> Dict[str, str]:
    centered = centered_local_positions(local_positions)
    actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
    slot_vectors = {slot: unit_vec(value["x"], value["y"]) for slot, value in slots.items()}
    slot_names = list(slots.keys())
    sector_names = list(local_positions.keys())
    best_score = None
    best_mapping: Dict[str, str] = {}
    import itertools
    for perm in itertools.permutations(sector_names, len(slot_names)):
        score = 0.0
        mapping: Dict[str, str] = {}
        for slot_name, sector_name in zip(slot_names, perm):
            ax, ay = actual_vectors[sector_name]
            sx, sy = slot_vectors[slot_name]
            score += (ax - sx) ** 2 + (ay - sy) ** 2
            mapping[sector_name] = slot_name
        if best_score is None or score < best_score:
            best_score = score
            best_mapping = mapping
    return best_mapping


def choose_sector_template(local_positions: Dict[str, Dict[str, float]]) -> Tuple[str, Dict[str, str], Dict[str, Dict[str, float]]]:
    names = list(local_positions.keys())
    count = len(names)
    if count == 1:
        slots = template_positions_ratio(1)
        return ("single", {names[0]: "single"}, slots)
    if count == 2:
        centered = centered_local_positions(local_positions)
        x_values = [point["x"] for point in centered.values()]
        x_span = max(x_values) - min(x_values) if x_values else 0.0
        best = None
        for variant in [0, 1]:
            slots = template_positions_ratio(2, variant)
            mapping = best_slot_assignment(local_positions, slots)
            score = 0.0
            actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
            for sector_name, slot_name in mapping.items():
                ax, ay = actual_vectors[sector_name]
                sx, sy = unit_vec(slots[slot_name]["x"], slots[slot_name]["y"])
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if x_span <= 1e-6:
                score += 0.0 if variant == 1 else 1e-3
            if best is None or score < best[0]:
                best = (score, variant, mapping, slots)
        assert best is not None
        return ("dual_b" if best[1] == 1 else "dual_a", best[2], best[3])
    if count == 3:
        best = None
        centered = centered_local_positions(local_positions)
        actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
        for variant in [0, 1]:
            slots = template_positions_ratio(3, variant)
            mapping = best_slot_assignment(local_positions, slots)
            score = 0.0
            for sector_name, slot_name in mapping.items():
                ax, ay = actual_vectors[sector_name]
                sx, sy = unit_vec(slots[slot_name]["x"], slots[slot_name]["y"])
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if best is None or score < best[0]:
                best = (score, variant, mapping, slots)
        assert best is not None
        return ("triple_b" if best[1] == 1 else "triple_a", best[2], best[3])
    return (f"multi_{count}", {}, {})


def sector_radius_ratio(sector_count: int) -> float:
    if sector_count <= 1:
        return 1.0
    if sector_count in (2, 3):
        return 0.5
    return 0.36


def split_tags(tags: Optional[str]) -> List[str]:
    if not tags:
        return []
    return [item for item in tags.split() if item]


def parse_select_tags(tags: Optional[str]) -> List[str]:
    if not tags:
        return []
    raw = tags.strip()
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    parts = [item.strip() for item in re.split(r"[\s,]+", raw) if item.strip()]
    return parts


def station_type_priority(station_type: str) -> int:
    return 1 if station_type in {"tradingstation", "shipyard"} else 0


def station_tag_priority(tags: List[str]) -> int:
    preferred = {"tradingstation", "wharf", "shipyard", "equipmentdock"}
    return 1 if any(tag in preferred for tag in tags) else 0


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def coerce_attr_value(value: Optional[str]):
    if value is None:
        return ""
    raw = value.strip()
    if raw == "":
        return ""
    try:
        if any(char in raw for char in (".", "e", "E")):
            return float(raw)
        return int(raw)
    except ValueError:
        return raw


def as_number(value, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value.strip()
        if raw:
            try:
                return float(raw)
            except ValueError:
                return default
    return default


def round_sig(value: float, digits: int = 4) -> float:
    if value == 0 or not math.isfinite(value):
        return value
    return round(value, digits - 1 - int(math.floor(math.log10(abs(value)))))


def classify_density_tier(ware: str, density: float) -> Tuple[str, int]:
    value = max(0.0, density)
    if ware == "nividium":
        thresholds = [0.1, 1.0, 10.0, 100.0, 1000.0]
    else:
        thresholds = [1.0, 10.0, 100.0, 1000.0, 10000.0]
    names = ["low", "midlow", "medium", "midhigh", "high"]
    for index in range(len(thresholds) - 1):
        if value < thresholds[index + 1]:
            return names[index], index + 1
    return names[-1], len(names)


def normalize_noise_bound(value: Optional[float], default: float) -> float:
    return min(1.0, max(0.0, default if value is None else float(value)))


def parse_xml_attrs(node: ET.Element) -> Dict[str, object]:
    return {key: coerce_attr_value(value) for key, value in node.attrib.items()}


def parse_step_curve(node: Optional[ET.Element]) -> List[dict]:
    if node is None:
        return []
    steps: List[dict] = []
    for step_node in node.findall("./step"):
        steps.append({
            "position": as_number(coerce_attr_value(step_node.get("position")), 0.0),
            "value": as_number(coerce_attr_value(step_node.get("value")), 0.0),
        })
    steps.sort(key=lambda item: item["position"])
    return steps


def piecewise_average(steps: List[dict], weighted_power: Optional[int] = None) -> float:
    if not steps:
        return 1.0
    points = sorted(
        [
            {
                "position": min(1.0, max(0.0, float(item.get("position", 0.0)))),
                "value": float(item.get("value", 0.0)),
            }
            for item in steps
        ],
        key=lambda item: item["position"],
    )
    if points[0]["position"] > 0.0:
        points.insert(0, {"position": 0.0, "value": points[0]["value"]})
    if points[-1]["position"] < 1.0:
        points.append({"position": 1.0, "value": points[-1]["value"]})

    total = 0.0
    weight_total = 0.0
    for left, right in zip(points, points[1:]):
        x0 = left["position"]
        x1 = right["position"]
        if x1 <= x0:
            continue
        y0 = left["value"]
        y1 = right["value"]
        mid = (x0 + x1) * 0.5
        ymid = y0 + (y1 - y0) * ((mid - x0) / (x1 - x0))
        if weighted_power is None:
            total += (y0 + y1) * (x1 - x0) * 0.5
            weight_total += (x1 - x0)
        else:
            w0 = x0 ** weighted_power
            wm = mid ** weighted_power
            w1 = x1 ** weighted_power
            total += ((y0 * w0) + (4.0 * ymid * wm) + (y1 * w1)) * (x1 - x0) / 6.0
            weight_total += (w0 + (4.0 * wm) + w1) * (x1 - x0) / 6.0
    if weight_total <= 0:
        return 1.0
    return total / weight_total


def distance_3d(left: dict, right: dict) -> float:
    return math.sqrt(
        (as_number(left.get("x")) - as_number(right.get("x"))) ** 2
        + (as_number(left.get("y")) - as_number(right.get("y"))) ** 2
        + (as_number(left.get("z")) - as_number(right.get("z"))) ** 2
    )


# 体积计算上限限制（单位：米）
CYLINDER_RADIUS_LIMIT = 200_000      # 200 km
CYLINDER_HEIGHT_LIMIT = 80_000       # 80 km
SPLINETUBE_LENGTH_LIMIT = 1_000_000  # 1000 km


def boundary_volume(boundary: Optional[dict]) -> float:
    """
    计算边界体积（单位：m³），带体积上限限制。

    返回：体积值（m³）

    限制规则：
    - sphere: 半径 > 200km 时按圆柱体计算（r=200km, h=80km）
    - cylinder: 半径最大 200km，高度最大 80km
    - splinetube: 长度最大 1000km，半径最大 200km
    """
    if not boundary:
        return 1.0
    boundary_class = str(boundary.get("class") or "")
    size = boundary.get("size") or {}
    radius = as_number(size.get("r"), 0.0)

    if boundary_class == "sphere":
        if radius > CYLINDER_RADIUS_LIMIT:
            # 超过限制，按圆柱体计算
            return math.pi * (CYLINDER_RADIUS_LIMIT ** 2) * CYLINDER_HEIGHT_LIMIT
        return (4.0 / 3.0) * math.pi * (radius ** 3)

    if boundary_class == "cylinder":
        linear = as_number(size.get("linear"), 0.0)
        r_capped = min(radius, CYLINDER_RADIUS_LIMIT)
        linear_capped = min(linear, CYLINDER_HEIGHT_LIMIT)
        return math.pi * (r_capped ** 2) * linear_capped

    if boundary_class == "splinetube":
        spline = boundary.get("spline") or []
        length = 0.0
        for left, right in zip(spline, spline[1:]):
            length += distance_3d(left, right)
        r_capped = min(radius, CYLINDER_RADIUS_LIMIT)
        length_capped = min(length, SPLINETUBE_LENGTH_LIMIT)
        return math.pi * (r_capped ** 2) * length_capped

    return 1.0


def compute_spline_length(boundary: Optional[dict]) -> float:
    """
    计算 splinetube 的等效 linear 长度（控制点距离之和）。
    对于非 splinetube 类型，返回 0.0。
    """
    if not boundary:
        return 0.0
    boundary_class = str(boundary.get("class") or "")
    if boundary_class != "splinetube":
        return 0.0
    spline = boundary.get("spline") or []
    length = 0.0
    for left, right in zip(spline, spline[1:]):
        length += distance_3d(left, right)
    return length


def build_boundary(node: Optional[ET.Element]) -> Optional[dict]:
    """
    构建边界对象。

    支持两种 XML 结构：
    1. 直接 <boundary> 节点
    2. <boundaries><boundary .../></boundaries> 容器中的第一个 boundary

    对于 splinetube 类型，在 size 中添加等效 linear 字段（控制点距离之和）。
    """
    if node is None:
        return None

    # 检查是否是 boundaries 容器，如果是则取第一个 boundary 子节点
    if node.tag == "boundaries":
        boundary_node = node.find("./boundary[@class]")
        if boundary_node is None:
            return None
        node = boundary_node

    boundary = {
        "class": (node.get("class") or "").strip(),
    }
    size_node = node.find("./size")
    if size_node is not None:
        boundary["size"] = parse_xml_attrs(size_node)
    spline_points = []
    for spline_node in node.findall("./splineposition"):
        spline_points.append(parse_xml_attrs(spline_node))
    if spline_points:
        boundary["spline"] = spline_points
        # 对于 splinetube 类型，计算并存储等效 linear 长度
        if boundary["class"] == "splinetube":
            length = 0.0
            for left, right in zip(spline_points, spline_points[1:]):
                length += distance_3d(left, right)
            if "size" not in boundary:
                boundary["size"] = {}
            boundary["size"]["linear"] = length
    return boundary


def build_falloff(node: Optional[ET.Element]) -> Optional[dict]:
    if node is None:
        return None
    lateral = parse_step_curve(node.find("./lateral"))
    radial = parse_step_curve(node.find("./radial"))
    falloff = {
        "lateral": lateral,
        "radial": radial,
    }
    falloff["lateral_factor"] = piecewise_average(lateral)
    falloff["radial_factor"] = piecewise_average(radial, weighted_power=1)
    falloff["effective_factor"] = falloff["lateral_factor"] * falloff["radial_factor"]
    return falloff


# =============================================================================
# 8.0 简化资源计算算法
# =============================================================================
# 新算法核心：
# 1. 移除 fields/noise/factor 计算
# 2. 固体：体积 × falloff × resourcedensity
# 3. 气体：方块数 × falloff × resourcedensity
# 4. 截断规则：固体 256km×256km×192km，气体 256km×256km×64km
# =============================================================================

# 截断限制（单位：米）
SOLID_XZ_LIMIT = 256_000       # 256 km
SOLID_Y_LIMIT = 96_000         # 96 km (总高度 192km)
GAS_XZ_LIMIT = 256_000         # 256 km
GAS_Y_LIMIT = 64_000           # 64 km (总高度 128km)
GAS_BLOCK_SIZE = 64_000        # 64 km 立方体网格
GAS_MIN_HEIGHT = 64_000        # 气体最小高度 64km

# 气体资源 ware 列表
GAS_WARES = {"helium", "hydrogen", "methane", "bogas"}


def is_gas_ware(ware: str) -> bool:
    """判断 ware 是否为气体资源"""
    return ware in GAS_WARES


def calculate_falloff_factors(falloff: Optional[dict]) -> Tuple[float, float, float]:
    """
    从 falloff 对象计算一元因子

    Returns:
        (lateral_factor, radial_factor, total_factor)
    """
    if not falloff:
        return (1.0, 1.0, 1.0)

    lateral_factor = as_number(falloff.get("lateral_factor"), 1.0)
    radial_factor = as_number(falloff.get("radial_factor"), 1.0)
    return (lateral_factor, radial_factor, lateral_factor * radial_factor)


def calculate_solid_volume_truncated(boundary: dict) -> Tuple[float, float]:
    """
    计算固体资源的有效体积（截断后）

    Args:
        boundary: 边界定义（含 class, size, spline 等）

    Returns:
        (total_volume_m3, effective_volume_m3) - 截断前和截断后的体积（单位：m³）
    """
    boundary_class = str(boundary.get("class", ""))
    size = boundary.get("size", {})
    radius = as_number(size.get("r"), 0.0)

    if boundary_class == "sphere":
        # 球体：V = 4/3 × π × r³
        total_volume = (4.0 / 3.0) * math.pi * (radius ** 3)
        # 截断：半径限制在 200km，高度限制在 192km
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        # 球体截断为圆柱体
        effective_volume = math.pi * (capped_radius ** 2) * (SOLID_Y_LIMIT * 2)
        return (total_volume, effective_volume)

    elif boundary_class == "cylinder":
        linear = as_number(size.get("linear"), 0.0)
        # 圆柱：V = π × r² × h
        total_volume = math.pi * (radius ** 2) * linear
        # 截断
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_height = min(linear, SOLID_Y_LIMIT * 2)  # 192km
        effective_volume = math.pi * (capped_radius ** 2) * capped_height
        return (total_volume, effective_volume)

    elif boundary_class == "splinetube":
        spline = boundary.get("spline", [])
        length = 0.0
        for i in range(len(spline) - 1):
            p0 = spline[i]
            p1 = spline[i + 1]
            length += distance_3d(p0, p1)

        # Tube: V = π × r² × length
        total_volume = math.pi * (radius ** 2) * length
        # 截断：X/Z 限制 256km，长度限制 512km
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_length = min(length, SOLID_XZ_LIMIT * 2)
        effective_volume = math.pi * (capped_radius ** 2) * capped_length
        return (total_volume, effective_volume)

    else:
        return (0.0, 0.0)


def generate_gas_block_coordinates(
    region_pos: Dict[str, float],
    boundary: dict,
) -> Tuple[List[Tuple[int, int, int]], List[Tuple[int, int, int]]]:
    """
    生成气体资源命中的 64km³ 方块坐标列表

    方块是 64×64×64km 的立方体，判断命中需要检查方块是否与圆柱体相交。
    使用方块中心到圆柱中心的距离 <= (radius + 方块半宽) 来判断。

    Args:
        region_pos: region 相对 sector 的坐标 (x, y, z)
        boundary: 边界定义（含 size.r 半径，size.linear 高度）

    Returns:
        (total_blocks_coords, effective_blocks_coords) - 总坐标列表和有效坐标列表
    """
    radius = as_number(boundary.get("size", {}).get("r", 0.0))
    linear = as_number(boundary.get("size", {}).get("linear", 0.0))
    boundary_class = str(boundary.get("class", ""))

    # 方块尺寸
    block_half = GAS_BLOCK_SIZE // 2  # 32km，方块半宽

    # 有效范围（方块索引）
    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4 个方块（单侧）
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1 个方块（单侧）

    total_coords = []
    effective_coords = []

    # 遍历所有可能的方块（-4 到 +4 共 9 个，-1 到 +1 共 3 个）
    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                # 方块中心坐标（相对 sector 原点）
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 计算方块中心到 region 中心的偏移
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)

                if boundary_class == "cylinder":
                    # 圆柱体：检查 XZ 平面距离和 Y 轴高度
                    # 方块有大小，使用 radius + block_half 作为有效半径
                    dist_xz = math.sqrt(dx*dx + dz*dz)
                    effective_radius = radius + block_half

                    # Y 轴高度检查：方块与圆柱高度范围相交
                    # 圆柱 Y 范围：[region_y - linear, region_y + linear]
                    # 方块 Y 范围：[block_y - block_half, block_y + block_half]
                    region_y = region_pos.get("y", 0.0)
                    block_y_min = block_y - block_half
                    block_y_max = block_y + block_half
                    cylinder_y_min = region_y - linear
                    cylinder_y_max = region_y + linear

                    # 检查 Y 范围是否相交
                    y_overlap = not (block_y_max < cylinder_y_min or block_y_min > cylinder_y_max)

                    in_radius = dist_xz <= effective_radius
                    in_height = y_overlap
                else:
                    # 球体或其他：检查 3D 距离，使用 radius + block_half
                    dist = math.sqrt(dx*dx + dy*dy + dz*dz)
                    effective_radius = radius + block_half
                    in_radius = dist <= effective_radius
                    in_height = True  # 球体没有高度限制

                # 总方块数：所有在 region 半径内的方块
                if in_radius and in_height:
                    total_coords.append((block_x, block_y, block_z))

                    # 有效方块数：还需要在截断范围内
                    if (abs(block_x) <= GAS_XZ_LIMIT and
                        abs(block_z) <= GAS_XZ_LIMIT and
                        abs(block_y) <= GAS_Y_LIMIT):
                        effective_coords.append((block_x, block_y, block_z))

    return (total_coords, effective_coords)


def calculate_gas_block_count_truncated(
    region_pos: Dict[str, float],
    boundary: dict,
) -> Tuple[int, int]:
    """
    计算气体资源命中的 64km³ 方块数量

    Args:
        region_pos: region 相对 sector 的坐标 (x, y, z)
        boundary: 边界定义（含 size.r 半径）

    Returns:
        (total_blocks, effective_blocks) - 总方块数和有效方块数
    """
    total_coords, effective_coords = generate_gas_block_coordinates(region_pos, boundary)
    return (max(1, len(total_coords)), max(0, len(effective_coords)))


def calculate_region_resources_simplified(
    region: dict,
    region_pos: Optional[Dict[str, float]] = None,
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    简化版资源计算（8.0 新算法）

    公式：yield = base × falloff × resourcedensity

    Args:
        region: region 定义（含 boundary, falloff, resources）
        region_pos: region 相对 sector 的坐标（用于气体计算）
        yield_info_map: 资源 yield 信息映射（用于获取 replenishtime）

    Returns:
        资源列表，包含 total_yield/total_respawn/yield/respawn 字段
    """
    boundary = region.get("boundary", {})
    falloff = region.get("falloff")
    resources_raw = region.get("resources", [])

    if not resources_raw:
        return []

    # 计算 falloff
    lateral_f, radial_f, total_falloff = calculate_falloff_factors(falloff)

    results = []

    for res in resources_raw:
        ware = res.get("ware", "")
        if not ware:
            continue

        # 获取 resourcedensity 和 replenishtime
        resourcedensity = as_number(res.get("resourcedensity"), 0.0)
        replenishtime = as_number(res.get("replenishtime"), 60.0)

        # 如果 resourcedensity 为 0，尝试从 yield_info_map 获取
        if resourcedensity <= 0 and yield_info_map:
            yield_name = res.get("yield_name")
            if ware in yield_info_map:
                if yield_name and yield_name in yield_info_map[ware]:
                    resourcedensity = as_number(
                        yield_info_map[ware][yield_name].get("resourcedensity"), 0.0
                    )
                    replenishtime = as_number(
                        yield_info_map[ware][yield_name].get("replenishtime"), 60.0
                    )

        if resourcedensity <= 0:
            continue

        if is_gas_ware(ware):
            # 气体资源：使用方块网格算法
            total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                region_pos or {"x": 0.0, "y": 0.0, "z": 0.0},
                boundary
            )

            # yield = blocks × falloff × resourcedensity
            total_yield = total_blocks * total_falloff * resourcedensity
            effective_yield = effective_blocks * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": round_to_int(total_respawn),
                "yield": round_to_int(effective_yield),
                "respawn": round_to_int(effective_respawn),
                "delay": replenishtime,
                "factor": 1.0,  # 气体不再使用 factor
            })
        else:
            # 固体资源：使用体积算法
            total_vol, effective_vol = calculate_solid_volume_truncated(boundary)

            # 转换为 km³
            total_vol_km3 = total_vol / 1_000_000_000.0
            effective_vol_km3 = effective_vol / 1_000_000_000.0

            # yield = volume × falloff × resourcedensity
            total_yield = total_vol_km3 * total_falloff * resourcedensity
            effective_yield = effective_vol_km3 * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": round_to_int(total_respawn),
                "yield": round_to_int(effective_yield),
                "respawn": round_to_int(effective_respawn),
                "delay": replenishtime,
                "factor": 1.0,  # 固体不再使用 factor
            })

    return results


class PerlinNoise3D:
    def __init__(self, seed: int = 1337):
        import random

        permutation = list(range(256))
        random.Random(seed).shuffle(permutation)
        self.p = permutation * 2

    @staticmethod
    def fade(t: float) -> float:
        return t * t * t * (t * (t * 6 - 15) + 10)

    @staticmethod
    def lerp(a: float, b: float, t: float) -> float:
        return a + t * (b - a)

    @staticmethod
    def grad(hash_value: int, x: float, y: float, z: float) -> float:
        h = hash_value & 15
        u = x if h < 8 else y
        v = y if h < 4 else (x if h in (12, 14) else z)
        return ((u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v))

    def sample(self, x: float, y: float, z: float) -> float:
        xi = math.floor(x) & 255
        yi = math.floor(y) & 255
        zi = math.floor(z) & 255
        xf = x - math.floor(x)
        yf = y - math.floor(y)
        zf = z - math.floor(z)
        u = self.fade(xf)
        v = self.fade(yf)
        w = self.fade(zf)

        p = self.p
        aaa = p[p[p[xi] + yi] + zi]
        aba = p[p[p[xi] + yi + 1] + zi]
        aab = p[p[p[xi] + yi] + zi + 1]
        abb = p[p[p[xi] + yi + 1] + zi + 1]
        baa = p[p[p[xi + 1] + yi] + zi]
        bba = p[p[p[xi + 1] + yi + 1] + zi]
        bab = p[p[p[xi + 1] + yi] + zi + 1]
        bbb = p[p[p[xi + 1] + yi + 1] + zi + 1]

        x1 = self.lerp(
            self.grad(aaa, xf, yf, zf),
            self.grad(baa, xf - 1, yf, zf),
            u,
        )
        x2 = self.lerp(
            self.grad(aba, xf, yf - 1, zf),
            self.grad(bba, xf - 1, yf - 1, zf),
            u,
        )
        y1 = self.lerp(x1, x2, v)

        x3 = self.lerp(
            self.grad(aab, xf, yf, zf - 1),
            self.grad(bab, xf - 1, yf, zf - 1),
            u,
        )
        x4 = self.lerp(
            self.grad(abb, xf, yf - 1, zf - 1),
            self.grad(bbb, xf - 1, yf - 1, zf - 1),
            u,
        )
        y2 = self.lerp(x3, x4, v)
        return self.lerp(y1, y2, w)


def build_noise_cdf(sample_count: int = 32768) -> List[float]:
    noise = PerlinNoise3D(1337)
    values: List[float] = []
    grid = round(sample_count ** (1.0 / 3.0))
    inv = 1.0 / max(1, grid)
    for xi in range(grid):
        for yi in range(grid):
            for zi in range(grid):
                raw = noise.sample((xi + 0.5) * inv * 7.13, (yi + 0.5) * inv * 5.71, (zi + 0.5) * inv * 6.37)
                values.append((raw + 1.0) * 0.5)
    values.sort()
    return values


NOISE_CDF_SAMPLES = build_noise_cdf()


def noise_probability(min_value: Optional[float], max_value: Optional[float]) -> float:
    lo = normalize_noise_bound(min_value, 0.0)
    hi = normalize_noise_bound(max_value, 1.0)
    if hi <= lo:
        return 0.0
    samples = NOISE_CDF_SAMPLES
    left = bisect.bisect_left(samples, lo)
    right = bisect.bisect_right(samples, hi)
    return max(0.0, min(1.0, (right - left) / len(samples)))


def load_color_map_from_xml(colors_xml_path: Path) -> Dict[str, str]:
    if not colors_xml_path.exists():
        return {}
    root = parse_xml(colors_xml_path)
    color_map: Dict[str, str] = {}
    for color_node in root.findall(".//colors/color[@id]"):
        color_id = (color_node.get("id") or "").strip()
        if not color_id:
            continue
        r = int(as_float(color_node.get("r"), 0.0))
        g = int(as_float(color_node.get("g"), 0.0))
        b = int(as_float(color_node.get("b"), 0.0))
        color_map[color_id] = rgb_to_hex(r, g, b)
    for mapping_node in root.findall(".//mappings/mapping[@id]"):
        mapping_id = (mapping_node.get("id") or "").strip()
        ref_id = (mapping_node.get("ref") or "").strip()
        if mapping_id and ref_id and ref_id in color_map:
            color_map[mapping_id] = color_map[ref_id]
    return color_map


def migrate_factions(
    factions_xml_path: Path,
    colors_xml_path: Path,
    i18n_registry,
) -> Tuple[List[dict], Dict[str, dict]]:
    if not factions_xml_path.exists():
        return [], {}
    colors_by_name = load_color_map_from_xml(colors_xml_path)
    factions_root = parse_xml(factions_xml_path)
    rows: List[dict] = []
    by_id: Dict[str, dict] = {}
    for node in factions_root.findall("./faction[@id]"):
        faction_id = (node.get("id") or "").strip()
        if not faction_id:
            continue
        name_id = (node.get("name") or "").strip()
        name = i18n_registry.get_name(name_id, "en") if name_id else ""
        tags = split_tags(node.get("tags"))
        color_node = node.find("./color")
        color_name = (color_node.get("ref") if color_node is not None else "") or ""
        color = colors_by_name.get(color_name, "#4b5563")
        item = {
            "id": faction_id,
            "name": name,
            "nameId": name_id,
            "tags": tags,
            "color_name": color_name,
            "color": color,
            "claimspace": "claimspace" in tags,
        }
        rows.append(item)
        by_id[faction_id] = item
    rows.sort(key=lambda item: item["id"])
    return rows, by_id


def migrate_regionyields(regionyields_xml_path: Path) -> List[dict]:
    if not regionyields_xml_path.exists():
        return []
    root = parse_xml(regionyields_xml_path)
    resources: List[dict] = []
    for resource_node in root.findall("./resource[@ware]"):
        ware = (resource_node.get("ware") or "").strip()
        if not ware:
            continue
        effect_r = int(as_float(resource_node.get("effect_r"), 0.0))
        effect_g = int(as_float(resource_node.get("effect_g"), 0.0))
        effect_b = int(as_float(resource_node.get("effect_b"), 0.0))
        resource_item = {
            "ware": ware,
            "color": rgb_to_hex(effect_r, effect_g, effect_b),
            "yields": [],
        }
        for yield_node in resource_node.findall("./yield[@name]"):
            yield_item: Dict[str, object] = {}
            for key, value in yield_node.attrib.items():
                yield_item[key] = coerce_attr_value(value)
            # 添加 density 作为 resourcedensity 的别名（level 标识）
            if "resourcedensity" in yield_item:
                yield_item["density"] = yield_item["resourcedensity"]
            resource_item["yields"].append(yield_item)
        resources.append(resource_item)
    resources.sort(key=lambda item: item["ware"])
    return resources


def build_yield_level_map(regionyields_xml_path: Path) -> Dict[str, Dict[str, int]]:
    levels: Dict[str, Dict[str, int]] = {}
    for resource in migrate_regionyields(regionyields_xml_path):
        ware = (resource.get("ware") or "").strip()
        if not ware:
            continue
        yield_map: Dict[str, int] = {}
        for index, yield_item in enumerate(resource.get("yields", []), start=1):
            name = str(yield_item.get("name") or "").strip()
            if not name:
                continue
            yield_map[name] = index
        levels[ware] = yield_map
    return levels


def build_yield_density_map(regionyields_xml_path: Path) -> Dict[str, Dict[str, float]]:
    """
    构建资源密度映射表（仅 resourcedensity）。
    兼容旧函数，新代码请使用 build_yield_info_map。
    """
    info_map = build_yield_info_map(regionyields_xml_path)
    return {
        ware: {
            yield_name: info["resourcedensity"]
            for yield_name, info in yields.items()
        }
        for ware, yields in info_map.items()
    }


def build_yield_info_map(regionyields_xml_path: Path) -> Dict[str, Dict[str, dict]]:
    """
    构建资源完整信息映射表，包含 resourcedensity、replenishtime、gatherspeedfactor。

    Returns:
        {ware: {yield_name: {resourcedensity, replenishtime, gatherspeedfactor}}}
    """
    info_map: Dict[str, Dict[str, dict]] = {}
    for resource in migrate_regionyields(regionyields_xml_path):
        ware = str(resource.get("ware") or "").strip()
        if not ware:
            continue
        info_map[ware] = {}
        for yield_item in resource.get("yields", []):
            yield_name = str(yield_item.get("name") or "").strip()
            if not yield_name:
                continue
            info_map[ware][yield_name] = {
                "resourcedensity": as_number(yield_item.get("resourcedensity"), 0.0),
                "replenishtime": as_number(yield_item.get("replenishtime"), 0.0),
                "gatherspeedfactor": as_number(yield_item.get("gatherspeedfactor"), 1.0),
            }
    return info_map


def load_region_object_groups(
    regionobjectgroups_xml_path: Path,
) -> Dict[str, dict]:
    if not regionobjectgroups_xml_path.exists():
        return {}
    root = parse_xml(regionobjectgroups_xml_path)
    groups: Dict[str, dict] = {}
    for group_node in root.findall("./group[@name]"):
        group_name = (group_node.get("name") or "").strip()
        if not group_name:
            continue
        groups[group_name] = {
            "resource": (group_node.get("resource") or "").strip(),
            "yield": as_number(group_node.get("yield"), 0.0),
            "yieldvariation": as_number(group_node.get("yieldvariation"), 0.0),
        }
    return groups


def parse_region_fields(
    region_node: ET.Element,
    group_index: Dict[str, dict],
    resources_map: Optional[Dict[str, dict]] = None,
) -> dict:
    """
    解析 region 的 <fields> 节点，提取 asteroid、debris 和 nebula 字段数据。

    Args:
        region_node: region XML 节点
        group_index: regionobjectgroups 的 group 索引
        resources_map: region 的 <resources> 节点解析结果，ware → {yield_name, ...}

    Returns:
        包含 asteroids、debris、nebulae 列表的字典
    """
    fields_data = {
        "asteroids": [],
        "debris": [],
        "nebulae": [],
    }

    fields_node = region_node.find("./fields")
    if fields_node is None:
        return fields_data

    def parse_field_node(node: ET.Element, node_type: str) -> Optional[dict]:
        """解析单个 field 节点（asteroid 或 debris）"""
        groupref = (node.get("groupref") or "").strip()
        if not groupref or groupref not in group_index:
            return None

        group = group_index[groupref]
        ware = group["resource"]
        densityfactor = as_float(node.get("densityfactor"), 1.0)
        minnoisevalue = as_float(node.get("minnoisevalue"), 0.0)
        maxnoisevalue = as_float(node.get("maxnoisevalue"), 1.0)
        resourcepercentage = as_float(node.get("resourcepercentage"), 100.0) / 100.0

        return {
            "groupref": groupref,
            "resource": ware,
            "yield": group["yield"],
            "densityfactor": densityfactor,
            "minnoisevalue": minnoisevalue,
            "maxnoisevalue": maxnoisevalue,
            "resourcepercentage": resourcepercentage,
        }

    # 解析 asteroid 字段（固体资源）
    for asteroid_node in fields_node.findall("./asteroid[@groupref]"):
        asteroid_data = parse_field_node(asteroid_node, "asteroid")
        if asteroid_data:
            fields_data["asteroids"].append(asteroid_data)

    # 解析 debris 字段（固体资源）
    for debris_node in fields_node.findall("./debris[@groupref]"):
        debris_data = parse_field_node(debris_node, "debris")
        if debris_data:
            fields_data["debris"].append(debris_data)

    # 解析 nebula 字段（气体资源）
    # 只有带 resources="..." 属性的 nebula 才生成资源
    # resources 属性使用空格分隔多个 ware（如 "methane helium"）
    for nebula_node in fields_node.findall("./nebula[@resources]"):
        resources_str = (nebula_node.get("resources") or "").strip()
        if resources_str:
            # 将空格分隔的字符串解析为数组
            resources_list = [r.strip() for r in resources_str.split() if r.strip()]
            fields_data["nebulae"].append({
                "resources": resources_list,
            })

    return fields_data


def parse_region_resources_node(
    region_node: ET.Element,
) -> Dict[str, dict]:
    """
    解析 region 的 <resources> 节点，提取 ware → yield_name 映射。

    Args:
        region_node: region XML 节点

    Returns:
        字典，key 为 ware，value 包含 yield_name 等信息
    """
    resources_map: Dict[str, dict] = {}
    resources_node = region_node.find("./resources")
    if resources_node is None:
        return resources_map

    for resource_node in resources_node.findall("./resource[@ware]"):
        ware = (resource_node.get("ware") or "").strip()
        yield_name = (resource_node.get("yield") or "").strip()
        if not ware or not yield_name:
            continue
        resources_map[ware] = {
            "ware": ware,
            "yield": yield_name,
        }

    return resources_map


def build_region_legacy_resource_map(
    region_definitions_xml_path: Path,
    yield_level_map: Dict[str, Dict[str, int]],
    yield_density_map: Dict[str, Dict[str, float]],
) -> Dict[str, Dict[str, dict]]:
    if not region_definitions_xml_path.exists():
        return {}
    root = parse_xml(region_definitions_xml_path)
    by_name: Dict[str, Dict[str, dict]] = {}
    for region_node in root.findall("./region[@name]"):
        region_name = (region_node.get("name") or "").strip()
        if not region_name:
            continue
        resources: Dict[str, dict] = {}
        for resource_node in region_node.findall("./resources/resource[@ware]"):
            ware = (resource_node.get("ware") or "").strip()
            yield_name = (resource_node.get("yield") or "").strip()
            if not ware or not yield_name:
                continue
            level = yield_level_map.get(ware, {}).get(yield_name, 1)
            resources[ware] = {
                "ware": ware,
                "yield": yield_name,
                "level": level,
                "resourcedensity": yield_density_map.get(ware, {}).get(yield_name, 0.0),
            }
        by_name[region_name] = resources
    return by_name


def summarize_region_resources(
    region_item: dict,
    fields_data: dict,
    resources_map: Dict[str, dict],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    总结 region 的资源产出（8.0 版本，使用 fields 解析）。

    Args:
        region_item: region 定义（含 density, boundary, falloff, volume_km3, falloff_factor, noise_probability）
        fields_data: 解析后的 fields 数据（含 asteroids 和 gas_nebulae 列表）
        resources_map: region 的 <resources> 节点解析结果，ware → {yield_name, ...}
        yield_info_map: 资源 yield 信息映射（用于获取 replenishtime 计算 delay）

    Returns:
        资源产出列表，包含 ware, yield, delay, respawn, density, respawn_density
    """
    region_density = as_number(region_item.get("density"), 1.0)
    falloff_factor = as_number(region_item.get("falloff_factor"), 1.0)
    noise_probability = as_number(region_item.get("noise_probability"), 1.0)
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    # Region 修正因子：F_region = density × falloff_factor × noise_probability
    F_region = region_density * falloff_factor * noise_probability

    by_ware: Dict[str, dict] = {}

    def process_field_resource(
        ware: str,
        densityfactor: float,
        noise_width: float,
        group_yield: float,
        resourcepercentage: float,
        is_gas: bool = False,
        gatherspeedfactor: float = 1.0,
    ) -> None:
        """处理单个 field 资源贡献"""
        # Field 贡献 = densityfactor × noise_width × yield × resourcepercentage
        field_contribution = densityfactor * noise_width * group_yield * resourcepercentage

        # 跳过空的 ware
        if not ware or not ware.strip():
            return

        ware = ware.strip()

        # 获取 yield_name（从 resources_map 查找）
        # 如果 resources_map 为空，说明 region 没有<resources>节点，直接跳过
        if not resources_map:
            return

        if ware not in resources_map:
            # field 产出的 ware 在 resources_map 中没有定义
            print(f"⚠️ 警告：ware='{ware}' 在 region 的<resources>节点中未定义")
            return

        yield_name = resources_map[ware].get("yield")

        # 获取 resourcedensity 和 replenishtime
        resourcedensity: float = 0.0
        replenishtime: float = 60.0
        actual_gatherspeedfactor: float = gatherspeedfactor

        if not yield_info_map or ware not in yield_info_map:
            print(f"⚠️ 警告：ware='{ware}' 在 yield_info_map 中不存在")
            return

        if not yield_name or yield_name not in yield_info_map[ware]:
            print(f"⚠️ 警告：ware='{ware}' 的 yield_name='{yield_name}' 在 yield_info_map 中不存在")
            return

        resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
        replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
        if is_gas:
            actual_gatherspeedfactor = yield_info_map[ware][yield_name].get("gatherspeedfactor", 1.0)

        if resourcedensity <= 0:
            print(f"⚠️ 警告：ware='{ware}' 的 resourcedensity <= 0")
            return

        # 气体资源：单位密度 = ρ_base × F_region（不使用 field_contribution）
        # 固体资源：单位密度 = ρ_base × F_region × field_contribution
        if is_gas:
            density = resourcedensity * F_region
        else:
            density = resourcedensity * F_region * field_contribution

        # 单位回复密度 = density × 60 / replenishtime
        respawn_density = density * 60.0 / replenishtime if replenishtime > 0 else 0.0

        # 总量 = density × volume_km3
        yield_total = density * volume_km3

        # 总重生量 = respawn_density × volume_km3
        respawn_total = respawn_density * volume_km3

        item = by_ware.setdefault(ware, {
            "ware": ware,
            "density": 0.0,
            "respawn_density": 0.0,
            "yield": 0.0,
            "respawn": 0.0,
            "replenishtime": replenishtime,
            "is_gas": is_gas,
            "gatherspeedfactor": actual_gatherspeedfactor,
            "yield_name": yield_name,
            "resourcedensity": resourcedensity,
        })

        # 累加（多个 field 可能产出同一种资源）
        item["density"] += density
        item["respawn_density"] += respawn_density
        item["yield"] += yield_total
        item["respawn"] += respawn_total
        item["replenishtime"] = replenishtime  # 使用最后一个
        item["gatherspeedfactor"] = actual_gatherspeedfactor
        item["yield_name"] = yield_name  # 保存 yield_name
        item["resourcedensity"] = resourcedensity  # 保存 resourcedensity

    # 处理固体资源（asteroid fields）
    for asteroid in fields_data.get("asteroids", []):
        ware = asteroid["resource"]
        densityfactor = asteroid["densityfactor"]
        minnoisevalue = asteroid["minnoisevalue"]
        maxnoisevalue = asteroid["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = asteroid["yield"]
        resourcepercentage = asteroid["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    # 处理固体资源（debris fields）- 与 asteroid 逻辑相同
    for debris in fields_data.get("debris", []):
        ware = debris["resource"]
        densityfactor = debris["densityfactor"]
        minnoisevalue = debris["minnoisevalue"]
        maxnoisevalue = debris["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = debris["yield"]
        resourcepercentage = debris["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    # 处理气体资源（nebula fields）
    for nebula in fields_data.get("nebulae", []):
        resources_list = nebula.get("resources", [])
        for ware in resources_list:
            process_field_resource(
                ware=ware,
                densityfactor=1.0,  # nebula 不使用 densityfactor
                noise_width=1.0,    # nebula 不使用 noise_width
                group_yield=1.0,    # nebula 不使用 yield
                resourcepercentage=1.0,  # nebula 不使用 resourcepercentage
                is_gas=True,
            )

    # 构建最终输出
    resources: List[dict] = []
    for ware, item in sorted(by_ware.items(), key=lambda x: x[0]):
        # 计算 delay（分钟）和 factor
        replenishtime = item["replenishtime"]
        delay = replenishtime if replenishtime > 0 else 60.0  # 单位：分钟
        factor = item.get("gatherspeedfactor", 1.0) if item.get("is_gas") else 1.0

        resource_item = {
            "ware": ware,
            "yield": round_to_int(item["yield"]),
            "delay": delay,
            "respawn": round_to_int(item["respawn"]),
            "density": round_significant(item["density"]),
            "respawn_density": round_significant(item["respawn_density"]),
            "factor": factor,
            "yield_name": item.get("yield_name"),
            "resourcedensity": item.get("resourcedensity", 0.0),
        }
        resources.append(resource_item)

    return resources


def summarize_region_resources_only(
    region_item: dict,
    resources_map: Dict[str, dict],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    总结 region 的资源产出（仅使用 <resources> 节点，不使用 field 数据）。

    Args:
        region_item: region 定义（含 density, boundary, falloff, volume_km3, falloff_factor, noise_probability）
        resources_map: region 的 <resources> 节点解析结果，ware → {yield_name, ...}
        yield_info_map: 资源 yield 信息映射（用于获取 replenishtime 计算 delay）

    Returns:
        资源产出列表，包含 ware, yield, delay, respawn, density, respawn_density
    """
    region_density = as_number(region_item.get("density"), 1.0)
    falloff_factor = as_number(region_item.get("falloff_factor"), 1.0)
    noise_probability = as_number(region_item.get("noise_probability"), 1.0)
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    # Region 修正因子：F_region = density × falloff_factor × noise_probability
    F_region = region_density * falloff_factor * noise_probability

    by_ware: Dict[str, dict] = {}

    # 处理每个 <resources> 节点中的资源
    for ware, res_info in resources_map.items():
        yield_name = res_info.get("yield")

        # 获取 resourcedensity 和 replenishtime
        resourcedensity: float = 0.0
        replenishtime: float = 60.0
        if yield_info_map and ware in yield_info_map:
            if yield_name and yield_name in yield_info_map[ware]:
                resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
                replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
            else:
                yield_entries = list(yield_info_map[ware].values())
                if yield_entries:
                    resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                    replenishtime = yield_entries[0].get("replenishtime", 60.0)

        if resourcedensity <= 0:
            continue

        # 单位密度 = ρ_base × F_region（仅使用 region 修正，不使用 field 贡献）
        density = resourcedensity * F_region

        # 单位回复密度 = density × 60 / replenishtime
        respawn_density = density * 60.0 / replenishtime if replenishtime > 0 else 0.0

        # 总量 = density × volume_km3
        yield_total = density * volume_km3

        # 总重生量 = respawn_density × volume_km3
        respawn_total = respawn_density * volume_km3

        by_ware[ware] = {
            "ware": ware,
            "density": density,
            "respawn_density": respawn_density,
            "yield": yield_total,
            "respawn": respawn_total,
            "replenishtime": replenishtime,
            "is_gas": False,
            "yield_name": yield_name,
            "resourcedensity": resourcedensity,
        }

    # 构建最终输出
    resources: List[dict] = []
    for ware, item in sorted(by_ware.items(), key=lambda x: x[0]):
        replenishtime = item["replenishtime"]
        delay = replenishtime if replenishtime > 0 else 60.0
        factor = 1.0  # 固体资源 factor = 1.0

        resource_item = {
            "ware": ware,
            "yield": round_to_int(item["yield"]),
            "delay": delay,
            "respawn": round_to_int(item["respawn"]),
            "density": round_significant(item["density"]),
            "respawn_density": round_significant(item["respawn_density"]),
            "factor": factor,
            "yield_name": item.get("yield_name"),
            "resourcedensity": item.get("resourcedensity", 0.0),
        }
        resources.append(resource_item)

    return resources


def summarize_region_fields_only(
    region_item: dict,
    fields_data: dict,
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    总结 region 的资源产出（仅使用 <fields> 节点数据，使用 densityfactor）。

    densityfactor 含义：The factor to multiply the region's base density with, which is in objects per 100 km³.

    Args:
        region_item: region 定义（含 density, boundary, falloff, volume_km3, falloff_factor, noise_probability）
        fields_data: 解析后的 fields 数据（含 asteroids、debris、nebulae 列表）
        yield_info_map: 资源 yield 信息映射（用于获取 replenishtime 计算 delay）

    Returns:
        资源产出列表，包含 ware, yield, delay, respawn, density, respawn_density
    """
    region_density = as_number(region_item.get("density"), 1.0)
    falloff_factor = as_number(region_item.get("falloff_factor"), 1.0)
    noise_probability = as_number(region_item.get("noise_probability"), 1.0)
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    # Region 修正因子：F_region = density × falloff_factor × noise_probability
    F_region = region_density * falloff_factor * noise_probability

    by_ware: Dict[str, dict] = {}

    def process_field_resource(
        ware: str,
        densityfactor: float,
        noise_width: float,
        group_yield: float,
        resourcepercentage: float,
        is_gas: bool = False,
        gatherspeedfactor: float = 1.0,
    ) -> None:
        """处理单个 field 资源贡献"""
        # densityfactor 单位：objects per 100 km³
        # 需要转换为 per km³：densityfactor / 100
        # Field 贡献 = noise_width × yield × resourcepercentage
        field_contribution = noise_width * group_yield * resourcepercentage

        # 获取 resourcedensity 和 replenishtime
        resourcedensity: float = 0.0
        replenishtime: float = 60.0
        actual_gatherspeedfactor: float = gatherspeedfactor

        if yield_info_map and ware in yield_info_map:
            yield_entries = list(yield_info_map[ware].values())
            if yield_entries:
                resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                replenishtime = yield_entries[0].get("replenishtime", 60.0)
                if is_gas:
                    actual_gatherspeedfactor = yield_entries[0].get("gatherspeedfactor", 1.0)

        if resourcedensity <= 0:
            return

        # 密度计算：
        # density = (densityfactor / 100) × F_region × field_contribution
        # 气体资源不使用 field_contribution
        if is_gas:
            density = (densityfactor / 100) * F_region
        else:
            density = (densityfactor / 100) * F_region * field_contribution

        # 单位回复密度 = density × 60 / replenishtime
        respawn_density = density * 60.0 / replenishtime if replenishtime > 0 else 0.0

        # 总量 = density × volume_km3
        yield_total = density * volume_km3

        # 总重生量 = respawn_density × volume_km3
        respawn_total = respawn_density * volume_km3

        item = by_ware.setdefault(ware, {
            "ware": ware,
            "density": 0.0,
            "respawn_density": 0.0,
            "yield": 0.0,
            "respawn": 0.0,
            "replenishtime": replenishtime,
            "is_gas": is_gas,
            "gatherspeedfactor": actual_gatherspeedfactor,
        })

        # 累加（多个 field 可能产出同一种资源）
        item["density"] += density
        item["respawn_density"] += respawn_density
        item["yield"] += yield_total
        item["respawn"] += respawn_total
        item["replenishtime"] = replenishtime
        item["gatherspeedfactor"] = actual_gatherspeedfactor

    # 处理固体资源（asteroid fields）
    for asteroid in fields_data.get("asteroids", []):
        ware = asteroid["resource"]
        densityfactor = asteroid["densityfactor"]
        minnoisevalue = asteroid["minnoisevalue"]
        maxnoisevalue = asteroid["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = asteroid["yield"]
        resourcepercentage = asteroid["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    # 处理固体资源（debris fields）- 与 asteroid 逻辑相同
    for debris in fields_data.get("debris", []):
        ware = debris["resource"]
        densityfactor = debris["densityfactor"]
        minnoisevalue = debris["minnoisevalue"]
        maxnoisevalue = debris["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = debris["yield"]
        resourcepercentage = debris["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    # 处理气体资源（nebula fields）
    for nebula in fields_data.get("nebulae", []):
        resources_list = nebula.get("resources", [])
        for ware in resources_list:
            process_field_resource(
                ware=ware,
                densityfactor=1.0,  # nebula 不使用 densityfactor
                noise_width=1.0,    # nebula 不使用 noise_width
                group_yield=1.0,    # nebula 不使用 yield
                resourcepercentage=1.0,  # nebula 不使用 resourcepercentage
                is_gas=True,
            )

    # 构建最终输出
    resources: List[dict] = []
    for ware, item in sorted(by_ware.items(), key=lambda x: x[0]):
        replenishtime = item["replenishtime"]
        delay = replenishtime if replenishtime > 0 else 60.0
        factor = item.get("gatherspeedfactor", 1.0) if item.get("is_gas") else 1.0

        resource_item = {
            "ware": ware,
            "yield": round_to_int(item["yield"]),
            "delay": delay,
            "respawn": round_to_int(item["respawn"]),
            "density": round_significant(item["density"]),
            "respawn_density": round_significant(item["respawn_density"]),
            "factor": factor,
            "yield_name": item.get("yield_name"),
            "resourcedensity": item.get("resourcedensity", 0.0),
        }
        resources.append(resource_item)

    return resources


def migrate_region_definitions(
    region_definitions_xml_path: Path,
    regionobjectgroups_xml_path: Path,
    yield_level_map: Dict[str, Dict[str, int]],
    yield_density_map: Dict[str, Dict[str, float]],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
    region_position_map: Optional[Dict[str, Dict[str, float]]] = None,
) -> Tuple[Dict[str, dict], Dict[str, dict]]:
    """
    迁移 region 定义。

    新架构（8.0 简化版）：
    - regions.json: 包含 boundary, falloff 和资源模板数据（ware, resourcedensity, delay, gatherfactor, yield_name）
    - resourceareas.json: 包含实例计算结果（需要 position 进行截断计算）

    Args:
        region_position_map: region_ref → {"x": float, "y": float, "z": float} 的映射，
                            表示 region 相对其所属 cluster 的坐标

    Returns:
        (region_templates, region_calc_data)
        - region_templates: regions.json 使用的模板数据（含 boundary, falloff, resources）
        - region_calc_data: resourceareas.json 使用的计算数据（含 asteroids, debris, nebulae 等）
    """
    if not region_definitions_xml_path.exists():
        return {}, {}
    root = parse_xml(region_definitions_xml_path)
    group_index = load_region_object_groups(regionobjectgroups_xml_path)
    templates: Dict[str, dict] = {}
    calc_data: Dict[str, dict] = {}

    for region_node in root.findall("./region[@name]"):
        region_name = (region_node.get("name") or "").strip()
        if not region_name:
            continue
        # 支持两种 XML 结构：直接 <boundary> 或 <boundaries><boundary/></boundaries>
        boundary_node = region_node.find("./boundary")
        if boundary_node is None:
            boundary_node = region_node.find("./boundaries")
        falloff_node = region_node.find("./falloff")

        # 8.0 简化算法：只保留 boundary 和 falloff，移除 noise 相关字段
        region_item = {
            "id": region_name,
            "boundary": build_boundary(boundary_node),
            "falloff": build_falloff(falloff_node),
        }

        # 计算 region 级别的体积（移动到 region 根级别）
        boundary = region_item["boundary"]
        falloff = region_item["falloff"] or {}

        # 体积计算：纯几何体积，不含 falloff 修正
        volume_m3 = boundary_volume(boundary)
        volume_km3 = volume_m3 / 1_000_000_000.0

        # 对于 splinetube 类型，存储等效 linear 长度
        spline_linear = compute_spline_length(boundary)
        if spline_linear > 0:
            region_item["linear"] = spline_linear

        region_item["volume_km3"] = round_to_int(volume_km3)
        region_item["falloff_factor"] = round(as_number(falloff.get("effective_factor"), 1.0), 4)

        # 注意：position 不再写入 region definition，而是在 resourceareas 中写入

        # 解析 region 的 <resources> 节点，获取 ware → yield_name 映射
        resources_map = parse_region_resources_node(region_node)

        # 解析 fields 节点（asteroid、debris 和 nebula）
        fields_data = parse_region_fields(region_node, group_index, resources_map)

        # === regions.json: 包含 boundary, falloff, volume_km3 和模板资源数据 ===
        region_template = {
            "id": region_name,
            "boundary": region_item["boundary"],
            "falloff": region_item["falloff"],
            "volume_km3": region_item["volume_km3"],
            "resources": [],
        }
        # 对于 splinetube 类型，添加 linear 字段
        if "linear" in region_item:
            region_template["linear"] = region_item["linear"]

        # 从 resources_map 和 yield_info_map 构建模板资源
        for ware, res_info in resources_map.items():
            yield_name = res_info.get("yield")

            # 获取 resourcedensity 和 replenishtime
            resourcedensity: float = 0.0
            replenishtime: float = 60.0
            gatherfactor: float = 1.0

            if yield_info_map and ware in yield_info_map:
                if yield_name and yield_name in yield_info_map[ware]:
                    resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
                    replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
                    gatherfactor = yield_info_map[ware][yield_name].get("gatherspeedfactor", 1.0)
                else:
                    # 如果 yield_name 不存在，使用第一个
                    yield_entries = list(yield_info_map[ware].values())
                    if yield_entries:
                        resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                        replenishtime = yield_entries[0].get("replenishtime", 60.0)
                        gatherfactor = yield_entries[0].get("gatherspeedfactor", 1.0)

            if resourcedensity > 0:
                region_template["resources"].append({
                    "ware": ware,
                    "resourcedensity": resourcedensity,
                    "delay": replenishtime,
                    "gatherfactor": gatherfactor if is_gas_ware(ware) else 1.0,
                    "yield_name": yield_name,
                })

        # 只保留有 resources 的 region
        if region_template["resources"]:
            templates[region_name] = region_template

        # === resourceareas.json: 保留完整计算数据 ===
        # 添加 field 数组（asteroids、debris、nebulae）
        region_item["asteroids"] = fields_data.get("asteroids", [])
        region_item["debris"] = fields_data.get("debris", [])
        region_item["nebulae"] = fields_data.get("nebulae", [])

        calc_data[region_name] = region_item

    return templates, calc_data


def summarize_region_resources_simplified(
    region_item: dict,
    resources_map: Dict[str, dict],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    简化版资源计算（8.0 新算法）- 整合到 migrate_region_definitions 的版本

    核心变更：
    1. 移除 fields/noise/factor 计算
    2. 固体：有效体积 × falloff × resourcedensity
    3. 气体：有效方块数 × falloff × resourcedensity
    4. 输出 total_yield/total_respawn/yield/respawn 字段
    5. density/respawn_density：单位体积产量和回复密度

    Args:
        region_item: region 定义（含 boundary, falloff）
        resources_map: region 的 <resources> 节点解析结果，ware → {yield_name, ...}
        yield_info_map: 资源 yield 信息映射（用于获取 replenishtime）

    Returns:
        资源产出列表，包含 total_yield/total_respawn/yield/respawn/density/respawn_density 字段
    """
    boundary = region_item.get("boundary", {})
    falloff = region_item.get("falloff")
    region_pos = region_item.get("position")  # 如果有 position 则使用

    if not resources_map:
        return []

    # 计算 falloff
    lateral_f, radial_f, total_falloff = calculate_falloff_factors(falloff)

    results = []

    for ware, res_info in resources_map.items():
        yield_name = res_info.get("yield")

        # 获取 resourcedensity 和 replenishtime
        resourcedensity: float = 0.0
        replenishtime: float = 60.0

        if yield_info_map and ware in yield_info_map:
            if yield_name and yield_name in yield_info_map[ware]:
                resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
                replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
            else:
                # 如果 yield_name 不存在，使用第一个
                yield_entries = list(yield_info_map[ware].values())
                if yield_entries:
                    resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                    replenishtime = yield_entries[0].get("replenishtime", 60.0)

        if resourcedensity <= 0:
            continue

        if is_gas_ware(ware):
            # 气体资源：使用方块网格算法
            total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                region_pos or {"x": 0.0, "y": 0.0, "z": 0.0},
                boundary
            )

            # yield = blocks × falloff × resourcedensity
            total_yield = total_blocks * total_falloff * resourcedensity
            effective_yield = effective_blocks * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            # density = yield / volume (单位体积产量)
            # 气体的体积按有效方块数 × 64km³ 计算
            effective_vol_km3 = effective_blocks * (GAS_BLOCK_SIZE ** 3) / 1_000_000_000.0
            density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
            respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

            # 获取 gatherfactor（气体的 gatherspeedfactor）
            gatherfactor = 1.0
            if yield_info_map and ware in yield_info_map:
                if yield_name and yield_name in yield_info_map[ware]:
                    gatherfactor = yield_info_map[ware][yield_name].get("gatherspeedfactor", 1.0)

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": int(round(total_respawn)),
                "yield": round_to_int(effective_yield),
                "respawn": int(round(effective_respawn)),
                "delay": replenishtime,
                "gatherfactor": gatherfactor,
                "density": round_significant(density),
                "respawn_density": round_significant(respawn_density),
                "yield_name": yield_name,
            })
        else:
            # 固体资源：使用体积算法
            total_vol, effective_vol = calculate_solid_volume_truncated(boundary)

            # 转换为 km³
            total_vol_km3 = total_vol / 1_000_000_000.0
            effective_vol_km3 = effective_vol / 1_000_000_000.0

            # yield = volume × falloff × resourcedensity
            total_yield = total_vol_km3 * total_falloff * resourcedensity
            effective_yield = effective_vol_km3 * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            # density = yield / volume (单位体积产量)
            density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
            respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": int(round(total_respawn)),
                "yield": round_to_int(effective_yield),
                "respawn": int(round(effective_respawn)),
                "delay": replenishtime,
                "gatherfactor": 1.0,  # 固体不再使用 factor
                "density": round_significant(density),
                "respawn_density": round_significant(respawn_density),
                "yield_name": yield_name,
            })

    return results


def calculate_resourcearea_resources(
    region_calc: dict,
    region_pos: Optional[Dict[str, float]],
    template_resources: List[dict],
) -> List[dict]:
    """
    计算 resourcearea 级别的资源数据（实例计算）

    基于 region 计算数据（boundary, falloff）和 position，计算每个资源的产量。

    公式：yield = base × falloff × resourcedensity

    Args:
        region_calc: region 计算数据（含 boundary, falloff）
        region_pos: region 相对 sector 的坐标（用于气体计算和截断）
        template_resources: 模板资源列表（含 ware, resourcedensity, delay, gatherfactor, yield_name）

    Returns:
        资源列表，包含 total_yield/total_respawn/yield/respawn/density/respawn_density 字段
    """
    boundary = region_calc.get("boundary", {})
    falloff = region_calc.get("falloff")

    if not template_resources:
        return []

    # 计算 falloff
    lateral_f, radial_f, total_falloff = calculate_falloff_factors(falloff)

    results = []

    for template_res in template_resources:
        ware = template_res.get("ware", "")
        if not ware:
            continue

        resourcedensity = as_number(template_res.get("resourcedensity"), 0.0)
        replenishtime = as_number(template_res.get("delay"), 60.0)
        gatherfactor = as_number(template_res.get("gatherfactor"), 1.0)

        if resourcedensity <= 0:
            continue

        if is_gas_ware(ware):
            # 气体资源：使用方块网格算法
            total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                region_pos or {"x": 0.0, "y": 0.0, "z": 0.0},
                boundary
            )

            # yield = blocks × falloff × resourcedensity
            total_yield = total_blocks * total_falloff * resourcedensity
            effective_yield = effective_blocks * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            # density = yield / volume (单位体积产量)
            # 气体的体积按有效方块数 × 64km³ 计算
            effective_vol_km3 = effective_blocks * (GAS_BLOCK_SIZE ** 3) / 1_000_000_000.0
            density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
            respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": int(round(total_respawn)),
                "yield": round_to_int(effective_yield),
                "respawn": int(round(effective_respawn)),
                "delay": replenishtime,
                "gatherfactor": gatherfactor,
                "density": round_significant(density),
                "respawn_density": round_significant(respawn_density),
            })
        else:
            # 固体资源：使用体积算法
            total_vol, effective_vol = calculate_solid_volume_truncated(boundary)

            # 转换为 km³
            total_vol_km3 = total_vol / 1_000_000_000.0
            effective_vol_km3 = effective_vol / 1_000_000_000.0

            # yield = volume × falloff × resourcedensity
            total_yield = total_vol_km3 * total_falloff * resourcedensity
            effective_yield = effective_vol_km3 * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            # density = yield / volume (单位体积产量)
            density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
            respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": int(round(total_respawn)),
                "yield": round_to_int(effective_yield),
                "respawn": int(round(effective_respawn)),
                "delay": replenishtime,
                "gatherfactor": 1.0,  # 固体不再使用 factor
                "density": round_significant(density),
                "respawn_density": round_significant(respawn_density),
            })

    return results


def summarize_sector_resources(region_rows: List[dict]) -> List[dict]:
    """
    总结 sector 的资源产出，输出统一的 resources 格式。

    计算方式（与 9.0 统一）：
    - amount = sum(yield) - yield 已经是总量（density × volume_km3）
    - respawn = sum(respawn) - respawn 已经是每小时总回复量（respawn_density × volume_km3）
    """
    by_ware: Dict[str, dict] = {}
    for region in region_rows:
        for resource in region.get("resources", []):
            ware = str(resource.get("ware") or "").strip()
            if not ware:
                continue

            # yield 和 respawn 已经是总量
            yield_val = as_number(resource.get("yield"), 0.0)
            respawn_val = as_number(resource.get("respawn"), 0.0)

            entry = by_ware.setdefault(ware, {
                "ware": ware,
                "amount": 0.0,
                "respawn": 0.0,
            })
            entry["amount"] += yield_val
            entry["respawn"] += respawn_val

    summarized: List[dict] = []
    for ware, entry in sorted(by_ware.items()):
        summarized.append({
            "ware": ware,
            "amount": int(round(entry["amount"])),
            "respawn": int(round(entry["respawn"])),
        })
    return summarized


def load_mapdefaults(mapdefaults_xml: Path) -> Tuple[Dict[str, str], Dict[str, dict]]:
    if not mapdefaults_xml.exists():
        return {}, {}

    root = parse_xml(mapdefaults_xml)
    name_id_by_macro: Dict[str, str] = {}
    area_by_sector_macro: Dict[str, dict] = {}

    for dataset in root.findall("./dataset[@macro]"):
        macro = dataset.get("macro")
        if not macro:
            continue
        macro_key = macro.lower()
        properties = dataset.find("./properties")
        if properties is None:
            continue

        identification = properties.find("./identification")
        if identification is not None:
            name_id = identification.get("name") or ""
            if name_id:
                name_id_by_macro[macro_key] = name_id

        area_node = properties.find("./area")
        if area_node is not None and SECTOR_MACRO_RE.fullmatch(macro):
            area_by_sector_macro[macro_key] = {
                "sunlight": as_float(area_node.get("sunlight"), 0.0),
                "economy": as_float(area_node.get("economy"), 0.0),
                "security": as_float(area_node.get("security"), 0.0),
                "tags": split_tags(area_node.get("tags")),
            }

    return name_id_by_macro, area_by_sector_macro


def parse_xml(path: Path) -> ET.Element:
    return ET.parse(path).getroot()


def parse_xml_group(map_dir: Path, suffix: str) -> List[ET.Element]:
    return [parse_xml(path) for path in sorted(map_dir.glob(f"*{suffix}"))]


def zone_connection_path_to_zone_macro(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    match = re.search(r"Zone(\d+)_Cluster_(\d+)_Sector(\d+)_connection", path, re.IGNORECASE)
    if not match:
        return None
    return f"Zone{int(match.group(1)):03d}_Cluster_{int(match.group(2)):02d}_Sector{int(match.group(3)):03d}_macro"

def generate_map_data(
    map_dir: Path,
    mapdefaults_path: Path,
    god_xml_path: Optional[Path] = None,
    factions_by_id: Optional[Dict[str, dict]] = None,
    region_definitions_xml_path: Optional[Path] = None,
    regionobjectgroups_xml_path: Optional[Path] = None,
    regionyields_xml_path: Optional[Path] = None,
    i18n_registry=None,
    resource_model: str = "regions",
    sector_resource_areas: Optional[Dict[str, List[dict]]] = None,
    definitions: Optional[Dict[str, dict]] = None,
) -> Dict[str, object]:
    name_id_by_macro, area_by_sector_macro = load_mapdefaults(mapdefaults_path)
    registry = i18n_registry or get_i18n_registry()
    if i18n_registry is None:
        registry.configure(X4_UNPACKED_DATA_PATH, {
            "044": {"iso": "en", "name": "English"},
        })
    registry.collect_many(set(name_id_by_macro.values()))

    galaxy_root = parse_xml(map_dir / "galaxy.xml")
    cluster_roots = parse_xml_group(map_dir, "clusters.xml")
    sector_roots = parse_xml_group(map_dir, "sectors.xml")
    zone_roots = parse_xml_group(map_dir, "zones.xml")
    zonehighway_roots = parse_xml_group(map_dir, "zonehighways.xml")
    sechighway_roots = parse_xml_group(map_dir, "sechighways.xml")

    clusters: Dict[str, dict] = {}
    sectors: Dict[str, dict] = {}
    zones: Dict[str, dict] = {}
    cluster_links: Dict[str, dict] = {}
    sector_links: Dict[str, dict] = {}
    sector_highways: Dict[str, dict] = {}
    sector_region_links: Dict[str, List[dict]] = defaultdict(list)

    for macro in galaxy_root.findall("./macro"):
        if macro.get("class") != "galaxy":
            continue
        for conn in macro.findall("./connections/connection[@ref='clusters']"):
            macro_node = conn.find("./macro")
            cluster_macro = macro_node.get("ref") if macro_node is not None else None
            if not cluster_macro:
                continue
            raw_pos = pos_from(conn)
            axial = cluster_world_to_axial(raw_pos)
            clusters[cluster_macro] = {
                "id": cluster_macro,
                "nameId": name_id_by_macro.get(cluster_macro.lower(), ""),
                "name": registry.get_name(name_id_by_macro.get(cluster_macro.lower(), ""), "en"),
                "owner": "neutral",
                "owner_color": OWNER_COLORS.get("neutral", "#94a3b8"),
                "raw_pos": raw_pos,
                "normalized": {
                    "axial": axial,
                    "pixel_basis": axial_to_pixel_flat(axial["q"], axial["r"], 1.0),
                },
                "sector_ids": [],
                "sector_link_ids": [],
            }

    sechighway_geometry: Dict[str, dict] = {}
    for sechighways_root in sechighway_roots:
        for macro in sechighways_root.findall("./macro[@class='highway']"):
            highway_id = macro.get("name")
            if not highway_id:
                continue
            entry = pos_from(macro.find("./connections/connection[@ref='entrypoint']"))
            exitp = pos_from(macro.find("./connections/connection[@ref='exitpoint']"))
            spline = []
            for spline_node in macro.findall("./properties/boundaries/boundary[@class='splinetube']/splineposition"):
                spline.append({
                    "x": as_float(spline_node.get("x")),
                    "z": as_float(spline_node.get("z")),
                    "tx": as_float(spline_node.get("tx")),
                    "tz": as_float(spline_node.get("tz")),
                })
            sechighway_geometry[highway_id] = {
                "entry_pos": entry,
                "exit_pos": exitp,
                "spline": spline,
            }
    zonehighway_geometry: Dict[str, dict] = {}
    for zonehighways_root in zonehighway_roots:
        for macro in zonehighways_root.findall("./macro[@class='highway']"):
            highway_id = macro.get("name")
            if not highway_id:
                continue
            entry = pos_from(macro.find("./connections/connection[@ref='entrypoint']"))
            exitp = pos_from(macro.find("./connections/connection[@ref='exitpoint']"))
            spline = []
            for spline_node in macro.findall("./properties/boundaries/boundary[@class='splinetube']/splineposition"):
                spline.append({
                    "x": as_float(spline_node.get("x")),
                    "z": as_float(spline_node.get("z")),
                    "tx": as_float(spline_node.get("tx")),
                    "tz": as_float(spline_node.get("tz")),
                })
            size_node = macro.find("./properties/boundaries/boundary[@class='splinetube']/size")
            radius = as_float(size_node.get("r")) if size_node is not None else 0.0
            zonehighway_geometry[highway_id] = {
                "entry_pos": entry,
                "exit_pos": exitp,
                "spline": spline,
                "radius": radius,
            }

    cluster_sector_offsets: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    zone_offsets_by_sector: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    for clusters_root in cluster_roots:
        for cluster_macro_node in clusters_root.findall("./macro[@class='cluster']"):
            cluster_macro = cluster_macro_node.get("name")
            if not cluster_macro:
                continue
            if cluster_macro not in clusters:
                raw_pos = galaxy_cluster_positions.get(cluster_macro, {"x": 0.0, "z": 0.0})
                axial = cluster_world_to_axial(raw_pos)
                clusters[cluster_macro] = {
                    "id": cluster_macro,
                    "nameId": name_id_by_macro.get(cluster_macro.lower(), ""),
                    "name": registry.get_name(name_id_by_macro.get(cluster_macro.lower(), ""), "en"),
                    "owner": "neutral",
                    "owner_color": OWNER_COLORS.get("neutral", "#94a3b8"),
                    "raw_pos": raw_pos,
                    "normalized": {
                        "axial": axial,
                        "pixel_basis": axial_to_pixel_flat(axial["q"], axial["r"], 1.0),
                    },
                    "sector_ids": [],
                    "sector_link_ids": [],
                }
            for conn in cluster_macro_node.findall("./connections/connection[@ref='sectors']"):
                macro_node = conn.find("./macro")
                sector_macro = macro_node.get("ref") if macro_node is not None else None
                if not sector_macro:
                    continue
                raw_local = pos_from(conn)
                cluster_sector_offsets[cluster_macro][sector_macro] = raw_local
                if sector_macro not in clusters[cluster_macro]["sector_ids"]:
                    clusters[cluster_macro]["sector_ids"].append(sector_macro)
            for conn in cluster_macro_node.findall("./connections/connection[@ref='regions']"):
                connection_name = (conn.get("name") or "").strip()
                # 两级解析逻辑：
                # 1. 优先从 connection 名称解析 sector
                sector_macro = resolve_sector_macro_from_region_connection(connection_name)
                # 2. 如果 connection 名称解析出的 sector 不存在于 clusters 中，则使用 region ref 解析
                if sector_macro is None or sector_macro not in clusters.get(sector_macro.split("_Sector")[0] + "_macro", {}).get("sector_ids", []):
                    macro_node = conn.find("./macro")
                    if macro_node is not None:
                        region_ref_node = macro_node.find("./properties/region")
                        region_ref = (region_ref_node.get("ref") if region_ref_node is not None else "") or ""
                        if region_ref:
                            sector_macro_from_ref = resolve_sector_macro_from_region_ref(region_ref)
                            # 如果 region ref 解析出的 sector 存在于 clusters 中，则使用它
                            if sector_macro_from_ref and sector_macro_from_ref in clusters.get(sector_macro_from_ref.split("_Sector")[0] + "_macro", {}).get("sector_ids", []):
                                sector_macro = sector_macro_from_ref
                # 3. 如果 region ref 也无法解析，则不匹配
                if sector_macro is None:
                    continue
                macro_node = conn.find("./macro")
                if macro_node is None:
                    continue
                region_macro_name = (macro_node.get("name") or "").strip()
                if not region_macro_name:
                    continue
                region_ref_node = macro_node.find("./properties/region")
                region_ref = (region_ref_node.get("ref") if region_ref_node is not None else "") or ""
                sector_region_links[sector_macro].append({
                    "name": region_macro_name,
                    "region_ref": region_ref,
                    "cluster_id": cluster_macro,
                    "sector_id": sector_macro,
                    "offset": pos3d_from(conn),  # region 相对 cluster 的坐标
                })
            for conn in cluster_macro_node.findall("./connections/connection[@ref='sechighways']"):
                macro_node = conn.find("./macro")
                highway_macro = (macro_node.get("ref") if macro_node is not None else None)
                if not highway_macro:
                    continue
                endpoint_macros = [m.get("ref") for m in conn.findall("./macro/connections/connection/macro") if m.get("ref")]
                unique_endpoints: List[str] = []
                seen_endpoints = set()
                for endpoint in endpoint_macros:
                    if endpoint not in seen_endpoints:
                        unique_endpoints.append(endpoint)
                        seen_endpoints.add(endpoint)
                if len(unique_endpoints) < 2:
                    continue
                pair: Optional[Tuple[str, str]] = None
                for idx, left in enumerate(unique_endpoints):
                    left_match = SHCON_ZONE_RE.fullmatch(left)
                    if left_match is None:
                        continue
                    left_sector = f"Cluster_{int(left_match.group(1)):02d}_Sector{int(left_match.group(2)):03d}_macro"
                    for right in unique_endpoints[idx + 1:]:
                        right_match = SHCON_ZONE_RE.fullmatch(right)
                        if right_match is None:
                            continue
                        right_sector = f"Cluster_{int(right_match.group(1)):02d}_Sector{int(right_match.group(2)):03d}_macro"
                        if left_sector != right_sector:
                            pair = (left, right)
                            break
                    if pair is not None:
                        break
                if pair is None:
                    continue
                link_id = highway_macro
                sector_links[link_id] = {
                    "id": link_id,
                    "kind": "sector_highway",
                    "cluster_id": cluster_macro,
                    "macro": highway_macro,
                    "raw_local_pos": pos_from(conn),
                    "zone_a_id": pair[0],
                    "zone_b_id": pair[1],
                    "geometry": sechighway_geometry.get(highway_macro, {"entry_pos": {"x": 0.0, "z": 0.0}, "exit_pos": {"x": 0.0, "z": 0.0}, "spline": []}),
                }
                if link_id not in clusters[cluster_macro]["sector_link_ids"]:
                    clusters[cluster_macro]["sector_link_ids"].append(link_id)

    for sectors_root in sector_roots:
        for sector_macro_node in sectors_root.findall("./macro[@class='sector']"):
            sector_macro = sector_macro_node.get("name")
            if not sector_macro:
                continue
            match = SECTOR_MACRO_RE.fullmatch(sector_macro)
            cluster_id = f"Cluster_{int(match.group(1)):02d}_macro" if match else None
            raw_local = cluster_sector_offsets.get(cluster_id or "", {}).get(sector_macro, {"x": 0.0, "z": 0.0})
            cluster_raw = clusters.get(cluster_id or "", {}).get("raw_pos", {"x": 0.0, "z": 0.0})
            area = area_by_sector_macro.get(
                sector_macro.lower(),
                {"sunlight": 0.0, "economy": 0.0, "security": 0.0, "tags": []},
            )
            sectors[sector_macro] = {
                "id": sector_macro,
                "cluster_id": cluster_id,
                "nameId": name_id_by_macro.get(sector_macro.lower(), ""),
                "name": registry.get_name(name_id_by_macro.get(sector_macro.lower(), ""), "en"),
                "owner": clusters.get(cluster_id or "", {}).get("owner", "neutral"),
                "owner_color": OWNER_COLORS.get(clusters.get(cluster_id or "", {}).get("owner", "neutral"), "#94a3b8"),
                "area": area,
                "raw_local_pos": raw_local,
                "raw_world_pos": vec_add(cluster_raw, raw_local),
                "zone_ids": [],
                "cluster_gate_ids": [],
                "highway_ids": [],
            }
            for conn in sector_macro_node.findall("./connections/connection[@ref='zones']"):
                macro_node = conn.find("./macro")
                zone_macro = macro_node.get("ref") if macro_node is not None else None
                if not zone_macro:
                    continue
                zone_offsets_by_sector[sector_macro][zone_macro] = pos_from(conn)
                sectors[sector_macro]["zone_ids"].append(zone_macro)
            for conn in sector_macro_node.findall("./connections/connection[@ref='zonehighways']"):
                macro_node = conn.find("./macro")
                highway_macro = macro_node.get("ref") if macro_node is not None else None
                if not highway_macro:
                    continue
                geometry = zonehighway_geometry.get(
                    highway_macro,
                    {"entry_pos": {"x": 0.0, "z": 0.0}, "exit_pos": {"x": 0.0, "z": 0.0}, "spline": [], "radius": 0.0},
                )
                connection_name = conn.get("name") or highway_macro
                highway_id = f"{sector_macro}:{connection_name}"
                instance_offset = pos_from(conn)
                entry_pos = vec_add(instance_offset, geometry["entry_pos"])
                exit_pos = vec_add(instance_offset, geometry["exit_pos"])
                entry_macro = conn.find("./macro/connections/connection[@ref='entrypoint']/macro")
                exit_macro = conn.find("./macro/connections/connection[@ref='exitpoint']/macro")
                entry_zone_id = zone_connection_path_to_zone_macro(entry_macro.get("path") if entry_macro is not None else None)
                exit_zone_id = zone_connection_path_to_zone_macro(exit_macro.get("path") if exit_macro is not None else None)
                entry_conn = entry_macro.get("connection") if entry_macro is not None else None
                exit_conn = exit_macro.get("connection") if exit_macro is not None else None
                sector_highways[highway_id] = {
                    "id": highway_id,
                    "kind": "sector_highway",
                    "sector_id": sector_macro,
                    "macro": highway_macro,
                    "name": connection_name,
                    "from_zone_id": entry_zone_id,
                    "to_zone_id": exit_zone_id,
                    "from_zone_connection": entry_conn,
                    "to_zone_connection": exit_conn,
                    "instance_offset": instance_offset,
                    "entry_pos": entry_pos,
                    "exit_pos": exit_pos,
                    "spline": [vec_add(instance_offset, {"x": point["x"], "z": point["z"]}) for point in geometry["spline"]],
                    "radius": geometry["radius"],
                    "source": "sectors_xml_zonehighways",
                }
                sectors[sector_macro]["highway_ids"].append(highway_id)

    regions_rows: List[dict] = []
    resourceareas_rows: List[dict] = []

    # 根据资源模型选择不同的处理逻辑
    if resource_model == "resourceareas" and sector_resource_areas and definitions:
        # 9.0+ 使用新版资源嵌入逻辑
        # 注意：sector_resource_areas 的 key 是小写，sectors 的 key 是原始大小写
        # 需要用 sectors 字典的 key 的小写版本去匹配
        for sector_key in sectors.keys():
            sector_key_lower = sector_key.lower()
            areas = sector_resource_areas.get(sector_key_lower, [])

            # 获取 cluster_id
            cluster_id = sectors[sector_key].get("cluster_id", "")

            # 聚合 resources (原 resource_wares)
            resources_map: Dict[str, dict] = {}

            for area in areas:
                ref = area.get("ref", "")
                amount = area.get("amount", 1)
                definition = definitions.get(ref, {})

                if not definition:
                    continue

                ware = definition.get("ware", "")
                rating = definition.get("rating", 0.0)
                yield_val = definition.get("yield", 0.0)
                delay = definition.get("respawnDelay", 0.0)
                sustainable = definition.get("sustainableYieldPerHour", 0.0)

                # factor: 自动选择 objectyieldfactor 或 gatherspeedfactor
                factor = definition.get("objectyieldfactor")
                if factor is None:
                    factor = definition.get("gatherspeedfactor")
                if factor is None:
                    factor = 1.0

                # 计算 respawn = yield × 60 / delay
                respawn = 0.0
                if delay > 0:
                    respawn = yield_val * 60.0 / delay

                # 添加到 resourceareas_rows（单独输出）
                resourceareas_rows.append({
                    "ref": ref,
                    "amount": amount,
                    "ware": ware,
                    "rating": rating,
                    "yield": round_to_int(yield_val),
                    "delay": delay,
                    "factor": factor,
                    "respawn": round_to_int(respawn),
                    "cluster_id": cluster_id,
                    "sector_id": sector_key,
                })

                # 统一到 maps.json 的 sector.resources 计算方式
                # amount = sum(yield * amount)
                # respawn = sum(respawn * amount) = sum(yield * 60 / delay * amount)
                if ware:
                    entry = resources_map.setdefault(ware, {
                        "ware": ware,
                        "amount": 0.0,
                        "respawn": 0.0,
                    })
                    entry["amount"] += yield_val * amount
                    if delay > 0:
                        respawn = yield_val * 60.0 / delay
                        entry["respawn"] += respawn * amount

            # 转换 resources
            resources_list = [
                {
                    "ware": entry["ware"],
                    "amount": int(entry["amount"]),
                    "respawn": int(entry["respawn"]),
                }
                for entry in sorted(resources_map.values(), key=lambda x: x["ware"])
            ]

            sectors[sector_key]["resources"] = resources_list

        for sector_key in sectors.keys():
            sectors[sector_key].setdefault("resources", [])
    else:
        # 8.0- 使用旧版 region 处理逻辑
        resolved_region_definitions_path = region_definitions_xml_path or Path(DEFAULT_REGION_DEFINITIONS_XML)
        resolved_regionobjectgroups_path = regionobjectgroups_xml_path or Path(DEFAULT_REGIONOBJECTGROUPS_XML)
        resolved_regionyields_path = regionyields_xml_path or Path(DEFAULT_REGIONYIELDS_XML)
        yield_level_map = build_yield_level_map(resolved_regionyields_path)
        yield_info_map = build_yield_info_map(resolved_regionyields_path)
        yield_density_map = build_yield_density_map(resolved_regionyields_path)

        # 构建 region_position_map：region_ref → 相对 sector 的坐标
        # 坐标转换逻辑：
        # 1. region 的 offset 是相对 cluster 的坐标
        # 2. sector 有 raw_local_pos（相对 cluster）和 raw_world_pos（世界坐标）
        # 3. region 相对 sector 坐标 = region 相对 cluster 坐标 - sector 相对 cluster 坐标
        region_position_map: Dict[str, Dict[str, float]] = {}
        for sector_id, links in sector_region_links.items():
            sector_data = sectors.get(sector_id, {})
            sector_local_pos = sector_data.get("raw_local_pos", {"x": 0.0, "y": 0.0, "z": 0.0})
            for link in links:
                region_ref = link["region_ref"]
                region_offset = link.get("offset", {"x": 0.0, "y": 0.0, "z": 0.0})
                # region 相对 sector 坐标 = region 相对 cluster 坐标 - sector 相对 cluster 坐标
                relative_pos = {
                    "x": region_offset.get("x", 0.0) - sector_local_pos.get("x", 0.0),
                    "y": region_offset.get("y", 0.0) - sector_local_pos.get("y", 0.0),
                    "z": region_offset.get("z", 0.0) - sector_local_pos.get("z", 0.0),
                }
                # 如果同一个 region 被多个 sector 引用，取最后一个
                region_position_map[region_ref] = relative_pos

        templates, calc_data = migrate_region_definitions(
            resolved_region_definitions_path,
            resolved_regionobjectgroups_path,
            yield_level_map,
            yield_density_map,
            yield_info_map,
            region_position_map,
        )
        # regions_rows 输出纯 region 模板定义
        for region_id, template in templates.items():
            regions_rows.append(template)
        regions_rows.sort(key=lambda item: item["id"])

        for sector_id, links in sector_region_links.items():
            # 如果 sector 不在 sectors 字典中，跳过（例如 isolated sector）
            if sector_id not in sectors:
                continue

            # 按 (ref, position) 聚合 resourceareas
            # 新格式：{areas: [{ref, amount, position, resources: [{ware, ...}]}]}
            resourceareas_map: Dict[tuple, dict] = {}
            sector_region_rows: List[dict] = []
            referenced_region_ids: set = set()  # 跟踪被引用的 region ID

            for link in links:
                region_ref = link["region_ref"]
                region_calc = calc_data.get(region_ref, {})
                if not region_calc:
                    continue

                # 获取 position（如果存在）
                position = region_position_map.get(region_ref) if region_position_map else None

                # 获取 region 的模板资源（从 templates 获取 ware 基础信息）
                template = templates.get(region_ref, {})
                template_resources = template.get("resources", [])
                if not template_resources:
                    continue  # 没有资源的 region 不写入

                # 标记该 region 为已引用
                referenced_region_ids.add(region_ref)

                # position_key: 有 position 时使用 position 字符串，无 position 时使用 None
                position_key = None
                if position:
                    position_key = f"{position['x']},{position['y']},{position['z']}"

                # 按 (ref, position_key) 聚合
                key = (region_ref, position_key)
                if key not in resourceareas_map:
                    resourceareas_map[key] = {
                        "ref": region_ref,
                        "amount": 0,
                    }
                    # 只有有 position 时才添加 position 字段
                    if position:
                        resourceareas_map[key]["position"] = position

                    # 计算 falloff 因子
                    falloff = region_calc.get("falloff") or {}
                    lateral_f = as_number(falloff.get("lateral_factor"), 1.0)
                    radial_f = as_number(falloff.get("radial_factor"), 1.0)
                    total_falloff = lateral_f * radial_f

                    resourceareas_map[key]["lateral_factor"] = round(lateral_f, 4)
                    resourceareas_map[key]["radial_factor"] = round(radial_f, 4)
                    resourceareas_map[key]["falloff_factor"] = round(total_falloff, 4)

                    # 计算体积（固体）或方块数（气体）
                    boundary = region_calc.get("boundary", {})

                    # 判断是否为气体资源（根据 template_resources 中的 ware）
                    has_gas = any(is_gas_ware(t.get("ware", "")) for t in template_resources)
                    has_solid = any(not is_gas_ware(t.get("ware", "")) for t in template_resources)

                    # 分别计算气体和固体的体积/方块数
                    if has_gas:
                        # 气体资源：使用方块网格算法
                        total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                            position or {"x": 0.0, "y": 0.0, "z": 0.0},
                            boundary
                        )
                        resourceareas_map[key]["total_blocks"] = total_blocks
                        resourceareas_map[key]["blocks"] = effective_blocks

                    if has_solid:
                        # 固体资源：使用体积算法
                        total_vol, effective_vol = calculate_solid_volume_truncated(boundary)
                        total_vol_km3 = total_vol / 1_000_000_000.0
                        effective_vol_km3 = effective_vol / 1_000_000_000.0
                        resourceareas_map[key]["total_volume_km3"] = round_to_int(total_vol_km3)
                        resourceareas_map[key]["volume_km3"] = round_to_int(effective_vol_km3)

                    # 计算 resources
                    resourceareas_map[key]["resources"] = calculate_resourcearea_resources(
                        region_calc,
                        position,
                        template_resources,
                    )

                # 累加 amount
                resourceareas_map[key]["amount"] += 1

                sector_region_rows.append(region_calc)

            # 转换为列表，添加 cluster_id 和 sector_id 字段
            sector_data = sectors.get(sector_id, {})
            cluster_id = sector_data.get("cluster_id", "")
            for area_item in resourceareas_map.values():
                area_item["cluster_id"] = cluster_id
                area_item["sector_id"] = sector_id
                resourceareas_rows.append(area_item)

            if sector_id in sectors:
                sectors[sector_id]["resources"] = summarize_sector_resources(sector_region_rows)
        for sector_id in sectors.keys():
            sectors[sector_id].setdefault("resources", [])

    for zones_root in zone_roots:
        for zone_macro_node in zones_root.findall("./macro[@class='zone']"):
            zone_macro = zone_macro_node.get("name")
            if not zone_macro:
                continue
            sector_id = None
            for candidate_sector, candidate_zones in zone_offsets_by_sector.items():
                if zone_macro in candidate_zones:
                    sector_id = candidate_sector
                    break
            if sector_id is None:
                continue
            raw_local = zone_offsets_by_sector[sector_id][zone_macro]
            zone_kind = "shcon" if SHCON_ZONE_RE.fullmatch(zone_macro or "") else "zone"
            zones[zone_macro] = {
                "id": zone_macro,
                "sector_id": sector_id,
                "name": "",
                "kind": zone_kind,
                "raw_local_pos": raw_local,
                "cluster_gate_ids": [],
            }
            for conn in zone_macro_node.findall("./connections/connection"):
                conn_name = conn.get("name") or conn.get("ref") or ""
                match = CLUSTER_GATE_RE.fullmatch(conn_name)
                if match:
                    gate_id = f"{zone_macro}:{conn_name}"
                    gate_raw = vec_add(raw_local, pos_from(conn))
                    cluster_links[gate_id] = {
                        "id": gate_id,
                        "kind": "cluster_gate",
                        "sector_id": sector_id,
                        "cluster_id": sectors[sector_id]["cluster_id"],
                        "zone_id": zone_macro,
                        "name": conn_name,
                        "target_cluster_id": f"Cluster_{int(match.group(2)):02d}_macro",
                        "raw_local_pos": gate_raw,
                    }
                    zones[zone_macro]["cluster_gate_ids"].append(gate_id)
                    sectors[sector_id]["cluster_gate_ids"].append(gate_id)
                    continue
    cluster_to_sectors: Dict[str, List[str]] = defaultdict(list)
    for sector_id, sector in sectors.items():
        if sector["cluster_id"]:
            cluster_to_sectors[sector["cluster_id"]].append(sector_id)

    sector_point_sets: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    for sector_id, sector in sectors.items():
        for gate_id in sector["cluster_gate_ids"]:
            sector_point_sets[sector_id][gate_id] = cluster_links[gate_id]["raw_local_pos"]
    for zone_id, zone in zones.items():
        if zone["kind"] == "shcon":
            sector_point_sets[zone["sector_id"]][zone_id] = zone["raw_local_pos"]
    for cluster_id, sector_ids in cluster_to_sectors.items():
        local_positions = {sector_id: sectors[sector_id]["raw_local_pos"] for sector_id in sector_ids}
        template_kind, slot_map, slot_positions = choose_sector_template(local_positions)
        radius_ratio = sector_radius_ratio(len(sector_ids))
        for sector_id in sector_ids:
            slot_name = slot_map.get(sector_id, "single")
            offset_ratio = slot_positions.get(slot_name, {"x": 0.0, "y": 0.0})
            point_set = sector_point_sets.get(sector_id, {})
            max_extent = max((math.hypot(point["x"], point["z"]) for point in point_set.values()), default=1.0)
            inner_ratio = math.sqrt(3.0) / 2.0
            extent_ratio = 0.8
            scale_per_radius = (inner_ratio * extent_ratio) / max(1.0, max_extent)
            sectors[sector_id]["normalized"] = {
                "template_kind": template_kind,
                "slot": slot_name,
                "sector_radius_ratio": radius_ratio,
                "center_offset_ratio": {"x": offset_ratio["x"], "y": offset_ratio["y"]},
                "scale_per_radius": scale_per_radius,
                "scale_basis": {
                    "hex_inner_ratio": inner_ratio,
                    "extent_ratio": extent_ratio,
                    "max_extent": max_extent,
                },
            }

    for gate_id, gate in cluster_links.items():
        sector_id = gate["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        raw = gate["raw_local_pos"]
        gate["raw_local_pos"] = {
            "x": raw["x"],
            "z": raw["z"],
            "sx": raw["x"] * scale_per_radius,
            "sy": -raw["z"] * scale_per_radius,
        }

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        raw = zone["raw_local_pos"]
        zone["raw_local_pos"] = {
            "x": raw["x"],
            "z": raw["z"],
            "sx": raw["x"] * scale_per_radius,
            "sy": -raw["z"] * scale_per_radius,
        }

    for highway_id, highway in sector_highways.items():
        sector_id = highway["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        highway["entry_sr"] = {
            "sx": highway["entry_pos"]["x"] * scale_per_radius,
            "sy": -highway["entry_pos"]["z"] * scale_per_radius,
        }
        highway["exit_sr"] = {
            "sx": highway["exit_pos"]["x"] * scale_per_radius,
            "sy": -highway["exit_pos"]["z"] * scale_per_radius,
        }
        highway["spline_sr"] = [
            {"sx": point["x"] * scale_per_radius, "sy": -point["z"] * scale_per_radius}
            for point in highway["spline"]
        ]

    for link_id, link in sector_links.items():
        zone_a = zones.get(link["zone_a_id"])
        zone_b = zones.get(link["zone_b_id"])
        if zone_a:
            link["sector_a_id"] = zone_a["sector_id"]
            link["from_zone_normalized_ratio"] = zone_a.get("normalized", {}).get("projected_local_ratio")
            link["from_zone_raw_local_pos"] = zone_a["raw_local_pos"]
        if zone_b:
            link["sector_b_id"] = zone_b["sector_id"]
            link["to_zone_normalized_ratio"] = zone_b.get("normalized", {}).get("projected_local_ratio")
            link["to_zone_raw_local_pos"] = zone_b["raw_local_pos"]

    sector_stations: Dict[str, List[dict]] = defaultdict(list)
    if god_xml_path and god_xml_path.exists():
        god_root = parse_xml(god_xml_path)
        sector_macro_by_lower = {key.lower(): key for key in sectors.keys()}
        zone_macro_by_lower = {key.lower(): key for key in zones.keys()}
        for station_node in god_root.findall(".//station[@id]"):
            location = station_node.find("./location")
            if location is None:
                continue
            location_class = (location.get("class") or "").strip().lower()
            location_macro = (location.get("macro") or "").strip()
            if not location_class or not location_macro:
                continue

            sector_id = None
            if location_class == "sector":
                sector_id = sector_macro_by_lower.get(location_macro.lower())
            elif location_class == "zone":
                zone_id = zone_macro_by_lower.get(location_macro.lower())
                if zone_id and zone_id in zones:
                    sector_id = zones[zone_id]["sector_id"]
            if not sector_id or sector_id not in sectors:
                continue

            base_pos = {"x": as_float(station_node.get("x"), 0.0), "z": as_float(station_node.get("z"), 0.0)}
            position = station_node.find("./position")
            if position is not None:
                base_pos = {"x": as_float(position.get("x"), 0.0), "z": as_float(position.get("z"), 0.0)}

            if location_class == "zone":
                zone_id = zone_macro_by_lower.get(location_macro.lower())
                if not zone_id or zone_id not in zones:
                    continue
                raw_sector_pos = vec_add({"x": zones[zone_id]["raw_local_pos"]["x"], "z": zones[zone_id]["raw_local_pos"]["z"]}, base_pos)
            else:
                raw_sector_pos = base_pos

            sector_norm = sectors[sector_id]["normalized"]
            scale_per_radius = sector_norm["scale_per_radius"]
            station_sector_pos = {
                "x": raw_sector_pos["x"],
                "z": raw_sector_pos["z"],
                "sx": raw_sector_pos["x"] * scale_per_radius,
                "sy": -raw_sector_pos["z"] * scale_per_radius,
            }

            select = station_node.find("./station/select")
            station_item = {
                "owner": (station_node.get("owner") or "").strip(),
                "race": (station_node.get("race") or "").strip(),
                "type": (station_node.get("type") or "").strip(),
                "tags": parse_select_tags(select.get("tags") if select is not None else None),
                "raw_sector_pos": station_sector_pos,
            }
            sector_stations[sector_id].append(station_item)

    faction_map = factions_by_id or {}
    owner_resolution_ties: List[dict] = []
    excluded_owners = {"player"}

    def owner_color(owner: str) -> str:
        if owner in faction_map:
            return faction_map[owner].get("color") or OWNER_COLORS.get(owner, "#4b5563")
        return OWNER_COLORS.get(owner, "#4b5563")

    for sector_id, sector in sectors.items():
        stations = sector_stations.get(sector_id, [])
        candidates = []
        for station in stations:
            owner = (station.get("owner") or "").strip()
            station_type = (station.get("type") or "").strip()
            tags = station.get("tags") or []
            if not owner or owner in excluded_owners:
                continue
            faction = faction_map.get(owner)
            if faction is not None and not faction.get("claimspace", False):
                continue
            if station_type == "piratebase":
                continue
            score = (station_type_priority(station_type), station_tag_priority(tags))
            candidates.append((score, station))

        if not candidates:
            sector["owner"] = "ownerless"
            sector["owner_color"] = owner_color("ownerless")
            continue

        candidates.sort(key=lambda item: item[0], reverse=True)
        best_score = candidates[0][0]
        top = [item[1] for item in candidates if item[0] == best_score]
        chosen = top[0]
        sector["owner"] = (chosen.get("owner") or "").strip() or "ownerless"
        sector["owner_color"] = owner_color(sector["owner"])
        if len(top) > 1:
            owner_resolution_ties.append(
                {
                    "sector_id": sector_id,
                    "score": {"type_priority": best_score[0], "tag_priority": best_score[1]},
                    "candidates": [
                        {
                            "owner": item.get("owner"),
                            "type": item.get("type"),
                            "tags": item.get("tags", []),
                        }
                        for item in top
                    ],
                    "chosen": {
                        "owner": chosen.get("owner"),
                        "type": chosen.get("type"),
                        "tags": chosen.get("tags", []),
                    },
                }
            )

    for cluster_id, cluster in clusters.items():
        sector_ids = cluster.get("sector_ids", [])
        if not sector_ids:
            cluster["owner"] = "ownerless"
            cluster["owner_color"] = owner_color("ownerless")
            continue
        owners = {sectors[sector_id]["owner"] for sector_id in sector_ids if sector_id in sectors}
        if len(owners) == 1 and "ownerless" not in owners:
            cluster_owner = next(iter(owners))
        else:
            cluster_owner = "ownerless"
        cluster["owner"] = cluster_owner
        cluster["owner_color"] = owner_color(cluster_owner)

    grouped_sector_links: Dict[Tuple[str, str, str], List[str]] = defaultdict(list)
    for link_id, link in sector_links.items():
        sector_a_id = link.get("sector_a_id")
        sector_b_id = link.get("sector_b_id")
        if not sector_a_id or not sector_b_id:
            continue
        grouped_sector_links[(link["cluster_id"],) + tuple(sorted((sector_a_id, sector_b_id)))].append(link_id)
    for _, group in grouped_sector_links.items():
        count = len(group)
        for index, link_id in enumerate(sorted(group)):
            sector_links[link_id].setdefault("render", {})["lane_index"] = index
            sector_links[link_id]["render"]["lane_count"] = count

    nested_clusters: Dict[str, dict] = {}
    for cluster_id, cluster in clusters.items():
        nested_cluster = {
            key: value
            for key, value in cluster.items()
            if key not in {"sector_ids", "sector_link_ids"}
        }
        nested_cluster["sectors"] = {}
        nested_cluster["sector_links"] = {}
        nested_clusters[cluster_id] = nested_cluster

    for sector_id, sector in sectors.items():
        cluster_id = sector.get("cluster_id")
        if not cluster_id or cluster_id not in nested_clusters:
            continue
        nested_sector = {
            key: value
            for key, value in sector.items()
            if key not in {"zone_ids", "cluster_gate_ids", "highway_ids"}
        }
        nested_sector["shcon_anchors"] = {}
        nested_sector["cluster_gates"] = {}
        nested_sector["highways"] = {}
        nested_sector["stations"] = []
        nested_clusters[cluster_id]["sectors"][sector_id] = nested_sector

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        if zone["kind"] != "shcon":
            continue
        nested_clusters[cluster_id]["sectors"][sector_id]["shcon_anchors"][zone_id] = {
            "id": zone_id,
            "raw_sector_pos": zone["raw_local_pos"],
        }

    for gate_id, gate in cluster_links.items():
        cluster_id = gate["cluster_id"]
        sector_id = gate["sector_id"]
        normalized_id = gate["name"]
        nested_gate = {
            "id": normalized_id,
            "target_cluster_id": gate["target_cluster_id"],
            "raw_local_pos": gate["raw_local_pos"],
        }
        nested_clusters[cluster_id]["sectors"][sector_id]["cluster_gates"][normalized_id] = nested_gate

    for highway_id, highway in sector_highways.items():
        sector_id = highway["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        entry = {
            "x": highway["entry_pos"]["x"],
            "z": highway["entry_pos"]["z"],
            "sx": highway["entry_sr"]["sx"],
            "sy": highway["entry_sr"]["sy"],
        }
        exitp = {
            "x": highway["exit_pos"]["x"],
            "z": highway["exit_pos"]["z"],
            "sx": highway["exit_sr"]["sx"],
            "sy": highway["exit_sr"]["sy"],
        }
        spline_points = [
            {
                "x": point["x"],
                "z": point["z"],
                "sx": point_sr["sx"],
                "sy": point_sr["sy"],
            }
            for point, point_sr in zip(highway["spline"], highway["spline_sr"])
        ]
        nested_clusters[cluster_id]["sectors"][sector_id]["highways"][highway["name"]] = {
            "macro": highway["macro"],
            "entry": entry,
            "exit": exitp,
            "spline": spline_points,
        }

    for link_id, link in sector_links.items():
        cluster_id = link["cluster_id"]
        nested_link = {
            "id": link["id"],
            "sector_a_id": link.get("sector_a_id"),
            "sector_b_id": link.get("sector_b_id"),
            "from_zone_id": link.get("zone_a_id"),
            "to_zone_id": link.get("zone_b_id"),
            "render": link.get("render", {}),
        }
        nested_clusters[cluster_id]["sector_links"][link_id] = nested_link

    for sector_id, station_items in sector_stations.items():
        cluster_id = sectors[sector_id]["cluster_id"]
        if cluster_id and cluster_id in nested_clusters and sector_id in nested_clusters[cluster_id]["sectors"]:
            nested_clusters[cluster_id]["sectors"][sector_id]["stations"] = station_items

    payload = {
        "meta": {
            "version": "x4-map-xml-v2",
            "source_map_dir": str(map_dir),
            "mapdefaults_xml": str(mapdefaults_path) if mapdefaults_path.exists() else None,
            "structure": "clusters->sectors with zone data expanded into sector-space",
        },
        "clusters": nested_clusters,
    }
    name_ids = sorted(
        {
            item["nameId"]
            for item in list(clusters.values()) + list(sectors.values())
            if item.get("nameId")
        }
    )
    missing_cluster_nameid = sorted([cluster_id for cluster_id, cluster in clusters.items() if not cluster.get("nameId")])
    missing_sector_nameid = sorted([sector_id for sector_id, sector in sectors.items() if not sector.get("nameId")])
    return {
        "payload": payload,
        "regions": regions_rows,
        "resourceareas": build_resourceareas_json_payload(resourceareas_rows),
        "name_ids": name_ids,
        "missing_name_ids": {
            "clusters": missing_cluster_nameid,
            "sectors": missing_sector_nameid,
        },
        "stats": {
            "clusters": len(clusters),
            "sectors": len(sectors),
            "zones": len(zones),
            "cluster_links": len(cluster_links),
            "sector_links": len(sector_links),
            "highways": len(sector_highways),
            "regions": len(regions_rows),
            "resourceareas": sum(len(g.get("areas", [])) for g in build_resourceareas_json_payload(resourceareas_rows)),
            "stations": sum(len(items) for items in sector_stations.values()),
            "owner_resolution_ties": len(owner_resolution_ties),
        },
        "owner_resolution_ties": owner_resolution_ties,
    }


def write_map_output(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_runtime_paths(args: argparse.Namespace) -> dict:
    return {
        "map_dir": Path(args.map_dir or DEFAULT_MAP_DIR),
        "output_path": Path(args.output or DEFAULT_OUTPUT),
        "mapdefaults_path": Path(args.mapdefaults_xml or DEFAULT_MAPDEFAULTS),
        "god_xml_path": Path(args.god_xml or DEFAULT_GOD_XML),
        "factions_xml_path": Path(args.factions_xml or DEFAULT_FACTIONS_XML),
        "colors_xml_path": Path(args.colors_xml or DEFAULT_COLORS_XML),
        "region_definitions_xml_path": Path(args.region_definitions_xml or DEFAULT_REGION_DEFINITIONS_XML),
        "regionobjectgroups_xml_path": Path(args.regionobjectgroups_xml or DEFAULT_REGIONOBJECTGROUPS_XML),
        "regionyields_xml_path": Path(args.regionyields_xml or DEFAULT_REGIONYIELDS_XML),
        "factions_output_path": Path(args.factions_output or DEFAULT_FACTIONS_OUTPUT),
        "regions_output_path": Path(args.regions_output or DEFAULT_REGIONS_OUTPUT),
        "regionyields_output_path": Path(args.regionyields_output or DEFAULT_REGIONYIELDS_OUTPUT),
        "regionyield_definitions_output_path": Path(DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT),
        "resourceareas_output_path": Path(DEFAULT_RESOURCEAREAS_OUTPUT),
    }


def run_for_config(args: argparse.Namespace, effective_config: Dict[str, object]) -> None:
    apply_runtime_config(effective_config)
    runtime_paths = resolve_runtime_paths(args)
    map_dir = runtime_paths["map_dir"]
    output_path = runtime_paths["output_path"]
    mapdefaults_path = runtime_paths["mapdefaults_path"]
    god_xml_path = runtime_paths["god_xml_path"]
    factions_xml_path = runtime_paths["factions_xml_path"]
    colors_xml_path = runtime_paths["colors_xml_path"]
    region_definitions_xml_path = runtime_paths["region_definitions_xml_path"]
    regionobjectgroups_xml_path = runtime_paths["regionobjectgroups_xml_path"]
    regionyields_xml_path = runtime_paths["regionyields_xml_path"]
    factions_output_path = runtime_paths["factions_output_path"]
    regions_output_path = runtime_paths["regions_output_path"]
    regionyields_output_path = runtime_paths["regionyields_output_path"]
    regionyield_definitions_output_path = runtime_paths["regionyield_definitions_output_path"]
    resourceareas_output_path = runtime_paths["resourceareas_output_path"]

    # 版本分流：根据版本号判定资源模型
    version_str = str(effective_config.get("version", ""))
    resource_model = detect_map_resource_model(version_str)
    print(f"📊 资源模型: {resource_model} (version={version_str})")

    registry = get_i18n_registry()
    registry.configure(X4_UNPACKED_DATA_PATH, {
        "044": {"iso": "en", "name": "English"},
    })
    factions_rows, factions_by_id = migrate_factions(
        factions_xml_path=factions_xml_path,
        colors_xml_path=colors_xml_path,
        i18n_registry=registry,
    )
    factions_output_path.parent.mkdir(parents=True, exist_ok=True)
    factions_output_path.write_text(json.dumps(factions_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    # 版本分流：根据资源模型选择不同的处理逻辑
    if resource_model == "resourceareas":
        # 9.0+ 新版资源模型
        # 1. 解析 definition 模板
        definitions = migrate_resourcearea_definitions(regionyields_xml_path)
        print(f"📦 解析 resourcearea definitions: {len(definitions)} 个")

        # 2. 解析 sector 资源区引用
        sector_resource_areas = migrate_sector_resourceareas(mapdefaults_path)
        print(f"📦 解析 sector resourceareas: {len(sector_resource_areas)} 个 sector")

        # 3. 输出 regionyield_definitions.json（只含 definitions 数组）
        definitions_list = list(definitions.values())
        regionyield_definitions_output_path.parent.mkdir(parents=True, exist_ok=True)
        regionyield_definitions_output_path.write_text(
            json.dumps(definitions_list, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"📦 Regionyield Definitions Output: {regionyield_definitions_output_path}")

        # 4. regionyields.json 固定输出空数组
        regionyields_output_path.parent.mkdir(parents=True, exist_ok=True)
        regionyields_output_path.write_text("[]", encoding="utf-8")
        print(f"📦 Regionyields Output: {regionyields_output_path} (空数组占位)")

        # 5. 生成 maps.json
        result = generate_map_data(
            map_dir=map_dir,
            mapdefaults_path=mapdefaults_path,
            god_xml_path=god_xml_path,
            factions_by_id=factions_by_id,
            region_definitions_xml_path=region_definitions_xml_path,
            regionobjectgroups_xml_path=regionobjectgroups_xml_path,
            regionyields_xml_path=regionyields_xml_path,
            i18n_registry=registry,
            resource_model="resourceareas",
            sector_resource_areas=sector_resource_areas,
            definitions=definitions,
        )

        # 6. 输出 resourceareas.json
        resourceareas_rows = result.get("resourceareas", [])
        resourceareas_output_path.parent.mkdir(parents=True, exist_ok=True)
        resourceareas_output_path.write_text(
            json.dumps(resourceareas_rows, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"📦 Resourceareas Output: {resourceareas_output_path} count={len(resourceareas_rows)}")

        # 7. 9.0+ 不输出 regions.json
        print(f"📦 Regions Output: 跳过 (9.0+ 不生成)")

    else:
        # 8.0- 旧版资源模型
        regionyields_rows = migrate_regionyields(regionyields_xml_path)
        regionyields_output_path.parent.mkdir(parents=True, exist_ok=True)
        regionyields_output_path.write_text(json.dumps(regionyields_rows, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"📦 Regionyields Output: {regionyields_output_path} count={len(regionyields_rows)}")

        result = generate_map_data(
            map_dir=map_dir,
            mapdefaults_path=mapdefaults_path,
            god_xml_path=god_xml_path,
            factions_by_id=factions_by_id,
            region_definitions_xml_path=region_definitions_xml_path,
            regionobjectgroups_xml_path=regionobjectgroups_xml_path,
            regionyields_xml_path=regionyields_xml_path,
            i18n_registry=registry,
        )

        # 输出 regions.json（纯 region 定义）
        regions_output_path.parent.mkdir(parents=True, exist_ok=True)
        regions_output_path.write_text(json.dumps(result.get("regions", []), ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"📦 Regions Output: {regions_output_path} count={len(result.get('regions', []))}")

        # 输出 resourceareas.json（region 到 sector 的引用关系）
        resourceareas_output_path.parent.mkdir(parents=True, exist_ok=True)
        resourceareas_output_path.write_text(
            json.dumps(result.get("resourceareas", []), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"📦 Resourceareas Output: {resourceareas_output_path} count={len(result.get('resourceareas', []))}")

    write_map_output(result["payload"], output_path)
    stats = result["stats"]
    missing = result["missing_name_ids"]
    print(f"Factions Output: {factions_output_path} count={len(factions_rows)}")
    print(f"Output: {output_path}")
    print(
        f"clusters={stats['clusters']} sectors={stats['sectors']} zones={stats['zones']} "
        f"cluster_links={stats['cluster_links']} sector_links={stats['sector_links']} highways={stats['highways']} "
        f"stations={stats['stations']} owner_resolution_ties={stats['owner_resolution_ties']}"
    )
    ties = result.get("owner_resolution_ties", [])
    if ties:
        print("owner_resolution_tie_list:")
        for item in ties:
            candidates_text = "; ".join(
                [
                    f"{cand.get('owner')}|{cand.get('type')}|{','.join(cand.get('tags', []))}"
                    for cand in item.get("candidates", [])
                ]
            )
            chosen = item.get("chosen", {})
            chosen_text = f"{chosen.get('owner')}|{chosen.get('type')}|{','.join(chosen.get('tags', []))}"
            print(f"  {item.get('sector_id')} score={item.get('score')} chosen={chosen_text} candidates={candidates_text}")
    print(f"missing_cluster_nameId={len(missing['clusters'])}")
    if missing["clusters"]:
        print("  " + ", ".join(missing["clusters"]))
    print(f"missing_sector_nameId={len(missing['sectors'])}")
    if missing["sectors"]:
        print("  " + ", ".join(missing["sectors"]))


def main() -> None:
    args = parse_args()
    target_versions = get_target_versions(_config, args)
    print(f"🧭 计划处理 {len(target_versions)} 个版本。")
    for version_item in target_versions:
        effective_config = merge_version_config(_config, version_item)
        version_label = effective_config.get("version")
        flavor = "beta" if effective_config.get("beta", False) else "stable"
        folder_name = effective_config.get("folder_name", "")
        print(f"\n🚀 版本开始: {version_label} ({flavor}) -> {folder_name}")
        run_for_config(args, effective_config)


if __name__ == "__main__":
    main()
