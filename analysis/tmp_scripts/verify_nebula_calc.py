#!/usr/bin/env python3
"""对比 save_sample_data 和生成数据"""
import json

# 读取 save_sample_data
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

# 读取生成的 resourceareas.json
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

# 找到 cluster_703 的 nebula
nebula_gen = None
for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        for area in cluster.get('areas', []):
            if 'nebula_1' in area.get('ref', ''):
                nebula_gen = area
                break

if not nebula_gen:
    print("未找到生成的 nebula 数据")
    exit(1)

print("=== save_sample_data ===")
for ware_name, density_data in sample.get('ware', {}).items():
    for density_type, resources in density_data.items():
        total_max = sum(r.get('max', 0) for r in resources.get('resources', []))
        print(f"{ware_name} ({density_type}): total_max = {total_max:,}")

print("\n=== 生成的 resourceareas.json ===")
for res in nebula_gen.get('resources', []):
    ware = res.get('ware')
    total_yield = res.get('total_yield', 0)
    print(f"{ware}: total_yield = {total_yield:,}")

print("\n=== 对比 ===")
for ware_name, density_data in sample.get('ware', {}).items():
    for density_type, resources in density_data.items():
        sample_total = sum(r.get('max', 0) for r in resources.get('resources', []))

        # 找到生成的对应 ware
        gen_total = 0
        for res in nebula_gen.get('resources', []):
            if res.get('ware') == ware_name:
                gen_total = res.get('total_yield', 0)
                break

        # 计算误差
        if sample_total > 0:
            error = (gen_total - sample_total) / sample_total * 100
            print(f"{ware_name}: sample={sample_total:,}, gen={gen_total:,}, error={error:+.1f}%")
