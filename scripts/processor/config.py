"""运行时配置和路径管理 - X4 Map Data Processor."""

import argparse
import os
from pathlib import Path
from typing import Dict, Optional

from processor.versioning import load_version_config, merge_version_config

# 加载配置
_config = load_version_config()

# 全局路径变量
X4_UNPACKED_DATA_PATH = ""
OUTPUT_VERSION_DIR = ""
DEFAULT_MAP_DIR = ""
DEFAULT_OUTPUT = ""
DEFAULT_MAPDEFAULTS = ""
DEFAULT_GOD_XML = ""
DEFAULT_FACTIONS_XML = ""
DEFAULT_COLORS_XML = ""
DEFAULT_REGION_DEFINITIONS_XML = ""
DEFAULT_REGIONOBJECTGROUPS_XML = ""
DEFAULT_REGIONYIELDS_XML = ""
DEFAULT_FACTIONS_OUTPUT = ""
DEFAULT_REGIONS_OUTPUT = ""
DEFAULT_REGIONYIELDS_OUTPUT = ""
DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT = ""
DEFAULT_RESOURCEAREAS_OUTPUT = ""


def apply_runtime_config(effective_config: Dict[str, object]) -> None:
    """应用运行时配置到全局变量。"""
    global X4_UNPACKED_DATA_PATH
    global OUTPUT_VERSION_DIR
    global DEFAULT_MAP_DIR
    global DEFAULT_OUTPUT
    global DEFAULT_MAPDEFAULTS
    global DEFAULT_GOD_XML
    global DEFAULT_FACTIONS_XML
    global DEFAULT_COLORS_XML
    global DEFAULT_REGION_DEFINITIONS_XML
    global DEFAULT_REGIONOBJECTGROUPS_XML
    global DEFAULT_REGIONYIELDS_XML
    global DEFAULT_FACTIONS_OUTPUT
    global DEFAULT_REGIONS_OUTPUT
    global DEFAULT_REGIONYIELDS_OUTPUT
    global DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT
    global DEFAULT_RESOURCEAREAS_OUTPUT

    X4_UNPACKED_DATA_PATH = os.path.join(str(effective_config["raw_assets_dir"]), str(effective_config["folder_name"]))
    OUTPUT_VERSION_DIR = os.path.join(str(effective_config["processed_assets_dir"]), str(effective_config["folder_name"]))
    DEFAULT_MAP_DIR = str(Path(X4_UNPACKED_DATA_PATH) / "maps" / "xu_ep2_universe")
    DEFAULT_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "maps.json")
    DEFAULT_MAPDEFAULTS = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "mapdefaults_final.xml")
    DEFAULT_GOD_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "god_final.xml")
    DEFAULT_FACTIONS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "factions_final.xml")
    DEFAULT_COLORS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "colors_final.xml")
    DEFAULT_REGION_DEFINITIONS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "region_definitions_final.xml")
    DEFAULT_REGIONOBJECTGROUPS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "regionobjectgroups_final.xml")
    DEFAULT_REGIONYIELDS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "regionyields_final.xml")
    DEFAULT_FACTIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "factions.json")
    DEFAULT_REGIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regions.json")
    DEFAULT_REGIONYIELDS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regionyields.json")
    DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regionyield_definitions.json")
    DEFAULT_RESOURCEAREAS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "resourceareas.json")


def default_version_item(config: Dict[str, object]) -> Dict[str, object]:
    """获取默认版本配置项。"""
    current_version = config.get("current_version")
    current_beta = bool(config.get("beta", False))
    for version_item in config.get("versions", []):
        if str(version_item.get("version")) == str(current_version) and bool(version_item.get("beta", False)) == current_beta:
            return merge_version_config(config, version_item)
    raise SystemExit("未找到默认版本配置。")


def parse_args() -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="Extract and normalize X4 universe map data from distilled XML.")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--all-versions", action="store_true", help="处理配置中的所有版本")
    mode_group.add_argument("--version", type=str, help="处理指定版本号，例如 8.0 或 9.0")
    flavor_group = parser.add_mutually_exclusive_group()
    flavor_group.add_argument("--beta", action="store_true", help="选择 beta 版本")
    flavor_group.add_argument("--stable", action="store_true", help="选择 stable 版本")
    parser.add_argument("--map-dir")
    parser.add_argument("--mapdefaults-xml")
    parser.add_argument("--god-xml")
    parser.add_argument("--factions-xml")
    parser.add_argument("--colors-xml")
    parser.add_argument("--region-definitions-xml")
    parser.add_argument("--regionobjectgroups-xml")
    parser.add_argument("--regionyields-xml")
    parser.add_argument("--factions-output")
    parser.add_argument("--regions-output")
    parser.add_argument("--regionyields-output")
    parser.add_argument("--output")
    return parser.parse_args()


def resolve_runtime_paths(args: argparse.Namespace) -> dict:
    """解析运行时路径。"""
    return {
        "map_dir": Path(args.map_dir or DEFAULT_MAP_DIR),
        "output_path": Path(args.output or DEFAULT_OUTPUT),
        "mapdefaults_path": Path(args.mapdefaults_xml or DEFAULT_MAPDEFAULTS),
        "god_xml_path": Path(args.god_xml or DEFAULT_GOD_XML),
        "factions_xml_path": Path(args.factions_xml or DEFAULT_FACTIONS_XML),
        "colors_xml_path": Path(args.colors_xml or DEFAULT_COLORS_XML),
        "region_definitions_xml_path": Path(args.region_definitions_xml or DEFAULT_REGION_DEFINITIONS_XML),
        "regionobjectgroups_xml_path": Path(args.regionobjectgroups_xml or DEFAULT_REGIONOBJECTGROUPS_XML),
        "regionyields_xml_path": Path(args.regionyields_xml or DEFAULT_REGIONYIELDS_XML),
        "factions_output_path": Path(args.factions_output or DEFAULT_FACTIONS_OUTPUT),
        "regions_output_path": Path(args.regions_output or DEFAULT_REGIONS_OUTPUT),
        "regionyields_output_path": Path(args.regionyields_output or DEFAULT_REGIONYIELDS_OUTPUT),
        "regionyield_definitions_output_path": Path(DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT),
        "resourceareas_output_path": Path(DEFAULT_RESOURCEAREAS_OUTPUT),
    }
