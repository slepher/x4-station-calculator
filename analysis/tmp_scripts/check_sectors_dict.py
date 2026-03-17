#!/usr/bin/env python3
"""
检查 sectors 字典中是否包含特定的 sector

用法:
    python3 analysis/tmp_scripts/check_sectors_dict.py
"""

import json
from pathlib import Path

def main():
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
        maps_data = json.load(f)

    target_sectors = ["Cluster_02_Sector002_macro", "Cluster_7300_Sector001_macro"]

    clusters_dict = maps_data.get("clusters", {})
    all_sectors = {}
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id, sector in sectors_dict.items():
            all_sectors[sector_id] = sector

    print(f"总 sector 数量：{len(all_sectors)}")

    for target in target_sectors:
        if target in all_sectors:
            print(f"\n{target}: 存在")
            print(f"  cluster_id={all_sectors[target].get('cluster_id', 'MISSING')}")
        else:
            print(f"\n{target}: 不存在于 sectors 字典中")

if __name__ == "__main__":
    main()
