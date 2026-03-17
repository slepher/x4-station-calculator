#!/usr/bin/env python3
"""调试 nebula 的 boundary 值来源"""
import json
import sys
sys.path.insert(0, 'scripts')
from x4_data_map_processor import calculate_gas_block_count_truncated

# 读取 resourceareas.json 查看 nebula 的完整数据
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        for area in cluster.get('areas', []):
            if 'nebula' in area.get('ref', ''):
                print(f"=== {area['ref']} ===")
                print(f"完整 keys: {list(area.keys())}")
                print(f"position: {area.get('position')}")
                print(f"当前输出：total_blocks={area.get('total_blocks')}, blocks={area.get('blocks')}")

                # 检查是否有 boundary 字段
                print(f"boundary: {area.get('boundary')}")
