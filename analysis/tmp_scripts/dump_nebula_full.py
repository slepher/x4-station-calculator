#!/usr/bin/env python3
"""直接在 processor 中添加调试输出"""
import json
import sys

# 读取 resourceareas.json 检查 nebula 的完整数据
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        print(f"=== {cluster['cluster_id']} / {cluster['sector_id']} ===")
        for area in cluster.get('areas', []):
            if 'nebula' in area.get('ref', ''):
                print(f"\nArea: {area['ref']}")
                print(f"  keys: {list(area.keys())}")
                for key, value in area.items():
                    print(f"  {key}: {value}")
