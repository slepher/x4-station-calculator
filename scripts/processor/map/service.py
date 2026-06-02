"""Map 数据处理服务 - X4 Map Data Processor.

提供统一的 Map 数据处理服务，根据版本号自动选择资源模型并执行对应的处理流程。
"""

import json
from pathlib import Path
from typing import Dict, Optional, Any, Set

from processor.i18n import get_i18n_registry, I18nRegistry
from processor.path_utils import get_map_dir, get_library_xml
from processor.versioning import load_version_config
from processor.resource.model_detector import detect_map_resource_model
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
)
from processor.resource.legacy_processor import migrate_regionyields
from processor.map.generator import generate_map_data
import importlib as _imp
_mig = _imp.import_module("scripts.x4-game.factions.converter")
migrate_factions = _mig.migrate_factions
from processor.output_manager import (
    write_regionyields,
    write_factions,
    write_regions,
    write_map,
    write_regionyield_definitions,
)


def write_map_output(payload: dict, output_path: Path) -> None:
    """写入地图输出文件。"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def process_map_for_version(
    raw_assets_dir: str,
    processed_assets_dir: str,
    folder_name: str,
    version: str,
    i18n_registry: Optional[I18nRegistry] = None,
) -> Dict[str, Any]:
    """
    根据版本号处理 Map 数据。

    自动检测资源模型（regions vs resourceareas），构建 XML 路径，执行对应的处理流程。

    Args:
        raw_assets_dir: 原始资源目录（如 X4_UNPACKED_DATA_PATH）
        processed_assets_dir: 处理后输出目录
        folder_name: 版本文件夹名（如 "8.0-Diplomacy"）
        version: 版本号（如 "8.0", "9.0"）
        i18n_registry: 可选的共享 registry 实例，不传则创建新的（仅 English）

    Returns:
        处理结果统计信息，包含 name_ids 集合
    """
    # 构建基础路径
    base_path = raw_assets_dir
    output_base = processed_assets_dir

    # 构建 XML 输入路径
    map_dir = Path(get_map_dir(base_path, ""))
    mapdefaults_path = Path(get_library_xml(base_path, "mapdefaults"))
    god_xml_path = Path(get_library_xml(base_path, "god"))
    factions_xml_path = Path(get_library_xml(base_path, "factions"))
    colors_xml_path = Path(get_library_xml(base_path, "colors"))
    region_definitions_xml_path = Path(get_library_xml(base_path, "region_definitions"))
    regionobjectgroups_xml_path = Path(get_library_xml(base_path, "regionobjectgroups"))
    regionyields_xml_path = Path(get_library_xml(base_path, "regionyields"))

    # 构建 JSON 输出路径
    factions_output_path = Path(output_base) / "data" / "factions.json"
    regions_output_path = Path(output_base) / "data" / "regions.json"
    regionyields_output_path = Path(output_base) / "data" / "regionyields.json"
    regionyield_definitions_output_path = Path(output_base) / "data" / "regionyield_definitions.json"
    resourceareas_output_path = Path(output_base) / "data" / "resourceareas.json"
    maps_output_path = Path(output_base) / "data" / "maps.json"

    # 检测资源模型
    resource_model = detect_map_resource_model(version)
    print(f"📊 资源模型：{resource_model} (version={version})")

    # 配置国际化 - 使用共享实例或创建新的
    use_shared = i18n_registry is not None
    registry = i18n_registry if use_shared else get_i18n_registry()
    dlc_order = load_version_config().get("dlc_order", [])

    if not use_shared:
        # 仅在创建新 registry 时配置（x4_map_processor.py 场景）
        registry.configure(raw_assets_dir, {"044": {"iso": "en", "name": "English"}})

    # 处理 factions
    factions_rows, factions_by_id = migrate_factions(
        factions_xml_path=factions_xml_path,
        colors_xml_path=colors_xml_path,
    )
    write_factions(factions_rows, factions_output_path)

    # 根据资源模型选择处理逻辑
    if resource_model == "resourceareas":
        # 9.0+ 新版资源模型
        definitions = migrate_resourcearea_definitions(regionyields_xml_path)
        print(f"📦 解析 resourcearea definitions: {len(definitions)} 个")

        sector_resource_areas = migrate_sector_resourceareas(mapdefaults_path)
        print(f"📦 解析 sector resourceareas: {len(sector_resource_areas)} 个 sector")

        definitions_list = list(definitions.values())
        write_regionyield_definitions(definitions_list, regionyield_definitions_output_path)
        print(f"📦 Regionyield Definitions Output: {regionyield_definitions_output_path}")

        # 9.0+ 不生成 regionyields.json 文件
        print(f"📦 Regionyields Output: 跳过 (9.0+ 不生成该文件)")

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
            dlc_order=dlc_order,
        )

        resourceareas_rows = result.get("resourceareas", [])
        # Step 1 不再输出 resourceareas.json，由 Step 2 生成
        print(f"📦 Resourceareas Output: 跳过 (由 Step 2 生成)")
        print(f"📦 Regions Output: 跳过 (9.0+ 不生成)")

        # 输出 maps.json
        payload = result.get("payload", {})
        write_map(payload, maps_output_path)
        print(f"📦 Maps Output: {maps_output_path}")

        # 收集 nameId
        map_name_ids = set(result.get("name_ids", []))
        missing = result.get("missing_name_ids", {})
        ties = result.get("owner_resolution_ties", [])

        print(f"   ✅ map nameId merged: {len(map_name_ids)}")
        print(f"   ℹ️ owner resolution ties: {len(ties)}")
        print(f"   ℹ️ map missing cluster nameId: {len(missing.get('clusters', []))}")
        print(f"   ℹ️ map missing sector nameId: {len(missing.get('sectors', []))}")

        return {
            "resource_model": "resourceareas",
            "resourceareas_count": len(resourceareas_rows),
            "factions_count": len(factions_rows),
            "name_ids": map_name_ids,
        }

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
            dlc_order=dlc_order,
        )

        # 输出 regions.json
        regions_rows = result.get("regions", [])
        write_regions(regions_rows, regions_output_path)
        print(f"📦 Regions Output: {regions_output_path} count={len(regions_rows)}")

        # Step 1 不再输出 resourceareas.json，由 Step 2 生成
        resourceareas_rows = result.get("resourceareas", [])
        print(f"📦 Resourceareas Output: 跳过 (由 Step 2 生成)")

        print(f"📦 Regionyields Output: {regionyields_output_path} ({len(regionyields_rows)})")

    # 分支后处理：输出 maps.json 并收集 nameId（8.0 和 9.0 共有）
    payload = result.get("payload", {})
    write_map(payload, maps_output_path)
    print(f"📦 Maps Output: {maps_output_path}")

    # 收集 nameId
    map_name_ids = set(result.get("name_ids", []))
    missing = result.get("missing_name_ids", {})
    ties = result.get("owner_resolution_ties", [])

    print(f"   ✅ map nameId merged: {len(map_name_ids)}")
    print(f"   ℹ️ owner resolution ties: {len(ties)}")
    print(f"   ℹ️ map missing cluster nameId: {len(missing.get('clusters', []))}")
    print(f"   ℹ️ map missing sector nameId: {len(missing.get('sectors', []))}")

    return {
        "resource_model": resource_model,
        "resourceareas_count": len(result.get("resourceareas", [])),
        "regions_count": len(result.get("regions", [])),
        "regionyields_count": len(result.get("regionyields", [])),
        "factions_count": len(factions_rows),
        "name_ids": map_name_ids,
    }
