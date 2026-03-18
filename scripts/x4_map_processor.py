"""Map 处理器 - X4 Map Data Processor."""

import argparse
import sys
from pathlib import Path
from typing import Dict

# 添加 scripts 目录到 Python 路径
script_dir = Path(__file__).resolve().parent
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir))

from processor.config import apply_runtime_config, merge_version_config
from processor.versioning import load_version_config, get_target_versions
from processor.i18n import get_i18n_registry
from processor.resource.model_detector import detect_map_resource_model
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
)
from processor.resource.legacy_processor import migrate_regionyields
from processor.map.generator import generate_map_data
from processor.map.writer import migrate_factions
from processor.output_manager import (
    write_regionyields,
    write_factions,
    write_regions,
    write_map,
    write_resourceareas,
    write_regionyield_definitions,
)


def run_for_config(args: argparse.Namespace, effective_config: Dict[str, object]) -> None:
    """运行指定配置的处理流程。"""
    apply_runtime_config(effective_config)

    # 构建运行时路径
    from processor.path_utils import get_map_dir, get_library_xml
    from processor.config import X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR

    base_path = X4_UNPACKED_DATA_PATH
    output_base = OUTPUT_VERSION_DIR

    map_dir = Path(args.map_dir) if args.map_dir else Path(get_map_dir(base_path, ""))
    output_path = Path(args.output) if args.output else Path(output_base) / "data" / "maps.json"
    mapdefaults_path = Path(args.mapdefaults_xml) if args.mapdefaults_xml else Path(get_library_xml(base_path, "mapdefaults"))
    god_xml_path = Path(args.god_xml) if args.god_xml else Path(get_library_xml(base_path, "god"))
    factions_xml_path = Path(args.factions_xml) if args.factions_xml else Path(get_library_xml(base_path, "factions"))
    colors_xml_path = Path(args.colors_xml) if args.colors_xml else Path(get_library_xml(base_path, "colors"))
    region_definitions_xml_path = Path(args.region_definitions_xml) if args.region_definitions_xml else Path(get_library_xml(base_path, "region_definitions"))
    regionobjectgroups_xml_path = Path(args.regionobjectgroups_xml) if args.regionobjectgroups_xml else Path(get_library_xml(base_path, "regionobjectgroups"))
    regionyields_xml_path = Path(args.regionyields_xml) if args.regionyields_xml else Path(get_library_xml(base_path, "regionyields"))
    factions_output_path = Path(args.factions_output) if args.factions_output else Path(output_base) / "data" / "factions.json"
    regions_output_path = Path(args.regions_output) if args.regions_output else Path(output_base) / "data" / "regions.json"
    regionyields_output_path = Path(args.regionyields_output) if args.regionyields_output else Path(output_base) / "data" / "regionyields.json"
    regionyield_definitions_output_path = Path(output_base) / "data" / "regionyield_definitions.json"
    resourceareas_output_path = Path(output_base) / "data" / "resourceareas.json"

    # 版本分流：根据版本号判定资源模型
    version_str = str(effective_config.get("version", ""))
    resource_model = detect_map_resource_model(version_str)
    print(f"📊 资源模型：{resource_model} (version={version_str})")

    registry = get_i18n_registry()
    registry.configure(X4_UNPACKED_DATA_PATH, {
        "044": {"iso": "en", "name": "English"},
    })

    factions_rows, factions_by_id = migrate_factions(
        factions_xml_path=factions_xml_path,
        colors_xml_path=colors_xml_path,
        i18n_registry=registry,
    )
    write_factions(factions_rows, factions_output_path)

    # 版本分流：根据资源模型选择不同的处理逻辑
    if resource_model == "resourceareas":
        # 9.0+ 新版资源模型
        definitions = migrate_resourcearea_definitions(regionyields_xml_path)
        print(f"📦 解析 resourcearea definitions: {len(definitions)} 个")

        sector_resource_areas = migrate_sector_resourceareas(mapdefaults_path)
        print(f"📦 解析 sector resourceareas: {len(sector_resource_areas)} 个 sector")

        definitions_list = list(definitions.values())
        write_regionyield_definitions(definitions_list, regionyield_definitions_output_path)
        print(f"📦 Regionyield Definitions Output: {regionyield_definitions_output_path}")

        # 9.0+ 不生成 regionyields，写入空数组
        write_regionyields([], regionyields_output_path)
        print(f"📦 Regionyields Output: {regionyields_output_path} (空数组占位)")

        result = generate_map_data(
            map_dir=map_dir,
            mapdefaults_path=mapdefaults_path,
            god_xml_path=god_xml_path,
            factions_by_id=factions_by_id,
            region_definitions_xml_path=region_definitions_xml_path,
            regionobjectgroups_xml_path=regionobjectgroups_xml_path,
            regionyields_xml_path=regionyields_xml_path,
            i18n_registry=registry,
            resource_model="resourceareas",
            sector_resource_areas=sector_resource_areas,
            definitions=definitions,
        )

        resourceareas_rows = result.get("resourceareas", [])
        write_resourceareas(resourceareas_rows, resourceareas_output_path)
        print(f"📦 Resourceareas Output: {resourceareas_output_path} count={len(resourceareas_rows)}")

        print(f"📦 Regions Output: 跳过 (9.0+ 不生成)")

    else:
        # 8.0- 旧版资源模型
        regionyields_rows = migrate_regionyields(regionyields_xml_path)
        write_regionyields(regionyields_rows, regionyields_output_path)
        print(f"📦 Regionyields Output: {regionyields_output_path} count={len(regionyields_rows)}")

        result = generate_map_data(
            map_dir=map_dir,
            mapdefaults_path=mapdefaults_path,
            god_xml_path=god_xml_path,
            factions_by_id=factions_by_id,
            region_definitions_xml_path=region_definitions_xml_path,
            regionobjectgroups_xml_path=regionobjectgroups_xml_path,
            regionyields_xml_path=regionyields_xml_path,
            i18n_registry=registry,
            resource_model="regions",
        )

        # 输出 maps.json
        payload = result.get("payload", {})
        write_map(payload, output_path)
        print(f"📦 Maps Output: {output_path}")

        # 输出 regions.json
        regions_rows = result.get("regions", [])
        write_regions(regions_rows, regions_output_path)
        print(f"📦 Regions Output: {regions_output_path} count={len(regions_rows)}")


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
