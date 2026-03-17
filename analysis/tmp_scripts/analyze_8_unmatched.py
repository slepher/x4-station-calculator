#!/usr/bin/env python3
"""分析 8 个未匹配点是否应该被命中"""
import math

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
radius = 300000  # 300km
linear = 30000   # 30km
block_half = 32000  # 32km，方块半宽

# 8 个未匹配点
unmatched = [
    (-320000, 0, -128000), (320000, 0, 128000), (128000, 0, 320000), (-128000, 0, 320000),
    (320000, 0, -128000), (-320000, 0, 128000), (128000, 0, -320000), (-128000, 0, -320000),
]

print("=== 8 个未匹配点分析（考虑方块大小）===")
print(f"nebula: r={radius/1000}km, linear={linear/1000}km")
print(f"方块半宽：{block_half/1000}km")
print(f"有效半径（r + block_half）：{(radius + block_half)/1000}km")
print()

for coord in unmatched:
    x, y, z = coord

    # 计算到 nebula 中心的 XZ 距离
    dist_xz = math.sqrt(x*x + z*z)

    # 计算 Y 轴偏移
    dy = y - nebula_position["y"]

    # 方块的 Y 范围
    block_y_min = y - block_half
    block_y_max = y + block_half
    cylinder_y_min = nebula_position["y"] - linear
    cylinder_y_max = nebula_position["y"] + linear

    # Y 范围是否相交
    y_overlap = not (block_y_max < cylinder_y_min or block_y_min > cylinder_y_max)

    # 是否在有效半径内
    in_effective_radius = dist_xz <= (radius + block_half)

    print(f"  {coord}:")
    print(f"    XZ 距离：{dist_xz/1000:.1f}km")
    print(f"    有效半径：{(radius + block_half)/1000:.1f}km")
    print(f"    in_effective_radius: {in_effective_radius}")
    print(f"    |dy|: {abs(dy)/1000:.1f}km, linear: {linear/1000}km")
    print(f"    方块 Y 范围：[{block_y_min/1000}, {block_y_max/1000}]km")
    print(f"    圆柱 Y 范围：[{cylinder_y_min/1000}, {cylinder_y_max/1000}]km")
    print(f"    y_overlap: {y_overlap}")
    print()

# 结论
print("=== 结论 ===")
print(f"这 8 个点的 XZ 距离都 > 332km (r + block_half)，所以不在有效半径内")
print(f"但它们可能在遍历范围外？")

# 检查遍历范围
GAS_XZ_LIMIT = 256_000
GAS_BLOCK_SIZE = 64_000
xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE
print(f"\n遍历范围：bx, bz ∈ [{-xz_max_blocks-1}, {xz_max_blocks+1}]")
print(f"坐标范围：x, z ∈ [{(-xz_max_blocks-1)*GAS_BLOCK_SIZE/1000}, {(xz_max_blocks+1)*GAS_BLOCK_SIZE/1000}] km")

# 检查 8 个点是否在遍历范围内
for coord in unmatched[:4]:
    x, y, z = coord
    bx = x // GAS_BLOCK_SIZE
    bz = z // GAS_BLOCK_SIZE
    in_range = (-xz_max_blocks-1) <= bx <= (xz_max_blocks+1) and (-xz_max_blocks-1) <= bz <= (xz_max_blocks+1)
    print(f"  {coord}: bx={bx}, bz={bz}, in_range={in_range}")
