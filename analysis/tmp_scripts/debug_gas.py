#!/usr/bin/env python3
"""
调试气体资源计算
"""

import json
import math
from pathlib import Path

# 气体常量
GAS_XZ_LIMIT = 256_000       # 256 km
GAS_Y_LIMIT = 64_000         # 64 km (总高度 128km)
GAS_BLOCK_SIZE = 64_000      # 64 km 立方体网格
GAS_MIN_HEIGHT = 64_000      # 气体最小高度 64km

def debug_gas_calc():
    # 加载 regions.json 获取 boundary 信息
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json") as f:
        regions = json.load(f)

    # 加载 resourceareas.json 获取 position 信息
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    # 找到 p1_40km_hydrogen_field
    target_ref = "p1_40km_hydrogen_field"

    # 从 regions.json 获取 boundary
    region_data = None
    for r in regions:
        if r["id"] == target_ref:
            region_data = r
            break

    if not region_data:
        print(f"未找到 region: {target_ref}")
        return

    print(f"=== {target_ref} ===")
    print(f"region 数据：{json.dumps(region_data, indent=2, ensure_ascii=False)}")

    # 从 resourceareas.json 获取 position
    area_data = None
    for cluster in resourceareas:
        for area in cluster.get("areas", []):
            if area["ref"] == target_ref:
                area_data = area
                break
        if area_data:
            break

    if not area_data:
        print(f"未找到 area: {target_ref}")
        return

    print(f"\narea 数据:")
    print(f"  position: {area_data.get('position')}")
    print(f"  total_volume_km3: {area_data.get('total_volume_km3')}")
    print(f"  volume_km3: {area_data.get('volume_km3')}")

    # 但是 regions.json 现在没有 boundary 了，需要从原始 XML 获取
    # 这里我们只能看到输出结果
    print(f"\n注意：regions.json 不再包含 boundary 数据")
    print(f"需要检查原始 XML 或 processor 代码中的 boundary 计算")

    # 手动计算气体方块
    print("\n=== 气体方块计算调试 ===")
    print(f"假设半径 = 40km (根据名称 p1_40km_hydrogen_field)")
    radius = 40_000  # 40km

    position = area_data.get("position", {"x": 0, "y": 0, "z": 0})
    pos_x = position.get("x", 0)
    pos_y = position.get("y", 0)
    pos_z = position.get("z", 0)

    print(f"region 位置：({pos_x}, {pos_y}, {pos_z})")
    print(f"region 半径：{radius}m")

    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1

    print(f"\n遍历范围：x=[{-xz_max_blocks-1}..{xz_max_blocks+1}], y=[{-y_max_blocks-1}..{y_max_blocks+1}], z=[{-xz_max_blocks-1}..{xz_max_blocks+1}]")
    print(f"气体最小高度：{GAS_MIN_HEIGHT}m (|y| >= 64km)")

    total_blocks = 0
    effective_blocks = 0

    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 气体最小高度限制
                if abs(block_y) < GAS_MIN_HEIGHT:
                    continue

                # 计算距离
                dx = block_x - pos_x
                dy = block_y - pos_y
                dz = block_z - pos_z
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                if dist <= radius:
                    total_blocks += 1
                    in_range = (abs(block_x) <= GAS_XZ_LIMIT and
                                abs(block_z) <= GAS_XZ_LIMIT and
                                abs(block_y) <= GAS_Y_LIMIT)
                    if in_range:
                        effective_blocks += 1
                    print(f"  命中方块：({bx},{by},{bz}) -> ({block_x},{block_y},{block_z}), dist={dist:.0f}m, in_range={in_range}")

    print(f"\n结果：total_blocks={total_blocks}, effective_blocks={effective_blocks}")
    print(f"有效方块为 0 的原因：可能是 region 位置在截断范围外，或者半径太小无法覆盖有效范围的方块")

if __name__ == "__main__":
    debug_gas_calc()
