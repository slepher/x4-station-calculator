#!/usr/bin/env python3
"""
检查 maps.json 中所有 sector 的命名模式

用法:
    python3 analysis/tmp_scripts/list_all_sectors.py
"""

import json
from pathlib import Path

def main():
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
        maps_data = json.load(f)

    clusters_dict = maps_data.get("clusters", {})
    all_sectors = []
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id in sectors_dict.keys():
            all_sectors.append(sector_id)

    print(f"总 sector 数量：{len(all_sectors)}")

    # 查找包含 02 或 7300 的 sector
    print("\n包含 '02' 的 sector:")
    for s in sorted(all_sectors):
        if "02" in s:
            print(f"  {s}")

    print("\n包含 '7300' 的 sector:")
    for s in sorted(all_sectors):
        if "7300" in s:
            print(f"  {s}")

if __name__ == "__main__":
    main()
