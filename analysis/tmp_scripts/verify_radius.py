#!/usr/bin/env python3
"""验证 300km 半径应该命中多少个点"""
import sys
import json
import math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))
from x4_data_map_processor import generate_gas_block_coordinates

GAS_BLOCK_SIZE = 64_000

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

# 生成 block 坐标（不应用高度限制）
total_coords, effective_coords = generate_gas_block_coordinates(
    nebula_position, nebula_boundary, apply_height_limit=False
)

# 检查生成坐标的距离分布
print("=== 生成的 block 坐标距离分布 ===")
distances = []
for coord in total_coords:
    x, y, z = coord
    dist = math.sqrt((x - nebula_position["x"])**2 + (y - nebula_position["y"])**2 + (z - nebula_position["z"])**2)
    distances.append((coord, dist))

# 按距离排序
distances.sort(key=lambda x: x[1])

# 距离分段
ranges = [(0, 200), (200, 256), (256, 300), (300, 320), (320, 350)]
print(f"nebula boundary r=300km")
print(f"距离分段统计:")
for low, high in ranges:
    count = len([d for d in distances if low*1000 <= d[1] < high*1000])
    print(f"  {low}-{high}km: {count} 个")

# 检查距离超过 300km 的点
over_300 = [(c, d) for c, d in distances if d > 300000]
print(f"\n距离 > 300km 的点：{len(over_300)} 个")
for c, d in over_300[:10]:
    print(f"  {c}, dist={d/1000:.1f}km")

# 检查距离刚好在 300km 以内的点
print(f"\n总点数：{len(total_coords)}")
print(f"距离 <= 300km 的点数：{len([d for d in distances if d[1] <= 300000])}")

# 检查 save_sample_data 中距离超过 300km 的点
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])
sample_over_300 = []
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    dist = math.sqrt((x - nebula_position["x"])**2 + (y - nebula_position["y"])**2 + (z - nebula_position["z"])**2)
    if dist > 300000:
        sample_over_300.append(((int(x), int(y), int(z)), dist))

print(f"\nsave_sample_data 中距离 > 300km 的点：{len(sample_over_300)} 个")
for c, d in sorted(sample_over_300, key=lambda x: x[1])[:10]:
    print(f"  {c}, dist={d/1000:.1f}km")

# 结论：save_sample_data 可能使用了不同的半径或者没有半径限制？
print(f"\n=== 推论 ===")
print(f"如果 save_sample_data 的 nebula 半径不是 300km，那应该是多少？")
# 找出 save_sample_data 中最远的点
max_dist = max(d for _, d in [(r.get('x', 0), math.sqrt((r.get('x', 0) - nebula_position["x"])**2 + **(r.get('y', 0) - nebula_position["y"])2 + (r.get('z', 0) - nebula_position["z"])**2)) for r in helium])
print(f"save_sample_data 中最大距离：{max_dist/1000:.1f}km")
