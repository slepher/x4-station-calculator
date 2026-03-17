#!/usr/bin/env python3
"""验证不含 GAS_MIN_HEIGHT 限制的计算"""
import json
import math

GAS_BLOCK_SIZE = 64_000  # 64 km
GAS_XZ_LIMIT = 256_000   # 256 km
GAS_Y_LIMIT = 64_000     # 64 km（总高度 128km）

def calculate_gas_block_count_no_height_limit(region_pos, boundary):
    """不含 GAS_MIN_HEIGHT 限制的气体方块计数"""
    radius = boundary.get("size", {}).get("r", 0.0) if boundary else 0.0

    # 有效范围（方块索引）
    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4 个方块（单侧）
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1 个方块（单侧）

    total_blocks = 0
    effective_blocks = 0

    # 遍历所有可能的方块
    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                # 方块中心坐标
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 计算方块中心到 region 中心的距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                # 检查是否在半径内
                if radius > 0 and dist <= radius:
                    total_blocks += 1

                    # 有效方块：还需要在截断范围内
                    if (abs(block_x) <= GAS_XZ_LIMIT and
                        abs(block_z) <= GAS_XZ_LIMIT and
                        abs(block_y) <= GAS_Y_LIMIT):
                        effective_blocks += 1

    return (max(1, total_blocks), max(0, effective_blocks))


# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

# 计算
total_blocks, effective_blocks = calculate_gas_block_count_no_height_limit(
    nebula_position, nebula_boundary
)
print(f"不含 GAS_MIN_HEIGHT 限制:")
print(f"  total_blocks: {total_blocks}")
print(f"  effective_blocks: {effective_blocks}")

# 与 save_sample_data 对比
# helium: total_max = 1,134,299, density = 15000, falloff = 0.792
# 反推 base = 1,134,299 / (0.792 * 15000) ≈ 95.5

falloff = 0.792
density = 15000
sample_total = 1134299
implied_base = sample_total / (falloff * density)
print(f"\n从 save_sample_data 反推：base ≈ {implied_base:.0f}")

# 尝试解释 97 个资源点
print(f"\nsave_sample_data 有 97 个资源点，每个点代表一个方块")
print(f"97 个方块 × 0.792 × 15000 = {97 * 0.792 * 15000:,.0f}")
print(f"与 save_sample_data helium total_max = 1,134,299 接近")
