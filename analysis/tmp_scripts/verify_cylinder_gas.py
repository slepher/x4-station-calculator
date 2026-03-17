#!/usr/bin/env python3
"""验证 cylinder 类型的气体计算"""
import json
import math

GAS_BLOCK_SIZE = 64_000  # 64 km
GAS_XZ_LIMIT = 256_000   # 256 km
GAS_Y_LIMIT = 64_000     # 64 km
GAS_MIN_HEIGHT = 64_000  # 64 km

def calculate_gas_block_count_cylinder(region_pos, boundary):
    """
    cylinder 类型的气体方块计数

    cylinder 的 boundary 结构：
    {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

    对于 cylinder，有效半径应该是 min(r, GAS_XZ_LIMIT)
    """
    r = boundary.get("size", {}).get("r", 0.0)
    linear = boundary.get("size", {}).get("linear", 0.0)

    # 对于 cylinder，使用 r 作为半径，但需要截断
    effective_r = min(r, GAS_XZ_LIMIT)

    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1

    total_blocks = 0
    effective_blocks = 0

    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 气体最小高度限制
                if abs(block_y) < GAS_MIN_HEIGHT:
                    continue

                # 计算距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                # 使用 effective_r 判断
                if dist <= effective_r:
                    total_blocks += 1

                    # 有效方块：在截断范围内
                    if (abs(block_x) <= GAS_XZ_LIMIT and
                        abs(block_z) <= GAS_XZ_LIMIT and
                        abs(block_y) <= GAS_Y_LIMIT):
                        effective_blocks += 1

    return (max(1, total_blocks), max(0, effective_blocks))


# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

# 计算
result = calculate_gas_block_count_cylinder(nebula_position, nebula_boundary)
print(f"使用 effective_r = min(300, 256) = 256km:")
print(f"  total_blocks: {result[0]}")
print(f"  effective_blocks: {result[1]}")

# 尝试不同的半径
print("\n=== 不同半径的命中数 ===")
for r in [200000, 220000, 240000, 256000]:
    boundary = {'class': 'cylinder', 'size': {'r': r, 'linear': 30000}}
    result = calculate_gas_block_count_cylinder(nebula_position, boundary)
    print(f"  r={r/1000:.0f}km: total={result[0]}, effective={result[1]}")
