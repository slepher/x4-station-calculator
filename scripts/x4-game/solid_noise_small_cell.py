"""
X4 Solid 资源小单元格路径实现 (cell_count < 17)
基于逆向工程 FUN_1414f4840 和 FUN_1414f4290
"""

from __future__ import annotations
import math
import struct
from dataclasses import dataclass
from typing import List, Tuple

# 黄金比例共轭 (DAT_142d7ff90)
GOLDEN_RATIO_CONJUGATE = 0.6180339

# 各轴乘数
HASH_MULTIPLIER_X = 173.0  # DAT_142d80884
HASH_MULTIPLIER_Y = 263.0  # DAT_142d808ac
HASH_MULTIPLIER_Z = 337.0  # DAT_142d808b8

# LCG 随机数生成器常量
LCG_MULTIPLIER = 0x5851f42d4c957f2d
LCG_INCREMENT = 0x14057b7ef767814f

# 归一化因子: 1 / 2^32
NORMALIZATION_FACTOR = 2.3283064365386963e-10


def generate_noise_table(seed_str: str) -> List[float]:
    """
    生成 1024-float noise table
    对应 FUN_1414f4210

    Args:
        seed_str: XML 中的 seed 字符串（如 "12345" 或空字符串）

    Returns:
        1024 个浮点数的列表，范围 [0, 1)
    """
    # 从字符串解析 64 位种子
    if seed_str and seed_str.strip():
        try:
            seed = int(seed_str) & 0xFFFFFFFFFFFFFFFF
        except ValueError:
            # 如果无法解析，使用字符串哈希
            seed = hash(seed_str) & 0xFFFFFFFFFFFFFFFF
    else:
        seed = 0

    noise_table = []
    for _ in range(1024):
        # LCG: seed = seed * multiplier + increment
        seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) & 0xFFFFFFFFFFFFFFFF
        # 取高 32 位
        value = (seed >> 30) & 0xFFFFFFFF
        # 归一化到 [0, 1)
        noise_table.append(float(value) * NORMALIZATION_FACTOR)

    return noise_table


def fractional(x: float) -> float:
    """获取小数部分"""
    return x - math.floor(x)


def get_cell_corners(noise_table: List[float], x: int, y: int, z: int) -> List[float]:
    """
    获取 cell (x,y,z) 8个角点的噪声值
    对应 FUN_1414f4290

    Args:
        noise_table: 1024-float noise table
        x, y, z: cell 的整数坐标

    Returns:
        8 个角点的噪声值 [c000, c001, c010, c011, c100, c101, c110, c111]
        其中 cXYZ 表示 (x+X, y+Y, z+Z) 处的值
    """
    # 计算每个轴的哈希值
    hx = int(fractional(x * GOLDEN_RATIO_CONJUGATE) * HASH_MULTIPLIER_X)
    hy = int(fractional(y * GOLDEN_RATIO_CONJUGATE) * HASH_MULTIPLIER_Y)
    hz = int(fractional(z * GOLDEN_RATIO_CONJUGATE) * HASH_MULTIPLIER_Z)

    # 计算 8 个角点的索引（确保是整数）
    indices = [
        int(hx + hy + hz) & 0x3ff,           # (x, y, z)
        int(hx + hy + hz + HASH_MULTIPLIER_Z) & 0x3ff,  # (x, y, z+1)
        int(hx + hy + hz + HASH_MULTIPLIER_Y) & 0x3ff,  # (x, y+1, z)
        int(hx + hy + hz + HASH_MULTIPLIER_Y + HASH_MULTIPLIER_Z) & 0x3ff,  # (x, y+1, z+1)
        int(hx + hy + hz + HASH_MULTIPLIER_X) & 0x3ff,  # (x+1, y, z)
        int(hx + hy + hz + HASH_MULTIPLIER_X + HASH_MULTIPLIER_Z) & 0x3ff,  # (x+1, y, z+1)
        int(hx + hy + hz + HASH_MULTIPLIER_X + HASH_MULTIPLIER_Y) & 0x3ff,  # (x+1, y+1, z)
        int(hx + hy + hz + HASH_MULTIPLIER_X + HASH_MULTIPLIER_Y + HASH_MULTIPLIER_Z) & 0x3ff,  # (x+1, y+1, z+1)
    ]

    return [noise_table[i] for i in indices]


