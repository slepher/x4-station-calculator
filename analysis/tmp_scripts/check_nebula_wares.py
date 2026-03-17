#!/usr/bin/env python3
"""检查 nebula 的 ware 类型"""
import json

# 读取生成的 regions.json
with open('src/assets/x4_game_data/8.0-Diplomacy/data/regions.json') as f:
    regions = json.load(f)

# 找到 cluster_703 的 nebula
for r in regions:
    if '703' in r.get('id', '') and 'nebula_1' in r.get('id', ''):
        print(f"=== {r['id']} ===")
        print(f"resources: {r.get('resources')}")
