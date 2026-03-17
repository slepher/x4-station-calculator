#!/usr/bin/env python3
"""
检查 nebula 的 template_resources
"""
import json
from pathlib import Path

def main():
    # 读取 regions.json
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json") as f:
        regions = json.load(f)

    # 找到 nebula regions
    for r in regions:
        if 'nebula' in r.get('id', '').lower():
            ref = r['id']
            resources = r.get('resources', [])
            wares = [res.get('ware') for res in resources]

            # 检查是否有气体 ware
            gas_wares = {'helium', 'hydrogen', 'methane', 'bogas'}
            has_gas = any(w in gas_wares for w in wares)
            has_solid = any(w not in gas_wares for w in wares)

            print(f"{ref}:")
            print(f"  wares: {wares}")
            print(f"  has_gas: {has_gas}, has_solid: {has_solid}")

            if has_solid:
                print(f"  固体 wares: {[w for w in wares if w not in gas_wares]}")

if __name__ == "__main__":
    main()
