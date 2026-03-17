#!/usr/bin/env python3
"""检查 save_sample_data 中 8 个边缘点的信息"""
import json

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

# 8 个边缘点坐标
edge_coords = [
    (-320000, 0, -128000), (320000, 0, 128000), (128000, 0, 320000), (-128000, 0, 320000),
    (320000, 0, -128000), (-320000, 0, 128000), (128000, 0, -320000), (-128000, 0, -320000),
]

print("=== save_sample_data 中 8 个边缘点的信息 ===")
for r in helium:
    x, y, z = int(r.get('x', 0)), int(r.get('y', 0)), int(r.get('z', 0))
    if (x, y, z) in edge_coords:
        print(f"  {x, y, z}:")
        print(f"    max: {r.get('max')}")
        print(f"    falloff: {r.get('falloff')}")
        print(f"    resourcedensity: {r.get('resourcedensity')}")

# 检查总点数
print(f"\nsave_sample_data helium 总点数：{len(helium)}")

# 按 XZ 距离排序
import math
helium_with_dist = []
for r in helium:
    x, z = r.get('x', 0), r.get('z', 0)
    dist_xz = math.sqrt(x*x + z*z)
    helium_with_dist.append((r, dist_xz))

helium_with_dist.sort(key=lambda x: x[1], reverse=True)

print(f"\n=== 最远的 15 个点 ===")
for r, dist in helium_with_dist[:15]:
    x, y, z = int(r.get('x', 0)), int(r.get('y', 0)), int(r.get('z', 0))
    print(f"  ({x}, {y}, {z}): XZ={dist/1000:.1f}km")
