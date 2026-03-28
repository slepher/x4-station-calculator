"""Solid estimator module - 固体资源估算算法.

提供固体资源的体积截断和理论储量估算功能。
"""

from __future__ import annotations

import math
from typing import Optional, Tuple

# 固体资源截断常量（单位：米）
SOLID_XZ_LIMIT = 1024000  # 1024km
SOLID_Y_LIMIT = 1024000   # 1024km
SPLINETUBE_LENGTH_LIMIT = 2048000  # 2048km


def _as_number(value, default: float = 0.0) -> float:
    """将值转换为数字，失败则返回默认值。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def calculate_solid_volume_truncated(boundary: dict) -> Tuple[float, float]:
    """计算固体资源的有效体积（截断后）。

    Args:
        boundary: 边界定义（含 class, size, spline 等）

    Returns:
        (total_volume_m3, effective_volume_m3) - 截断前和截断后的体积（单位：m³）
    """
    boundary_class = str(boundary.get("class", ""))
    size = boundary.get("size", {})
    radius = _as_number(size.get("r"), 0.0)

    if boundary_class == "sphere":
        # 球体：V = 4/3 × π × r³
        total_volume = (4.0 / 3.0) * math.pi * (radius ** 3)
        # 截断：半径限制在 1024km
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        # 球体截断为有效空间内的体积
        effective_volume = (4.0 / 3.0) * math.pi * (capped_radius ** 3)
        return (total_volume, effective_volume)

    elif boundary_class == "cylinder":
        linear = _as_number(size.get("linear"), 0.0)
        # 圆柱：V = π × r² × h，其中 linear 是半高，所以全高 = linear × 2
        total_volume = math.pi * (radius ** 2) * (linear * 2)
        # 截断：半径限制在 1024km，高度限制在 2048km
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_height = min(linear * 2, SOLID_Y_LIMIT * 2)  # 2048km
        effective_volume = math.pi * (capped_radius ** 2) * capped_height
        return (total_volume, effective_volume)

    elif boundary_class == "splinetube":
        # splinetube 需要计算曲线长度
        spline = boundary.get("spline", [])
        length = _compute_spline_length(spline)

        # Tube: V = π × r² × length
        total_volume = math.pi * (radius ** 2) * length
        # 截断
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_length = min(length, SPLINETUBE_LENGTH_LIMIT)
        effective_volume = math.pi * (capped_radius ** 2) * capped_length
        return (total_volume, effective_volume)

    elif boundary_class == "box":
        half_x = _as_number(size.get("x"), 0.0) / 2
        half_y = _as_number(size.get("y"), 0.0) / 2
        half_z = _as_number(size.get("z"), 0.0) / 2
        total_volume = (half_x * 2) * (half_y * 2) * (half_z * 2)
        # 截断到有效空间
        capped_half_x = min(half_x, SOLID_XZ_LIMIT)
        capped_half_y = min(half_y, SOLID_Y_LIMIT)
        capped_half_z = min(half_z, SOLID_XZ_LIMIT)
        effective_volume = (capped_half_x * 2) * (capped_half_y * 2) * (capped_half_z * 2)
        return (total_volume, effective_volume)

    else:
        # 未知类型，返回 1.0
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


def estimate_solid_yield(
    boundary: dict,
    falloff_factor: float,
    resourcedensity: float,
    replenishtime: float,
) -> Tuple[float, float]:
    """估算固体资源的理论储量。

    公式：
    - theoretical_reserve = effective_volume_m3 × falloff_factor × resourcedensity
    - theoretical_respawn = theoretical_reserve × 60 / replenishtime

    Args:
        boundary: 边界定义
        falloff_factor: falloff 因子（lateral_factor × radial_factor）
        resourcedensity: 资源密度
        replenishtime: 重生时间（分钟）

    Returns:
        (theoretical_reserve, theoretical_respawn) - 理论储量和理论回复量
    """
    _, effective_volume_m3 = calculate_solid_volume_truncated(boundary)

    # 转换为 km³
    effective_volume_km3 = effective_volume_m3 / 1e9

    # 计算理论储量
    theoretical_reserve = effective_volume_km3 * falloff_factor * resourcedensity

    # 计算理论回复量（每小时）
    if replenishtime > 0:
        theoretical_respawn = theoretical_reserve * 60.0 / replenishtime
    else:
        theoretical_respawn = 0.0

    return (theoretical_reserve, theoretical_respawn)


def calculate_solid_volume_km3(boundary: dict) -> float:
    """计算固体资源的有效体积（km³）。

    Args:
        boundary: 边界定义

    Returns:
        有效体积（km³）
    """
    _, effective_volume_m3 = calculate_solid_volume_truncated(boundary)
    return effective_volume_m3 / 1e9


__all__ = [
    "SOLID_XZ_LIMIT",
    "SOLID_Y_LIMIT",
    "SPLINETUBE_LENGTH_LIMIT",
    "calculate_solid_volume_truncated",
    "estimate_solid_yield",
    "calculate_solid_volume_km3",
]