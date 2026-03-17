#!/usr/bin/env python3
"""分析 save_sample_data 的资源点位置"""
import json
import math

GAS_BLOCK_SIZE = 64_000  # 64 km

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

# 找到 helium 的资源点
helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

print(f"helium 资源点数量：{len(helium)}")

# 检查资源点的坐标分布
print("\n=== 坐标分析 ===")
block_counts = {}
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)

    # 计算方块索引
    bx = round(x / GAS_BLOCK_SIZE)
    by = round(y / GAS_BLOCK_SIZE)
    bz = round(z / GAS_BLOCK_SIZE)

    key = (bx, by, bz)
    block_counts[key] = block_counts.get(key, 0) + 1

print(f"唯一方块索引数量：{len(block_counts)}")
print(f"方块分布：")
for block, count in sorted(block_counts.items(), key=lambda x: -x[1])[:20]:
    print(f"  {block}: {count} 个资源点")

# 检查 y 坐标
y_coords = set(r.get('y', 0) for r in helium)
print(f"\ny 坐标集合：{sorted(y_coords)}")

# 气体最小高度限制：|y| >= 64km
valid_points = [r for r in helium if abs(r.get('y', 0)) >= GAS_MIN_HEIGHT]
print(f"满足 |y| >= 64km 的资源点：{len(valid_points)}")
