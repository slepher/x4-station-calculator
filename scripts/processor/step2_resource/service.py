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
    build_sector_resource_summaries_from_resourceareas,
    build_resourceareas_json_payload,
)


def process_resources_for_version(
    version: str,
    maps_json_path: Path,
    regionyields_xml_path: Optional[Path] = None,
    mapdefaults_xml_path: Optional[Path] = None,
    regions_json_path: Optional[Path] = None,
    sector_id: Optional[str] = None,
    force_recalc_per_block: bool = False,
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
        )


def _write_resourcearea_blocks(
    resourceareas: List[dict],
    sector_id: Optional[str] = None,
    force_recalc: bool = False,
    regions_json_path: Optional[Path] = None,
) -> Optional[Path]:
    """写入 resourcearea_blocks.json 到 analysis/resources/。

    默认从已有文件读取，除非强制重新计算或文件不存在。

    Args:
        resourceareas: resourceareas 数据列表
        sector_id: 可选，仅输出指定 sector
        force_recalc: 强制重新计算逐格数据
        regions_json_path: regions.json 文件路径（用于逐格计算）

    Returns:
        输出文件路径
    """
    if not resourceareas:
        return None

    # 检查是否可以直接使用已有文件
    ANALYSIS_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    blocks_path = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"

    # 加载已有数据（如果存在）
    existing_regions = {}
    if blocks_path.exists():
        try:
            with blocks_path.open("r", encoding="utf-8") as f:
                existing_data = json.load(f)
            for region in existing_data.get("regions", []):
                ref = region.get("ref", "")
                if ref:
                    existing_regions[ref] = region
        except Exception:
            existing_regions = {}

    # 如果强制重新计算且指定了 sector，只删除该 sector 的数据
    if force_recalc and sector_id:
        sector_id_lower = sector_id.lower()
        existing_regions = {
            ref: region for ref, region in existing_regions.items()
            if region.get("sector_id", "").lower() != sector_id_lower
        }

    # 如果不强制重新计算且已有完整数据，直接返回
    if not force_recalc and not sector_id and existing_regions:
        return blocks_path

    blocks_output = {}

    # 逐格计算 - 加载依赖
    from processor.step2_resource.per_block_bridge import calculate_resource_per_block

    # 使用传入的 regions_json_path 或默认路径
    if regions_json_path is None:
        raise ValueError("regions_json_path is required for per-block calculation")
    if regions_json_path.exists():
        with regions_json_path.open("r", encoding="utf-8") as f:
            regions_data = json.load(f)
        regions_by_id = {r.get("id"): r for r in regions_data if isinstance(r, dict)}
    else:
        regions_by_id = {}

    for entry in resourceareas:
        sector_id_val = entry.get("sector_id", "")
        areas = entry.get("areas", [])

        for area in areas:
            ref = area.get("ref", "")
            region_json = regions_by_id.get(ref, {})
            if not region_json:
                continue

            position = area.get("position", {})
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

                # 初始化 region 数据（如果不存在）
                if ref not in blocks_output:
                    blocks_output[ref] = {
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
                    if tile_key not in blocks_output[ref]["tiles"]:
                        blocks_output[ref]["tiles"][tile_key] = {
                            "x": tile_x,
                            "y": tile_y,
                            "z": tile_z,
                            "wares": {},
                        }

                    # 累加该 ware 的值到 tile
                    for field_result in tile.get("fields", []):
                        if field_result.get("ware") == ware:
                            area_value = field_result.get("area_value", 0)
                            blocks_output[ref]["tiles"][tile_key]["wares"][ware] = \
                                blocks_output[ref]["tiles"][tile_key]["wares"].get(ware, 0) + area_value
                            # 同时累加到 total
                            blocks_output[ref]["total"][ware] = \
                                blocks_output[ref]["total"].get(ware, 0) + area_value

    # 转换为列表格式，并将 tiles 字典转换为列表
    blocks_list = []

    # 先添加新计算的数据
    for ref, region_data in blocks_output.items():
        blocks_list.append({
            "ref": ref,
            "sector_id": region_data.get("sector_id"),
            "total": region_data["total"],
            "tiles": list(region_data["tiles"].values()),
        })

    # 再添加已有数据中未更新的部分
    processed_refs = set(blocks_output.keys())
    for ref, region_data in existing_regions.items():
        if ref not in processed_refs:
            blocks_list.append(region_data)

    # 写入到 analysis/resources/
    ANALYSIS_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    blocks_path = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"

    with blocks_path.open("w", encoding="utf-8") as f:
        json.dump({"regions": blocks_list}, f, indent=2)

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
    """处理 9.0+ 版本资源。

    9.0+ 版本直接从 definition 读取 yield/respawn，无需复杂计算。
    """
    if regionyields_xml_path is None or mapdefaults_xml_path is None:
        return {"status": "error", "message": "Missing XML paths for 9.0+ processing"}

    # 1. 解析 definitions
    definitions = migrate_resourcearea_definitions(regionyields_xml_path)

    # 2. 解析 sector resourceareas
    sector_resource_areas = migrate_sector_resourceareas(mapdefaults_xml_path)

    # 3. 过滤指定 sector
    if sector_id:
        sector_id_lower = sector_id.lower()
        sector_resource_areas = {
            k: v for k, v in sector_resource_areas.items()
            if k.lower() == sector_id_lower
        }

    # 4. 构建 resourceareas.json
    resourceareas = build_resourceareas_json_payload(
        sector_resource_areas,
        definitions,
    )

    # 5. 聚合 sector.resources
    sector_summaries = build_sector_resource_summaries_from_resourceareas(
        sector_resource_areas,
        definitions,
    )

    # 6. 写入输出文件
    output_dir.mkdir(parents=True, exist_ok=True)

    resourceareas_path = output_dir / "resourceareas.json"
    with resourceareas_path.open("w", encoding="utf-8") as f:
        json.dump(resourceareas, f, indent=2)

    # 7. 更新 maps.json 中的 sector.resources
    if maps_json_path.exists():
        with maps_json_path.open("r", encoding="utf-8") as f:
            maps_data = json.load(f)

        # 处理两种结构：sectors 数组或 clusters 嵌套
        sectors_list = maps_data.get("sectors", [])
        if sectors_list:
            # 旧格式：顶层 sectors 数组
            for sector in sectors_list:
                sector_macro = sector.get("id", "").lower()
                if sector_macro in sector_summaries:
                    sector["resources"] = sector_summaries[sector_macro]
        else:
            # 新格式：clusters 嵌套结构
            clusters = maps_data.get("clusters", {})
            for cluster_data in clusters.values():
                if not isinstance(cluster_data, dict):
                    continue
                sectors_dict = cluster_data.get("sectors", {})
                for sector_macro, sector in sectors_dict.items():
                    sector_macro_lower = sector_macro.lower()
                    if sector_macro_lower in sector_summaries:
                        sector["resources"] = sector_summaries[sector_macro_lower]

        with maps_json_path.open("w", encoding="utf-8") as f:
            json.dump(maps_data, f, indent=2)

    # 8. 输出 resourcearea_blocks.json 到 analysis/resources/
    blocks_path = _write_resourcearea_blocks(resourceareas, sector_id, False, None)

    return {
        "status": "success",
        "resource_model": "resourceareas",
        "sectors_processed": len(sector_resource_areas),
        "definitions_count": len(definitions),
        "output_files": [
            str(resourceareas_path),
            str(blocks_path) if blocks_path else None,
        ],
    }


def _process_80_resources(
    regions_json_path: Optional[Path],
    maps_json_path: Path,
    output_dir: Path,
    sector_id: Optional[str],
    force_recalc_per_block: bool = False,
) -> Dict[str, object]:
    """处理 8.0 版本资源。

    8.0 版本需要：
    1. 估算算法：计算理论储量
    2. 逐格算法：计算精确储量（默认从已有文件读取，除非强制重新计算）
    """
    if regions_json_path is None:
        return {"status": "error", "message": "Missing regions.json path for 8.0 processing"}

    # 读取 regions.json
    with regions_json_path.open("r", encoding="utf-8") as f:
        regions_data = json.load(f)

    # 读取 maps.json
    with maps_json_path.open("r", encoding="utf-8") as f:
        maps_data = json.load(f)

    # 索引 regions
    regions_by_id = {r.get("id"): r for r in regions_data if isinstance(r, dict)}

    # 尝试加载已有的 resourcearea_blocks.json（新格式：{regions: [...]}）
    blocks_cache: Dict[str, dict] = {}
    blocks_file = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"
    if not force_recalc_per_block and blocks_file.exists():
        try:
            with blocks_file.open("r", encoding="utf-8") as f:
                blocks_data = json.load(f)
            # 新格式：{regions: [{ref, total, tiles}, ...]}
            for entry in blocks_data.get("regions", []):
                ref = entry.get("ref", "")
                if ref:
                    blocks_cache[ref] = entry
        except Exception:
            blocks_cache = {}

    # 处理每个 sector
    resourceareas_rows: List[dict] = []

    # 遍历 clusters -> sectors 结构
    clusters = maps_data.get("clusters", {})
    for cluster_macro, cluster_data in clusters.items():
        if not isinstance(cluster_data, dict):
            continue

        sectors_dict = cluster_data.get("sectors", {})
        for sector_macro, sector in sectors_dict.items():
            if not isinstance(sector, dict):
                continue

            current_sector_id = sector.get("id", sector_macro)

            # 过滤指定 sector
            if sector_id and current_sector_id.lower() != sector_id.lower():
                continue

            cluster_id = cluster_macro
            sector_regions = sector.get("regions", [])

            for region_ref in sector_regions:
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

    # 聚合 sector.resources
    sector_resources = aggregate_sector_resources_from_resourceareas(resourceareas_rows)

    # 二阶段：逐格计算，更新 reserve/respawn
    # 默认从已有文件读取，除非强制重新计算或文件不存在
    if force_recalc_per_block or not blocks_cache:
        # 重新执行逐格计算
        from processor.step2_resource.per_block_bridge import calculate_resource_per_block

        for row in resourceareas_rows:
            ref = row.get("ref", "")
            sector_id_val = row.get("sector_id", "")
            region_json = regions_by_id.get(ref, {})
            if not region_json:
                continue

            resources = row.get("resources", [])
            for res in resources:
                ware = res.get("ware", "")
                resourcedensity = res.get("resourcedensity", 1.0)

                result = calculate_resource_per_block(
                    sector_id=sector_id_val,
                    field_ref=ref,
                    area_data=row,
                    region_json=region_json,
                    ware=ware,
                    resourcedensity=resourcedensity,
                )

                # 聚合所有 tile 的 area_value 作为 reserve
                total_reserve = 0
                for tile in result.get("per_tile", []):
                    # 固体资源：fields 列表
                    if "fields" in tile:
                        for field_result in tile.get("fields", []):
                            if field_result.get("ware") == ware:
                                total_reserve += field_result.get("area_value", 0)
                    # 气体资源：直接用 ware 名作为 key
                    elif ware in tile:
                        total_reserve += tile.get(ware, 0)

                if total_reserve > 0:
                    res["reserve"] = total_reserve
                    # respawn 基于 delay 计算
                    delay = res.get("delay", 60.0)
                    if delay > 0:
                        res["respawn"] = round_to_int(total_reserve * 60.0 / delay)
                    else:
                        res["respawn"] = 0
    else:
        # 从缓存读取（新格式：从 total 字段读取 ware 汇总值）
        for row in resourceareas_rows:
            ref = row.get("ref", "")
            region_cache = blocks_cache.get(ref, {})
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

    # 写入输出文件
    output_dir.mkdir(parents=True, exist_ok=True)

    resourceareas_path = output_dir / "resourceareas.json"

    # 转换为 resourceareas.json 格式
    grouped: Dict[str, dict] = {}
    for row in resourceareas_rows:
        sector_id_key = row.get("sector_id", "")
        if sector_id_key not in grouped:
            grouped[sector_id_key] = {
                "cluster_id": row.get("cluster_id", ""),
                "sector_id": sector_id_key,
                "areas": [],
            }
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
        grouped[sector_id_key]["areas"].append(area)

    resourceareas_output = list(grouped.values())

    with resourceareas_path.open("w", encoding="utf-8") as f:
        json.dump(resourceareas_output, f, indent=2)

    # 逐格计算完成后，重新聚合 sector_resources（包含正确的 reserve）
    sector_resources = aggregate_sector_resources_from_resourceareas(resourceareas_rows)

    # 更新 maps.json 中的 sector.resources
    for cluster_data in clusters.values():
        if not isinstance(cluster_data, dict):
            continue
        sectors_dict = cluster_data.get("sectors", {})
        for sector_macro, sector in sectors_dict.items():
            if not isinstance(sector, dict):
                continue
            current_sector_id = sector.get("id", sector_macro)
            if current_sector_id in sector_resources:
                sector["resources"] = sector_resources[current_sector_id]

    with maps_json_path.open("w", encoding="utf-8") as f:
        json.dump(maps_data, f, indent=2)

    # 输出 resourcearea_blocks.json 到 analysis/resources/
    blocks_path = _write_resourcearea_blocks(resourceareas_output, sector_id, force_recalc_per_block, regions_json_path)

    return {
        "status": "success",
        "resource_model": "regions",
        "sectors_processed": len(grouped),
        "output_files": [
            str(resourceareas_path),
            str(blocks_path) if blocks_path else None,
        ],
    }


__all__ = [
    "process_resources_for_version",
]