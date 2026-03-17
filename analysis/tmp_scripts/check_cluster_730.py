#!/usr/bin/env python3
"""检查 resourceareas.json 中 Cluster_730 的数据"""
import json

with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

# 查找 Cluster_730 的 sector
for group in data:
    if 'Cluster_730_macro' in group.get('cluster_id', ''):
        print(f"Cluster: {group['cluster_id']}, Sector: {group['sector_id']}")
        for area in group.get('areas', [])[:5]:
            print(f"  - ref: {area['ref']}, resources: {len(area.get('resources', []))}")
