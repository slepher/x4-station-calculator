"""Map 处理器 - X4 Map Data Processor."""

import argparse
import sys
from pathlib import Path

# 添加 scripts 目录到 Python 路径
script_dir = Path(__file__).resolve().parent
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir))

from processor.config import apply_runtime_config, merge_version_config
from processor.versioning import load_version_config, get_target_versions
from processor.map.service import process_map_for_version


def run_for_config(args: argparse.Namespace, effective_config: dict) -> None:
    """运行指定配置的处理流程。"""
    apply_runtime_config(effective_config)

    from processor.config import X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR

    version_str = str(effective_config.get("version", ""))

    process_map_for_version(
        raw_assets_dir=X4_UNPACKED_DATA_PATH,
        processed_assets_dir=OUTPUT_VERSION_DIR,
        folder_name="",  # base_path 已经包含 folder_name
        version=version_str,
    )


def main() -> None:
    """CLI 入口点。"""
    _config = load_version_config()
    args = argparse.Namespace(
        all_versions=False,
        version=None,
        beta=False,
        stable=False,
        map_dir=None,
        mapdefaults_xml=None,
        god_xml=None,
        factions_xml=None,
        colors_xml=None,
        region_definitions_xml=None,
        regionobjectgroups_xml=None,
        regionyields_xml=None,
        factions_output=None,
        regions_output=None,
        regionyields_output=None,
        output=None,
    )

    # 解析命令行参数
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
    args = parser.parse_args()

    versions = get_target_versions(_config, args)
    for version_item in versions:
        print(f"处理版本：{version_item.get('version')}")
        effective_config = merge_version_config(_config, version_item)
        run_for_config(args, effective_config)


if __name__ == "__main__":
    main()
