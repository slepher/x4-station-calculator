"""Map 计算函数 - X4 Map Data Processor.

提供纯计算函数，无 XML 解析，无文件 I/O。
"""

import math
from typing import Dict, List, Optional, Tuple

from processor.map.constants import (
    SOLID_XZ_LIMIT,
    SOLID_Y_LIMIT,
    GAS_XZ_LIMIT,
    GAS_Y_LIMIT,
    GAS_BLOCK_SIZE,
    GAS_WARES,
    CYLINDER_RADIUS_LIMIT,
    CYLINDER_HEIGHT_LIMIT,
    SPLINETUBE_LENGTH_LIMIT,
)
from processor.utils.data_utils import as_number
from processor.utils.math_utils import distance_3d


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
