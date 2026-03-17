#!/usr/bin/env python3
"""分析 save_sample_data 的资源分布"""
import json

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

print("=== 资源点分布 ===")
for ware_name, density_data in sample.get('ware', {}).items():
    for density_type, data in density_data.items():
        resources = data.get('resources', [])
        print(f"\n{ware_name} ({density_type}): {len(resources)} 个资源点")

        # 按 y 坐标分组
        y_coords = set()
        for r in resources:
            y_coords.add(r.get('y'))

        print(f"  y 坐标：{sorted(y_coords)}")

        # 检查是否有 y=0 的资源点（这些应该是 nebula 的）
        nebula_points = [r for r in resources if r.get('y', 0) == 0]
        solid_points = [r for r in resources if r.get('y', 0) != 0]

        print(f"  nebula 点 (y=0): {len(nebula_points)}")
        print(f"  固体点 (y!=0): {len(solid_points)}")

        # 计算 nebula 点的总量
        nebula_total = sum(r.get('max', 0) for r in nebula_points)
        solid_total = sum(r.get('max', 0) for r in solid_points)

        print(f"  nebula total_max: {nebula_total:,}")
        print(f"  固体 total_max: {solid_total:,}")