def trilinear_interpolation(
    corners: List[float],
    fx: float, fy: float, fz: float
) -> float:
    """
    三线性插值

    Args:
        corners: 8 个角点的值 [c000, c001, c010, c011, c100, c101, c110, c111]
        fx: x 方向插值因子 [0, 1]
        fy: y 方向插值因子 [0, 1]
        fz: z 方向插值因子 [0, 1]

    Returns:
        插值后的值
    """
    c000, c001, c010, c011, c100, c101, c110, c111 = corners

    # 沿 x 方向插值
    c00 = c000 + (c100 - c000) * fx
    c01 = c001 + (c101 - c001) * fx
    c10 = c010 + (c110 - c010) * fx
    c11 = c011 + (c111 - c011) * fx

    # 沿 y 方向插值
    c0 = c00 + (c10 - c00) * fy
    c1 = c01 + (c11 - c01) * fy

    # 沿 z 方向插值
    return c0 + (c1 - c0) * fz


def compute_local_noise_small_cell(
    noise_table: List[float],
    min_x: float, max_x: float,
    min_y: float, max_y: float,
    min_z: float, max_z: float
) -> float:
    """
    小单元格路径：计算 query box 的局部噪声值
    对应 FUN_1414f4840 的慢路径 (cell_count < 17)

    Args:
        noise_table: 1024-float noise table
        min_x, max_x: query box 在 x 方向的归一化范围
        min_y, max_y: query box 在 y 方向的归一化范围
        min_z, max_z: query box 在 z 方向的归一化范围

    Returns:
        噪声权重值
    """
    # 计算覆盖的 cell 范围
    cell_min_x = math.floor(min_x)
    cell_max_x = math.ceil(max_x)
    cell_min_y = math.floor(min_y)
    cell_max_y = math.ceil(max_y)
    cell_min_z = math.floor(min_z)
    cell_max_z = math.ceil(max_z)

    total_weight = 0.0

    # 遍历所有覆盖的 cell
    for cx in range(cell_min_x, cell_max_x):
        for cy in range(cell_min_y, cell_max_y):
            for cz in range(cell_min_z, cell_max_z):
                # 获取 cell 的 8 个角点噪声值
                corners = get_cell_corners(noise_table, cx, cy, cz)

                # 计算 query box 与当前 cell 的重叠部分
                overlap_min_x = max(min_x, cx)
                overlap_max_x = min(max_x, cx + 1)
                overlap_min_y = max(min_y, cy)
                overlap_max_y = min(max_y, cy + 1)
                overlap_min_z = max(min_z, cz)
                overlap_max_z = min(max_z, cz + 1)

                # 如果无重叠，跳过
                if (overlap_min_x >= overlap_max_x or
                    overlap_min_y >= overlap_max_y or
                    overlap_min_z >= overlap_max_z):
                    continue

                # 计算重叠部分的体积权重
                overlap_volume = (
                    (overlap_max_x - overlap_min_x) *
                    (overlap_max_y - overlap_min_y) *
                    (overlap_max_z - overlap_min_z)
                )

                # 计算 cell 内重叠区域的中心点（用于插值）
                # 实际上应该对重叠区域积分，这里简化为取中心点
                center_x = (overlap_min_x + overlap_max_x) / 2 - cx
                center_y = (overlap_min_y + overlap_max_y) / 2 - cy
                center_z = (overlap_min_z + overlap_max_z) / 2 - cz

                # 三线性插值
                noise_value = trilinear_interpolation(
                    corners, center_x, center_y, center_z
                )

                # 累加贡献（体积加权的噪声值）
                total_weight += noise_value * overlap_volume

    return total_weight


def compute_local_noise_fast_path(min_noise: float, max_noise: float) -> float:
    """
    快路径：直接返回 F(max) - F(min)
    其中 F 是 noise CDF

    Args:
        min_noise: minnoisevalue
        max_noise: maxnoisevalue

    Returns:
        F(max) - F(min)
    """
    # 简化：假设噪声均匀分布，直接返回差值
    # 实际应该使用 FUN_1414f5870 (noise CDF)
    return max_noise - min_noise


def compute_cell_count(
    tile_x: float, tile_y: float, tile_z: float,
    noise_scale: float, area_half: float
) -> int:
    """
    计算 cell count，用于决定使用快路径还是慢路径

    Args:
        tile_x, tile_y, tile_z: tile 中心坐标
        noise_scale: noisescale
        area_half: query box 半长

    Returns:
        cell count
    """
    min_x = (tile_x - area_half) / noise_scale
    max_x = (tile_x + area_half) / noise_scale
    min_y = (tile_y - area_half) / noise_scale
    max_y = (tile_y + area_half) / noise_scale
    min_z = (tile_z - area_half) / noise_scale
    max_z = (tile_z + area_half) / noise_scale

    cell_count = (
        max(math.ceil(max_x), math.floor(min_x) + 1) - math.floor(min_x)
    ) * (
        max(math.ceil(max_y), math.floor(min_y) + 1) - math.floor(min_y)
    ) * (
        max(math.ceil(max_z), math.floor(min_z) + 1) - math.floor(min_z)
    )

    return cell_count
