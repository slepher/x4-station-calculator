"""Gas estimator module - 气体资源估算算法.

提供气体资源的体积离散化和理论储量估算功能。
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

# 气体资源截断常量（单位：米）
GAS_XZ_LIMIT = 1024000   # 1024km
GAS_Y_LIMIT = 1024000    # 1024km
GAS_BLOCK_SIZE = 64000   # 64km

# 气体资源名称集合
GAS_WARES = {
    "hydrogen",
    "helium",
    "methane",
    "argon",
    "coolant",
}


def _as_number(value, default: float = 0.0) -> float:
    """将值转换为数字，失败则返回默认值。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def is_gas_ware(ware: str) -> bool:
    """判断 ware 是否为气体资源。"""
    return ware.lower() in GAS_WARES


def calculate_gas_volume_km3(
    region_pos: Dict[str, float],
    boundary: dict,
) -> Tuple[float, float]:
    """计算气体资源的有效体积（离散化后）。

    气体资源使用 64km 方块离散化计算：
    - cylinder: 按 64km 分层，统计命中层数
    - sphere: 半径按 32km 向上取整
    - splinetube: 截面离散为 64km × 64km 方阵
    - box: 枚举 64km 网格统计命中

    Args:
        region_pos: region 位置字典 {"x": ..., "y": ..., "z": ...}
        boundary: 边界定义

    Returns:
        (total_volume_km3, effective_volume_km3) - 总体积和有效体积
    """
    boundary_class = str(boundary.get("class", ""))
    size = boundary.get("size", {})
    radius = _as_number(size.get("r"), 0.0)

    if boundary_class == "sphere":
        # 球体离散化：半径向上取整到 32km 边界
        # 方块数量 = ceil(radius / 32km)³
        block_radius = math.ceil(radius / (GAS_BLOCK_SIZE / 2))
        total_blocks = (2 * block_radius + 1) ** 3

        # 有效方块：限制在有效空间内
        effective_radius = min(block_radius, GAS_XZ_LIMIT // GAS_BLOCK_SIZE)
        effective_blocks = (2 * effective_radius + 1) ** 3

        # 体积 = 方块数量 × 64³ km³
        block_volume_km3 = (GAS_BLOCK_SIZE / 1000) ** 3
        return (total_blocks * block_volume_km3, effective_blocks * block_volume_km3)

    elif boundary_class == "cylinder":
        linear = _as_number(size.get("linear"), 0.0)
        # 圆柱离散化：水平方向方块数 × 高度方向方块数
        radius_blocks = math.ceil(radius / GAS_BLOCK_SIZE) * 2 + 1
        height_blocks = math.ceil(linear / GAS_BLOCK_SIZE)

        total_blocks = radius_blocks * radius_blocks * height_blocks

        # 有效方块
        effective_radius_blocks = min(radius_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2 + 1)
        effective_height_blocks = min(height_blocks, GAS_Y_LIMIT // GAS_BLOCK_SIZE * 2 + 1)
        effective_blocks = effective_radius_blocks * effective_radius_blocks * effective_height_blocks

        block_volume_km3 = (GAS_BLOCK_SIZE / 1000) ** 3
        return (total_blocks * block_volume_km3, effective_blocks * block_volume_km3)

    elif boundary_class == "splinetube":
        # splinetube 离散化
        spline = boundary.get("spline", [])
        length = _compute_spline_length(spline)

        # 截面方块数 × 长度方块数
        radius_blocks = math.ceil(radius / GAS_BLOCK_SIZE) * 2 + 1
        length_blocks = max(1, int(length / GAS_BLOCK_SIZE))

        total_blocks = radius_blocks * radius_blocks * length_blocks

        # 有效方块
        effective_radius_blocks = min(radius_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2 + 1)
        effective_length_blocks = min(length_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_blocks = effective_radius_blocks * effective_radius_blocks * effective_length_blocks

        block_volume_km3 = (GAS_BLOCK_SIZE / 1000) ** 3
        return (total_blocks * block_volume_km3, effective_blocks * block_volume_km3)

    elif boundary_class == "box":
        half_x = _as_number(size.get("x"), 0.0) / 2
        half_y = _as_number(size.get("y"), 0.0) / 2
        half_z = _as_number(size.get("z"), 0.0) / 2

        x_blocks = math.ceil(half_x * 2 / GAS_BLOCK_SIZE)
        y_blocks = math.ceil(half_y * 2 / GAS_BLOCK_SIZE)
        z_blocks = math.ceil(half_z * 2 / GAS_BLOCK_SIZE)

        total_blocks = x_blocks * y_blocks * z_blocks

        # 有效方块
        effective_x_blocks = min(x_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_y_blocks = min(y_blocks, GAS_Y_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_z_blocks = min(z_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_blocks = effective_x_blocks * effective_y_blocks * effective_z_blocks

        block_volume_km3 = (GAS_BLOCK_SIZE / 1000) ** 3
        return (total_blocks * block_volume_km3, effective_blocks * block_volume_km3)

    else:
        return (1.0, 1.0)


def _compute_spline_length(spline: list) -> float:
    """计算样条曲线的近似长度。"""
    if len(spline) < 2:
        return 0.0

    total_length = 0.0
    for i in range(len(spline) - 1):
        p1 = spline[i]
        p2 = spline[i + 1]
        dx = _as_number(p2.get("x"), 0.0) - _as_number(p1.get("x"), 0.0)
        dy = _as_number(p2.get("y"), 0.0) - _as_number(p1.get("y"), 0.0)
        dz = _as_number(p2.get("z"), 0.0) - _as_number(p1.get("z"), 0.0)
        total_length += math.sqrt(dx * dx + dy * dy + dz * dz)

    return total_length


def estimate_gas_yield(
    region_pos: Dict[str, float],
    boundary: dict,
    falloff_factor: float,
    resourcedensity: float,
    replenishtime: float,
) -> Tuple[float, float]:
    """估算气体资源的理论储量。

    公式：
    - theoretical_reserve = effective_volume_km3 × falloff_factor × resourcedensity / 64³
    - theoretical_respawn = theoretical_reserve × 60 / replenishtime

    注意：气体资源需要除以 64³ 因子，这是游戏引擎的特殊处理。

    Args:
        region_pos: region 位置字典
        boundary: 边界定义
        falloff_factor: falloff 因子
        resourcedensity: 资源密度
        replenishtime: 重生时间（分钟）

    Returns:
        (theoretical_reserve, theoretical_respawn) - 理论储量和理论回复量
    """
    _, effective_volume_km3 = calculate_gas_volume_km3(region_pos, boundary)

    # 气体资源需要除以 64³ 因子
    gas_factor = 64.0 ** 3

    # 计算理论储量
    theoretical_reserve = effective_volume_km3 * falloff_factor * resourcedensity / gas_factor

    # 计算理论回复量（每小时）
    if replenishtime > 0:
        theoretical_respawn = theoretical_reserve * 60.0 / replenishtime
    else:
        theoretical_respawn = 0.0

    return (theoretical_reserve, theoretical_respawn)


def calculate_gas_block_count(
    region_pos: Dict[str, float],
    boundary: dict,
) -> Tuple[int, int]:
    """计算气体资源命中的 64km³ 方块数量。

    Args:
        region_pos: region 位置字典
        boundary: 边界定义

    Returns:
        (total_blocks, effective_blocks) - 总方块数和有效方块数
    """
    boundary_class = str(boundary.get("class", ""))
    size = boundary.get("size", {})
    radius = _as_number(size.get("r"), 0.0)

    if boundary_class == "sphere":
        block_radius = math.ceil(radius / (GAS_BLOCK_SIZE / 2))
        total_blocks = (2 * block_radius + 1) ** 3

        effective_radius = min(block_radius, GAS_XZ_LIMIT // GAS_BLOCK_SIZE)
        effective_blocks = (2 * effective_radius + 1) ** 3

        return (max(1, total_blocks), max(0, effective_blocks))

    elif boundary_class == "cylinder":
        linear = _as_number(size.get("linear"), 0.0)

        radius_blocks = math.ceil(radius / GAS_BLOCK_SIZE) * 2 + 1
        height_blocks = math.ceil(linear / GAS_BLOCK_SIZE)

        total_blocks = radius_blocks * radius_blocks * height_blocks

        effective_radius_blocks = min(radius_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2 + 1)
        effective_height_blocks = min(height_blocks, GAS_Y_LIMIT // GAS_BLOCK_SIZE * 2 + 1)
        effective_blocks = effective_radius_blocks * effective_radius_blocks * effective_height_blocks

        return (max(1, total_blocks), max(0, effective_blocks))

    elif boundary_class == "splinetube":
        spline = boundary.get("spline", [])
        length = _compute_spline_length(spline)

        radius_blocks = math.ceil(radius / GAS_BLOCK_SIZE) * 2 + 1
        length_blocks = max(1, int(length / GAS_BLOCK_SIZE))

        total_blocks = radius_blocks * radius_blocks * length_blocks

        effective_radius_blocks = min(radius_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2 + 1)
        effective_length_blocks = min(length_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_blocks = effective_radius_blocks * effective_radius_blocks * effective_length_blocks

        return (max(1, total_blocks), max(0, effective_blocks))

    elif boundary_class == "box":
        half_x = _as_number(size.get("x"), 0.0) / 2
        half_y = _as_number(size.get("y"), 0.0) / 2
        half_z = _as_number(size.get("z"), 0.0) / 2

        x_blocks = math.ceil(half_x * 2 / GAS_BLOCK_SIZE)
        y_blocks = math.ceil(half_y * 2 / GAS_BLOCK_SIZE)
        z_blocks = math.ceil(half_z * 2 / GAS_BLOCK_SIZE)

        total_blocks = x_blocks * y_blocks * z_blocks

        effective_x_blocks = min(x_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_y_blocks = min(y_blocks, GAS_Y_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_z_blocks = min(z_blocks, GAS_XZ_LIMIT // GAS_BLOCK_SIZE * 2)
        effective_blocks = effective_x_blocks * effective_y_blocks * effective_z_blocks

        return (max(1, total_blocks), max(0, effective_blocks))

    else:
        return (1, 0)


__all__ = [
    "GAS_XZ_LIMIT",
    "GAS_Y_LIMIT",
    "GAS_BLOCK_SIZE",
    "GAS_WARES",
    "is_gas_ware",
    "calculate_gas_volume_km3",
    "estimate_gas_yield",
    "calculate_gas_block_count",
]