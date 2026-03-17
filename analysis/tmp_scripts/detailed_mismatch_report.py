#!/usr/bin/env python3
"""
详细分析 region ref 与 sector 的匹配情况

用法:
    python3 analysis/tmp_scripts/detailed_mismatch_report.py
"""

import re
import json
from pathlib import Path
from collections import defaultdict

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
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    # 收集所有 unique region ref
    all_refs = defaultdict(list)

    for group in resourceareas:
        cluster_id = group.get("cluster_id", "")
        sector_id = group.get("sector_id", "")
        for area in group.get("areas", []):
            region_ref = area.get("ref", "")
            all_refs[region_ref].append({
                "cluster_id": cluster_id,
                "sector_id": sector_id,
            })

    # 分类
    pattern_refs = []  # region_cluster_X_sector_Y 模式
    other_refs = []    # 其他模式

    for ref, locations in all_refs.items():
        expected_sector, suffix = parse_sector_from_region_ref(ref)
        if expected_sector:
            pattern_refs.append((ref, locations, expected_sector, suffix))
        else:
            other_refs.append((ref, locations))

    # 找出不匹配的
    mismatches = []
    matches = []

    for ref, locations, expected_sector, suffix in pattern_refs:
        for loc in locations:
            actual_sector = loc["sector_id"]
            if actual_sector != expected_sector:
                mismatches.append({
                    "region_ref": ref,
                    "actual_cluster": loc["cluster_id"],
                    "actual_sector": actual_sector,
                    "expected_sector": expected_sector,
                    "suffix": suffix,
                })
            else:
                matches.append({
                    "region_ref": ref,
                    "sector": actual_sector,
                })

    # 输出表格 1：不匹配的 region
    print("=" * 160)
    print("表 1: Region Ref 与 Sector 不匹配（region ref 中的 sector 与实际所在 sector 不一致）")
    print("=" * 160)
    print(f"{'Region Ref':<45} {'Actual Cluster':<30} {'Actual Sector':<30} {'Expected Sector':<30} {'Suffix':<10}")
    print("-" * 160)

    if mismatches:
        for m in sorted(mismatches, key=lambda x: x["region_ref"]):
            print(f"{m['region_ref']:<45} {m['actual_cluster']:<30} {m['actual_sector']:<30} {m['expected_sector']:<30} {m['suffix']:<10}")
    else:
        print("（无不匹配的记录）")

    # 输出表格 2：非 region_cluster_X_sector_Y 模式的 ref
    print("\n" + "=" * 160)
    print("表 2: 其他命名模式的 Region Ref（不使用 region_cluster_X_sector_Y 格式）")
    print("=" * 160)
    print(f"{'Region Ref':<60} {'引用位置数量':<15} {'引用位置'}")
    print("-" * 160)

    for ref, locations in sorted(other_refs, key=lambda x: x[0]):
        loc_strs = [f"{loc['cluster_id']}/{loc['sector_id']}" for loc in locations]
        print(f"{ref:<60} {len(locations):<15} {', '.join(loc_strs)}")

    # 输出表格 3：有 suffix 的 region ref
    print("\n" + "=" * 160)
    print("表 3: 带有 Suffix 的 Region Ref（如 region_cluster_02_sector_001b 中的 'b'）")
    print("=" * 160)
    print(f"{'Region Ref':<50} {'Expected Sector':<30} {'Suffix':<10} {'Actual Location'}")
    print("-" * 160)

    refs_with_suffix = [(ref, locs, exp, suf) for ref, locs, exp, suf in pattern_refs if suf]
    for ref, locations, expected_sector, suffix in sorted(refs_with_suffix, key=lambda x: x[0]):
        for loc in locations:
            print(f"{ref:<50} {expected_sector:<30} {suffix:<10} {loc['cluster_id']}/{loc['sector_id']}")

    # 统计
    print("\n" + "=" * 160)
    print("统计摘要")
    print("=" * 160)
    print(f"  使用 region_cluster_X_sector_Y 模式的 region: {len(pattern_refs)}")
    print(f"  使用其他命名模式的 region: {len(other_refs)}")
    print(f"  匹配的 region-sector 引用：{len(matches)}")
    print(f"  不匹配的 region-sector 引用：{len(mismatches)}")
    print(f"  总 region-sector 引用：{len(matches) + len(mismatches)}")

if __name__ == "__main__":
    main()
