#!/usr/bin/env python3
"""分析 28 个未匹配点的 Y 轴高度"""
import json
import math

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}
linear = nebula_boundary['size']['linear']
radius = nebula_boundary['size']['r']

# 加载 save_sample_data
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

# 28 个未匹配点（XZ 距离 > 300km）
unmatched = [
    (0, 0, -320000), (-320000, 0, 0), (0, 0, 320000), (320000, 0, 0),
    (-320000, 0, -64000), (320000, 0, 64000), (-64000, 0, 320000), (-320000, 0, 64000),
    (320000, 0, -64000), (-64000, 0, -320000), (64000, 0, 320000), (64000, 0, -320000),
    (256000, 0, -192000), (128000, 0, 320000), (320000, 0, -128000),
]

print("=== 28 个未匹配点分析 ===")
print(f"nebula: r={radius/1000}km, linear={linear/1000}km")
print(f"nebula 中心 y={nebula_position['y']/1000}km")
print()

# 计算每个点的 XZ 距离和 Y 轴高度
for coord in sorted(unmatched, key=lambda c: math.sqrt(c[0]**2 + c[2]**2)):
    x, y, z = coord
    dist_xz = math.sqrt(x*x + z*z)
    dy = y - nebula_position["y"]
    abs_dy = abs(dy)
    in_height = abs_dy <= linear

    print(f"  {coord}: XZ={dist_xz/1000:.1f}km, |dy|={abs_dy/1000:.1f}km, in_height={in_height}")

# 检查 save_sample_data 中所有点的 Y 轴高度
print(f"\n=== save_sample_data 所有点的 Y 轴高度 ===")
y_vals = set(r.get('y', 0) for r in helium)
print(f"Y 坐标唯一值：{sorted(y_vals)}")

for y in y_vals:
    dy = y - nebula_position["y"]
    print(f"  y={y/1000:.0f}km: dy={dy/1000:.0f}km, |dy|={abs(dy)/1000:.0f}km, in_height={abs(dy) <= linear}")

# 结论
print(f"\n=== 结论 ===")
print(f"linear={linear/1000}km 意味着圆柱体高度为 {linear*2/1000}km（从 y={-linear/1000}km 到 +{linear/1000}km）")
print(f"nebula 中心在 y={nebula_position['y']/1000}km，所以有效 Y 范围是 [{nebula_position['y']-linear}/1000, {nebula_position['y']+linear}/1000]km")
print(f"save_sample_data 所有点在 y=0，dy = 0 - (-20) = 20km，|dy|=20km <= {linear/1000}km，满足高度要求")
print(f"所以 28 个未匹配点是因为 XZ 距离 > {radius/1000}km，不在圆柱半径内")
