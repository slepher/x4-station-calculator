#!/usr/bin/env python3
"""测试不同的方块命中逻辑"""
import math

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
radius = 300000  # 300km
linear = 30000   # 30km
GAS_BLOCK_SIZE = 64000
block_half = GAS_BLOCK_SIZE // 2  # 32km

# 测试点：(320000, 0, 128000) - XZ 距离 344.7km
test_coord = (320000, 0, 128000)
block_x, block_y, block_z = test_coord

print("=== 测试方块命中逻辑 ===")
print(f"测试方块中心：{test_coord}")
print(f"nebula: r={radius/1000}km, linear={linear/1000}km")
print()

# 方法 1：方块中心距离（当前逻辑）
dx = block_x - nebula_position["x"]
dz = block_z - nebula_position["z"]
dist_xz_center = math.sqrt(dx*dx + dz*dz)
print(f"方法 1：方块中心距离 = {dist_xz_center/1000:.1f}km")
print(f"  判断：dist <= r + block_half = {dist_xz_center/1000:.1f} <= {(radius + block_half)/1000:.1f} = {dist_xz_center <= radius + block_half}")
print()

# 方法 2：方块最近边距离
# 方块在 XZ 平面的范围：[block_x - block_half, block_x + block_half] × [block_z - block_half, block_z + block_half]
# 圆柱中心在 (0, 0)
# 最近距离 = max(0, sqrt(max(0, |x| - block_half)^2 + max(0, |z| - block_half)^2) - radius)
# 简化：方块到原点的最短距离

# 方块 X 范围
x_min, x_max = block_x - block_half, block_x + block_half
z_min, z_max = block_z - block_half, block_z + block_half

# 计算方块到原点 (0,0) 的最近距离
if x_min <= 0 <= x_max:
    nearest_x = 0
elif abs(x_min) < abs(x_max):
    nearest_x = x_min
else:
    nearest_x = x_max

if z_min <= 0 <= z_max:
    nearest_z = 0
elif abs(z_min) < abs(z_max):
    nearest_z = z_min
else:
    nearest_z = z_max

dist_xz_nearest = math.sqrt(nearest_x**2 + nearest_z**2)
print(f"方法 2：方块最近边距离 = {dist_xz_nearest/1000:.1f}km")
print(f"  判断：dist <= r = {dist_xz_nearest/1000:.1f} <= {radius/1000:.1f} = {dist_xz_nearest <= radius}")
print()

# 方法 3：方块最远角距离
farthest_x = x_max if abs(x_max) > abs(x_min) else x_min
farthest_z = z_max if abs(z_max) > abs(z_min) else z_min
dist_xz_farthest = math.sqrt(farthest_x**2 + farthest_z**2)
print(f"方法 3：方块最远角距离 = {dist_xz_farthest/1000:.1f}km")
print(f"  判断：dist <= r + block_half*sqrt(2) = {dist_xz_farthest/1000:.1f} <= {(radius + block_half*math.sqrt(2))/1000:.1f} = {dist_xz_farthest <= radius + block_half*math.sqrt(2)}")
print()

# 方法 4：方块与圆柱相交（正确逻辑）
# 方块与圆柱相交的条件：方块到原点的最短距离 <= radius
print(f"方法 4：方块与圆柱相交")
print(f"  方块 X 范围：[{x_min/1000}, {x_max/1000}]km")
print(f"  方块 Z 范围：[{z_min/1000}, {z_max/1000}]km")
print(f"  方块到原点的最短距离 = {dist_xz_nearest/1000:.1f}km")
print(f"  判断：dist <= r = {dist_xz_nearest/1000:.1f} <= {radius/1000:.1f} = {dist_xz_nearest <= radius}")
