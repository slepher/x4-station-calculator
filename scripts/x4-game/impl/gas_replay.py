"""Gas field replay main entry - reverse engineered from X4.exe.

FUN_14075bd20: Main entry for gas field weight computation.
FUN_14075c250: Recursive grid subdivision.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .grid_enumeration import (
    AREA_SIZE,
    QUERY_RADIUS_14073F750,
    QueryGridWindow,
    build_query_grid_window_140760320,
)
from .weight_computation import (
    compute_tile_contribution_14073f750,
    compute_tile_profile_weight_14073f750,
    truncate_to_runtime_int,
    f32,
)

if TYPE_CHECKING:
    from .replay_context import ReplayContext


@dataclass
class TileResult:
    """Result for a single tile."""
    storage_coord: tuple[int, int, int]
    world_coord: tuple[int, int, int]
    profile_weight: float
    lateral_interval: tuple[float, float] | None = None
    radial_interval: tuple[float, float] | None = None
    lateral_weight: float = 0.0
    radial_weight: float = 0.0
    contributions: dict[str, float] = field(default_factory=dict)
    tile_values: dict[str, int] = field(default_factory=dict)


@dataclass
class ReplayResult:
    """Result of gas field replay."""
    field_name: str
    boundary_class: str
    sector_id: str
    region_id: str
    ware_id: str
    tile_count: int
    tile_coords: list[tuple[int, int, int]]
    per_tile: list[TileResult]
    ware_totals: dict[str, int]
    grid_window: QueryGridWindow


# C++ constants from DAT_*
DAT_142d80994 = 64000.0  # AREA_SIZE
DAT_142d842b0 = 64000.0
DAT_142d7ff50 = 0.5
DAT_142d83660 = 1.5625e-05  # 1/64000
DAT_142d83a50 = 0.5
DAT_142d7fbe8 = 1e-6
DAT_142d80300 = 1.7320508  # sqrt(3)


def _floor_to_int(f: float) -> int:
    """C++ style floor for positive and negative numbers."""
    i = int(f)
    if f < 0 and f != i:
        return i - 1
    return i


def compute_field_bounding_box(
    ctx: ReplayContext,
) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Compute bounding box for a field.

    Corresponds to the bounding box computation in FUN_14075bd20.
    """
    boundary = ctx.boundary
    field = ctx.field
    extension = QUERY_RADIUS_14073F750

    # Ensure sampled points are generated for SplineTube
    if hasattr(boundary, '_ensure_sampled'):
        boundary._ensure_sampled()

    # Check if boundary has precomputed bounding box
    if hasattr(boundary, 'box_min') and hasattr(boundary, 'box_max'):
        if boundary.box_min is not None and boundary.box_max is not None:
            return (boundary.box_min, boundary.box_max)

    # Compute from boundary type
    if hasattr(boundary, 'radius'):
        radius = boundary.radius

        if hasattr(boundary, 'sampled_points') and boundary.sampled_points:
            points = boundary.sampled_points
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            zs = [p[2] for p in points]
            min_x = min(xs) - radius - extension
            max_x = max(xs) + radius + extension
            min_y = min(ys) - radius - extension
            max_y = max(ys) + radius + extension
            min_z = min(zs) - radius - extension
            max_z = max(zs) + radius + extension
        elif hasattr(boundary, 'linear'):
            linear = boundary.linear
            min_x = field.position_x - radius - extension
            max_x = field.position_x + radius + extension
            min_y = field.position_y - extension
            max_y = field.position_y + linear + extension
            min_z = field.position_z - radius - extension
            max_z = field.position_z + radius + extension
        else:
            min_x = field.position_x - radius - extension
            max_x = field.position_x + radius + extension
            min_y = field.position_y - radius - extension
            max_y = field.position_y + radius + extension
            min_z = field.position_z - radius - extension
            max_z = field.position_z + radius + extension
    else:
        size_x = getattr(boundary, 'size_x', 0) or 0
        size_y = getattr(boundary, 'size_y', 0) or 0
        size_z = getattr(boundary, 'size_z', 0) or 0
        min_x = field.position_x - size_x - extension
        max_x = field.position_x + size_x + extension
        min_y = field.position_y - size_y - extension
        max_y = field.position_y + size_y + extension
        min_z = field.position_z - size_z - extension
        max_z = field.position_z + size_z + extension

    return ((min_x, min_y, min_z), (max_x, max_y, max_z))


def _compute_grid_origin_and_depth_14075BD20(
    min_corner: tuple[float, float, float],
    max_corner: tuple[float, float, float],
) -> tuple[tuple[float, float, float], int]:
    """Compute grid origin and depth from bounding box.

    Corresponds to FUN_14075bd20 lines 150-210.
    """
    DAT_142d84300 = 800000.0
    DAT_142d84580 = -800000.0
    DAT_142d84280 = 32000.0

    # Compute bbox size
    bbox_size = (
        max_corner[0] - min_corner[0],
        max_corner[1] - min_corner[1],
        max_corner[2] - min_corner[2],
    )

    # Clamp size
    clamped_size = tuple(
        max(DAT_142d84580, min(DAT_142d84300, s)) for s in bbox_size
    )

    # Convert to grid indices
    min_grid_idx = tuple(_floor_to_int(c * DAT_142d83660) for c in min_corner)
    max_grid_idx = tuple(_floor_to_int(c * DAT_142d83660) for c in max_corner)

    # Compute center index
    center_idx = tuple(
        _floor_to_int((min_grid_idx[i] + max_grid_idx[i]) * DAT_142d7ff50)
        for i in range(3)
    )

    # Grid origin = center_idx * 64000 + 32000
    grid_origin = tuple(
        float(center_idx[i]) * DAT_142d80994 + DAT_142d84280
        for i in range(3)
    )

    # Compute depth using while loop equivalent:
    # depth = 0; cell_size = 64000
    # while cell_size < max_size * 0.5: cell_size *= 2; depth += 1
    max_size = max(abs(s) for s in clamped_size)
    depth = 0
    cell_size = DAT_142d80994
    threshold = max_size * DAT_142d7ff50
    while cell_size < threshold:
        cell_size *= 2.0
        depth += 1

    return grid_origin, depth


