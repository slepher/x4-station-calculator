#!/usr/bin/env python3
"""验证 resourcearea_blocks 与 resourcearea_blocks_game 的一致性。

比对 Step 2 处理器输出与验收脚本输出的方块明细，生成差异报告。

验证模式：
- per-tile: 逐格比对（要求格式完全匹配）
- sector-aggregate: 星区聚合比对（比对每个星区的资源总量）
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict


def load_json(path: Path) -> Any:
    """加载 JSON 文件。"""
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def aggregate_sector_resources_from_game(
    game_blocks: List[dict],
) -> Dict[str, Dict[str, float]]:
    """从游戏脚本输出聚合星区资源总量。

    Args:
        game_blocks: 游戏脚本输出的方块明细（per-block 格式）

    Returns:
        {sector_id: {ware: total_yield}}
    """
    result: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for entry in game_blocks:
        sector_id = entry.get("sector_id", "")
        per_tile = entry.get("per_tile", [])

        for tile in per_tile:
            fields = tile.get("fields", [])
            for field in fields:
                # field.field = "asteroid_ore_l" -> ware = "ore"
                field_name = field.get("field", "")
                ware = _field_to_ware(field_name)
                area_value = field.get("area_value", 0)
                result[sector_id][ware] += area_value

    return {k: dict(v) for k, v in result.items()}


def aggregate_sector_resources_from_processor(
    processor_blocks: List[dict],
) -> Dict[str, Dict[str, float]]:
    """从处理器输出聚合星区资源总量。

    Args:
        processor_blocks: 处理器输出的方块明细

    Returns:
        {sector_id: {ware: total_yield}}
    """
    result: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for entry in processor_blocks:
        sector_id = entry.get("sector_id", "")
        per_tile = entry.get("per_tile", [])

        for tile in per_tile:
            # 新格式：每个 tile 包含 fields 列表
            fields = tile.get("fields", [])
            if fields:
                for field in fields:
                    field_name = field.get("field", "")
                    # 从 field name 提取 ware
                    ware = _field_to_ware(field_name)
                    result[sector_id][ware] += field.get("area_value", 0)
            else:
                # 旧格式兼容
                ware = tile.get("ware", "")
                result[sector_id][ware] += tile.get("tile_total", 0)

    return {k: dict(v) for k, v in result.items()}


def _field_to_ware(field_name: str) -> str:
    """将 field 名称转换为 ware 名称。

    asteroid_ore_l -> ore
    asteroid_silicon_m -> silicon
    gas_helium -> helium
    """
    if field_name.startswith("asteroid_"):
        parts = field_name.split("_")
        if len(parts) >= 3:
            return parts[1]  # ore, silicon, etc.
    elif field_name.startswith("gas_"):
        return field_name[4:]  # helium, hydrogen, etc.
    return field_name


def compare_sector_aggregates(
    game_aggregates: Dict[str, Dict[str, float]],
    processor_aggregates: Dict[str, Dict[str, float]],
    tolerance: float = 0.01,
) -> Dict[str, Any]:
    """比对星区聚合数据。

    Args:
        game_aggregates: 游戏脚本聚合数据（真值）
        processor_aggregates: 处理器聚合数据（待验值）
        tolerance: 相对误差容忍度

    Returns:
        比对结果
    """
    all_sectors = set(game_aggregates.keys()) | set(processor_aggregates.keys())

    passed = []
    failed = []

    for sector_id in sorted(all_sectors):
        game_resources = game_aggregates.get(sector_id, {})
        processor_resources = processor_aggregates.get(sector_id, {})

        if not game_resources:
            # 游戏没有此 sector 的数据，跳过（可能是游戏脚本错误）
            continue

        if not processor_resources:
            failed.append({
                "sector_id": sector_id,
                "error": "missing_in_processor",
                "message": "Sector exists in game output but not in processor output",
            })
            continue

        # 只比对游戏有的资源（游戏脚本只计算第一个 resource）
        sector_errors = []

        for ware in game_resources.keys():
            game_total = game_resources.get(ware, 0)
            processor_total = processor_resources.get(ware, 0)

            if game_total == 0 and processor_total == 0:
                continue

            if game_total == 0:
                # 理论上不会发生（因为我们只遍历 game 有的资源）
                continue

            if processor_total == 0:
                sector_errors.append({
                    "ware": ware,
                    "error": "missing_in_processor",
                    "game_total": game_total,
                })
                continue

            error_ratio = abs(processor_total - game_total) / game_total
            if error_ratio > tolerance:
                sector_errors.append({
                    "ware": ware,
                    "error": "value_mismatch",
                    "game_total": game_total,
                    "processor_total": processor_total,
                    "error_ratio": error_ratio,
                })

        if sector_errors:
            failed.append({
                "sector_id": sector_id,
                "error": "resource_mismatch",
                "details": sector_errors,
            })
        else:
            passed.append(sector_id)

    return {
        "summary": {
            "total_sectors": len(all_sectors),
            "passed_sectors": len(passed),
            "failed_sectors": len(failed),
        },
        "passed": passed,
        "failed_details": failed,
    }


def compare_blocks(
    game_blocks: List[dict],
    processor_blocks: List[dict],
    tolerance: float = 0.0001,
) -> Dict[str, Any]:
    """比对两个方块列表（逐格比对）。

    Args:
        game_blocks: 验收脚本输出的方块明细（真值）
        processor_blocks: Step 2 处理器输出的方块明细（待验值）
        tolerance: 相对误差容忍度

    Returns:
        比对结果
    """
    # 按 sector_id 索引
    game_by_sector = {b["sector_id"]: b for b in game_blocks}
    processor_by_sector = {b["sector_id"]: b for b in processor_blocks}

    all_sectors = set(game_by_sector.keys()) | set(processor_by_sector.keys())

    passed = []
    failed = []

    for sector_id in sorted(all_sectors):
        game_entry = game_by_sector.get(sector_id)
        processor_entry = processor_by_sector.get(sector_id)

        if game_entry is None:
            failed.append({
                "sector_id": sector_id,
                "error": "missing_in_game",
                "message": "Sector exists in processor output but not in game output",
            })
            continue

        if processor_entry is None:
            failed.append({
                "sector_id": sector_id,
                "error": "missing_in_processor",
                "message": "Sector exists in game output but not in processor output",
            })
            continue

        # 比对 per_tile
        game_tiles = game_entry.get("per_tile", [])
        processor_tiles = processor_entry.get("per_tile", [])

        # 按坐标索引（处理 coord 可能是 list 或 str 的情况）
        game_tiles_by_coord = {}
        for t in game_tiles:
            coord = t.get("coord")
            if isinstance(coord, list):
                coord_key = tuple(coord)
            else:
                coord_key = coord
            game_tiles_by_coord[coord_key] = t

        processor_tiles_by_coord = {}
        for t in processor_tiles:
            coord = t.get("coord")
            if isinstance(coord, list):
                coord_key = tuple(coord)
            else:
                coord_key = coord
            processor_tiles_by_coord[coord_key] = t

        all_coords = set(game_tiles_by_coord.keys()) | set(processor_tiles_by_coord.keys())

        sector_errors = []

        for coord in all_coords:
            game_tile = game_tiles_by_coord.get(coord)
            processor_tile = processor_tiles_by_coord.get(coord)

            if game_tile is None:
                sector_errors.append({
                    "coord": list(coord) if isinstance(coord, tuple) else coord,
                    "error": "extra_tile_in_processor",
                })
                continue

            if processor_tile is None:
                sector_errors.append({
                    "coord": list(coord) if isinstance(coord, tuple) else coord,
                    "error": "missing_tile_in_processor",
                })
                continue

            # 比对 tile_total
            game_total = game_tile.get("tile_total", 0)
            processor_total = processor_tile.get("tile_total", 0)

            if game_total != 0:
                error_ratio = abs(processor_total - game_total) / game_total
                if error_ratio > tolerance:
                    sector_errors.append({
                        "coord": list(coord) if isinstance(coord, tuple) else coord,
                        "error": "value_mismatch",
                        "game_total": game_total,
                        "processor_total": processor_total,
                        "error_ratio": error_ratio,
                    })

        if sector_errors:
            failed.append({
                "sector_id": sector_id,
                "error": "tile_mismatch",
                "details": sector_errors,
            })
        else:
            passed.append(sector_id)

    return {
        "summary": {
            "total_sectors": len(all_sectors),
            "passed_sectors": len(passed),
            "failed_sectors": len(failed),
        },
        "passed": passed,
        "failed_details": failed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Verify resourcearea_blocks consistency"
    )
    parser.add_argument(
        "--game-blocks",
        type=Path,
        default=Path("analysis/resources/resourcearea_blocks_game.json"),
        help="Game script output (default: analysis/resources/resourcearea_blocks_game.json)",
    )
    parser.add_argument(
        "--processor-blocks",
        type=Path,
        default=Path("analysis/resources/resourcearea_blocks.json"),
        help="Processor output (default: analysis/resources/resourcearea_blocks.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("analysis/resources/verify_report.json"),
        help="Output report path (default: analysis/resources/verify_report.json)",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.01,
        help="Relative error tolerance (default: 0.01 = 1%%)",
    )
    parser.add_argument(
        "--mode",
        choices=["per-tile", "sector-aggregate"],
        default="sector-aggregate",
        help="Comparison mode: per-tile (detailed) or sector-aggregate (high-level totals)",
    )

    args = parser.parse_args()

    # 加载数据
    print(f"Loading game blocks from {args.game_blocks}")
    game_blocks = load_json(args.game_blocks) if args.game_blocks.exists() else []

    print(f"Loading processor blocks from {args.processor_blocks}")
    processor_blocks = load_json(args.processor_blocks) if args.processor_blocks.exists() else []

    # 选择比对模式
    if args.mode == "sector-aggregate":
        print("Using sector-aggregate comparison mode")
        game_aggregates = aggregate_sector_resources_from_game(game_blocks)
        processor_aggregates = aggregate_sector_resources_from_processor(processor_blocks)
        result = compare_sector_aggregates(game_aggregates, processor_aggregates, args.tolerance)
    else:
        print("Using per-tile comparison mode")
        result = compare_blocks(game_blocks, processor_blocks, args.tolerance)

    # 输出报告
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\n=== 验证结果 ({args.mode} 模式) ===")
    print(f"总星区数: {result['summary']['total_sectors']}")
    print(f"通过星区: {result['summary']['passed_sectors']}")
    print(f"失败星区: {result['summary']['failed_sectors']}")
    print(f"\n报告已保存到: {args.output}")

    if result['summary']['failed_sectors'] > 0:
        # 打印前几个失败详情
        print(f"\n失败星区详情 (前 5 个):")
        for detail in result['failed_details'][:5]:
            print(f"  - {detail['sector_id']}: {detail['error']}")
        return 1
    return 0


if __name__ == "__main__":
    exit(main())