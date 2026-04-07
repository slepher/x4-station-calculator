"""X4 Region Resource Replay Module

This module provides a unified interface to compute resource totals for a given
sector and region using reverse-engineered X4.exe logic.

Usage:
    from x4_replay import compute_region_resources

    result = compute_region_resources(
        sector_id="Cluster_01_Sector001_macro",
        region_id="region_cluster_01_sector_001_a"
    )
    print(result.totals)  # {ware_id: total_amount, ...}
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from impl.compile_hit import prepare_region_runtime_for_dispatch
from impl.dispatch import replay_region_runtime_14075BD20
from impl.save_compare import load_save_tiles_by_ware

if TYPE_CHECKING:
    from field.resource_field import FieldContributionTrace

# Paths - navigate to project root from scripts/x4-game
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"


@dataclass
class ResourceTotal:
    """Resource total for a specific ware."""
    ware_id: str
    total: float
    unit: str = ""


@dataclass
class TileResourceData:
    """Resource data for a single tile.

    C++: Tile data structure from spatial index
    """
    coord: tuple[int, int, int]  # Tile coordinates (x, y, z)
    tile_values: dict[str, int]  # ware_id -> current for this tile
    field_traces: list['FieldContributionTrace'] = field(default_factory=list)


@dataclass
class RegionResourceResult:
    """Result of computing region resources."""
    sector_id: str
    region_id: str
    region_name: str = ""
    field_type: str = ""  # asteroid, debris, nebula
    boundary_class: str = ""
    totals: dict[str, int] = field(default_factory=dict)  # ware_id -> total current
    tile_count: int = 0
    per_tile: list[TileResourceData] = field(default_factory=list)  # Per-tile data


def load_json_data(filename: str) -> dict | list:
    """Load JSON data from data directory."""
    filepath = DATA_ROOT / filename
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def find_region_data(sector_id: str, region_id: str) -> dict | None:
    """Find region data from regions.json.

    Args:
        sector_id: Sector identifier (e.g., Cluster_01_Sector001_macro)
        region_id: Region identifier (e.g., region_cluster_01_sector_001_a)

    Returns:
        Region data dict or None if not found
    """
    regions_data = load_json_data("regions.json")

    for region in regions_data:
        if region.get("id") != region_id:
            continue

        # Check if this region belongs to the specified sector
        region_sector = region.get("sector", "")
        if region_sector and region_sector != sector_id:
            continue

        return region

    return None


def find_area_data(area_id: str) -> dict | None:
    """Find area data from resourceareas.json.

    Args:
        area_id: Area identifier (references regions.json area field)

    Returns:
        Area data dict or None if not found
    """
    if not area_id:
        return None

    areas_data = load_json_data("resourceareas.json")

    if isinstance(areas_data, dict):
        for area_list in areas_data.values():
            if not isinstance(area_list, list):
                continue
            for area in area_list:
                if isinstance(area, dict) and area.get("id") == area_id:
                    return area
    else:
        for area in areas_data:
            if area.get("id") == area_id:
                return area

    return None


def find_region_position_from_maps(sector_id: str, region_id: str) -> dict | None:
    """Find region position from maps.json.

    Args:
        sector_id: Sector identifier
        region_id: Region identifier

    Returns:
        Position dict with x, y, z or None if not found
    """
    maps_data = load_json_data("maps.json")
    sector = maps_data.get("sectors", {}).get(sector_id)
    if sector:
        for region in sector.get("regions", []):
            if region.get("ref") == region_id:
                return region.get("position")

    return None


def find_region_instances_from_maps(sector_id: str, region_id: str) -> list[dict]:
    """Find every placement of a region ref inside one sector."""
    maps_data = load_json_data("maps.json")
    instances: list[dict] = []
    sector = maps_data.get("sectors", {}).get(sector_id)
    if sector:
        for region in sector.get("regions", []):
            if region.get("ref") == region_id:
                instances.append(region)

    return instances


def find_area_instances(sector_id: str, region_id: str) -> list[dict]:
    """Find every resource-area entry matching the region ref in one sector."""
    areas_data = load_json_data("resourceareas.json")

    if isinstance(areas_data, dict):
        return [
            area
            for area in areas_data.get(sector_id, [])
            if isinstance(area, dict) and area.get("ref") == region_id
        ]

    for cluster in areas_data:
        if cluster.get("sector_id") != sector_id:
            continue
        return [
            area
            for area in cluster.get("areas", [])
            if area.get("ref") == region_id
        ]

    return []


def _position_key(position: dict | None) -> tuple[float, float, float] | None:
    if not position:
        return None
    return (
        float(position.get("x", 0.0) or 0.0),
        float(position.get("y", 0.0) or 0.0),
        float(position.get("z", 0.0) or 0.0),
    )


def get_field_type(region_data: dict) -> str:
    """Determine field type from region data.

    Args:
        region_data: Region data from regions.json

    Returns:
        Field type: "asteroid", "debris", "nebula", or ""
    """
    fields = region_data.get("fields", [])

    for field_def in fields:
        tag = field_def.get("tag", "").lower()
        if tag == "asteroid":
            return "asteroid"
        elif tag == "debris":
            return "debris"
        elif tag == "nebula":
            return "nebula"
        elif tag == "volumetricfog":
            return "volumetricfog"

    return ""


def _compute_region_resources_for_instance(
    sector_id: str,
    region_id: str,
    region_data: dict,
    area_data: dict | None,
    ware_filter: str | None = None,
) -> RegionResourceResult:
    """Compute replay output for one concrete region placement."""

    # Determine field type
    field_type = get_field_type(region_data)

    # Get boundary class
    boundary_data = region_data.get("boundary", {})
    boundary_class = boundary_data.get("class", "")

    # Initialize result
    result = RegionResourceResult(
        sector_id=sector_id,
        region_id=region_id,
        region_name=region_data.get("name", ""),
        field_type=field_type,
        boundary_class=boundary_class,
    )

    compiled = prepare_region_runtime_for_dispatch(
        sector_id=sector_id,
        region_id=region_id,
        region_data=region_data,
        area_data=area_data,
    )
    totals, per_tile = replay_region_runtime_14075BD20(compiled, ware_filter=ware_filter)
    result.totals = totals
    result.per_tile = [
        TileResourceData(
            coord=tile["coord"],
            tile_values=tile["tile_values"],
            field_traces=tile["field_traces"],
        )
        for tile in per_tile
    ]
    result.tile_count = len(result.per_tile)

    return result


def compute_region_resources(
    sector_id: str,
    region_id: str,
    ware_filter: str | None = None,
) -> RegionResourceResult:
    """Compute total resources for all placements of one region ref in a sector."""
    region_data = find_region_data(sector_id, region_id)
    if not region_data:
        raise ValueError(f"Region not found: {region_id} in sector {sector_id}")

    field_type = get_field_type(region_data)
    boundary_data = region_data.get("boundary", {})
    boundary_class = boundary_data.get("class", "")

    aggregate = RegionResourceResult(
        sector_id=sector_id,
        region_id=region_id,
        region_name=region_data.get("name", ""),
        field_type=field_type,
        boundary_class=boundary_class,
    )

    map_instances = find_region_instances_from_maps(sector_id, region_id)
    area_instances = find_area_instances(sector_id, region_id)
    area_by_position = {
        _position_key(area.get("position")): area
        for area in area_instances
    }

    if not map_instances:
        aggregate.per_tile = []
        aggregate.tile_count = 0
        return aggregate

    merged_tiles: dict[tuple[int, int, int], dict[str, int]] = {}
    merged_tile_traces: dict[tuple[int, int, int], list['FieldContributionTrace']] = {}

    for instance in map_instances:
        instance_area = area_by_position.get(_position_key(instance.get("position")))
        instance_result = _compute_region_resources_for_instance(
            sector_id=sector_id,
            region_id=region_id,
            region_data=region_data,
            area_data=instance_area,
            ware_filter=ware_filter,
        )

        for ware, amount in instance_result.totals.items():
            aggregate.totals[ware] = aggregate.totals.get(ware, 0.0) + amount

        for tile in instance_result.per_tile:
            tile_bucket = merged_tiles.setdefault(tile.coord, {})
            for ware, amount in tile.tile_values.items():
                tile_bucket[ware] = tile_bucket.get(ware, 0) + amount
            merged_tile_traces.setdefault(tile.coord, []).extend(tile.field_traces)

    aggregate.per_tile = [
        TileResourceData(coord=coord, tile_values=values, field_traces=merged_tile_traces.get(coord, []))
        for coord, values in sorted(merged_tiles.items())
    ]
    aggregate.tile_count = len(aggregate.per_tile)
    return aggregate


def format_result(
    result: RegionResourceResult,
    save_tiles_by_ware: dict[str, dict] | None = None,
    compare: bool = False,
) -> str:
    """Format region resource result as readable text.

    Args:
        result: RegionResourceResult to format
        save_tiles_by_ware: Dict mapping ware_id to save tiles dict for comparison
        compare: Whether to show comparison with save data

    Returns:
        Formatted string
    """
    lines = [
        f"Sector: {result.sector_id}",
        f"Region: {result.region_id}",
        f"Name: {result.region_name}",
        f"Type: {result.field_type}",
        f"Boundary: {result.boundary_class}",
        f"Tiles: {result.tile_count}",
        "",
        "Resource Totals:",
    ]

    if result.totals:
        for ware, total in sorted(result.totals.items()):
            lines.append(f"  {ware}: {total}")
    else:
        lines.append("  No resources found")

    # Per-tile comparison
    if compare and save_tiles_by_ware:
        lines.append("")
        lines.append("Per-Tile Comparison:")
        lines.append("=" * 80)

        # Compare over the union of replay/save wares and tile coordinates so
        # save-only tiles remain visible in verbose diagnostics.
        all_wares = sorted(set(result.totals.keys()) | set(save_tiles_by_ware.keys()))

        # Calculate replay totals per ware for verification
        replay_total_by_ware: dict[str, float] = {ware: 0.0 for ware in all_wares}
        replay_tiles_by_coord = {tile.coord: tile for tile in result.per_tile}
        all_coords = set(replay_tiles_by_coord.keys())
        for save_tiles in save_tiles_by_ware.values():
            all_coords.update(save_tiles.keys())

        for coord in sorted(all_coords):
            tile = replay_tiles_by_coord.get(coord)
            lines.append(f"Tile: {coord}")

            # Build comparison for each ware
            for ware in all_wares:
                tile_value = 0 if tile is None else tile.tile_values.get(ware, 0)
                replay_total_by_ware[ware] += tile_value

                # Get save value
                save_tiles = save_tiles_by_ware.get(ware, {})
                save_row = save_tiles.get(coord)
                save_value = None if save_row is None else int(save_row.get("max", 0))

                # Calculate error ratio
                error_ratio = None
                if save_value not in (None, 0):
                    error_ratio = (tile_value - save_value) / save_value

                # Format output
                line_parts = [f"  {ware}:"]
                line_parts.append(f"replay={tile_value}")
                if save_value is not None:
                    line_parts.append(f"save={save_value}")
                    if error_ratio is not None:
                        line_parts.append(f"err={error_ratio:+.2%}")
                else:
                    line_parts.append("save=N/A")

                lines.append(" ".join(line_parts))

        # Total comparison
        lines.append("")
        lines.append("Total Comparison:")
        lines.append("-" * 40)

        for ware in all_wares:
            replay_total = replay_total_by_ware[ware]
            save_tiles = save_tiles_by_ware.get(ware, {})
            save_total = sum(
                int(row.get("max", 0)) for row in save_tiles.values()
            )

            if save_total > 0:
                total_error = (replay_total - save_total) / save_total
                lines.append(
                    f"  {ware}: replay={replay_total} save={save_total} "
                    f"err={total_error:+.2%}"
                )
            else:
                lines.append(
                    f"  {ware}: replay={replay_total} save={save_total} err=N/A"
                )

    return "\n".join(lines)


def main():
    """Command-line entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Compute resource totals for an X4 region"
    )
    parser.add_argument(
        "--sector-id",
        required=True,
        help="Sector identifier (e.g., Cluster_01_Sector001_macro)",
    )
    parser.add_argument(
        "--region-id",
        required=True,
        help="Region identifier (e.g., region_cluster_01_sector_001_a)",
    )
    parser.add_argument(
        "--ware",
        help="Filter by specific ware (e.g., ice, hydrogen)",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare with save data (per-tile max values)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show verbose output (per-tile details)",
    )

    args = parser.parse_args()

    try:
        result = compute_region_resources(
            sector_id=args.sector_id,
            region_id=args.region_id,
            ware_filter=args.ware,
        )

        # Load save data for comparison if requested
        save_tiles_by_ware: dict[str, dict] = {}
        if args.compare:
            try:
                save_tiles_by_ware = load_save_tiles_by_ware(
                    sector_id=args.sector_id,
                    region_id=args.region_id,
                    wares=list(result.totals.keys()),
                )
            except Exception as e:
                print(f"Warning: Failed to load save data: {e}")
                save_tiles_by_ware = {}

        print(format_result(result, save_tiles_by_ware, args.compare))
    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()
