#!/usr/bin/env python3
"""Weight computation replay script - reverse engineered from X4.exe.

This script replays gas and solid field weight computation using reverse-engineered
C++ logic from X4.exe.

Usage (gas):
    python3 sum_weights_replay.py gas \
        --sector-id Cluster_713_Sector001_macro \
        --region-id region_cluster_713_sector_001_nebula_2 \
        --ware-id hydrogen

Usage (solid):
    python3 sum_weights_replay.py solid \
        --sector-id Cluster_03_Sector001_macro \
        --field-ref p1_40km_ice_field

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
    build_replay_context_140e860c0,
    replay_gas_field_14075bd20,
    build_solid_region_state_14073E110,
    replay_solid_region_14073E110,
    load_solid_save_sample,
    load_solid_total_sample,
    ReplayResult,
)


def get_resourcedensity(ctx, ware_id: str) -> float:
    """Get resourcedensity for a ware from context."""
    for resource in ctx.resources:
        if resource.ware_key == ware_id:
            return resource.resourcedensity
    return 1.0


def format_result(result: ReplayResult, ctx, verbose: bool = False) -> str:
    """Format replay result for output.

    Args:
        result: ReplayResult from gas replay
        ctx: ReplayContext for density lookup
        verbose: Whether to include per-tile details

    Returns:
        Formatted string for output
    """
    lines = [
        f"Field: {result.field_name}",
        f"Boundary: {result.boundary_class}",
        f"Sector: {result.sector_id}",
        f"Region: {result.region_id}",
        f"Ware: {result.ware_id}",
        "",
        f"Tile count: {result.tile_count}",
        "",
        "Ware totals:",
    ]

    for ware, total in sorted(result.ware_totals.items()):
        density = get_resourcedensity(ctx, ware)
        falloff = total / density if density > 0 else 0
        lines.append(f"  {ware}: {total} (falloff={falloff:.2f})")

    if verbose and result.per_tile:
        lines.append("")
        lines.append("Per-tile details:")
        for tile in result.per_tile:
            density = get_resourcedensity(ctx, result.ware_id)
            falloff = tile.profile_weight if density > 0 else 0
            lines.append(
                f"  {tile.storage_coord}: "
                f"weight={tile.profile_weight:.4f}, "
                f"falloff={falloff:.4f}, "
                f"lateral=[{tile.lateral_interval[0]:.4f},{tile.lateral_interval[1]:.4f}] "
                f"radial=[{tile.radial_interval[0]:.4f},{tile.radial_interval[1]:.4f}], "
                f"values={tile.tile_values}"
            )

    return "\n".join(lines)


def compare_with_save(result: ReplayResult, ctx) -> str:
    """Compare result with save data.

    Args:
        result: ReplayResult from gas replay
        ctx: ReplayContext with save_sample data

    Returns:
        Comparison string
    """
    if not ctx.save_sample:
        return "No save sample data available for comparison"

    density = get_resourcedensity(ctx, result.ware_id)

    # Build coord lookup from save
    save_by_coord = ctx.save_sample

    # Build coord lookup from computed
    computed_by_coord = {t.storage_coord: t for t in result.per_tile}

    # Find all coords
    all_coords = set(save_by_coord.keys()) | set(computed_by_coord.keys())

    lines = [
        "Comparison with save data:",
        f"Density: {density}",
        "",
        "Per-tile comparison:",
    ]

    # Tiles in both
    both_coords = set(save_by_coord.keys()) & set(computed_by_coord.keys())
    only_save = set(save_by_coord.keys()) - set(computed_by_coord.keys())
    only_computed = set(computed_by_coord.keys()) - set(save_by_coord.keys())

    # Sort by coord
    for coord in sorted(all_coords):
        save_entry = save_by_coord.get(coord)
        computed_tile = computed_by_coord.get(coord)

        if save_entry and computed_tile:
            # In both
            save_max = save_entry.get("max", 0)
            save_falloff = save_max / density if density > 0 else 0
            computed_val = computed_tile.tile_values.get(result.ware_id, 0)
            computed_falloff = computed_tile.profile_weight

            diff = computed_val - save_max
            diff_pct = (diff / save_max * 100) if save_max else 0

            lines.append(
                f"  {coord}: "
                f"save={save_max} (f={save_falloff:.2f}), "
                f"computed={computed_val} (f={computed_falloff:.2f}), "
                f"diff={diff:+d} ({diff_pct:+.1f}%)"
            )
        elif save_entry:
            # Only in save
            save_max = save_entry.get("max", 0)
            save_falloff = save_max / density if density > 0 else 0
            lines.append(
                f"  {coord}: ONLY IN SAVE, max={save_max} (falloff={save_falloff:.2f})"
            )
        else:
            # Only in computed
            computed_val = computed_tile.tile_values.get(result.ware_id, 0)
            computed_falloff = computed_tile.profile_weight
            lines.append(
                f"  {coord}: ONLY IN COMPUTED, val={computed_val} (falloff={computed_falloff:.2f})"
            )

    # Summary
    lines.append("")
    lines.append(f"Tiles in both: {len(both_coords)}")
    lines.append(f"Tiles only in save: {len(only_save)} -> {sorted(only_save)}")
    lines.append(f"Tiles only in computed: {len(only_computed)} -> {sorted(only_computed)}")

    # Totals
    total_save = sum(e.get("max", 0) for e in save_by_coord.values())
    total_computed = result.ware_totals.get(result.ware_id, 0)
    lines.append("")
    lines.append(f"Save total: {total_save}")
    lines.append(f"Computed total: {total_computed}")
    lines.append(f"Difference: {total_computed - total_save} ({(total_computed - total_save) / total_save * 100:+.1f}%)")

    return "\n".join(lines)


def format_solid_result(result, region, verbose: bool = False) -> str:
    """Format solid replay result for output."""
    lines = [
        f"Field: {result.field_name}",
        f"Boundary: {result.boundary_class}",
        f"Sector: {result.sector_id}",
        f"Ware: {result.ware_id}",
        f"Yield: {result.yield_name}",
        "",
        f"Tile count: {result.tile_count}",
        "",
        "Ware totals:",
    ]

    for ware, total in sorted(result.ware_totals.items()):
        lines.append(f"  {ware}: {total:.0f}")

    if verbose and result.per_tile:
        lines.append("")
        lines.append("Per-tile details:")
        for tile in result.per_tile[:50]:  # Limit output
            lines.append(
                f"  {tile.storage_coord}: "
                f"weight={tile.profile_weight:.4f}, "
                f"values={tile.tile_values}"
            )
        if len(result.per_tile) > 50:
            lines.append(f"  ... and {len(result.per_tile) - 50} more tiles")

    return "\n".join(lines)


def compare_solid_with_save(result, region) -> str:
    """Compare solid result with save data."""
    save_tiles = load_solid_save_sample(result.sector_id, result.ware_id, result.yield_name)
    save_total = load_solid_total_sample(result.sector_id, result.ware_id, result.field_ref)

    if not save_tiles:
        return "No save sample data available for comparison"

    lines = [
        "Comparison with save data:",
        "",
    ]

    # Build coord lookup from computed
    computed_by_coord = {t.storage_coord: t for t in result.per_tile}

    # Find coords in both
    both_coords = set(save_tiles.keys()) & set(computed_by_coord.keys())

    total_save = sum(e.get("max", 0) for e in save_tiles.values())
    total_computed = result.ware_totals.get(result.ware_id, 0)

    lines.append(f"Tiles in both: {len(both_coords)}")
    lines.append(f"Tiles only in save: {len(save_tiles) - len(both_coords)}")
    lines.append(f"Tiles only in computed: {len(result.per_tile) - len(both_coords)}")
    lines.append("")
    lines.append(f"Save total: {total_save}")
    lines.append(f"Computed total: {total_computed:.0f}")
    if total_save > 0:
        diff_pct = (total_computed - total_save) / total_save * 100
        lines.append(f"Difference: {total_computed - total_save:.0f} ({diff_pct:+.1f}%)")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Replay field weight computation"
    )
    subparsers = parser.add_subparsers(dest="mode", help="Field type")

    # Gas subcommand
    gas_parser = subparsers.add_parser("gas", help="Gas field replay")
    gas_parser.add_argument(
        "--sector-id",
        required=True,
        help="Sector identifier (e.g., Cluster_713_Sector001_macro)",
    )
    gas_parser.add_argument(
        "--region-id",
        required=True,
        help="Region identifier (e.g., region_cluster_713_sector_001_nebula_2)",
    )
    gas_parser.add_argument(
        "--ware-id",
        required=True,
        help="Ware identifier (e.g., hydrogen, helium)",
    )
    gas_parser.add_argument("--verbose", "-v", action="store_true", help="Show per-tile details")
    gas_parser.add_argument("--json", action="store_true", help="Output as JSON")
    gas_parser.add_argument("--compare", action="store_true", help="Compare with save data")

    # Solid subcommand
    solid_parser = subparsers.add_parser("solid", help="Solid field replay")
    solid_parser.add_argument(
        "sector_id",
        nargs="?",
        default="Cluster_03_Sector001_macro",
        help="Sector ID (default: Cluster_03_Sector001_macro)",
    )
    solid_parser.add_argument(
        "field_ref",
        nargs="?",
        default="p1_40km_ice_field",
        help="Field reference (default: p1_40km_ice_field)",
    )
    solid_parser.add_argument("--ware", help="Ware type (e.g., ice, ore, silicon)")
    solid_parser.add_argument("--yield-name", help="Yield name (e.g., high, medium)")
    solid_parser.add_argument("--cut-mode", choices=["full", "15x15x3"], default="full")
    solid_parser.add_argument("--verbose", "-v", action="store_true", help="Show per-tile details")
    solid_parser.add_argument("--compare", action="store_true", help="Compare with save data")

    args = parser.parse_args()

    if args.mode is None:
        parser.print_help()
        sys.exit(1)

    try:
        if args.mode == "gas":
            # Gas field replay
            ctx = build_replay_context_140e860c0(
                sector_id=args.sector_id,
                region_id=args.region_id,
                ware_id=args.ware_id,
            )
            result = replay_gas_field_14075bd20(ctx)

            if args.json:
                density = get_resourcedensity(ctx, args.ware_id)
                output = {
                    "field_name": result.field_name,
                    "boundary_class": result.boundary_class,
                    "sector_id": result.sector_id,
                    "region_id": result.region_id,
                    "ware_id": result.ware_id,
                    "density": density,
                    "tile_count": result.tile_count,
                    "ware_totals": result.ware_totals,
                }
                print(json.dumps(output, indent=2))
            else:
                print(format_result(result, ctx, args.verbose))
                if args.compare:
                    print()
                    print(compare_with_save(result, ctx))

        elif args.mode == "solid":
            # Solid field replay
            region = build_solid_region_state_14073E110(
                args.sector_id,
                args.field_ref,
                ware=args.ware,
                yield_name=args.yield_name,
            )
            result = replay_solid_region_14073E110(region, args.cut_mode)

            print(format_solid_result(result, region, args.verbose))
            if args.compare:
                print()
                print(compare_solid_with_save(result, region))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if hasattr(args, 'verbose') and args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()