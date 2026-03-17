#!/usr/bin/env python3
"""分析 save_sample_data 的资源点分布"""
import json
import math

GAS_BLOCK_SIZE = 64_000  # 64 km

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

# 找到 helium 的资源点
helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

print("=== 资源点详细分析 ===")
print(f"资源点数量：{len(helium)}")

# 计算每个资源点的方块索引和距离
nebula_pos = {"x": 0.0, "y": -20000.0, "z": 0.0}

block_set = set()
for i, r in enumerate(helium):
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    max_val = r.get('max', 0)
    falloff = r.get('falloff', 0)
    density = r.get('resourcedensity', 0)

    # 计算方块索引
    bx = round(x / GAS_BLOCK_SIZE)
    by = round(y / GAS_BLOCK_SIZE)
    bz = round(z / GAS_BLOCK_SIZE)

    # 计算到 nebula 中心的距离
    dx = x - nebula_pos["x"]
    dy = y - nebula_pos["y"]
    dz = z - nebula_pos["z"]
    dist = math.sqrt(dx*dx + dy*dy + dz*dz)

    block_key = (bx, by, bz)
    block_set.add(block_key)

    if i < 10:
        print(f"  [{i}] pos=({x},{y},{z}), block={block_key}, dist={dist:.0f}km, max={max_val:,}, falloff={falloff:.4f}")

print(f"\n唯一方块数量：{len(block_set)}")

# 计算总 max
total_max = sum(r.get('max', 0) for r in helium)
print(f"total_max: {total_max:,}")

# 反推每个方块的平均产量
avg_max_per_block = total_max / len(block_set)
print(f"平均每方块产量：{avg_max_per_block:,.0f}")

# 理论产量：base × falloff × density
# 如果 base=1 (每个方块), falloff≈0.78, density=15000
# yield = 1 × 0.78 × 15000 = 11,700
print(f"\n理论产量（每方块）：1 × 0.78 × 15000 = 11,700")
print(f"实际平均产量（每方块）：{avg_max_per_block:,.0f}")
