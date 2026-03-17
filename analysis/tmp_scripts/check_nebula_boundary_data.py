#!/usr/bin/env python3
"""检查 maps.json 中 nebula 的 boundary 数据"""
import json

with open('src/assets/x4_game_data/8.0-Diplomacy/data/maps.json') as f:
    maps = json.load(f)

# 找到 Cluster_703
for cluster in maps.get('maps', {}).get('Cluster_703', {}).get('sectors', []):
    if cluster.get('id') == 'Cluster_703_Sector001':
        print(f"=== Cluster_703_Sector001 ===")
        for nebula in cluster.get('nebulas', []):
            print(f"nebula: {nebula.get('id')}")
            print(f"  position: {nebula.get('position')}")
            print(f"  boundary: {nebula.get('boundary')}")
