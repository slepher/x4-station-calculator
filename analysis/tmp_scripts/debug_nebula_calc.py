#!/usr/bin/env python3
"""调试 nebula 的 position 和 boundary 值"""
import json
import sys
sys.path.insert(0, 'scripts')
from x4_data_map_processor import calculate_gas_block_count_truncated

# 读取 resourceareas.json 查看 nebula 的 position
with open('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json') as f:
    data = json.load(f)

for cluster in data:
    if '703' in cluster.get('cluster_id', ''):
        for area in cluster.get('areas', []):
            if 'nebula' in area.get('ref', ''):
                print(f"=== {area['ref']} ===")
                print(f"position: {area.get('position')}")
                print(f"当前输出：total_blocks={area.get('total_blocks')}, blocks={area.get('blocks')}")

                # 用相同的 position 和空 boundary 计算
                position = area.get('position', {"x": 0.0, "y": 0.0, "z": 0.0})
                boundary = {}  # nebula 没有 boundary

                result = calculate_gas_block_count_truncated(position, boundary)
                print(f"calculate_gas_block_count_truncated 结果：{result}")
                print(f"  预期：(1, 0) - 因为 boundary 为空，radius=0")
