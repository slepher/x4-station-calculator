#!/usr/bin/env python3
"""检查需要多大的 radius 才能命中所有 97 个点"""
import json
import math

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}

# 加载 save_sample_data
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

# 计算所有点的 XZ 距离
xz_distances = []
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    dist_xz = math.sqrt(x*x + z*z)
    xz_distances.append((int(x), int(y), int(z), dist_xz))

# 按 XZ 距离排序
xz_distances.sort(key=lambda d: d[3])

print("=== 所有 97 个点按 XZ 距离排序 ===")
print(f"nebula radius 需要 >= 第 97 个点的 XZ 距离才能命中所有点")
print()

# 分段显示
ranges = [(0, 100), (100, 200), (200, 256), (256, 300), (300, 320), (320, 350), (350, 400)]
for low, high in ranges:
    points = [d for d in xz_distances if low*1000 <= d[3] < high*1000]
    if points:
        print(f"  {low}-{high}km: {len(points)} 个点")

# 第 69 个点和第 97 个点的距离
print(f"\n第 69 个点的 XZ 距离：{xz_distances[68][3]/1000:.1f}km")
print(f"第 97 个点的 XZ 距离：{xz_distances[96][3]/1000:.1f}km")

# 结论
print(f"\n=== 结论 ===")
print(f"如果要命中 69 个点：radius >= {xz_distances[68][3]/1000:.1f}km")
print(f"如果要命中 97 个点：radius >= {xz_distances[96][3]/1000:.1f}km")
print(f"当前 maps.json 中的 radius = 300km")

# 检查 300km 能命中多少点
points_in_300 = [d for d in xz_distances if d[3] <= 300000]
print(f"\nradius=300km 能命中 {len(points_in_300)} 个点")
