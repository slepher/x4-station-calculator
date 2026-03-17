#!/usr/bin/env python3
"""分析 save_sample_data 的资源点距离分布"""
import json
import math

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])
nebula_pos = {"x": 0.0, "y": -20000.0, "z": 0.0}

# 计算每个资源点的距离
distances = []
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    dx = x - nebula_pos["x"]
    dy = y - nebula_pos["y"]
    dz = z - nebula_pos["z"]
    dist = math.sqrt(dx*dx + dy*dy + dz*dz)
    distances.append(dist)

distances.sort()

print("=== 距离分布 ===")
print(f"资源点数量：{len(distances)}")
print(f"最小距离：{min(distances)/1000:.1f}km")
print(f"最大距离：{max(distances)/1000:.1f}km")
print(f"平均距离：{sum(distances)/len(distances)/1000:.1f}km")

# 按距离分段
print("\n=== 距离分段 ===")
ranges = [(0, 100), (100, 200), (200, 300), (300, 400)]
for low, high in ranges:
    count = len([d for d in distances if low*1000 <= d < high*1000])
    print(f"  {low}-{high}km: {count} 个点")

# 检查 97 个点对应的 radius
# 如果我们用 distance <= radius 来判断，radius 应该是多少才能得到 97 个点？
print("\n=== 反推 radius ===")
# 第 97 个点的距离（从大到小）
distances_desc = sorted(distances, reverse=True)
if len(distances_desc) >= 97:
    print(f"第 97 个点的距离：{distances_desc[96]/1000:.1f}km")
    print(f"这意味着 radius 应该 >= {distances_desc[96]/1000:.1f}km")
