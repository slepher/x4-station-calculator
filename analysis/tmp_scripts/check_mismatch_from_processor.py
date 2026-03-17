#!/usr/bin/env python3
"""
从 processor 解析的数据中查找 region ref 与 sector 不匹配的情况

用法:
    python3 analysis/tmp_scripts/check_mismatch_from_processor.py
"""

import re
import sys
sys.path.insert(0, "scripts")

from x4_data_map_processor import main as processor_main
import argparse
import os

# 设置环境变量以使用 8.0 数据
os.environ["X4_RAW_ASSETS_DIR"] = "src/assets/x4_game_data/8.0-Diplomacy"

def parse_sector_from_connection_name(name):
    """从 connection 或 macro 名称中解析 sector 信息"""
    patterns = [
        r"C(\d+)S(\d+)_.*",
        r"Cluster_(\d+)_Sector(\d+)_.*",
    ]
    for pattern in patterns:
        match = re.match(pattern, name, re.IGNORECASE)
        if match:
            cluster_num = int(match.group(1))
            sector_num = int(match.group(2))
            return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None

def parse_sector_from_region_ref(ref):
    """从 region ref 中解析预期的 sector 信息"""
    patterns = [
        r"region_cluster_(\d+)_sector_(\d+)([a-z])?",
    ]
    for pattern in patterns:
        match = re.match(pattern, ref, re.IGNORECASE)
        if match:
            cluster_num = int(match.group(1))
            sector_num = int(match.group(2))
            suffix = match.group(3) or ""
            return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro", suffix
    return None, None

def main():
    # 需要解析 XML 获取 connection 名称
    # 由于无法直接访问 XML，我们从 resourceareas.json 和 maps.json 中分析

    import json
    from pathlib import Path

    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
        maps_data = json.load(f)

    # 构建 sector -> cluster_id 映射
    sector_to_cluster = {}
    clusters_dict = maps_data.get("clusters", {})
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id, sector in sectors_dict.items():
            sector_to_cluster[sector_id] = cluster_id

    print("=" * 140)
    print("Region Ref 与 Sector 匹配性分析")
    print("=" * 140)

    mismatches = []
    matches = []

    for group in resourceareas:
        cluster_id = group.get("cluster_id", "")
        sector_id = group.get("sector_id", "")

        for area in group.get("areas", []):
            region_ref = area.get("ref", "")

            # 从 region ref 解析预期的 sector
            expected_sector, suffix = parse_sector_from_region_ref(region_ref)

            if expected_sector:
                # 检查是否匹配
                actual_sector = sector_id

                # 检查 cluster 是否匹配
                expected_cluster = expected_sector.split("_Sector")[0] + "_macro"

                if actual_sector != expected_sector:
                    mismatches.append({
                        "region_ref": region_ref,
                        "actual_cluster": cluster_id,
                        "actual_sector": sector_id,
                        "expected_sector": expected_sector,
                        "suffix": suffix,
                    })
                else:
                    matches.append({
                        "region_ref": region_ref,
                        "sector": sector_id,
                    })

    # 输出表格
    print("\n不匹配的区域（region ref 中的 sector 与实际所在 sector 不一致）：")
    print("-" * 140)
    print(f"{'Region Ref':<45} {'Actual Cluster':<30} {'Actual Sector':<30} {'Expected Sector':<30}")
    print("-" * 140)

    for m in sorted(mismatches, key=lambda x: x["region_ref"]):
        print(f"{m['region_ref']:<45} {m['actual_cluster']:<30} {m['actual_sector']:<30} {m['expected_sector']:<30}")

    print("\n" + "=" * 140)
    print(f"统计:")
    print(f"  匹配的 region: {len(matches)}")
    print(f"  不匹配的 region: {len(mismatches)}")
    print(f"  总计：{len(matches) + len(mismatches)}")

if __name__ == "__main__":
    main()
