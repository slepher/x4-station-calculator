"""Step 2 Resource 服务入口 - X4 Map Data Processor.

提供资源计算的统一入口，协调：
- 8.0 版本：估算算法 → 逐格算法
- 9.0+ 版本：直接引用 definition
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

# 固定输出目录（analysis 硬编码除外）
ANALYSIS_RESOURCES_DIR = Path("analysis/resources")

from processor.path_utils import build_output_paths
from processor.shared.utils.math_utils import round_to_int, round_significant
from processor.step2_resource.model_detector import detect_map_resource_model
from processor.step2_resource.shared import (
    aggregate_sector_resources_from_resourceareas,
    calculate_falloff_factors,
    calculate_rating,
)
from processor.step2_resource.estimator import (
    is_gas_ware,
    estimate_solid_yield,
    estimate_gas_yield,
    calculate_solid_volume_km3,
    calculate_gas_volume_km3,
)
from processor.step2_resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
    load_regionyield_definitions_from_json,
    extract_sector_regions_from_maps_data,
    build_sector_resource_summaries_from_resourceareas,
    build_resourceareas_json_payload,
)
from processor.step2_resource.save_replay import calculate_save_resources_all
from processor.shared.output_manager import write_map_resources


def _iter_maps_sectors(maps_data: dict):
    """统一遍历 maps.json 中的 sector 数据。

    兼容两种结构：
    - 新结构：顶层 maps_data["sectors"] = {sector_id: sector_data}
    - 旧结构：maps_data["clusters"][...]["sectors"] = {sector_id: sector_data}
    """
    sectors = maps_data.get("sectors", {})
    if isinstance(sectors, dict):
        return sectors.items()

    collected: Dict[str, dict] = {}
    clusters = maps_data.get("clusters", {})
    if not isinstance(clusters, dict):
        return collected.items()

    for cluster_data in clusters.values():
        if not isinstance(cluster_data, dict):
            continue
        cluster_sectors = cluster_data.get("sectors", {})
        if not isinstance(cluster_sectors, dict):
            continue
        for sector_macro, sector in cluster_sectors.items():
            if isinstance(sector, dict):
                collected[sector_macro] = sector

    return collected.items()


def _normalize_sector_id(sector_id: str) -> str:
    """统一 sector_id 比较键。"""
    return sector_id.lower() if isinstance(sector_id, str) else ""


def _has_any_sector_regions(sector_resource_areas: Dict[str, List[dict]]) -> bool:
    """判断是否存在至少一个带引用的 sector.regions 集合。"""
    for areas in sector_resource_areas.values():
        if areas:
            return True
    return False


def _iter_sector_ids(maps_data: dict) -> List[str]:
    """提取 maps.json 中全部 sector id。"""
    sector_ids: List[str] = []
    for sector_macro, sector in _iter_maps_sectors(maps_data):
        if isinstance(sector, dict):
            sector_ids.append(str(sector.get("id", sector_macro)))
    return sector_ids


def _build_map_resources_payload(
    version: str,
    resource_model: str,
    sector_ids: List[str],
    sector_regions: Dict[str, List[dict]],
    sector_resources: Dict[str, List[dict]],
    areas_by_sector: Dict[str, List[dict]],
    regionyield_definitions: Optional[List[dict]] = None,
) -> dict:
    """组装统一的 map_resources.json 结构。"""
    normalized_sector_ids = sorted({_normalize_sector_id(sector_id) for sector_id in sector_ids if sector_id})
    sectors_payload: Dict[str, dict] = {}

    for sector_id in normalized_sector_ids:
        sectors_payload[sector_id] = {
            "regions": sector_regions.get(sector_id, []),
            "resources": sector_resources.get(sector_id, []),
            "areas": areas_by_sector.get(sector_id, []),
        }

    for sector_id, areas in areas_by_sector.items():
        sector_id_normalized = _normalize_sector_id(sector_id)
        sectors_payload.setdefault(sector_id_normalized, {
            "regions": sector_regions.get(sector_id_normalized, []),
            "resources": sector_resources.get(sector_id_normalized, []),
            "areas": [],
        })
        sectors_payload[sector_id_normalized]["areas"] = areas

    return {
        "version": version,
        "resource_model": resource_model,
        "sectors": sectors_payload,
        "regionyield_definitions": regionyield_definitions or [],
    }


def _load_grouped_resourceareas(path: Path) -> Dict[str, List[dict]]:
    """读取 resourceareas.json，兼容 list/dict 两种旧格式。"""
    if not path.exists():
        return {}

    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    if isinstance(payload, dict):
        if "sectors" in payload and isinstance(payload.get("sectors"), dict):
            grouped = {}
            for sector_id, sector_payload in payload["sectors"].items():
                if isinstance(sector_payload, dict):
                    grouped[_normalize_sector_id(sector_id)] = sector_payload.get("areas", [])
            return grouped

        if "regions" not in payload:
            return {
                _normalize_sector_id(sector_id): areas
                for sector_id, areas in payload.items()
                if isinstance(areas, list)
            }

    grouped: Dict[str, List[dict]] = {}
    if isinstance(payload, list):
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            sector_id = _normalize_sector_id(entry.get("sector_id", ""))
            if not sector_id:
                continue
            grouped[sector_id] = entry.get("areas", [])
    return grouped


def _build_sector_regions_from_grouped_resourceareas(
    grouped_resourceareas: Dict[str, List[dict]]
) -> Dict[str, List[dict]]:
    """从 grouped resourceareas 反推 sector.regions 结构。"""
    sector_regions: Dict[str, List[dict]] = {}
    for sector_id, areas in grouped_resourceareas.items():
        sector_regions[_normalize_sector_id(sector_id)] = [
            {
                "ref": area.get("ref", ""),
                "amount": area.get("amount", 1),
                "position": area.get("position", {}),
            }
            for area in areas
            if isinstance(area, dict) and area.get("ref")
        ]
    return sector_regions


def process_resources_for_version(
    version: str,
    maps_json_path: Path,
    regionyields_xml_path: Optional[Path] = None,
    mapdefaults_xml_path: Optional[Path] = None,
    regions_json_path: Optional[Path] = None,
    sector_id: Optional[str] = None,
    force_recalc_per_block: bool = False,
    save_sample_dir: Optional[Path] = None,
) -> Dict[str, object]:
    """根据版本处理资源计算。

    输出目录自动从输入路径推断：
    - resourceareas.json、maps.json（更新）→ maps_json_path 所在目录
    - resourcearea_blocks.json → 固定 analysis/resources/

    Args:
        version: 游戏版本号（如 "8.0", "9.0"）
        maps_json_path: maps.json 文件路径（输出目录由此推断）
        regionyields_xml_path: regionyields_final.xml 路径（9.0+ 需要）
        mapdefaults_xml_path: mapdefaults_final.xml 路径（9.0+ 需要）
        regions_json_path: regions.json 路径（8.0 版本需要）
        sector_id: 可选，仅处理指定 sector
        force_recalc_per_block: 强制重新计算逐格数据（默认从已有文件读取）

    Returns:
        处理结果摘要
    """
    resource_model = detect_map_resource_model(version)
    output_dir = maps_json_path.parent  # 输出到 maps.json 所在目录

    if resource_model == "resourceareas":
        return _process_90plus_resources(
            regionyields_xml_path=regionyields_xml_path,
            mapdefaults_xml_path=mapdefaults_xml_path,
            maps_json_path=maps_json_path,
            output_dir=output_dir,
            sector_id=sector_id,
        )
    else:
        return _process_80_resources(
            regions_json_path=regions_json_path,
            maps_json_path=maps_json_path,
            output_dir=output_dir,
            sector_id=sector_id,
            force_recalc_per_block=force_recalc_per_block,
            save_sample_dir=save_sample_dir,
        )


def _calculate_blocks_for_resourceareas(
    resourceareas: List[dict],
    regions_json_path: Path,
    sector_id: Optional[str] = None,
) -> Dict[tuple, dict]:
    """计算 resourcearea 的逐格数据。

    Args:
        resourceareas: resourceareas 数据列表
        regions_json_path: regions.json 文件路径
        sector_id: 可选，仅处理指定 sector

    Returns:
        计算结果，格式：{(sector_id, ref): {"ref": ..., "sector_id": ..., "total": {}, "tiles": {}}}
    """
    from processor.step2_resource.per_block_bridge import calculate_resource_per_block

    blocks_output: Dict[tuple, dict] = {}

    # 加载 regions.json
    if not regions_json_path.exists():
        return blocks_output

    with regions_json_path.open("r", encoding="utf-8") as f:
        regions_data = json.load(f)
    regions_by_id = {r.get("id"): r for r in regions_data if isinstance(r, dict)}

    for entry in resourceareas:
        sector_id_val = entry.get("sector_id", "")

        # 过滤指定 sector
        if sector_id and sector_id_val.lower() != sector_id.lower():
            continue

        areas = entry.get("areas", [])
        for area in areas:
            ref = area.get("ref", "")
            region_json = regions_by_id.get(ref, {})
            if not region_json:
                continue

            resources = area.get("resources", [])
            for res in resources:
                ware = res.get("ware", "")
                resourcedensity = res.get("resourcedensity", 1.0)

                result = calculate_resource_per_block(
                    sector_id=sector_id_val,
                    field_ref=ref,
                    area_data=area,
                    region_json=region_json,
                    ware=ware,
                    resourcedensity=resourcedensity,
                )

                # 使用 (sector_id, ref) 作为复合主键
                cache_key = (sector_id_val, ref)
                if cache_key not in blocks_output:
                    blocks_output[cache_key] = {
                        "ref": ref,
                        "sector_id": sector_id_val,
                        "total": {},
                        "tiles": {},
                    }

                # 处理每个 tile 的数据
                for tile in result.get("per_tile", []):
                    world_coord = tile.get("world_coord", (0, 0, 0))
                    tile_x, tile_y, tile_z = world_coord
                    tile_key = f"{tile_x}_{tile_y}_{tile_z}"

                    # 初始化 tile（如果不存在）
                    if tile_key not in blocks_output[cache_key]["tiles"]:
                        blocks_output[cache_key]["tiles"][tile_key] = {
                            "x": tile_x,
                            "y": tile_y,
                            "z": tile_z,
                            "wares": {},
                        }

                    # 累加该 ware 的值到 tile
                    # 固体资源：fields 列表中查找
                    if "fields" in tile:
                        for field_result in tile.get("fields", []):
                            if field_result.get("ware") == ware:
                                area_value = field_result.get("area_value", 0)
                                blocks_output[cache_key]["tiles"][tile_key]["wares"][ware] = \
                                    blocks_output[cache_key]["tiles"][tile_key]["wares"].get(ware, 0) + area_value
                                # 同时累加到 total
                                blocks_output[cache_key]["total"][ware] = \
                                    blocks_output[cache_key]["total"].get(ware, 0) + area_value
                    # 气体资源：直接用 ware 名作为 key
                    elif ware in tile:
                        area_value = tile.get(ware, 0)
                        if area_value > 0:
                            blocks_output[cache_key]["tiles"][tile_key]["wares"][ware] = \
                                blocks_output[cache_key]["tiles"][tile_key]["wares"].get(ware, 0) + area_value
                            # 同时累加到 total
                            blocks_output[cache_key]["total"][ware] = \
                                blocks_output[cache_key]["total"].get(ware, 0) + area_value

    return blocks_output


def _write_resourcearea_blocks(
    blocks_data: Dict[tuple, dict],
    sector_id: Optional[str] = None,
) -> Optional[Path]:
    """写入 resourcearea_blocks.json 到 analysis/resources/。

    新格式: {<sector_id>: [{ref, total, tiles}, ...]}

    Args:
        blocks_data: 计算结果，格式：{(sector_id, ref): {...}}
        sector_id: 可选，仅输出指定 sector

    Returns:
        输出文件路径
    """
    if not blocks_data:
        return None

    ANALYSIS_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    blocks_path = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"

    # 加载已有数据（如果存在）
    # 新格式: {<sector_id>: [{ref, total, tiles}, ...]}
    existing_data: Dict[str, List[dict]] = {}
    if blocks_path.exists():
        try:
            with blocks_path.open("r", encoding="utf-8") as f:
                file_data = json.load(f)
            # 处理新格式（对象）或旧格式（数组）
            if isinstance(file_data, dict):
                # 检查是旧格式 {regions: [...]} 还是新格式 {<sector_id>: [...]}
                if "regions" in file_data:
                    # 旧格式
                    for region in file_data.get("regions", []):
                        sid = region.get("sector_id", "")
                        if sid:
                            if sid not in existing_data:
                                existing_data[sid] = []
                            existing_data[sid].append({
                                "ref": region.get("ref", ""),
                                "total": region.get("total", {}),
                                "tiles": region.get("tiles", []),
                            })
                else:
                    # 新格式
                    existing_data = file_data
        except Exception:
            existing_data = {}

    # 如果指定了 sector，只删除该 sector 的数据
    if sector_id:
        sector_id_lower = sector_id.lower()
        existing_data = {
            sid: regions for sid, regions in existing_data.items()
            if sid.lower() != sector_id_lower
        }

    # 将新数据按 sector_id 分组
    new_data: Dict[str, List[dict]] = {}
    for (sid, ref), region_data in blocks_data.items():
        if sid:
            if sid not in new_data:
                new_data[sid] = []
            new_data[sid].append({
                "ref": ref,
                "total": region_data["total"],
                "tiles": list(region_data["tiles"].values()),
            })

    # 合并新旧数据
    for sid, regions in new_data.items():
        existing_data[sid] = regions

    # 写入文件
    with blocks_path.open("w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2)

    return blocks_path


def _extract_ware_from_field_name(field_name: str) -> str:
    """从 field name 提取 ware 名称。

    asteroid_ore_l -> ore
    asteroid_silicon_m -> silicon
    """
    parts = field_name.split("_")
    if len(parts) >= 2:
        return parts[1]
    return field_name


def _process_90plus_resources(
    regionyields_xml_path: Optional[Path],
    mapdefaults_xml_path: Optional[Path],
    maps_json_path: Path,
    output_dir: Path,
    sector_id: Optional[str],
) -> Dict[str, object]:
    """处理 9.0+ 版本资源并输出 map_resources.json。"""
    regionyield_definitions_path = output_dir / "regionyield_definitions.json"
    map_resources_path = output_dir / "map_resources.json"

    if not regionyield_definitions_path.exists():
        return {"status": "error", "message": f"Missing {regionyield_definitions_path}"}

    if not maps_json_path.exists():
        return {"status": "error", "message": f"Missing {maps_json_path}"}

    # 1. 从 JSON 加载 definitions
    definitions = load_regionyield_definitions_from_json(regionyield_definitions_path)

    # 2. 加载 maps.json（单次读取，同时提取 regions 和更新 resources）
    with maps_json_path.open("r", encoding="utf-8") as f:
        maps_data = json.load(f)

    sector_ids = _iter_sector_ids(maps_data)

    # 3. 从 maps_data 提取 sector.regions
    sector_resource_areas = extract_sector_regions_from_maps_data(maps_data)

    # 4. 发现旧空文件时，回退到原始 XML 重建 9.0 数据
    if not definitions:
        if regionyields_xml_path is None:
            return {"status": "error", "message": f"Empty {regionyield_definitions_path} and missing regionyields XML"}
        definitions = migrate_resourcearea_definitions(regionyields_xml_path)
        with regionyield_definitions_path.open("w", encoding="utf-8") as f:
            json.dump(list(definitions.values()), f, indent=2)

    if not _has_any_sector_regions(sector_resource_areas):
        if mapdefaults_xml_path is None:
            return {"status": "error", "message": f"maps.json has empty sector.regions and missing mapdefaults XML"}
        sector_resource_areas = migrate_sector_resourceareas(mapdefaults_xml_path)

    # 5. 过滤指定 sector
    if sector_id:
        sector_id_lower = _normalize_sector_id(sector_id)
        sector_ids = [
            current_sector_id
            for current_sector_id in sector_ids
            if _normalize_sector_id(current_sector_id) == sector_id_lower
        ]
        sector_resource_areas = {
            k: v for k, v in sector_resource_areas.items()
            if _normalize_sector_id(k) == sector_id_lower
        }

    # 6. 构建 resourceareas.json
    resourceareas = build_resourceareas_json_payload(
        sector_resource_areas,
        definitions,
    )

    # 7. 聚合 sector.resources
    sector_summaries = build_sector_resource_summaries_from_resourceareas(
        sector_resource_areas,
        definitions,
    )

    # 8. 写入输出文件
    output_dir.mkdir(parents=True, exist_ok=True)

    resourceareas_path = output_dir / "resourceareas.json"
    with resourceareas_path.open("w", encoding="utf-8") as f:
        json.dump(resourceareas, f, indent=2)

    grouped_areas = {
        _normalize_sector_id(entry.get("sector_id", "")): entry.get("areas", [])
        for entry in resourceareas
        if isinstance(entry, dict) and entry.get("sector_id")
    }
    normalized_sector_regions = {
        _normalize_sector_id(current_sector_id): areas
        for current_sector_id, areas in sector_resource_areas.items()
    }
    normalized_sector_resources = {
        _normalize_sector_id(current_sector_id): resources
        for current_sector_id, resources in sector_summaries.items()
    }
    definitions_payload = list(definitions.values())
    map_resources_payload = _build_map_resources_payload(
        version="9.0",
        resource_model="resourceareas",
        sector_ids=sector_ids,
        sector_regions=normalized_sector_regions,
        sector_resources=normalized_sector_resources,
        areas_by_sector=grouped_areas,
        regionyield_definitions=definitions_payload,
    )
    write_map_resources(map_resources_payload, str(map_resources_path))

    return {
        "status": "success",
        "resource_model": "resourceareas",
        "sectors_processed": len(sector_resource_areas),
        "definitions_count": len(definitions),
        "output_files": [
            str(resourceareas_path),
            str(map_resources_path),
        ],
    }


def _process_80_resources(
    regions_json_path: Optional[Path],
    maps_json_path: Path,
    output_dir: Path,
    sector_id: Optional[str],
    force_recalc_per_block: bool = False,
    save_sample_dir: Optional[Path] = None,
) -> Dict[str, object]:
    """处理 8.0 版本资源。

    8.0 版本需要：
    1. 估算算法：计算理论储量
    2. 逐格算法：计算精确储量（默认从已有文件读取，除非强制重新计算）
    3. 存档数据：提取真实 reserve/respawn（如果提供 save_sample_dir）
    """
    if regions_json_path is None:
        return {"status": "error", "message": "Missing regions.json path for 8.0 processing"}

    # 读取 regions.json
    with regions_json_path.open("r", encoding="utf-8") as f:
        regions_data = json.load(f)

    # 读取 maps.json
    with maps_json_path.open("r", encoding="utf-8") as f:
        maps_data = json.load(f)

    map_resources_path = output_dir / "map_resources.json"
    resourceareas_path = output_dir / "resourceareas.json"
    grouped_resourceareas_input = _load_grouped_resourceareas(resourceareas_path)

    # 索引 regions
    regions_by_id = {r.get("id"): r for r in regions_data if isinstance(r, dict)}

    # 尝试加载已有的 resourcearea_blocks.json（新格式：{<sector_id>: [{ref, total, tiles}, ...]}）
    # 使用 (sector_id, ref) 作为复合主键，避免不同 sector 共享同一个 ref 导致覆盖
    blocks_cache: Dict[tuple, dict] = {}
    blocks_file = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"
    if not force_recalc_per_block and blocks_file.exists():
        try:
            with blocks_file.open("r", encoding="utf-8") as f:
                blocks_data = json.load(f)
            # 新格式：{<sector_id>: [{ref, total, tiles}, ...]}
            if isinstance(blocks_data, dict):
                # 检查是新格式还是旧格式
                if "regions" not in blocks_data:
                    # 新格式：按 sector_id 分组
                    for sid, regions in blocks_data.items():
                        sid_normalized = _normalize_sector_id(sid)
                        for entry in regions:
                            ref = entry.get("ref", "")
                            if ref:
                                entry_with_sid = dict(entry)
                                entry_with_sid["sector_id"] = sid_normalized
                                blocks_cache[(sid_normalized, ref)] = entry_with_sid
                else:
                    # 旧格式：{regions: [...]}
                    for entry in blocks_data.get("regions", []):
                        ref = entry.get("ref", "")
                        sid = _normalize_sector_id(entry.get("sector_id", ""))
                        if ref:
                            blocks_cache[(sid, ref)] = entry
        except Exception:
            blocks_cache = {}

    sector_ids = _iter_sector_ids(maps_data)
    if sector_id:
        sector_id_lower = _normalize_sector_id(sector_id)
        sector_ids = [
            current_sector_id
            for current_sector_id in sector_ids
            if _normalize_sector_id(current_sector_id) == sector_id_lower
        ]

    sector_regions_from_maps: Dict[str, List[dict]] = {}

    # 处理每个 sector
    resourceareas_rows: List[dict] = []
    has_regions_from_maps = False

    for sector_macro, sector in _iter_maps_sectors(maps_data):
        if not isinstance(sector, dict):
            continue

        current_sector_id = sector.get("id", sector_macro)

        # 过滤指定 sector
        if sector_id and current_sector_id.lower() != sector_id.lower():
            continue

        cluster_id = sector.get("cluster_id", "")
        sector_regions = sector.get("regions", [])
        sector_regions_from_maps[_normalize_sector_id(current_sector_id)] = sector_regions

        for region_ref in sector_regions:
            has_regions_from_maps = True
            ref = region_ref.get("ref", "")
            amount = region_ref.get("amount", 1)
            position = region_ref.get("position", {})

            region_template = regions_by_id.get(ref, {})
            # 使用 regions.json 中的 boundary（包含完整的 spline 数据）
            boundary = region_template.get("boundary", {})
            resources = region_template.get("resources", [])
            falloff = region_template.get("falloff", {})

            # 计算 falloff 因子
            lateral_factor, radial_factor, falloff_factor = calculate_falloff_factors(falloff)

            # 计算体积
            solid_volume_km3 = 0.0
            gas_volume_km3 = 0.0

            # 计算每个资源的储量
            calculated_resources: List[dict] = []

            for res in resources:
                ware = res.get("ware", "")
                resourcedensity = res.get("resourcedensity", 1.0)
                delay = res.get("delay", 60.0)
                gatherfactor = res.get("gatherfactor", 1.0)
                yield_name = res.get("yield_name", "")

                if is_gas_ware(ware):
                    # 气体资源
                    _, gas_volume_km3 = calculate_gas_volume_km3(
                        region_pos=position,
                        boundary=boundary,
                    )
                    theoretical_reserve, theoretical_respawn = estimate_gas_yield(
                        region_pos=position,
                        boundary=boundary,
                        falloff_factor=falloff_factor,
                        resourcedensity=resourcedensity,
                        replenishtime=delay,
                    )
                else:
                    # 固体资源
                    solid_volume_km3 = calculate_solid_volume_km3(boundary=boundary)
                    theoretical_reserve, theoretical_respawn = estimate_solid_yield(
                        boundary=boundary,
                        falloff_factor=falloff_factor,
                        resourcedensity=resourcedensity,
                        replenishtime=delay,
                    )

                resource_entry = {
                    "ware": ware,
                    "resourcedensity": resourcedensity,
                    "theoretical_reserve": round_to_int(theoretical_reserve),
                    "theoretical_respawn": round_to_int(theoretical_respawn),
                    "delay": delay,
                    "gatherfactor": gatherfactor,
                }
                if yield_name:
                    resource_entry["yield_name"] = yield_name
                calculated_resources.append(resource_entry)

            # 构建 area 数据
            area_data = {
                "ref": ref,
                "amount": amount,
                "position": position,
                "boundary": boundary,
                "lateral_factor": round_significant(lateral_factor),
                "radial_factor": round_significant(radial_factor),
                "falloff_factor": round_significant(falloff_factor),
            }
            # 添加体积字段（仅当有值时）
            if solid_volume_km3 > 0:
                area_data["solid_volume_km3"] = round_to_int(solid_volume_km3)
            if gas_volume_km3 > 0:
                area_data["gas_volume_km3"] = round_to_int(gas_volume_km3)
            area_data["resources"] = calculated_resources

            resourceareas_rows.append({
                "cluster_id": cluster_id,
                "sector_id": current_sector_id,
                **area_data,
            })

    if not has_regions_from_maps:
        for grouped_sector_id, areas in grouped_resourceareas_input.items():
            if sector_id and grouped_sector_id != _normalize_sector_id(sector_id):
                continue
            for area in areas:
                if not isinstance(area, dict):
                    continue
                resourceareas_rows.append({
                    "sector_id": grouped_sector_id,
                    **area,
                })

    # 聚合 sector.resources
    sector_resources = aggregate_sector_resources_from_resourceareas(resourceareas_rows)

    # 二阶段：逐格计算，更新 reserve/respawn
    # 默认从已有文件读取，除非强制重新计算或文件不存在
    # 使用 (sector_id, ref) 作为复合主键
    blocks_output: Dict[tuple, dict] = {}

    # 检查是否需要重新计算：
    # 1. 强制重新计算
    # 2. 缓存为空
    # 3. 指定了 sector 但缓存中没有该 sector 的数据
    need_recalc = force_recalc_per_block or not blocks_cache

    # 计算缺失的星区（仅全量更新时）
    missing_sectors: set = set()
    if not need_recalc and not sector_id:
        # 全量更新：检查缓存中的星区数是否匹配所有需要处理的星区
        cached_sectors = set()
        try:
            with blocks_file.open("r", encoding="utf-8") as f:
                blocks_data_check = json.load(f)
            if isinstance(blocks_data_check, dict) and "regions" not in blocks_data_check:
                cached_sectors = {_normalize_sector_id(k) for k in blocks_data_check.keys()}
        except Exception:
            pass
        # 计算缺失的星区
        target_sectors = {_normalize_sector_id(row.get("sector_id", "")) for row in resourceareas_rows}
        missing_sectors = target_sectors - cached_sectors
        if missing_sectors:
            need_recalc = True

    if sector_id and not need_recalc:
        # 检查指定 sector 的数据是否在缓存中
        sector_in_cache = False
        try:
            with blocks_file.open("r", encoding="utf-8") as f:
                blocks_data_check = json.load(f)
            if isinstance(blocks_data_check, dict) and "regions" not in blocks_data_check:
                sector_in_cache = _normalize_sector_id(sector_id) in {
                    _normalize_sector_id(k) for k in blocks_data_check.keys()
                }
        except Exception:
            pass
        if not sector_in_cache:
            need_recalc = True

    if need_recalc:
        # 计算缺失星区的数据
        if missing_sectors:
            # 只计算缺失的星区
            rows_to_calc = [
                row for row in resourceareas_rows
                if _normalize_sector_id(row.get("sector_id", "")) in missing_sectors
            ]
        else:
            # 全部重新计算
            rows_to_calc = resourceareas_rows

        blocks_output = _calculate_blocks_for_resourceareas(
            resourceareas=[{"sector_id": row["sector_id"], "areas": [row]} for row in rows_to_calc],
            regions_json_path=regions_json_path,
            sector_id=sector_id,
        )

        # 更新 resourceareas_rows 中的 reserve/respawn（新计算的数据）
        for row in resourceareas_rows:
            sid = row.get("sector_id", "")
            ref = row.get("ref", "")
            cache_key = (sid, ref)
            if cache_key not in blocks_output:
                continue
            totals = blocks_output[cache_key].get("total", {})
            resources = row.get("resources", [])
            for res in resources:
                ware = res.get("ware", "")
                if ware in totals:
                    total_reserve = totals[ware]
                    res["reserve"] = total_reserve
                    delay = res.get("delay", 60.0)
                    if delay > 0:
                        res["respawn"] = round_to_int(total_reserve * 60.0 / delay)
                    else:
                        res["respawn"] = 0

        # 如果只是计算缺失星区，还需要从缓存读取已有星区的数据
        if missing_sectors:
            for row in resourceareas_rows:
                sid = row.get("sector_id", "")
                sid_normalized = _normalize_sector_id(sid)
                if sid_normalized in missing_sectors:
                    continue  # 已经在上面处理过了
                ref = row.get("ref", "")
                region_cache = blocks_cache.get((sid_normalized, ref), {})
                if not region_cache:
                    continue
                cached_totals = region_cache.get("total", {})
                resources = row.get("resources", [])
                for res in resources:
                    ware = res.get("ware", "")
                    if ware in cached_totals:
                        total_reserve = cached_totals[ware]
                        res["reserve"] = total_reserve
                        delay = res.get("delay", 60.0)
                        if delay > 0:
                            res["respawn"] = round_to_int(total_reserve * 60.0 / delay)
                        else:
                            res["respawn"] = 0
    else:
        # 从缓存读取（新格式：从 total 字段读取 ware 汇总值）
        for row in resourceareas_rows:
            sid = row.get("sector_id", "")
            sid_normalized = _normalize_sector_id(sid)
            ref = row.get("ref", "")
            region_cache = blocks_cache.get((sid_normalized, ref), {})
            if not region_cache:
                continue

            # 新格式：直接读取 total 字典
            cached_totals = region_cache.get("total", {})

            # 更新 resources
            resources = row.get("resources", [])
            for res in resources:
                ware = res.get("ware", "")
                if ware in cached_totals:
                    total_reserve = cached_totals[ware]
                    res["reserve"] = total_reserve
                    # respawn 基于 delay 计算
                    delay = res.get("delay", 60.0)
                    if delay > 0:
                        res["respawn"] = round_to_int(total_reserve * 60.0 / delay)
                    else:
                        res["respawn"] = 0

        # 将缓存数据转换为 blocks_output 格式，用于写入文件
        for (sid, ref), region_cache in blocks_cache.items():
            blocks_output[(sid, ref)] = {
                "ref": ref,
                "sector_id": sid,
                "total": region_cache.get("total", {}),
                "tiles": {f"{t['x']}_{t['y']}_{t['z']}": t for t in region_cache.get("tiles", [])},
            }

        # 更新 resourceareas_rows 中的 reserve/respawn
        for row in resourceareas_rows:
            sid = row.get("sector_id", "")
            sid_normalized = _normalize_sector_id(sid)
            ref = row.get("ref", "")
            region_cache = blocks_cache.get((sid_normalized, ref), {})
            if not region_cache:
                continue
            cached_totals = region_cache.get("total", {})
            resources = row.get("resources", [])
            for res in resources:
                ware = res.get("ware", "")
                if ware in cached_totals:
                    total_reserve = cached_totals[ware]
                    res["reserve"] = total_reserve
                    # respawn 基于 delay 计算
                    delay = res.get("delay", 60.0)
                    if delay > 0:
                        res["respawn"] = round_to_int(total_reserve * 60.0 / delay)
                    else:
                        res["respawn"] = 0

    # 写入输出文件
    output_dir.mkdir(parents=True, exist_ok=True)

    # 转换为 resourceareas.json 格式
    grouped: Dict[str, List[dict]] = {}

    # 如果指定了 sector，先读取现有文件保留其他星区数据
    # 新格式: {<sector_id>: [{area}, ...]}
    if sector_id and resourceareas_path.exists():
        try:
            with resourceareas_path.open("r", encoding="utf-8") as f:
                existing_data = json.load(f)
            # 处理新格式 (对象) 或旧格式 (数组)
            if isinstance(existing_data, dict):
                for sid, areas in existing_data.items():
                    if sid and sid.lower() != sector_id.lower():
                        grouped[sid] = areas
            elif isinstance(existing_data, list):
                for entry in existing_data:
                    if isinstance(entry, dict):
                        sid = entry.get("sector_id", "")
                        if sid and sid.lower() != sector_id.lower():
                            grouped[sid] = entry.get("areas", [])
        except Exception:
            pass

    for row in resourceareas_rows:
        sector_id_key = row.get("sector_id", "")
        if sector_id_key not in grouped:
            grouped[sector_id_key] = []
        area = {
            "ref": row.get("ref", ""),
            "amount": row.get("amount", 1),
            "position": row.get("position", {}),
            "boundary": row.get("boundary", {}),
            "lateral_factor": row.get("lateral_factor", 1.0),
            "radial_factor": row.get("radial_factor", 1.0),
            "falloff_factor": row.get("falloff_factor", 1.0),
            "resources": row.get("resources", []),
        }
        # 添加体积字段（可选）
        if row.get("solid_volume_km3"):
            area["solid_volume_km3"] = row["solid_volume_km3"]
        if row.get("gas_volume_km3"):
            area["gas_volume_km3"] = row["gas_volume_km3"]
        grouped[sector_id_key].append(area)

    # 格式: {<sector_id>: [{area}, ...]}
    resourceareas_output = grouped

    with resourceareas_path.open("w", encoding="utf-8") as f:
        json.dump(resourceareas_output, f, indent=2)

    # 逐格计算完成后，重新聚合 sector_resources（包含正确的 reserve）
    sector_resources = aggregate_sector_resources_from_resourceareas(resourceareas_rows)

    # 存档数据：提取真实 reserve/respawn
    if save_sample_dir and save_sample_dir.exists():
        save_resources = calculate_save_resources_all(save_sample_dir, sector_id)

        for sector_id_key, ware_list in sector_resources.items():
            sector_id_lower = sector_id_key.lower()
            save_ware_map = save_resources.get(sector_id_lower, {})

            for entry in ware_list:
                ware = entry.get("ware", "")
                save_data = save_ware_map.get(ware, {})

                if save_data:
                    entry["reserve"] = save_data.get("reserve", 0)
                    entry["respawn"] = save_data.get("respawn", 0)

    # 计算 rating：基于存档 respawn 或 replay_respawn
    for sector_id_key, ware_list in sector_resources.items():
        for entry in ware_list:
            ware = entry.get("ware", "")
            respawn_val = entry.get("respawn", 0)
            if respawn_val > 0:
                entry["rating"] = calculate_rating(respawn_val, ware)
            else:
                replay_respawn_val = entry.get("replay_respawn", 0)
                entry["rating"] = calculate_rating(replay_respawn_val, ware)

    # 输出 resourcearea_blocks.json 到 analysis/resources/
    # 增量更新：需要保留其他 sector 的缓存数据
    if need_recalc and (sector_id or missing_sectors):
        # 从缓存文件加载其他 sector 的数据
        blocks_file = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"
        if blocks_file.exists():
            try:
                with blocks_file.open("r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                if isinstance(cached_data, dict) and "regions" not in cached_data:
                    # 合并缓存数据到 blocks_output
                    for sid, regions in cached_data.items():
                        sid_normalized = _normalize_sector_id(sid)
                        # 跳过本次计算的星区
                        skip = False
                        if sector_id and sid_normalized == _normalize_sector_id(sector_id):
                            skip = True
                        if sid_normalized in missing_sectors:
                            skip = True
                        if not skip:
                            for region in regions:
                                ref = region.get("ref", "")
                                cache_key = (sid_normalized, ref)
                                if ref and cache_key not in blocks_output:
                                    blocks_output[cache_key] = {
                                        "ref": ref,
                                        "sector_id": sid_normalized,
                                        "total": region.get("total", {}),
                                        "tiles": {f"{t['x']}_{t['y']}_{t['z']}": t for t in region.get("tiles", [])},
                                    }
            except Exception:
                pass

    # 写入缓存文件：仅当重新计算时才写入
    if need_recalc:
        blocks_path = _write_resourcearea_blocks(blocks_output, sector_id)
    else:
        blocks_path = None

    normalized_sector_resources = {
        _normalize_sector_id(current_sector_id): resources
        for current_sector_id, resources in sector_resources.items()
    }
    if has_regions_from_maps:
        normalized_sector_regions = {
            current_sector_id: areas
            for current_sector_id, areas in sector_regions_from_maps.items()
            if areas
        }
    else:
        normalized_sector_regions = _build_sector_regions_from_grouped_resourceareas(grouped)

    grouped_normalized = {
        _normalize_sector_id(current_sector_id): areas
        for current_sector_id, areas in grouped.items()
    }
    map_resources_payload = _build_map_resources_payload(
        version="8.0",
        resource_model="regions",
        sector_ids=sector_ids,
        sector_regions=normalized_sector_regions,
        sector_resources=normalized_sector_resources,
        areas_by_sector=grouped_normalized,
    )
    write_map_resources(map_resources_payload, str(map_resources_path))

    return {
        "status": "success",
        "resource_model": "regions",
        "sectors_processed": len(grouped),
        "output_files": [
            path
            for path in [
                str(resourceareas_path),
                str(map_resources_path),
                str(blocks_path) if blocks_path else None,
            ]
            if path
        ],
    }


__all__ = [
    "process_resources_for_version",
]
