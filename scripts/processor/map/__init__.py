"""Map 处理器入口 - X4 Map Data Processor."""

import argparse
import json
from pathlib import Path
from typing import Dict

import processor.config as config
from processor.versioning import load_version_config, get_target_versions
from processor.i18n import get_i18n_registry
from processor.resource.model_detector import detect_map_resource_model
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
)
from processor.resource.legacy_processor import migrate_regionyields
from processor.map.generator import generate_map_data
from processor.map.writer import write_map_output, migrate_factions


def run_for_config(args: argparse.Namespace, effective_config: Dict[str, object]) -> None:
    """运行指定配置的处理流程。"""
    config.apply_runtime_config(effective_config)
    runtime_paths = config.resolve_runtime_paths(args)

    map_dir = runtime_paths["map_dir"]
    output_path = runtime_paths["output_path"]
    mapdefaults_path = runtime_paths["mapdefaults_path"]
    god_xml_path = runtime_paths["god_xml_path"]
    factions_xml_path = runtime_paths["factions_xml_path"]
    colors_xml_path = runtime_paths["colors_xml_path"]
    region_definitions_xml_path = runtime_paths["region_definitions_xml_path"]
    regionobjectgroups_xml_path = runtime_paths["regionobjectgroups_xml_path"]
    regionyields_xml_path = runtime_paths["regionyields_xml_path"]
    factions_output_path = runtime_paths["factions_output_path"]
    regions_output_path = runtime_paths["regions_output_path"]
    regionyields_output_path = runtime_paths["regionyields_output_path"]
    regionyield_definitions_output_path = runtime_paths["regionyield_definitions_output_path"]
    resourceareas_output_path = runtime_paths["resourceareas_output_path"]

    # 版本分流：根据版本号判定资源模型
    version_str = str(effective_config.get("version", ""))
    resource_model = detect_map_resource_model(version_str)
    print(f"📊 资源模型：{resource_model} (version={version_str})")

    registry = get_i18n_registry()
    registry.configure(config.X4_UNPACKED_DATA_PATH, {
        "044": {"iso": "en", "name": "English"},
    })

    factions_rows, factions_by_id = migrate_factions(
        factions_xml_path=factions_xml_path,
        colors_xml_path=colors_xml_path,
        i18n_registry=registry,
    )
    factions_output_path.parent.mkdir(parents=True, exist_ok=True)
    factions_output_path.write_text(json.dumps(factions_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    # 版本分流：根据资源模型选择不同的处理逻辑
    if resource_model == "resourceareas":
        # 9.0+ 新版资源模型
        definitions = migrate_resourcearea_definitions(regionyields_xml_path)
        print(f"📦 解析 resourcearea definitions: {len(definitions)} 个")

        sector_resource_areas = migrate_sector_resourceareas(mapdefaults_path)
        print(f"📦 解析 sector resourceareas: {len(sector_resource_areas)} 个 sector")

        definitions_list = list(definitions.values())
        regionyield_definitions_output_path.parent.mkdir(parents=True, exist_ok=True)
        regionyield_definitions_output_path.write_text(
            json.dumps(definitions_list, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"📦 Regionyield Definitions Output: {regionyield_definitions_output_path}")

        regionyields_output_path.parent.mkdir(parents=True, exist_ok=True)
        regionyields_output_path.write_text("[]", encoding="utf-8")
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
        resourceareas_output_path.parent.mkdir(parents=True, exist_ok=True)
        resourceareas_output_path.write_text(
            json.dumps(resourceareas_rows, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"📦 Resourceareas Output: {resourceareas_output_path} count={len(resourceareas_rows)}")

        print(f"📦 Regions Output: 跳过 (9.0+ 不生成)")

    else:
        # 8.0- 旧版资源模型
        regionyields_rows = migrate_regionyields(regionyields_xml_path)
        regionyields_output_path.parent.mkdir(parents=True, exist_ok=True)
        regionyields_output_path.write_text(json.dumps(regionyields_rows, ensure_ascii=False, indent=2), encoding="utf-8")
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
        write_map_output(payload, output_path)
        print(f"📦 Maps Output: {output_path}")

        # 输出 regions.json
        regions_rows = result.get("regions", [])
        regions_output_path.parent.mkdir(parents=True, exist_ok=True)
        regions_output_path.write_text(json.dumps(regions_rows, ensure_ascii=False, indent=2), encoding="utf-8")
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
        effective_config = config.merge_version_config(_config, version_item)
        run_for_config(args, effective_config)


if __name__ == "__main__":
    import sys
    # 添加 scripts 目录到 Python 路径以支持直接运行
    script_dir = Path(__file__).resolve().parent.parent.parent
    if str(script_dir) not in sys.path:
        sys.path.insert(0, str(script_dir))
    main()
