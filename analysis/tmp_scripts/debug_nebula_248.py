#!/usr/bin/env python3
"""
调试 nebula 的 248 值来源
"""
import math

GAS_BLOCK_SIZE = 64_000       # 64 km
GAS_XZ_LIMIT = 256_000        # 256 km
GAS_Y_LIMIT = 64_000          # 64 km (总高度 128km)
GAS_MIN_HEIGHT = 64_000       # 气体最小高度 64km

def calculate_gas_block_count_truncated_debug(region_pos, boundary):
    """带调试输出的气体方块计算"""
    radius = boundary.get("size", {}).get("r", 0.0) if boundary else 0.0

    print(f"  radius: {radius}")

    # 有效范围（方块索引）
    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4 个方块（单侧）
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1 个方块（单侧）

    print(f"  遍历范围：bx/bz=[{-xz_max_blocks-1}..{xz_max_blocks+1}], by=[{-y_max_blocks-1}..{y_max_blocks+1}]")

    total_blocks = 0
    effective_blocks = 0
    hit_blocks = []

    # 遍历所有可能的方块
    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                # 方块中心坐标
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 气体最小高度限制
                if abs(block_y) < GAS_MIN_HEIGHT:
                    continue

                # 计算方块中心到 region 中心的距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                # 检查是否在半径内
                if radius > 0 and dist <= radius:
                    total_blocks += 1

                    # 有效方块数：还需要在截断范围内
                    if (abs(block_x) <= GAS_XZ_LIMIT and
                        abs(block_z) <= GAS_XZ_LIMIT and
                        abs(block_y) <= GAS_Y_LIMIT):
                        effective_blocks += 1
                        hit_blocks.append((bx, by, bz, dist))

    print(f"  命中方块：{len(hit_blocks)} 个")
    for bx, by, bz, dist in hit_blocks[:10]:
        print(f"    ({bx},{by},{bz}) -> ({bx*64}km,{by*64}km,{bz*64}km), dist={dist:.0f}km")

    return (max(1, total_blocks), max(0, effective_blocks))


def main():
    # nebula 数据
    nebula_ref = "region_cluster_703_sector_001_nebula_1"
    nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
    nebula_boundary = {}  # nebula 没有 boundary

    print(f"=== {nebula_ref} ===")
    print(f"position: {nebula_position}")
    print(f"boundary: {nebula_boundary}")

    # 计算方块数
    total_blocks, effective_blocks = calculate_gas_block_count_truncated_debug(
        nebula_position,
        nebula_boundary
    )

    print(f"\n结果：total_blocks={total_blocks}, effective_blocks={effective_blocks}")

    # 如果 boundary 为空，radius=0，应该不会命中任何方块
    # 但函数返回 max(1, total_blocks)，所以至少返回 1

    # 248 这个值可能来自其他地方...
    # 也许 nebula 使用的是不同的计算方式？

    # 让我们反推：如果 total_yield = volume × falloff × density
    # 则 volume = total_yield / (falloff × density)

    # 已知数据：
    falloff = 0.792
    hydrogen_density = 49500
    hydrogen_total_yield = 9722919

    implied_volume = hydrogen_total_yield / (falloff * hydrogen_density)
    print(f"\n从 hydrogen 反推的 volume: {implied_volume:.0f}")

    # 248 可能是一个固定值？或者是从 XML 的某个属性来的？
    # 也许 nebula 的 volume 不是通过几何计算，而是直接指定的？

if __name__ == "__main__":
    main()
