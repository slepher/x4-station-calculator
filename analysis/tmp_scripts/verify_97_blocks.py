#!/usr/bin/env python3
"""验证 97 个方块的命中逻辑"""
import json
import math

GAS_BLOCK_SIZE = 64_000  # 64 km
GAS_XZ_LIMIT = 256_000   # 256 km
GAS_Y_LIMIT = 64_000     # 64 km
GAS_MIN_HEIGHT = 64_000  # 64 km

def count_blocks_with_radius(region_pos, radius):
    """计算给定半径命中的方块数"""
    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1

    hit_blocks = []

    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 气体最小高度限制：|y| >= 64km
                if abs(block_y) < GAS_MIN_HEIGHT:
                    continue

                # 计算距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                if dist <= radius:
                    hit_blocks.append((bx, by, bz, dist))

    return hit_blocks

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_radius = 300000  # 300km

# 测试不同半径
print("=== 不同半径的命中方块数 ===")
for r in [150000, 200000, 250000, 300000, 350000]:
    blocks = count_blocks_with_radius(nebula_position, r)
    print(f"radius={r/1000:.0f}km: {len(blocks)} 个方块")

# 从 save_sample_data 反推 radius
# 97 个方块，对应 radius = ?
print("\n=== 反推 radius ===")
# 从 save_sample_data 找到最远的资源点
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])
nebula_pos = {"x": 0.0, "y": -20000.0, "z": 0.0}

max_dist = 0
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    dx = x - nebula_pos["x"]
    dy = y - nebula_pos["y"]
    dz = z - nebula_pos["z"]
    dist = math.sqrt(dx*dx + dy*dy + dz*dz)
    if dist > max_dist:
        max_dist = dist

print(f"save_sample_data 中最远资源点距离：{max_dist/1000:.0f}km")
print(f"这意味着 radius 应该 >= {max_dist/1000:.0f}km")
