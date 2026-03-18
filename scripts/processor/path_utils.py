"""
公共路径工具函数

提供统一的路径拼接逻辑，用于访问 libraries 目录下的 XML 文件。
"""

import os
from typing import Dict, Optional
from pathlib import Path

# Libraries XML 文件类型映射
# Key: 类型名称 (用于函数调用)
# Value: 目录名称 (实际文件路径中的目录名)
LIBRARY_FILES: Dict[str, str] = {
    "wares": "wares",
    "colors": "colors",
    "waregroups": "waregroups",
    "shipgroups": "shipgroups",
    "defaults": "defaults",
    "loadouts": "loadouts",
    "mapdefaults": "mapdefaults",
    "god": "god",
    "factions": "factions",
    "region_definitions": "region_definitions",
    "regionyields": "regionyields",
}


def get_library_xml(base_path: str, lib_type: str) -> str:
    """
    根据基础路径和类型拼接 XML 文件路径

    拼接逻辑：base_path + "libraries" + "{lib_type}" + "final.xml"

    Args:
        base_path: 原始数据根目录 (如 X4_UNPACKED_DATA_PATH 或 self.raw_path)
        lib_type: 库类型，如 "wares", "loadouts", "defaults" 等

    Returns:
        完整的 XML 文件路径

    示例:
        >>> get_library_xml("/data", "loadouts")
        '/data/libraries/loadouts/final.xml'
    """
    dir_name = LIBRARY_FILES.get(lib_type, lib_type)
    return os.path.join(base_path, "libraries", dir_name, "final.xml")


def build_paths(raw_assets_dir: str, folder_name: str) -> Dict[str, str]:
    """
    构建一组完整的路径配置

    Args:
        raw_assets_dir: 原始资源目录
        folder_name: 版本文件夹名
        processed_assets_dir: 处理后输出目录

    Returns:
        路径字典
    """
    base_path = os.path.join(raw_assets_dir, folder_name)

    return {
        "base": base_path,
        "mapdefaults": get_library_xml(base_path, "mapdefaults"),
        "god": get_library_xml(base_path, "god"),
        "factions": get_library_xml(base_path, "factions"),
        "colors": get_library_xml(base_path, "colors"),
        "region_definitions": get_library_xml(base_path, "region_definitions"),
        "regionyields": get_library_xml(base_path, "regionyields"),
        "wares": get_library_xml(base_path, "wares"),
        "waregroups": get_library_xml(base_path, "waregroups"),
        "shipgroups": get_library_xml(base_path, "shipgroups"),
        "defaults": get_library_xml(base_path, "defaults"),
        "loadouts": get_library_xml(base_path, "loadouts"),
    }


def build_output_paths(processed_assets_dir: str, folder_name: str) -> Dict[str, str]:
    """
    构建输出路径配置

    Args:
        processed_assets_dir: 处理后输出目录
        folder_name: 版本文件夹名

    Returns:
        输出路径字典
    """
    base_path = os.path.join(processed_assets_dir, folder_name)
    data_path = os.path.join(base_path, "data")

    return {
        "maps": os.path.join(data_path, "maps.json"),
        "factions": os.path.join(data_path, "factions.json"),
        "regions": os.path.join(data_path, "regions.json"),
        "regionyields": os.path.join(data_path, "regionyields.json"),
    }


def get_map_dir(raw_assets_dir: str, folder_name: str) -> str:
    """获取地图目录路径"""
    base_path = os.path.join(raw_assets_dir, folder_name)
    return os.path.join(base_path, "maps", "xu_ep2_universe")


def get_map_xml_path(map_dir: str, xml_type: str) -> str:
    """
    获取地图目录下的 XML 文件路径（final.xml 格式）

    Args:
        map_dir: 地图目录路径
        xml_type: 类型，如 "galaxy", "clusters", "sectors", "zones", "zonehighways", "sechighways"

    Returns:
        XML 文件路径，如：{map_dir}/galaxy/final.xml
    """
    return os.path.join(map_dir, xml_type, "final.xml")
