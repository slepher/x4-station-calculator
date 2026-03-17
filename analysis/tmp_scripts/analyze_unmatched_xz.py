#!/usr/bin/env python3
"""分析为什么还有 28 个点未匹配"""
import sys
import json
import math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))
from x4_data_map_processor import generate_gas_block_coordinates

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

# 生成 block 坐标
total_coords, effective_coords = generate_gas_block_coordinates(
    nebula_position, nebula_boundary
)

# 检查生成坐标的 XZ 距离分布
print("=== 生成的 block 坐标 XZ 距离分布 ===")
xz_distances = []
for coord in total_coords:
    x, y, z = coord
    dist_xz = math.sqrt(x*x + z*z)  # cylinder 只检查 XZ 距离
    xz_distances.append((coord, dist_xz))

# 按 XZ 距离排序
xz_distances.sort(key=lambda x: x[1])

# 距离分段
ranges = [(0, 200), (200, 256), (256, 300), (300, 320), (320, 400)]
print(f"nebula boundary r=300km (cylinder)")
print(f"XZ 距离分段统计:")
for low, high in ranges:
    count = len([d for d in xz_distances if low*1000 <= d[1] < high*1000])
    print(f"  {low}-{high}km: {count} 个")

# 检查 XZ 距离超过 300km 的点
over_300 = [(c, d) for c, d in xz_distances if d > 300000]
print(f"\nXZ 距离 > 300km 的点：{len(over_300)} 个")

# 检查生成的坐标中 XZ 距离最大值
max_xz = max(d for _, d in xz_distances)
print(f"生成的坐标中最大 XZ 距离：{max_xz/1000:.1f}km")

# 遍历范围限制
print(f"\n=== 遍历范围 ===")
GAS_XZ_LIMIT = 256_000
GAS_BLOCK_SIZE = 64_000
xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE
print(f"xz_max_blocks = {xz_max_blocks}")
print(f"遍历范围：bx, bz ∈ [{-xz_max_blocks-1}, {xz_max_blocks+1}]")
print(f"坐标范围：x, z ∈ [{(-xz_max_blocks-1)*GAS_BLOCK_SIZE/1000}, {(xz_max_blocks+1)*GAS_BLOCK_SIZE/1000}] km")

# 检查 save_sample_data 的点
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])
print(f"\n=== save_sample_data 资源点 XZ 距离 ===")
sample_xz_distances = []
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    dist_xz = math.sqrt(x*x + z*z)
    sample_xz_distances.append(((int(x), int(y), int(z)), dist_xz))

sample_xz_distances.sort(key=lambda x: x[1])
print(f"最小 XZ 距离：{sample_xz_distances[0][1]/1000:.1f}km")
print(f"最大 XZ 距离：{sample_xz_distances[-1][1]/1000:.1f}km")

# XZ 距离分段
print(f"\nXZ 距离分段统计:")
for low, high in ranges:
    count = len([d for d in sample_xz_distances if low*1000 <= d[1] < high*1000])
    print(f"  {low}-{high}km: {count} 个")

# 结论
print(f"\n=== 结论 ===")
print(f"当前遍历范围只能生成 x,z ∈ [-320km, +320km] 的坐标")
print(f"但 save_sample_data 中有点在 XZ 距离 320km+ 处")
print(f"这些点虽然 XZ 距离 > 300km，但可能是因为 nebula 的 radius 实际上是 300km 圆柱，所以这些点不应该被命中")
print(f"需要确认：save_sample_data 的 97 个点是实际存档数据，还是参考数据？")

# 检查 28 个未匹配点的 XZ 距离
total_coords_set = set(total_coords)
sample_coords_set = set((int(r.get('x', 0)), int(r.get('y', 0)), int(r.get('z', 0))) for r in helium)
unmatched = sample_coords_set - total_coords_set

print(f"\n=== 28 个未匹配点的 XZ 距离 ===")
for coord in sorted(unmatched, key=lambda c: math.sqrt(c[0]**2 + c[2]**2)):
    dist_xz = math.sqrt(coord[0]**2 + coord[2]**2)
    print(f"  {coord}, XZ dist={dist_xz/1000:.1f}km")
