#!/usr/bin/env python3
"""检查 nebula 在 regions.json 中的数据"""
import json

with open('src/assets/x4_game_data/8.0-Diplomacy/data/regions.json') as f:
    regions = json.load(f)

for r in regions:
    if '703' in r.get('id', '') and 'nebula' in r.get('id', ''):
        print(f"=== {r['id']} (regions.json) ===")
        print(f"keys: {list(r.keys())}")
        print(f"resources: {r.get('resources')}")
