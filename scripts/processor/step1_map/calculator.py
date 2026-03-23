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
    TOTAL_BLOCK_NEG_LIMIT,
    TOTAL_BLOCK_POS_LIMIT,
    TOTAL_BLOCK_Y_NEG_LIMIT,
    TOTAL_BLOCK_Y_POS_LIMIT,
)
from processor.utils.data_utils import as_number
from processor.utils.math_utils import distance_3d, compute_spline_curve_length, sample_spline_curve_points


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
    计算 splinetube 的等效 linear 长度（曲线弧长）。
    对于非 splinetube 类型，返回 0.0。
    """
    if not boundary:
        return 0.0
    boundary_class = str(boundary.get("class") or "")
    if boundary_class != "splinetube":
        return 0.0
    spline = boundary.get("spline") or []
    return compute_spline_curve_length(spline)


def boundary_volume(boundary: Optional[dict]) -> float:
    """
    计算边界总量体积（单位：m³）。

    返回：未截断的真实体积值（m³）
    截断体积请使用 calculate_solid_volume_truncated()。
    """
    if not boundary:
        return 1.0
    boundary_class = str(boundary.get("class") or "")
    size = boundary.get("size") or {}
    radius = as_number(size.get("r"), 0.0)

    if boundary_class == "sphere":
        return (4.0 / 3.0) * math.pi * (radius ** 3)

    if boundary_class == "cylinder":
        linear = as_number(size.get("linear"), 0.0)
        return math.pi * (radius ** 2) * linear

    if boundary_class == "splinetube":
        spline = boundary.get("spline") or []
        length = compute_spline_curve_length(spline)
        return math.pi * (radius ** 2) * length

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
        length = compute_spline_curve_length(spline)

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


def _floor_grid(value: float) -> int:
    return math.floor(value / GAS_BLOCK_SIZE) * GAS_BLOCK_SIZE


def _ceil_grid(value: float) -> int:
    return math.ceil(value / GAS_BLOCK_SIZE) * GAS_BLOCK_SIZE


def _clip_axis_range_to_total_window(axis_range: range) -> range:
    start = max(axis_range.start, -TOTAL_BLOCK_NEG_LIMIT)
    stop_inclusive = min(axis_range.stop - GAS_BLOCK_SIZE, TOTAL_BLOCK_POS_LIMIT)
    if start > stop_inclusive:
        return range(0, 0, GAS_BLOCK_SIZE)
    return range(start, stop_inclusive + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE)


def _clip_y_range_to_total_window(axis_range: range) -> range:
    start = max(axis_range.start, -TOTAL_BLOCK_Y_NEG_LIMIT)
    stop_inclusive = min(axis_range.stop - GAS_BLOCK_SIZE, TOTAL_BLOCK_Y_POS_LIMIT)
    if start > stop_inclusive:
        return range(0, 0, GAS_BLOCK_SIZE)
    return range(start, stop_inclusive + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE)


def _rect_circle_overlap(center_x: float, center_z: float, radius: float, block_x: int, block_z: int) -> bool:
    block_half = GAS_BLOCK_SIZE // 2
    block_x_min = block_x - block_half
    block_x_max = block_x + block_half
    block_z_min = block_z - block_half
    block_z_max = block_z + block_half
    closest_x = min(max(center_x, block_x_min), block_x_max)
    closest_z = min(max(center_z, block_z_min), block_z_max)
    dx = center_x - closest_x
    dz = center_z - closest_z
    return (dx * dx + dz * dz) <= (radius * radius)


def _sphere_box_overlap(center: Dict[str, float], radius: float, block_x: int, block_y: int, block_z: int) -> bool:
    block_half = GAS_BLOCK_SIZE // 2
    min_x = block_x - block_half
    max_x = block_x + block_half
    min_y = block_y - block_half
    max_y = block_y + block_half
    min_z = block_z - block_half
    max_z = block_z + block_half
    closest_x = min(max(float(center["x"]), min_x), max_x)
    closest_y = min(max(float(center["y"]), min_y), max_y)
    closest_z = min(max(float(center["z"]), min_z), max_z)
    dx = float(center["x"]) - closest_x
    dy = float(center["y"]) - closest_y
    dz = float(center["z"]) - closest_z
    return (dx * dx + dy * dy + dz * dz) <= (radius * radius)


def _box_box_overlap(position: Dict[str, float], size: dict, block_x: int, block_y: int, block_z: int) -> bool:
    block_half = GAS_BLOCK_SIZE // 2
    region_min_x = float(position["x"]) - as_number(size.get("x"), 0.0) / 2
    region_max_x = float(position["x"]) + as_number(size.get("x"), 0.0) / 2
    region_min_y = float(position["y"]) - as_number(size.get("y"), 0.0) / 2
    region_max_y = float(position["y"]) + as_number(size.get("y"), 0.0) / 2
    region_min_z = float(position["z"]) - as_number(size.get("z"), 0.0) / 2
    region_max_z = float(position["z"]) + as_number(size.get("z"), 0.0) / 2

    block_min_x = block_x - block_half
    block_max_x = block_x + block_half
    block_min_y = block_y - block_half
    block_max_y = block_y + block_half
    block_min_z = block_z - block_half
    block_max_z = block_z + block_half

    return not (
        block_max_x < region_min_x
        or block_min_x > region_max_x
        or block_max_y < region_min_y
        or block_min_y > region_max_y
        or block_max_z < region_min_z
        or block_min_z > region_max_z
    )


def _point_segment_distance_sq_2d(px: float, pz: float, ax: float, az: float, bx: float, bz: float) -> float:
    abx = bx - ax
    abz = bz - az
    apx = px - ax
    apz = pz - az
    ab_len_sq = abx * abx + abz * abz
    if ab_len_sq <= 1e-9:
        dx = px - ax
        dz = pz - az
        return dx * dx + dz * dz
    t = max(0.0, min(1.0, (apx * abx + apz * abz) / ab_len_sq))
    closest_x = ax + t * abx
    closest_z = az + t * abz
    dx = px - closest_x
    dz = pz - closest_z
    return dx * dx + dz * dz


def _point_rect_distance_sq_2d(px: float, pz: float, min_x: float, max_x: float, min_z: float, max_z: float) -> float:
    dx = 0.0
    if px < min_x:
        dx = min_x - px
    elif px > max_x:
        dx = px - max_x

    dz = 0.0
    if pz < min_z:
        dz = min_z - pz
    elif pz > max_z:
        dz = pz - max_z

    return dx * dx + dz * dz


def _orientation_2d(ax: float, az: float, bx: float, bz: float, cx: float, cz: float) -> float:
    return (bx - ax) * (cz - az) - (bz - az) * (cx - ax)


def _on_segment_2d(ax: float, az: float, bx: float, bz: float, cx: float, cz: float) -> bool:
    return (
        min(ax, bx) - 1e-9 <= cx <= max(ax, bx) + 1e-9
        and min(az, bz) - 1e-9 <= cz <= max(az, bz) + 1e-9
    )


def _segments_intersect_2d(ax: float, az: float, bx: float, bz: float, cx: float, cz: float, dx: float, dz: float) -> bool:
    o1 = _orientation_2d(ax, az, bx, bz, cx, cz)
    o2 = _orientation_2d(ax, az, bx, bz, dx, dz)
    o3 = _orientation_2d(cx, cz, dx, dz, ax, az)
    o4 = _orientation_2d(cx, cz, dx, dz, bx, bz)

    if o1 * o2 < 0 and o3 * o4 < 0:
        return True

    if abs(o1) <= 1e-9 and _on_segment_2d(ax, az, bx, bz, cx, cz):
        return True
    if abs(o2) <= 1e-9 and _on_segment_2d(ax, az, bx, bz, dx, dz):
        return True
    if abs(o3) <= 1e-9 and _on_segment_2d(cx, cz, dx, dz, ax, az):
        return True
    if abs(o4) <= 1e-9 and _on_segment_2d(cx, cz, dx, dz, bx, bz):
        return True

    return False


def _segment_rect_distance_sq_2d(ax: float, az: float, bx: float, bz: float, min_x: float, max_x: float, min_z: float, max_z: float) -> float:
    if min_x <= ax <= max_x and min_z <= az <= max_z:
        return 0.0
    if min_x <= bx <= max_x and min_z <= bz <= max_z:
        return 0.0

    edges = [
        (min_x, min_z, max_x, min_z),
        (max_x, min_z, max_x, max_z),
        (max_x, max_z, min_x, max_z),
        (min_x, max_z, min_x, min_z),
    ]
    for ex1, ez1, ex2, ez2 in edges:
        if _segments_intersect_2d(ax, az, bx, bz, ex1, ez1, ex2, ez2):
            return 0.0

    distances = [
        _point_rect_distance_sq_2d(ax, az, min_x, max_x, min_z, max_z),
        _point_rect_distance_sq_2d(bx, bz, min_x, max_x, min_z, max_z),
    ]
    corners = [
        (min_x, min_z),
        (min_x, max_z),
        (max_x, min_z),
        (max_x, max_z),
    ]
    for px, pz in corners:
        distances.append(_point_segment_distance_sq_2d(px, pz, ax, az, bx, bz))
    return min(distances)


def _point_segment_distance_sq_3d(px: float, py: float, pz: float, ax: float, ay: float, az: float, bx: float, by: float, bz: float) -> float:
    abx = bx - ax
    aby = by - ay
    abz = bz - az
    apx = px - ax
    apy = py - ay
    apz = pz - az
    ab_len_sq = abx * abx + aby * aby + abz * abz
    if ab_len_sq <= 1e-9:
        dx = px - ax
        dy = py - ay
        dz = pz - az
        return dx * dx + dy * dy + dz * dz
    t = (apx * abx + apy * aby + apz * abz) / ab_len_sq
    if t <= 0.0:
        qx, qy, qz = ax, ay, az
    elif t >= 1.0:
        qx, qy, qz = bx, by, bz
    else:
        qx = ax + t * abx
        qy = ay + t * aby
        qz = az + t * abz
    dx = px - qx
    dy = py - qy
    dz = pz - qz
    return dx * dx + dy * dy + dz * dz


def _get_sampled_splinetube(boundary: dict) -> List[Dict[str, float]]:
    sampled = boundary.get("_sampled_spline")
    if isinstance(sampled, list):
        return sampled
    spline = boundary.get("spline") or []
    sampled = sample_spline_curve_points(spline, samples_per_segment=16)
    boundary["_sampled_spline"] = sampled
    return sampled


def _get_splinetube_segments(boundary: dict) -> List[dict]:
    cached_segments = boundary.get("_sampled_spline_segments")
    if isinstance(cached_segments, list):
        return cached_segments

    size = boundary.get("size", {})
    radius = as_number(size.get("r"), 0.0)
    sampled_spline = _get_sampled_splinetube(boundary)
    segments: List[dict] = []
    if len(sampled_spline) < 2 or radius <= 0:
        boundary["_sampled_spline_segments"] = segments
        return segments

    for left, right in zip(sampled_spline, sampled_spline[1:]):
        ax = float(left.get("x", 0.0))
        ay = float(left.get("y", 0.0))
        az = float(left.get("z", 0.0))
        bx = float(right.get("x", 0.0))
        by = float(right.get("y", 0.0))
        bz = float(right.get("z", 0.0))
        segments.append(
            {
                "ax": ax,
                "ay": ay,
                "az": az,
                "bx": bx,
                "by": by,
                "bz": bz,
                # capsule broad-phase: segment AABB expanded by tube radius
                "min_x": min(ax, bx) - radius,
                "max_x": max(ax, bx) + radius,
                "min_y": min(ay, by) - radius,
                "max_y": max(ay, by) + radius,
                "min_z": min(az, bz) - radius,
                "max_z": max(az, bz) + radius,
            }
        )

    boundary["_sampled_spline_segments"] = segments
    return segments


def _splinetube_box_overlap(region_pos: Dict[str, float], boundary: dict, block_x: int, block_y: int, block_z: int) -> bool:
    size = boundary.get("size", {})
    radius = as_number(size.get("r"), 0.0)
    segments = _get_splinetube_segments(boundary)
    if not segments or radius <= 0:
        return False

    block_half = GAS_BLOCK_SIZE // 2
    block_x_min = block_x - block_half
    block_x_max = block_x + block_half
    block_y_min = block_y - block_half
    block_y_max = block_y + block_half
    block_z_min = block_z - block_half
    block_z_max = block_z + block_half

    radius_sq = radius * radius
    block_outer_radius = math.sqrt(3.0) * block_half
    broad_radius_sq = (radius + block_outer_radius) * (radius + block_outer_radius)
    center_x = float(block_x)
    center_y = float(block_y)
    center_z = float(block_z)
    min_centerline_dist_sq = None

    for segment in segments:
        dist_sq = _point_segment_distance_sq_3d(
            center_x,
            center_y,
            center_z,
            segment["ax"],
            segment["ay"],
            segment["az"],
            segment["bx"],
            segment["by"],
            segment["bz"],
        )
        if min_centerline_dist_sq is None or dist_sq < min_centerline_dist_sq:
            min_centerline_dist_sq = dist_sq

    if min_centerline_dist_sq is None or min_centerline_dist_sq > broad_radius_sq:
        return False

    for segment in segments:
        if (
            segment["max_x"] < block_x_min
            or segment["min_x"] > block_x_max
            or segment["max_y"] < block_y_min
            or segment["min_y"] > block_y_max
            or segment["max_z"] < block_z_min
            or segment["min_z"] > block_z_max
        ):
            continue

        xz_dist_sq = _segment_rect_distance_sq_2d(
            segment["ax"],
            segment["az"],
            segment["bx"],
            segment["bz"],
            block_x_min,
            block_x_max,
            block_z_min,
            block_z_max,
        )
        seg_min_y = min(segment["ay"], segment["by"])
        seg_max_y = max(segment["ay"], segment["by"])
        if seg_max_y < block_y_min:
            y_gap = block_y_min - seg_max_y
        elif seg_min_y > block_y_max:
            y_gap = seg_min_y - block_y_max
        else:
            y_gap = 0.0
        if xz_dist_sq + y_gap * y_gap <= radius_sq:
            return True

    return False


def _block_hits_boundary(region_pos: Dict[str, float], boundary: dict, block_x: int, block_y: int, block_z: int) -> bool:
    boundary_class = str(boundary.get("class", ""))
    size = boundary.get("size", {})
    radius = as_number(size.get("r"), 0.0)
    linear = as_number(size.get("linear"), 0.0)

    if boundary_class == "cylinder":
        center_x = float(region_pos["x"])
        center_z = float(region_pos["z"])
        center_dx = float(region_pos["x"]) - float(block_x)
        center_dz = float(region_pos["z"]) - float(block_z)
        center_inside_xz = center_dx * center_dx + center_dz * center_dz <= radius * radius
        block_half = GAS_BLOCK_SIZE // 2
        block_y_min = block_y - block_half
        block_y_max = block_y + block_half
        cylinder_y_min = float(region_pos["y"])
        cylinder_y_max = float(region_pos["y"]) + linear
        hit_y = not (block_y_max < cylinder_y_min or block_y_min > cylinder_y_max)
        if not hit_y:
            return False
        if center_inside_xz:
            return True
        block_x_min = block_x - block_half
        block_x_max = block_x + block_half
        block_z_min = block_z - block_half
        block_z_max = block_z + block_half
        block_outer_radius = math.sqrt(2.0) * block_half
        if center_dx * center_dx + center_dz * center_dz > (radius + block_outer_radius) * (radius + block_outer_radius):
            return False
        radius_sq = radius * radius
        corners = (
            (block_x_min, block_z_min),
            (block_x_min, block_z_max),
            (block_x_max, block_z_min),
            (block_x_max, block_z_max),
        )
        for corner_x, corner_z in corners:
            dx = center_x - corner_x
            dz = center_z - corner_z
            if dx * dx + dz * dz <= radius_sq:
                return True
        return _rect_circle_overlap(center_x, center_z, radius, block_x, block_z)

    if boundary_class == "sphere":
        center_x = float(region_pos["x"])
        center_y = float(region_pos["y"])
        center_z = float(region_pos["z"])
        dx = center_x - float(block_x)
        dy = center_y - float(block_y)
        dz = center_z - float(block_z)
        radius_sq = radius * radius
        if dx * dx + dy * dy + dz * dz <= radius_sq:
            return True
        block_half = GAS_BLOCK_SIZE // 2
        block_x_min = block_x - block_half
        block_x_max = block_x + block_half
        block_y_min = block_y - block_half
        block_y_max = block_y + block_half
        block_z_min = block_z - block_half
        block_z_max = block_z + block_half
        block_outer_radius = math.sqrt(3.0) * block_half
        if (
            dx * dx
            + dy * dy
            + dz * dz
            > (radius + block_outer_radius) * (radius + block_outer_radius)
        ):
            return False
        corners = (
            (block_x_min, block_y_min, block_z_min),
            (block_x_min, block_y_min, block_z_max),
            (block_x_min, block_y_max, block_z_min),
            (block_x_min, block_y_max, block_z_max),
            (block_x_max, block_y_min, block_z_min),
            (block_x_max, block_y_min, block_z_max),
            (block_x_max, block_y_max, block_z_min),
            (block_x_max, block_y_max, block_z_max),
        )
        for corner_x, corner_y, corner_z in corners:
            dx = center_x - corner_x
            dy = center_y - corner_y
            dz = center_z - corner_z
            if dx * dx + dy * dy + dz * dz <= radius_sq:
                return True
        return _sphere_box_overlap(region_pos, radius, block_x, block_y, block_z)

    if boundary_class == "box":
        return _box_box_overlap(region_pos, size, block_x, block_y, block_z)

    if boundary_class == "splinetube":
        return _splinetube_box_overlap(region_pos, boundary, block_x, block_y, block_z)

    return False


def _boundary_block_search_ranges(region_pos: Dict[str, float], boundary: dict) -> Optional[Tuple[range, range, range]]:
    boundary_class = str(boundary.get("class", ""))
    size = boundary.get("size", {})
    block_half = GAS_BLOCK_SIZE // 2

    if boundary_class == "cylinder":
        radius = as_number(size.get("r"), 0.0)
        linear = as_number(size.get("linear"), 0.0)
        x_min = _floor_grid(float(region_pos["x"]) - radius - block_half)
        x_max = _ceil_grid(float(region_pos["x"]) + radius + block_half)
        y_min = _floor_grid(float(region_pos["y"]) - block_half)
        y_max = _ceil_grid(float(region_pos["y"]) + linear + block_half)
        z_min = _floor_grid(float(region_pos["z"]) - radius - block_half)
        z_max = _ceil_grid(float(region_pos["z"]) + radius + block_half)
        return (
            range(x_min, x_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(y_min, y_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(z_min, z_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
        )

    if boundary_class == "sphere":
        radius = as_number(size.get("r"), 0.0)
        x_min = _floor_grid(float(region_pos["x"]) - radius - block_half)
        x_max = _ceil_grid(float(region_pos["x"]) + radius + block_half)
        y_min = _floor_grid(float(region_pos["y"]) - radius - block_half)
        y_max = _ceil_grid(float(region_pos["y"]) + radius + block_half)
        z_min = _floor_grid(float(region_pos["z"]) - radius - block_half)
        z_max = _ceil_grid(float(region_pos["z"]) + radius + block_half)
        return (
            range(x_min, x_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(y_min, y_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(z_min, z_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
        )

    if boundary_class == "box":
        half_x = as_number(size.get("x"), 0.0) / 2
        half_y = as_number(size.get("y"), 0.0) / 2
        half_z = as_number(size.get("z"), 0.0) / 2
        x_min = _floor_grid(float(region_pos["x"]) - half_x - block_half)
        x_max = _ceil_grid(float(region_pos["x"]) + half_x + block_half)
        y_min = _floor_grid(float(region_pos["y"]) - half_y - block_half)
        y_max = _ceil_grid(float(region_pos["y"]) + half_y + block_half)
        z_min = _floor_grid(float(region_pos["z"]) - half_z - block_half)
        z_max = _ceil_grid(float(region_pos["z"]) + half_z + block_half)
        return (
            range(x_min, x_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(y_min, y_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(z_min, z_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
        )

    if boundary_class == "splinetube":
        spline = boundary.get("spline") or []
        radius = as_number(size.get("r"), 0.0)
        if len(spline) < 2:
            return None
        min_spline_x = min(float(point.get("x", 0.0)) for point in spline)
        max_spline_x = max(float(point.get("x", 0.0)) for point in spline)
        min_spline_z = min(float(point.get("z", 0.0)) for point in spline)
        max_spline_z = max(float(point.get("z", 0.0)) for point in spline)
        x_min = _floor_grid(min_spline_x - radius - block_half)
        x_max = _ceil_grid(max_spline_x + radius + block_half)
        y_min = _floor_grid(float(region_pos["y"]) - radius - block_half)
        y_max = _ceil_grid(float(region_pos["y"]) + radius + block_half)
        z_min = _floor_grid(min_spline_z - radius - block_half)
        z_max = _ceil_grid(max_spline_z + radius + block_half)
        return (
            range(x_min, x_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(y_min, y_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
            range(z_min, z_max + GAS_BLOCK_SIZE, GAS_BLOCK_SIZE),
        )

    return None


def generate_boundary_block_coordinates(
    region_pos: Dict[str, float],
    boundary: dict,
    xz_limit: Optional[int] = None,
    y_limit: Optional[int] = None,
) -> Tuple[List[Tuple[int, int, int]], List[Tuple[int, int, int]]]:
    """
    生成 boundary 命中的 block 坐标。

    total_coords 为几何上所有命中的 block。
    effective_coords 为在截断窗口内的命中 block；若未提供 limit，则等于 total_coords。
    """
    ranges = _boundary_block_search_ranges(region_pos, boundary)
    if ranges is None:
        return ([], [])

    total_coords: List[Tuple[int, int, int]] = []
    effective_coords: List[Tuple[int, int, int]] = []
    xs, ys, zs = ranges
    xs = _clip_axis_range_to_total_window(xs)
    ys = _clip_y_range_to_total_window(ys)
    zs = _clip_axis_range_to_total_window(zs)

    for block_x in xs:
        for block_y in ys:
            for block_z in zs:
                if not _block_hits_boundary(region_pos, boundary, block_x, block_y, block_z):
                    continue
                coord = (block_x, block_y, block_z)
                total_coords.append(coord)
                if (
                    xz_limit is None
                    or y_limit is None
                    or (
                        abs(block_x) <= xz_limit
                        and abs(block_z) <= xz_limit
                        and abs(block_y) <= y_limit
                    )
                ):
                    effective_coords.append(coord)

    return (total_coords, effective_coords)


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
    return generate_boundary_block_coordinates(
        region_pos=region_pos,
        boundary=boundary,
        xz_limit=GAS_XZ_LIMIT,
        y_limit=GAS_Y_LIMIT,
    )


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
