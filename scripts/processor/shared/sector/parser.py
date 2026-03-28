"""Sector 解析工具 - X4 Map Data Processor."""

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import xml.etree.ElementTree as ET

from processor.shared.utils.data_utils import split_tags


# 正则表达式模式
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
CLUSTER_MACRO_RE = re.compile(r"Cluster_(\d+)_macro", re.IGNORECASE)
REGION_CONNECTION_RES = (
    re.compile(r"C(\d+)S(\d+)_", re.IGNORECASE),
    re.compile(r"Cluster(\d+)_Sector(\d+)_", re.IGNORECASE),
)
REGION_REF_RES = (
    re.compile(r"region_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
    re.compile(r"region(\d+)_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
)
SHCON_ZONE_RE = re.compile(r"tzoneCluster_(\d+)_Sector(\d+)SHCon(\d+)_GateZone_macro", re.IGNORECASE)
ZONE_MACRO_RE = re.compile(r"Zone\d+_Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)


def as_float(value: Optional[str], default: float = 0.0) -> float:
    """将值安全转换为 float。"""
    return float(value) if value is not None else default


def parse_xml(path: Path) -> ET.Element:
    """解析 XML 文件并返回根元素。"""
    tree = ET.parse(str(path))
    return tree.getroot()


def load_mapdefaults(mapdefaults_xml: Path) -> Tuple[Dict[str, str], Dict[str, dict], Dict[str, dict]]:
    """
    加载 mapdefaults 配置。

    从 XML 中读取：
    - name_id_by_macro: dataset[@macro] -> identification[@name]
    - area_by_sector_macro: sector macro -> area 属性 (sunlight, economy, security, tags)
    - area_by_cluster_macro: cluster macro -> area 属性 (sunlight, economy, security, tags)
    """
    if not mapdefaults_xml.exists():
        return {}, {}, {}
    root = parse_xml(mapdefaults_xml)
    name_id_by_macro: Dict[str, str] = {}
    area_by_sector_macro: Dict[str, dict] = {}
    area_by_cluster_macro: Dict[str, dict] = {}

    for dataset in root.findall("./dataset[@macro]"):
        macro = (dataset.get("macro") or "").strip()
        if not macro:
            continue
        macro_key = macro.lower()

        # 读取 nameId：从 properties/identification[@name]
        properties = dataset.find("./properties")
        if properties is not None:
            identification = properties.find("./identification")
            if identification is not None:
                name_id = identification.get("name") or ""
                if name_id:
                    name_id_by_macro[macro_key] = name_id

            # 读取 area：从 properties/area[@*]
            area_node = properties.find("./area")
            if area_node is not None:
                area_data = {
                    "sunlight": as_float(area_node.get("sunlight"), 0.0),
                    "economy": as_float(area_node.get("economy"), 0.0),
                    "security": as_float(area_node.get("security"), 0.0),
                    "tags": split_tags(area_node.get("tags")),
                }
                if SECTOR_MACRO_RE.fullmatch(macro):
                    area_by_sector_macro[macro_key] = area_data
                elif CLUSTER_MACRO_RE.fullmatch(macro):
                    area_by_cluster_macro[macro_key] = area_data

    return name_id_by_macro, area_by_sector_macro, area_by_cluster_macro


def resolve_sector_macro_from_region_connection(connection_name: str) -> Optional[str]:
    """从 region connection 名称解析 sector macro。"""
    for pattern in REGION_CONNECTION_RES:
        match = pattern.search(connection_name)
        if match is None:
            continue
        cluster_num = int(match.group(1))
        sector_num = int(match.group(2))
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None


def resolve_sector_macro_from_region_ref(region_ref: str) -> Optional[str]:
    """从 region ref 解析 sector macro。"""
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


def zone_connection_path_to_zone_macro(path: Optional[str]) -> Optional[str]:
    """从 zone connection path 解析 zone macro。"""
    if not path:
        return None
    match = ZONE_MACRO_RE.fullmatch(path)
    if match:
        cluster_num = int(match.group(1))
        sector_num = int(match.group(2))
        zone_num = int(path.split("_")[0].replace("Zone", ""))
        return f"Zone{zone_num:03d}_Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None