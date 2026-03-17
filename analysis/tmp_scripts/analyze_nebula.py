#!/usr/bin/env python3
"""
分析 nebula 的计算逻辑
"""
import json
from pathlib import Path

def main():
    # 读取 save_sample_data
    with open("save_sample_data/cluster_703_sector001_macro.json") as f:
        sample = json.load(f)

    # 读取生成的 resourceareas
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    # 找到 cluster_703
    cluster703 = None
    for cluster in resourceareas:
        if '703' in cluster.get('cluster_id', '').lower() or '703' in cluster.get('sector_id', '').lower():
            cluster703 = cluster
            break

    # 找到 nebula area
    nebula_area = None
    for area in cluster703.get('areas', []):
        if 'nebula' in area.get('ref', ''):
            nebula_area = area
            break

    if not nebula_area:
        print("未找到 nebula area")
        return

    print("=== Nebula Area 数据 ===")
    print(f"ref: {nebula_area['ref']}")
    print(f"position: {nebula_area.get('position')}")
    print(f"total_volume_km3: {nebula_area.get('total_volume_km3')}")
    print(f"volume_km3: {nebula_area.get('volume_km3')}")
    print(f"lateral_factor: {nebula_area.get('lateral_factor')}")
    print(f"radial_factor: {nebula_area.get('radial_factor')}")
    print(f"falloff_factor: {nebula_area.get('falloff_factor')}")

    print("\nResources:")
    for res in nebula_area.get('resources', []):
        print(f"  {res['ware']}:")
        print(f"    resourcedensity: {res.get('resourcedensity'):,.0f}")
        print(f"    total_yield: {res.get('total_yield'):,}")
        print(f"    yield: {res.get('yield'):,}")
        print(f"    total_respawn: {res.get('total_respawn'):,}")
        print(f"    respawn: {res.get('respawn'):,}")

    # 对比 save_sample_data
    print("\n=== save_sample_data 对比 ===")
    sample_ware = sample.get('ware', {})

    for res in nebula_area.get('resources', []):
        ware = res['ware']
        if ware in sample_ware:
            sample_total = 0
            for density_data in sample_ware[ware].values():
                for r in density_data.get('resources', []):
                    sample_total += r.get('max', 0)

            gen_total = res.get('total_yield', 0)

            # 尝试反推 save_sample_data 的计算方式
            # 假设：sample_total = base × falloff × density
            # 则 base = sample_total / (falloff × density)

            falloff = nebula_area.get('falloff_factor', 1.0)
            density = res.get('resourcedensity', 1.0)

            if falloff * density > 0:
                implied_base = sample_total / (falloff * density)
                print(f"\n  {ware}:")
                print(f"    sample_total: {sample_total:,}")
                print(f"    gen_total_yield: {gen_total:,}")
                print(f"    falloff × density: {falloff:.4f} × {density:,.0f} = {falloff * density:.2f}")
                print(f"    反推 base (sample): {implied_base:,.0f}")
                print(f"    gen 使用的 base: {gen_total / (falloff * density):,.0f}")

    # 检查 total_volume_km3 和 volume_km3 的含义
    print("\n=== Volume 分析 ===")
    vol_total = nebula_area.get('total_volume_km3', 0)
    vol_eff = nebula_area.get('volume_km3', 0)

    print(f"total_volume_km3: {vol_total}")
    print(f"volume_km3: {vol_eff}")
    print(f"ratio: {vol_eff / vol_total if vol_total > 0 else 0:.2%}")

    # 这个体积值 248 和 138 可能代表什么？
    # 如果是方块数，那么 248 个 64km³ 方块 = 248 × 64³ = 248 × 262,144 km³
    # 但这似乎不合理

    # 也许 nebula 使用的是不同的体积单位？
    # 假设 248 是某种"单位体积"，而不是 km³ 或方块数

    # 检查：如果 total_yield = volume × falloff × density
    # 则 volume = total_yield / (falloff × density)

    for res in nebula_area.get('resources', []):
        ware = res['ware']
        gen_total = res.get('total_yield', 0)
        falloff = nebula_area.get('falloff_factor', 1.0)
        density = res.get('resourcedensity', 1.0)

        if falloff * density > 0:
            implied_vol = gen_total / (falloff * density)
            print(f"\n  {ware} 反推的 volume: {implied_vol:,.0f}")

    print(f"\n  nebula 的 total_volume_km3: {vol_total}")
    print(f"  如果 vol_total=248 是 km³，则与计算不符")
    print(f"  如果 vol_total=248 是方块数 (64km³)，则总容积 = 248 × 262,144 = {248 * 262144:,} km³")

if __name__ == "__main__":
    main()
