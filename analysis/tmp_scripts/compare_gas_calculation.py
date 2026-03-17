#!/usr/bin/env python3
"""
对比 save_sample_data 的计算逻辑与我们的实现
"""
import json
import math
from pathlib import Path

# 常量
GAS_BLOCK_SIZE = 64_000  # 64 km
GAS_XZ_LIMIT = 256_000   # 256 km
GAS_Y_LIMIT = 64_000     # 64 km
GAS_MIN_HEIGHT = 64_000  # 最小高度 64 km

def calculate_gas_block_count_truncated(region_pos, boundary):
    """计算气体资源命中的 64km³ 方块数量（考虑截断）"""
    block_size = GAS_BLOCK_SIZE

    # 获取 region 的边界参数
    radius = float(boundary.get("size", {}).get("r", 0.0))
    boundary_class = boundary.get("class", "sphere")

    if not radius:
        return (0, 0)

    # 有效范围（方块索引）
    xz_max = int(GAS_XZ_LIMIT / block_size)  # 4
    y_max = int(GAS_Y_LIMIT / block_size)    # 1

    total_blocks = 0
    effective_blocks = 0

    # 遍历所有可能的方块
    for bx in range(-xz_max - 1, xz_max + 2):
        for by in range(-y_max - 1, y_max + 2):
            for bz in range(-xz_max - 1, xz_max + 2):
                block_x = bx * block_size
                block_y = by * block_size
                block_z = bz * block_size

                # 气体最小高度限制
                if abs(block_y) < GAS_MIN_HEIGHT:
                    continue

                # 截断范围检查
                if (abs(block_x) > GAS_XZ_LIMIT or
                    abs(block_z) > GAS_XZ_LIMIT or
                    abs(block_y) > GAS_Y_LIMIT):
                    continue

                # 计算方块中心到 region 中心的距离
                dx = block_x - region_pos.get("x", 0)
                dy = block_y - region_pos.get("y", 0)
                dz = block_z - region_pos.get("z", 0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                if dist <= radius:
                    total_blocks += 1
                    effective_blocks += 1

    return (total_blocks, effective_blocks)


def main():
    # 读取生成的 resourceareas
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    # 读取 regions.json 获取 boundary 信息
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json") as f:
        regions = json.load(f)

    # 构建 region_id -> boundary 映射
    region_boundaries = {}
    for r in regions:
        region_boundaries[r['id']] = r.get('boundary', {})

    # 读取 save_sample_data
    with open("save_sample_data/cluster_703_sector001_macro.json") as f:
        sample = json.load(f)

    # 找到 cluster_703 的数据
    cluster703 = None
    for cluster in resourceareas:
        cid = cluster.get('cluster_id', '').lower()
        sid = cluster.get('sector_id', '').lower()
        if '703' in cid or '703' in sid:
            cluster703 = cluster
            break

    if not cluster703:
        print("未找到 Cluster 703 数据")
        return

    areas = cluster703.get('areas', [])
    sample_ware = sample.get('ware', {})

    print("=" * 80)
    print("气体资源对比分析")
    print("=" * 80)

    for area in areas:
        ref = area.get('ref', '')
        position = area.get('position', {})
        boundary = region_boundaries.get(ref, {})

        # 检查是否有气体资源
        area_resources = area.get('resources', [])
        gas_resources = [r for r in area_resources if r.get('ware') in {'helium', 'hydrogen', 'methane'}]

        if not gas_resources:
            continue

        print(f"\n=== {ref} ===")
        print(f"position: ({position.get('x')}, {position.get('y')}, {position.get('z')})")
        print(f"boundary: {boundary.get('class', 'unknown')} r={boundary.get('size', {}).get('r', 0)}")

        # 计算方块数
        total_blocks, effective_blocks = calculate_gas_block_count_truncated(position, boundary)
        print(f"\n方块计算:")
        print(f"  total_blocks: {total_blocks}")
        print(f"  effective_blocks: {effective_blocks}")

        # 获取 falloff
        lateral = area.get('lateral_factor', 1.0)
        radial = area.get('radial_factor', 1.0)
        falloff = area.get('falloff_factor', 1.0)
        print(f"\nfalloff: lateral={lateral:.4f}, radial={radial:.4f}, total={falloff:.4f}")

        # 对比每个气体 ware
        for res in gas_resources:
            ware = res.get('ware')
            gen_total_yield = res.get('total_yield', 0)
            resourcedensity = res.get('resourcedensity', 0)

            # 从 save_sample_data 获取对应的值
            sample_total = 0
            if ware in sample_ware:
                for density_data in sample_ware[ware].values():
                    for r in density_data.get('resources', []):
                        sample_total += r.get('max', 0)

            # 反推 save_sample_data 使用的公式
            # 假设 save_sample_data: max = block_count × falloff × density / num_points
            # 或者 save_sample_data 是积分方法计算的资源点

            print(f"\n  {ware}:")
            print(f"    sample total_max: {sample_total:,}")
            print(f"    gen total_yield:  {gen_total_yield:,}")

            # 计算差异
            if sample_total > 0:
                diff = gen_total_yield - sample_total
                pct = (diff / sample_total) * 100
                print(f"    diff: {diff:+,} ({pct:+.1f}%)")

            # 反推：如果我们用 blocks × falloff × density
            expected_yield = total_blocks * falloff * resourcedensity
            print(f"\n    验证公式：blocks × falloff × density")
            print(f"    {total_blocks} × {falloff:.4f} × {resourcedensity:,} = {expected_yield:,.0f}")
            print(f"    实际 gen: {gen_total_yield:,}")

            # 检查 resourcedensity 是否一致
            sample_avg_density = 0
            if ware in sample_ware:
                densities = []
                for density_data in sample_ware[ware].values():
                    for r in density_data.get('resources', []):
                        densities.append(r.get('resourcedensity', 0))
                if densities:
                    sample_avg_density = sum(densities) / len(densities)

            print(f"\n    resourcedensity: gen={resourcedensity:,}, sample_avg={sample_avg_density:,.0f}")


if __name__ == "__main__":
    main()
