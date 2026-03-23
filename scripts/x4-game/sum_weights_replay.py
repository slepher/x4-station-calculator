#!/usr/bin/env python3
"""Weight computation replay script - reverse engineered from X4.exe.

This script replays gas and solid field weight computation using reverse-engineered
C++ logic from X4.exe.

Usage:
    python3 sum_weights_replay.py --sector-id Cluster_713_Sector001_macro \
        --region-id region_cluster_713_sector_001_nebula_2

    python3 sum_weights_replay.py --sector-id Cluster_03_Sector001_macro \
        --region-id p1_40km_ice_field

The script automatically detects field type based on region data:
- Solid (AsteroidField): fields array contains tag="asteroid"
- Gas (Nebula): fields array contains tag="nebula"

C++ type detection (FUN_140e81620):
    case 0x08 (8): AsteroidField -> solid
    case 0x4c (76): Nebula -> gas

The implementation follows C++ reverse engineering principles:
- Functions with address suffixes (e.g., _140e860c0) match decompiled C++ logic
- Save data is for comparison only; discrepancies require new C++ evidence
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from impl import (
    replay_region_14073E110,
    RegionReplayResult,
    FieldReplayResult,
    is_gas_ware,
    is_solid_field,
    is_gas_field,
    load_solid_save_sample,
    ReplayContext,
    build_replay_context_140e860c0,
    replay_gas_field_14075bd20,
)


def get_resourcedensity(ctx: ReplayContext, ware_id: str) -> float:
    """Get resourcedensity for a ware from context."""
    for resource in ctx.resources:
        if resource.ware_key == ware_id:
            return resource.resourcedensity
    return 1.0


def format_field_result(result: FieldReplayResult, verbose: bool = False) -> str:
    """Format field replay result for output."""
    type_label = "[GAS]" if result.field_type == "gas" else "[SOLID]"

    lines = [
        f"{type_label} Field: {result.field_name}",
        f"  Boundary: {result.boundary_class}",
        f"  Sector: {result.sector_id}",
        f"  Region: {result.region_id}",
        f"  Ware: {result.ware_id}",
    ]

    if result.yield_name:
        lines.append(f"  Yield: {result.yield_name}")

    lines.extend([
        f"  Tile count: {result.tile_count}",
        "",
        "  Ware totals:",
    ])

    for ware, total in sorted(result.ware_totals.items()):
        lines.append(f"    {ware}: {total:.0f}")

    if verbose and result.per_tile:
        lines.append("")
        lines.append("  Per-tile details (first 20):")
        for tile in result.per_tile[:20]:
            lines.append(
                f"    {tile.storage_coord}: "
                f"weight={tile.profile_weight:.4f}, "
                f"values={tile.tile_values}"
            )
        if len(result.per_tile) > 20:
            lines.append(f"    ... and {len(result.per_tile) - 20} more tiles")

    return "\n".join(lines)


def compare_gas_with_save(result: FieldReplayResult, ctx: ReplayContext) -> str:
    """Compare gas result with save data."""
    if not ctx.save_sample:
        return "  No save sample data available for comparison"

    density = get_resourcedensity(ctx, result.ware_id)
    save_by_coord = ctx.save_sample
    computed_by_coord = {t.storage_coord: t for t in result.per_tile}

    both_coords = set(save_by_coord.keys()) & set(computed_by_coord.keys())
    total_save = sum(e.get("max", 0) for e in save_by_coord.values())
    total_computed = result.ware_totals.get(result.ware_id, 0)

    lines = [
        "  Comparison with save data:",
        f"    Tiles in both: {len(both_coords)}",
        f"    Tiles only in save: {len(save_by_coord) - len(both_coords)}",
        f"    Tiles only in computed: {len(computed_by_coord) - len(both_coords)}",
        f"    Save total: {total_save}",
        f"    Computed total: {total_computed:.0f}",
    ]

    if total_save > 0:
        diff_pct = (total_computed - total_save) / total_save * 100
        lines.append(f"    Difference: {total_computed - total_save:.0f} ({diff_pct:+.1f}%)")

    return "\n".join(lines)


def compare_solid_with_save(result: FieldReplayResult) -> str:
    """Compare solid result with save data."""
    save_tiles = load_solid_save_sample(result.sector_id, result.ware_id, result.yield_name)

    if not save_tiles:
        return "  No save sample data available for comparison"

    computed_by_coord = {t.storage_coord: t for t in result.per_tile}
    both_coords = set(save_tiles.keys()) & set(computed_by_coord.keys())
    total_save = sum(e.get("max", 0) for e in save_tiles.values())
    total_computed = result.ware_totals.get(result.ware_id, 0)

    lines = [
        "  Comparison with save data:",
        f"    Tiles in both: {len(both_coords)}",
        f"    Tiles only in save: {len(save_tiles) - len(both_coords)}",
        f"    Tiles only in computed: {len(computed_by_coord) - len(both_coords)}",
        f"    Save total: {total_save}",
        f"    Computed total: {total_computed:.0f}",
    ]

    if total_save > 0:
        diff_pct = (total_computed - total_save) / total_save * 100
        lines.append(f"    Difference: {total_computed - total_save:.0f} ({diff_pct:+.1f}%)")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Replay field weight computation (auto-detects gas/solid)"
    )
    parser.add_argument(
        "--sector-id",
        required=True,
        help="Sector identifier (e.g., Cluster_713_Sector001_macro)",
    )
    parser.add_argument(
        "--region-id",
        required=True,
        help="Region identifier (e.g., region_cluster_713_sector_001_nebula_2, p1_40km_ice_field)",
    )
    parser.add_argument(
        "--ware-id",
        help="Ware identifier filter (e.g., hydrogen, ice). If not specified, processes all wares.",
    )
    parser.add_argument(
        "--type",
        choices=["auto", "gas", "solid"],
        default="auto",
        help="Force field type (default: auto-detect)",
    )
    parser.add_argument("--yield-name", help="Yield name for solid fields (e.g., high, medium)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show per-tile details")
    parser.add_argument("--compare", action="store_true", help="Compare with save data")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    try:
        # Run unified replay
        result = replay_region_14073E110(
            sector_id=args.sector_id,
            region_id=args.region_id,
            ware_filter=args.ware_id,
        )

        if args.json and len(result.fields) == 1:
            # JSON output for single field
            field = result.fields[0]
            output = {
                "field_type": field.field_type,
                "field_name": field.field_name,
                "boundary_class": field.boundary_class,
                "sector_id": field.sector_id,
                "region_id": field.region_id,
                "ware_id": field.ware_id,
                "tile_count": field.tile_count,
                "ware_totals": field.ware_totals,
            }
            print(json.dumps(output, indent=2))
            return

        # Text output
        for field_result in result.fields:
            print(format_field_result(field_result, args.verbose))

            if args.compare:
                print()
                if field_result.field_type == "gas":
                    # Get context for comparison
                    ctx = build_replay_context_140e860c0(
                        sector_id=args.sector_id,
                        region_id=args.region_id,
                        ware_id=field_result.ware_id,
                    )
                    print(compare_gas_with_save(field_result, ctx))
                else:
                    print(compare_solid_with_save(field_result))

            print()

        if not result.fields:
            print(f"No fields found for region: {args.region_id}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()