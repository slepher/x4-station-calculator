"""Map 输出写入 - X4 Map Data Processor."""

import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import xml.etree.ElementTree as ET

from processor.utils.xml_utils import parse_xml, parse_xml_attrs, parse_step_curve, piecewise_average
from processor.utils.data_utils import split_tags, coerce_attr_value
from processor.utils.math_utils import as_float, as_number, rgb_to_hex, distance_3d

# 截断限制（单位：米）
SOLID_XZ_LIMIT = 256_000       # 256 km
SOLID_Y_LIMIT = 96_000         # 96 km (总高度 192km)
GAS_XZ_LIMIT = 256_000         # 256 km
GAS_Y_LIMIT = 64_000           # 64 km (总高度 128km)
GAS_BLOCK_SIZE = 64_000        # 64 km 立方体网格
GAS_MIN_HEIGHT = 64_000        # 气体最小高度 64km

# 气体资源 ware 列表
GAS_WARES = {"helium", "hydrogen", "methane", "bogas"}

# 体积上限限制
CYLINDER_RADIUS_LIMIT = 200_000   # 200 km
CYLINDER_HEIGHT_LIMIT = 80_000    # 80 km
SPLINETUBE_LENGTH_LIMIT = 1_000_000  # 1000 km


def write_map_output(payload: dict, output_path: Path) -> None:
    """写入地图输出文件。"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_color_map_from_xml(colors_xml_path: Path) -> Dict[str, str]:
    """从 XML 加载颜色映射。"""
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
    i18n_registry=None,
) -> Tuple[List[dict], Dict[str, dict]]:
    """迁移派系数据。"""
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
    """构建衰减对象。"""
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


def is_gas_ware(ware: str) -> bool:
    """判断 ware 是否为气体资源"""
    return ware in GAS_WARES


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
        # 截断
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_length = min(length, SPLINETUBE_LENGTH_LIMIT)
        effective_volume = math.pi * (capped_radius ** 2) * capped_length
        return (total_volume, effective_volume)

    else:
        # 未知类型，返回 1.0
        return (1.0, 1.0)


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
    radius = as_number(boundary.get("size", {}).get("r"), 0.0)
    linear = as_number(boundary.get("size", {}).get("linear"), 0.0)
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
