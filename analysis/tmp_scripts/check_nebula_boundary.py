#!/usr/bin/env python3
"""
检查 nebula 的 boundary 数据
"""
import json
from pathlib import Path

def main():
    # 读取 regions.json - 这是模板数据，不应该有 boundary
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json") as f:
        regions = json.load(f)

    # 找到 nebula region
    for r in regions:
        if '703' in r.get('id', '') and 'nebula' in r.get('id', ''):
            print(f"=== {r['id']} (regions.json) ===")
            print(f"keys: {list(r.keys())}")
            print(f"boundary: {r.get('boundary')}")
            break

    # 读取 resourceareas.json - 这应该有完整计算数据
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    # 找到 cluster_703
    for cluster in resourceareas:
        if '703' in cluster.get('cluster_id', '').lower():
            print(f"\n=== {cluster['cluster_id']} / {cluster['sector_id']} ===")
            for area in cluster.get('areas', []):
                if 'nebula' in area.get('ref', ''):
                    print(f"\nArea: {area['ref']}")
                    print(f"keys: {list(area.keys())}")
                    print(f"position: {area.get('position')}")
                    print(f"total_volume_km3: {area.get('total_volume_km3')}")
                    print(f"volume_km3: {area.get('volume_km3')}")

    # 我们需要检查 calc_data 中的 nebula 数据
    # 但 calc_data 不输出到 JSON，需要从 processor 获取
    # 这里我们检查原始 XML 数据

    print("\n\n=== 检查原始 XML 数据 ===")
    # 查找 region definition XML
    xml_path = Path("src/assets/x4_game_data/8.0-Diplomacy/regiondefinitions/regiondefinitions_703.xml")
    if xml_path.exists():
        import xml.etree.ElementTree as ET
        tree = ET.parse(xml_path)
        root = tree.getroot()

        # 找到包含 nebula 的 region
        for region in root.findall(".//region"):
            region_name = region.get("name", "")
            if 'nebula' in region_name.lower():
                print(f"\n=== {region_name} ===")

                # 检查 boundary 节点
                boundary = region.find("./boundary")
                if boundary is not None:
                    print(f"boundary class: {boundary.get('class')}")
                    size = boundary.find("./size")
                    if size is not None:
                        print(f"size.r: {size.get('r')}")
                else:
                    print("boundary: None")

                # 检查 fields 节点
                fields = region.find("./fields")
                if fields is not None:
                    print("fields: 存在")
                    for nebula in fields.findall("./nebula"):
                        print(f"  nebula resources: {nebula.get('resources')}")
                else:
                    print("fields: None")
    else:
        print(f"XML 文件不存在：{xml_path}")

if __name__ == "__main__":
    main()
