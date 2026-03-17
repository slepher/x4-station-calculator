#!/usr/bin/env python3
"""检查 cluster_703_sector001 的所有 region"""
import json

# 读取生成的 resourceareas.json
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

# 找到 cluster_703
for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        print(f"=== {cluster['cluster_id']} / {cluster['sector_id']} ===")
        print(f"Area 数量：{len(cluster.get('areas', []))}")
        for area in cluster.get('areas', []):
            ref = area.get('ref', '')
            wares = [r.get('ware') for r in area.get('resources', [])]
            print(f"  {ref}: {wares}")
