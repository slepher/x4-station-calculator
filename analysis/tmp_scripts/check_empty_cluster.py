#!/usr/bin/env python3
"""
检查 resourceareas.json 中 cluster_id 为空的情况

用法:
    python3 analysis/tmp_scripts/check_empty_cluster.py
"""

import json
from pathlib import Path

def main():
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        data = json.load(f)

    empty_cluster = [g for g in data if g["cluster_id"] == ""]
    print(f"cluster_id 为空的 group 数量：{len(empty_cluster)}")

    if empty_cluster:
        print("\ncluster_id 为空的 group:")
        for g in empty_cluster[:5]:
            print(f"  sector_id={g['sector_id']}, areas count={len(g['areas'])}")

    # 检查所有 group 的分布
    print(f"\n总 group 数量：{len(data)}")

    # 统计每个 cluster 的 group 数量
    from collections import defaultdict
    cluster_count = defaultdict(int)
    for g in data:
        cluster_count[g["cluster_id"]] += 1

    print("\n前 10 个 cluster 的 group 数量:")
    for cid, count in sorted(cluster_count.items(), key=lambda x: -x[1])[:10]:
        if cid:
            print(f"  {cid}: {count} 个 groups")

if __name__ == "__main__":
    main()
