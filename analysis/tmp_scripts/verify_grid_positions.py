#!/usr/bin/env python3
"""验证 save_sample_data 的资源点是否在 64km 网格上"""
import json

GAS_BLOCK_SIZE = 64_000  # 64 km

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

print("=== 资源点位置分析 ===")
print(f"资源点数量：{len(helium)}")

# 检查每个资源点是否在 64km 网格上
on_grid = 0
off_grid = 0
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)

    # 检查是否是 64km 的倍数
    x_on = (x % GAS_BLOCK_SIZE) == 0
    y_on = (y % GAS_BLOCK_SIZE) == 0
    z_on = (z % GAS_BLOCK_SIZE) == 0

    if x_on and y_on and z_on:
        on_grid += 1
    else:
        off_grid += 1

print(f"在 64km 网格上：{on_grid}")
print(f"不在 64km 网格上：{off_grid}")

# 检查坐标是否是 64km 的倍数
print("\n=== 坐标分析 ===")
x_vals = [r.get('x', 0) for r in helium]
y_vals = [r.get('y', 0) for r in helium]
z_vals = [r.get('z', 0) for r in helium]

print(f"x 坐标：{sorted(set(x_vals))}")
print(f"y 坐标：{sorted(set(y_vals))}")
print(f"z 坐标：{sorted(set(z_vals))}")

# 检查哪些坐标是 64km 的倍数
print("\n=== 64km 倍数检查 ===")
x_64 = [x for x in set(x_vals) if x % GAS_BLOCK_SIZE == 0]
y_64 = [y for y in set(y_vals) if y % GAS_BLOCK_SIZE == 0]
z_64 = [z for z in set(z_vals) if z % GAS_BLOCK_SIZE == 0]

print(f"x 是 64km 倍数的值：{sorted(x_64)}")
print(f"y 是 64km 倍数的值：{sorted(y_64)}")
print(f"z 是 64km 倍数的值：{sorted(z_64)}")
