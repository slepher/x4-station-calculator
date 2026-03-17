#!/usr/bin/env python3
"""测试：方块与圆柱相交的最宽松条件"""
import math

# nebula 数据
radius = 300000  # 300km
GAS_BLOCK_SIZE = 64000
block_half = GAS_BLOCK_SIZE // 2  # 32km

# 测试 8 个未匹配点
unmatched = [
    (-320000, 0, -128000), (320000, 0, 128000), (128000, 0, 320000), (-128000, 0, 320000),
    (320000, 0, -128000), (-320000, 0, 128000), (128000, 0, -320000), (-128000, 0, -320000),
]

print("=== 方块与圆柱相交测试 ===")
print(f"cylinder radius = {radius/1000}km")
print(f"方块尺寸 = {GAS_BLOCK_SIZE/1000}km, block_half = {block_half/1000}km")
print()

# 方块与圆柱相交的条件：
# 方块到原点的最短距离 <= radius
# 对于轴对齐的方块，最短距离是方块边界到原点的距离

for coord in unmatched:
    x, y, z = coord

    # 方块在 XZ 平面的范围
    x_min, x_max = x - block_half, x + block_half
    z_min, z_max = z - block_half, z + block_half

    # 计算方块到原点在 XZ 平面的最短距离
    # 如果原点在方块内，最短距离为 0
    if x_min <= 0 <= x_max and z_min <= 0 <= z_max:
        dist_xz_min = 0
    elif x_min <= 0 <= x_max:
        # 原点在 x 范围内，最短距离是 z 方向的距离
        dist_xz_min = min(abs(z_min), abs(z_max))
    elif z_min <= 0 <= z_max:
        # 原点在 z 范围内，最短距离是 x 方向的距离
        dist_xz_min = min(abs(x_min), abs(x_max))
    else:
        # 原点不在任何一个范围内，最短距离是最近的角
        nearest_x = x_min if abs(x_min) < abs(x_max) else x_max
        nearest_z = z_min if abs(z_min) < abs(z_max) else z_max
        dist_xz_min = math.sqrt(nearest_x**2 + nearest_z**2)

    # 相交条件
    intersects = dist_xz_min <= radius

    print(f"  {coord}:")
    print(f"    方块 X 范围：[{x_min/1000}, {x_max/1000}]km")
    print(f"    方块 Z 范围：[{z_min/1000}, {z_max/1000}]km")
    print(f"    方块到原点的最短 XZ 距离：{dist_xz_min/1000:.1f}km")
    print(f"    相交：{intersects}")
    print()

# 结论
print("=== 结论 ===")
print("即使使用最宽松的'方块与圆柱相交'判断，这 8 个点仍然不相交")
print("因为它们的最近角距离也 > 300km")
