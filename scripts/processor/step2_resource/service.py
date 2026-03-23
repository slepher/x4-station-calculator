"""Step 2 Resource 服务入口 - X4 Map Data Processor.

提供资源计算的统一入口，协调：
- 8.0 版本：估算算法 → 逐格算法
- 9.0+ 版本：直接引用 definition
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

# 固定输出目录
ANALYSIS_RESOURCES_DIR = Path("analysis/resources")

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
        )


def _write_resourcearea_blocks(
    resourceareas: List[dict],
    sector_id: Optional[str] = None,
) -> Optional[Path]:
    """写入 resourcearea_blocks.json 到 analysis/resources/。

    始终执行逐格计算，生成与游戏脚本可比对的明细数据。

    Args:
        resourceareas: resourceareas 数据列表
        sector_id: 可选，仅输出指定 sector

    Returns:
        输出文件路径
    """
    if not resourceareas:
        return None

    # 过滤指定 sector
    if sector_id:
        sector_id_lower = sector_id.lower()
        resourceareas = [
            r for r in resourceareas
            if r.get("sector_id", "").lower() == sector_id_lower
        ]

    if not resourceareas:
        return None

    blocks_output = []

    # 逐格计算 - 加载依赖
    from processor.step2_resource.per_block_bridge import calculate_resource_per_block

    regions_json_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json")
    if regions_json_path.exists():
        with regions_json_path.open("r", encoding="utf-8") as f:
            regions_data = json.load(f)
        regions_by_id = {r.get("id"): r for r in regions_data if isinstance(r, dict)}
    else:
        regions_by_id = {}

    for entry in resourceareas:
        sector_id_val = entry.get("sector_id", "")
        areas = entry.get("areas", [])

        # 按 coord 合并所有 fields（匹配游戏输出格式）
        tiles_by_coord: Dict[str, dict] = {}

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

                for tile in result.get("per_tile", []):
                    coord = tile.get("coord", (0, 0, 0))
                    if isinstance(coord, tuple):
                        coord_str = f"{coord[0]}_{coord[1]}_{coord[2]}"
                    else:
                        coord_str = str(coord)

                    # 初始化 tile（如果不存在）
                    if coord_str not in tiles_by_coord:
                        tiles_by_coord[coord_str] = {
                            "coord": coord_str,
                            "fields": [],
                        }

                    # 添加所有 matching fields 到此 tile
                    for field_result in tile.get("fields", []):
                        field_ware = field_result.get("ware", "")
                        if field_ware == ware:
                            tiles_by_coord[coord_str]["fields"].append({
                                "field": field_result.get("field", ""),
                                "area_value": field_result.get("area_value", 0),
                            })

        blocks_output.append({
            "sector_id": sector_id_val,
            "per_tile": list(tiles_by_coord.values()),
        })

    # 写入到 analysis/resources/
    ANALYSIS_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    blocks_path = ANALYSIS_RESOURCES_DIR / "resourcearea_blocks.json"

    with blocks_path.open("w", encoding="utf-8") as f:
        json.dump(blocks_output, f, indent=2)

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
    blocks_path = _write_resourcearea_blocks(resourceareas, sector_id)

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
) -> Dict[str, object]:
    """处理 8.0 版本资源。

    8.0 版本需要：
    1. 估算算法：计算理论储量
    2. 逐格算法：计算精确储量
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
                boundary = region_ref.get("boundary", {})

                region_template = regions_by_id.get(ref, {})
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
    blocks_path = _write_resourcearea_blocks(resourceareas_output, sector_id)

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