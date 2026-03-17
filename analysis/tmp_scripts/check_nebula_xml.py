#!/usr/bin/env python3
"""检查 nebula 的 XML 原始数据"""
import xml.etree.ElementTree as ET

xml_path = "src/assets/x4_game_data/8.0-Diplomacy/regiondefinitions/regiondefinitions_703.xml"
tree = ET.parse(xml_path)
root = tree.getroot()

for region in root.findall(".//region"):
    region_name = region.get("name", "")
    if 'nebula' in region_name.lower():
        print(f"=== {region_name} ===")

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
