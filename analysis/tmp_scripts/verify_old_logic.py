#!/usr/bin/env python3
"""验证不含 GAS_MIN_HEIGHT 的计算逻辑"""
import math

GAS_BLOCK_SIZE = 64_000  # 64 km
GAS_XZ_LIMIT = 256_000   # 256 km
GAS_Y_LIMIT = 64_000     # 64 km

def calculate_gas_block_count_old(region_pos, boundary):
    """旧版气体方块计数（不含 GAS_MIN_HEIGHT 限制）"""
    radius = boundary.get("size", {}).get("r", 0.0) if boundary else 0.0

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

                # 计算距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                # 检查是否在半径内
                if radius > 0 and dist <= radius:
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
result = calculate_gas_block_count_old(nebula_position, nebula_boundary)
print(f"旧版逻辑（不含 GAS_MIN_HEIGHT）:")
print(f"  total_blocks: {result[0]}")
print(f"  effective_blocks: {result[1]}")

# 与 save_sample_data 对比
# save_sample_data 有 97 个点
# 97 个点应该对应 total_blocks 还是 effective_blocks？

# 检查 97 个点中有多少在截断范围内
import json
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])
in_truncate = sum(1 for r in helium if abs(r.get('x', 0)) <= GAS_XZ_LIMIT and abs(r.get('z', 0)) <= GAS_XZ_LIMIT)
print(f"\nsave_sample_data helium:")
print(f"  总点数：{len(helium)}")
print(f"  在截断范围内：{in_truncate}")
print(f"  在截断范围外：{len(helium) - in_truncate}")
