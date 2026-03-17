#!/usr/bin/env python3
"""检查 nebula 的 volume_km3 来源"""
import json

# 检查 resourceareas.json 中的 nebula 数据
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        for area in cluster.get('areas', []):
            if 'nebula' in area.get('ref', ''):
                print(f"=== {area['ref']} ===")
                print(f"total_blocks: {area.get('total_blocks')}")
                print(f"blocks: {area.get('blocks')}")

                # 检查 save_sample_data 的对比
                print("\n=== save_sample_data 对比 ===")

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

# 计算 helium 的 total_max
helium = sample.get('ware', {}).get('helium', {})
for density_type, density_data in helium.items():
    total_max = sum(r.get('max', 0) for r in density_data.get('resources', []))
    print(f"helium {density_type}: total_max = {total_max:,}")

    # 反推 base = total_max / (falloff × density)
    resources = density_data.get('resources', [])
    if resources:
        avg_falloff = sum(r.get('falloff', 0) for r in resources) / len(resources)
        avg_density = resources[0].get('resourcedensity', 0)
        implied_base = total_max / (avg_falloff * avg_density)
        print(f"  avg_falloff: {avg_falloff:.4f}")
        print(f"  avg_density: {avg_density:,}")
        print(f"  反推 base: {implied_base:.0f}")
