#!/usr/bin/env python3
"""
追踪 248 值的来源
"""
import json
from pathlib import Path

def main():
    # 读取 resourceareas.json
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    # 找到 nebula area
    for cluster in resourceareas:
        for area in cluster.get('areas', []):
            if 'nebula' in area.get('ref', ''):
                print(f"=== {area['ref']} ===")
                print(f"keys: {list(area.keys())}")
                print(f"total_volume_km3: {area.get('total_volume_km3')}")
                print(f"volume_km3: {area.get('volume_km3')}")

                # 检查 resources 计算
                for res in area.get('resources', []):
                    ware = res.get('ware')
                    total_yield = res.get('total_yield', 0)
                    falloff = area.get('falloff_factor', 1.0)
                    density = res.get('resourcedensity', 1.0)

                    # 反推 base = total_yield / (falloff × density)
                    if falloff * density > 0:
                        base = total_yield / (falloff * density)
                        print(f"\n  {ware}:")
                        print(f"    total_yield: {total_yield:,}")
                        print(f"    falloff × density: {falloff:.4f} × {density:,.0f} = {falloff * density:.0f}")
                        print(f"    反推 base: {base:.0f}")

                # 248 应该是从 region_calc 的 volume_km3 来的
                # 但 region_calc 是从 migrate_region_definitions 返回的 calc_data
                # 让我们检查 calc_data 中 nebula 的 volume_km3

    # 我们需要知道 248 是否是从原始 XML 的 volume_km3 来的
    # 检查 migrate_region_definitions 中 region_item["volume_km3"] 的计算

    # 如果 boundary 为空，boundary_volume 返回 0
    # 那么 248 一定来自其他地方...

    # 也许是旧代码遗留？或者是从 fields 的 nebula 数据来的？
    print("\n\n=== 检查是否有其他 volume 来源 ===")

    # 检查旧的资源计算逻辑
    # 在旧代码中，nebula 可能使用 volume_km3 × density × falloff 计算
    # 而 volume_km3 可能是从 XML 的某个字段来的

    # 从 save_sample_data 反推
    with open("save_sample_data/cluster_703_sector001_macro.json") as f:
        sample = json.load(f)

    # save_sample_data 中的 helium total_max = 1,134,299
    # 如果 sample 使用的是 volume × falloff × density
    # 则 volume = total_max / (falloff × density)

    helium = sample['ware'].get('helium', {})
    for density_type, data in helium.items():
        total_max = sum(r.get('max', 0) for r in data.get('resources', []))
        # sample 中的 falloff 和 density
        resources = data.get('resources', [])
        if resources:
            avg_falloff = sum(r.get('falloff', 0) for r in resources) / len(resources)
            avg_density = sum(r.get('resourcedensity', 0) for r in resources) / len(resources)

            if avg_falloff * avg_density > 0:
                implied_vol = total_max / (avg_falloff * avg_density)
                print(f"helium ({density_type}):")
                print(f"  total_max: {total_max:,}")
                print(f"  avg_falloff: {avg_falloff:.4f}")
                print(f"  avg_density: {avg_density:,.0f}")
                print(f"  反推 volume: {implied_vol:.0f}")

if __name__ == "__main__":
    main()
