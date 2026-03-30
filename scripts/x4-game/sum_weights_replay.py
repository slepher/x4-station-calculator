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
    replay_region_unified,
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
from impl.save_sample_loader import load_save_sample


def get_resourcedensity(ctx: ReplayContext, ware_id: str) -> float:
    """Get resourcedensity for a ware from context."""
    for resource in ctx.resources:
        if resource.ware_key == ware_id:
            return resource.resourcedensity
    return 1.0


def format_field_result(
    result: FieldReplayResult,
    save_tiles_by_ware: dict[str, dict] | None = None,
    verbose: bool = False,
    compare: bool = False,
) -> str:
    """Format field replay result with per-tile comparison.

    Args:
        result: Field replay result
        save_tiles_by_ware: Dict mapping ware_id to save tiles dict for comparison
        verbose: Show per-tile details
        compare: Compare with save data
    """
    lines = [
        f"field={result.sector_id} / {result.region_id}",
        f"boundary_class={result.boundary_class}",
        f"tile_count={result.tile_count}",
        "ware_totals:",
    ]

    # Get all wares from result
    all_wares = sorted(result.ware_totals.keys())

    for ware, total in sorted(result.ware_totals.items()):
        lines.append(f"  {ware}={total:.0f}")

    # Per-tile values with comparison
    if verbose and result.per_tile:
        lines.append("tile_values:")

        # Calculate replay totals per ware for verification
        replay_total_by_ware: dict[str, int] = {ware: 0 for ware in all_wares}

        for tile in result.per_tile:
            coord = tile.storage_coord
            # Build values string
            values_parts = []
            for ware in all_wares:
                value = tile.tile_values.get(ware, 0)
                values_parts.append(f"{ware}={value:.0f}")
                replay_total_by_ware[ware] += int(value)

            line = f"  {coord} " + " ".join(values_parts)

            # Add comparison if requested
            if compare and save_tiles_by_ware:
                compare_parts = []
                for ware in all_wares:
                    tile_value = tile.tile_values.get(ware, 0)
                    save_tiles = save_tiles_by_ware.get(ware, {})
                    save_row = save_tiles.get(coord)
                    save_value = None if save_row is None else int(save_row.get("max", 0))

                    error_ratio = None
                    if save_value not in (None, 0):
                        error_ratio = (tile_value - save_value) / save_value

                    compare_parts.append(
                        f"{ware}:save={save_value if save_value is not None else 'N/A'},"
                        f"err={f'{error_ratio:.2%}' if error_ratio is not None else 'N/A'}"
                    )
                line += " | " + " ".join(compare_parts)

            lines.append(line)

        # Total comparison
        if compare and save_tiles_by_ware:
            lines.append("total_compare:")
            for ware in all_wares:
                replay_total = replay_total_by_ware[ware]
                # Calculate save total for this ware
                save_tiles = save_tiles_by_ware.get(ware, {})
                save_total = sum(
                    int(row.get("max", 0)) for row in save_tiles.values()
                )
                if save_total > 0:
                    total_error = (replay_total - save_total) / save_total
                    lines.append(f"  {ware}: replay={replay_total} save={save_total} error_ratio={total_error:.2%}")
                else:
                    lines.append(f"  {ware}: replay={replay_total} save={save_total} error_ratio=N/A")

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
        result = replay_region_unified(
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
            # Load save data for comparison - for all wares in the field
            save_tiles_by_ware: dict[str, dict] = {}
            if args.compare:
                all_wares = list(field_result.ware_totals.keys())
                for ware in all_wares:
                    save_tiles_by_ware[ware] = load_save_sample(
                        sector_id=args.sector_id,
                        ware=ware,
                        yield_name=field_result.yield_name,
                        region_filter=args.region_id,
                    )

            print(format_field_result(field_result, save_tiles_by_ware, args.verbose, args.compare))

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