def _enumerate_tiles_recursive_14075C250(
    ctx: ReplayContext,
    results: list[TileResult],
    grid_origin: tuple[float, float, float],
    depth: int,
) -> None:
    """Recursive 2×2×2 subdivision for tile enumeration.

    Corresponds to FUN_14075c250.
    Uses boundary.check_intersection_0x10() for spatial pruning.
    """
    cell_size = DAT_142d80994 * (1 << depth)

    # 2×2×2 loop
    for i in range(2):
        for j in range(2):
            for k in range(2):
                # Compute cell position
                cell_x = (i - DAT_142d7ff50) * cell_size + grid_origin[0]
                cell_y = (j - DAT_142d7ff50) * cell_size + grid_origin[1]
                cell_z = (k - DAT_142d7ff50) * cell_size + grid_origin[2]

                if depth == 0:
                    # Leaf level: compute tile contribution
                    norm_x = cell_x * DAT_142d83660 + DAT_142d83a50
                    norm_y = cell_y * DAT_142d83660 + DAT_142d83a50
                    norm_z = cell_z * DAT_142d83660 + DAT_142d83a50

                    tile_coord = (
                        _floor_to_int(norm_x) * int(DAT_142d842b0),
                        _floor_to_int(norm_y) * int(DAT_142d842b0),
                        _floor_to_int(norm_z) * int(DAT_142d842b0),
                    )

                    world_pos = (float(tile_coord[0]), float(tile_coord[1]), float(tile_coord[2]))

                    # Compute profile weight with falloff details
                    (profile_weight, lateral_interval, radial_interval,
                     lateral_weight, radial_weight) = compute_tile_profile_weight_14073f750(ctx, world_pos)

                    if profile_weight > DAT_142d7fbe8:
                        contributions = compute_tile_contribution_14073f750(ctx, world_pos, ctx.ware_id)

                        tile_values: dict[str, int] = {}
                        for ware_key, value in contributions.items():
                            tile_values[ware_key] = truncate_to_runtime_int(value)

                        tile_result = TileResult(
                            storage_coord=tile_coord,
                            world_coord=(int(world_pos[0]), int(world_pos[1]), int(world_pos[2])),
                            profile_weight=profile_weight,
                            lateral_interval=lateral_interval,
                            radial_interval=radial_interval,
                            lateral_weight=lateral_weight,
                            radial_weight=radial_weight,
                            contributions=contributions,
                            tile_values=tile_values,
                        )
                        results.append(tile_result)
                else:
                    # Check if cell intersects boundary (vtable+0x10)
                    # bounding_radius = cell_size * sqrt(3)
                    bounding_radius = cell_size * DAT_142d80300
                    cell_center = (cell_x, cell_y, cell_z)

                    if ctx.boundary.check_intersection_0x10(cell_center, bounding_radius):
                        _enumerate_tiles_recursive_14075C250(
                            ctx, results, cell_center, depth - 1
                        )


def replay_gas_field_14075bd20(
    ctx: ReplayContext,
) -> ReplayResult:
    """Replay gas field weight computation.

    Corresponds to FUN_14075bd20 - main entry for gas field computation.
    Uses recursive 2×2×2 subdivision with boundary.check_intersection_0x10()
    for spatial pruning.
    """
    # Ensure boundary is initialized
    if hasattr(ctx.boundary, '_ensure_sampled'):
        ctx.boundary._ensure_sampled()

    # Compute bounding box
    bbox_min, bbox_max = compute_field_bounding_box(ctx)

    # Compute grid origin and depth
    grid_origin, depth = _compute_grid_origin_and_depth_14075BD20(bbox_min, bbox_max)

    # Recursive enumeration and weight computation
    per_tile: list[TileResult] = []
    _enumerate_tiles_recursive_14075C250(ctx, per_tile, grid_origin, depth)

    # Aggregate totals
    ware_totals: dict[str, int] = {}
    for tile in per_tile:
        for ware_key, value in tile.tile_values.items():
            if ware_key not in ware_totals:
                ware_totals[ware_key] = 0
            ware_totals[ware_key] += value

    return ReplayResult(
        field_name=ctx.field.name,
        boundary_class=ctx.field.field_type,
        sector_id=ctx.sector_id,
        region_id=ctx.region_id,
        ware_id=ctx.ware_id,
        tile_count=len(per_tile),
        tile_coords=[t.storage_coord for t in per_tile],
        per_tile=per_tile,
        ware_totals=ware_totals,
        grid_window=ctx.field_grid_window,
    )