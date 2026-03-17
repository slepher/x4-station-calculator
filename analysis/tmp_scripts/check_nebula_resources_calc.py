#!/usr/bin/env python3
"""检查 nebula 的 resources 计算"""
import json

# 读取 resourceareas.json
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        for area in cluster.get('areas', []):
            if 'nebula' in area.get('ref', ''):
                print(f"=== {area['ref']} ===")

                # 检查 resources 计算
                for res in area.get('resources', []):
                    ware = res.get('ware')
                    total_yield = res.get('total_yield', 0)
                    falloff = area.get('falloff_factor', 1.0)
                    density = res.get('resourcedensity', 0)

                    # 反推 base = total_yield / (falloff × density)
                    if falloff * density > 0:
                        base = total_yield / (falloff * density)
                        print(f"  {ware}:")
                        print(f"    total_yield: {total_yield:,}")
                        print(f"    falloff: {falloff:.4f}")
                        print(f"    density: {density:,}")
                        print(f"    反推 base: {base:.0f}")
