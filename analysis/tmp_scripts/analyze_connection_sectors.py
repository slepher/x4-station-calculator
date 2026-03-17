#!/usr/bin/env python3
"""
从 XML 中解析 region connection，分析 connection 名称解析出的 sector 是否存在

解析逻辑：
1. 优先从 connection 名称解析 sector
2. 如果 connection 名称解析出的 sector 不存在于 maps.json，则使用 region ref 解析
3. 如果 connection 名称无法解析，则使用 region ref 解析
4. 如果 region ref 也无法解析，则不匹配

用法:
    python3 analysis/tmp_scripts/analyze_connection_sectors.py
"""

import xml.etree.ElementTree as ET
import json
import re
from pathlib import Path
from collections import defaultdict
from typing import Optional

# XML 目录
XML_DIR = Path("x4raw_assets/8.0-Diplomacy/maps/xu_ep2_universe")

# 使用与 map_processor.py 相同的正则
REGION_CONNECTION_RES = (
    re.compile(r"C(\d+)S(\d+)_", re.IGNORECASE),
    re.compile(r"Cluster(\d+)_Sector(\d+)_", re.IGNORECASE),
)

# Region Ref 解析正则
REGION_REF_RES = (
    re.compile(r"region_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
    re.compile(r"region(\d+)_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
)

def resolve_sector_macro_from_region_connection(connection_name: str) -> Optional[str]:
    """与 map_processor.py 相同的解析逻辑"""
    for pattern in REGION_CONNECTION_RES:
        match = pattern.search(connection_name)
        if match is None:
            continue
        cluster_num = int(match.group(1))
        sector_num = int(match.group(2))
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None

def resolve_sector_macro_from_region_ref(region_ref: str) -> Optional[str]:
    """从 region ref 解析 sector"""
    for pattern in REGION_REF_RES:
        match = pattern.search(region_ref)
        if match is None:
            continue
        groups = match.groups()
        if len(groups) == 3:
            # region(\d+)_cluster_(\d+)_sector_(\d+) 格式
            cluster_num = int(groups[1])
            sector_num = int(groups[2])
        else:
            # region_cluster_(\d+)_sector_(\d+) 格式
            cluster_num = int(groups[0])
            sector_num = int(groups[1])
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None

def find_region_connections(xml_files, actual_sectors):
    """查找所有 region connection"""
    connections = []

    for xml_file in xml_files:
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()

            # 查找所有 connection[@ref='regions']
            for conn in root.iter("connection"):
                if conn.get("ref") == "regions":
                    conn_name = conn.get("name", "")
                    macro = conn.find("./macro")
                    if macro is not None:
                        macro_name = macro.get("name", "")
                        region_prop = macro.find("./properties/region")
                        region_ref = region_prop.get("ref", "") if region_prop is not None else ""

                        # 两级解析逻辑：
                        # 1. 优先从 connection 名称解析 sector（使用与 map_processor.py 相同的逻辑）
                        conn_sector = resolve_sector_macro_from_region_connection(conn_name)
                        if not conn_sector:
                            conn_sector = resolve_sector_macro_from_region_connection(macro_name)

                        # 2. 如果 connection 名称解析出的 sector 不存在，则使用 region ref 解析
                        ref_sector = None
                        if conn_sector and conn_sector not in actual_sectors and region_ref:
                            # connection 名称解析出的 sector 不存在，尝试从 region ref 解析
                            ref_sector = resolve_sector_macro_from_region_ref(region_ref)
                        elif not conn_sector and region_ref:
                            # connection 名称无法解析，从 region ref 解析
                            ref_sector = resolve_sector_macro_from_region_ref(region_ref)

                        # 最终解析结果：优先使用 conn_sector（如果存在），否则使用 ref_sector
                        # 但如果 conn_sector 存在而 ref_sector 也存在，且 conn_sector 无效，则使用 ref_sector
                        if conn_sector and conn_sector not in actual_sectors and ref_sector:
                            final_sector = ref_sector
                        else:
                            final_sector = conn_sector or ref_sector

                        connections.append({
                            "xml_file": xml_file.name,
                            "connection_name": conn_name,
                            "macro_name": macro_name,
                            "region_ref": region_ref,
                            "conn_sector": conn_sector,      # connection 名称解析结果
                            "ref_sector": ref_sector,        # region ref 解析结果
                            "final_sector": final_sector,    # 最终采用的 sector
                        })
        except Exception as e:
            print(f"解析 {xml_file} 时出错：{e}")

    return connections

def main():
    # 查找所有 *_clusters.xml 文件 + clusters.xml 主文件
    xml_files = list(XML_DIR.glob("*_clusters.xml"))
    # 添加主 clusters.xml
    main_clusters = XML_DIR / "clusters.xml"
    if main_clusters.exists():
        xml_files.insert(0, main_clusters)
    print(f"找到 {len(xml_files)} 个 XML 文件:")
    for f in xml_files:
        print(f"  - {f.name}")
    print()

    # 加载 maps.json 获取实际存在的 sector
    maps_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json")
    with open(maps_path) as f:
        maps_data = json.load(f)

    actual_sectors = set()
    clusters_dict = maps_data.get("clusters", {})
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id in sectors_dict.keys():
            actual_sectors.add(sector_id)

    print(f"实际存在的 sector 数量：{len(actual_sectors)}")
    print()

    # 解析所有 connection（传入 actual_sectors 以便检查 sector 是否存在）
    connections = find_region_connections(xml_files, actual_sectors)
    print(f"找到 {len(connections)} 个 region connection")
    print()

    # 分类
    valid_connections = []     # 最终解析出的 sector 存在
    invalid_connections = []   # 最终解析出的 sector 不存在

    for conn in connections:
        final_sector = conn["final_sector"]
        if final_sector:
            if final_sector in actual_sectors:
                valid_connections.append(conn)
            else:
                invalid_connections.append(conn)
        else:
            # 无法解析的
            invalid_connections.append(conn)

    # 输出表格
    print("=" * 200)
    print("表：Connection 解析出的 Sector 不存在于 maps.json 中（两级解析：connection 名称 → region ref）")
    print("=" * 200)
    print(f"{'XML File':<25} {'Connection Name':<40} {'Macro Name':<30} {'Region Ref':<40} {'Conn Sector':<25} {'Ref Sector':<25} {'Final Sector':<25}")
    print("-" * 200)

    for conn in sorted(invalid_connections, key=lambda x: x["connection_name"]):
        xml_file = conn["xml_file"][:23] + "..." if len(conn["xml_file"]) > 25 else conn["xml_file"]
        conn_name = conn["connection_name"][:38] + "..." if len(conn["connection_name"]) > 40 else conn["connection_name"]
        macro_name = conn["macro_name"][:28] + "..." if len(conn["macro_name"]) > 30 else conn["macro_name"]
        region_ref = conn["region_ref"][:38] + "..." if len(conn["region_ref"]) > 40 else conn["region_ref"]
        conn_sector = conn["conn_sector"] or "-"
        ref_sector = conn["ref_sector"] or "-"
        final_sector = conn["final_sector"] or "无法解析"
        print(f"{xml_file:<25} {conn_name:<40} {macro_name:<30} {region_ref:<40} {conn_sector:<25} {ref_sector:<25} {final_sector:<25}")

    if not invalid_connections:
        print("（无无效 connection）")

    # 统计
    print("\n" + "=" * 200)
    print("统计摘要")
    print("=" * 200)
    print(f"  总 connection 数量：{len(connections)}")
    print(f"  解析出有效 sector 的 connection: {len(valid_connections)}")
    print(f"  解析出无效 sector 的 connection: {len(invalid_connections)}")

    # 统计解析方式
    conn_name_valid = sum(1 for c in connections if c["conn_sector"] and c["conn_sector"] in actual_sectors)
    conn_name_invalid_but_ref_valid = sum(1 for c in connections if c["conn_sector"] and c["conn_sector"] not in actual_sectors and c["ref_sector"])
    ref_matched = sum(1 for c in connections if not c["conn_sector"] and c["ref_sector"])
    unable_to_parse = sum(1 for c in connections if not c["final_sector"])
    print(f"\n  解析方式统计:")
    print(f"    - 从 connection 名称解析出有效 sector: {conn_name_valid}")
    print(f"    - 从 connection 名称解析出无效 sector，回退到 region ref: {conn_name_invalid_but_ref_valid}")
    print(f"    - 从 region ref 解析成功（connection 名称失败）: {ref_matched}")
    print(f"    - 无法解析：{unable_to_parse}")

    # 列出所有无效的 sector
    invalid_sectors = set(conn["final_sector"] for conn in invalid_connections if conn["final_sector"])
    if invalid_sectors:
        print(f"\n  无效 sector 列表（{len(invalid_sectors)} 个）:")
        for s in sorted(invalid_sectors):
            print(f"    - {s}")

if __name__ == "__main__":
    main()
