"""Weight computation functions - reverse engineered from X4.exe.

FUN_14073f750: Tile contribution computation.
FUN_140e80260: Base multiplier computation.
"""

from __future__ import annotations

import struct
from typing import TYPE_CHECKING

from .grid_enumeration import QUERY_RADIUS_14073F750
from .profile_eval import eval_profile_avg_1414ed970

if TYPE_CHECKING:
    from .replay_context import GasResourceEntry, ReplayContext


# C++ constants from DAT_*
DAT_142d80234 = 1.5  # Broadphase expansion factor


def f32(value: float) -> float:
    """Truncate to 32-bit float (simulate C++ float precision)."""
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def truncate_to_runtime_int(value: float) -> int:
    """Truncate float to runtime integer.

    Corresponds to C++ (int) cast.
    """
    if value <= 0.0:
        return 0
    return int(value)


def compute_resource_field_base_multiplier_140e80260(
    universe_yield_density: float,
    resourcedensity: float,
) -> float:
    """Compute base multiplier for a resource.

    Corresponds to FUN_140e80260.

    C++ logic:
        return f32(universe_multiplier * f32(resourcedensity))

    Args:
        universe_yield_density: Universe yield density for the ware
        resourcedensity: Resource density from region JSON

    Returns:
        Base multiplier value
    """
    return f32(f32(universe_yield_density) * f32(resourcedensity))


def resource_field_is_enabled_140e802d0(resourcedensity: float) -> bool:
    """Check if a resource field is enabled.

    Corresponds to FUN_140e802d0.

    Args:
        resourcedensity: Resource density value

    Returns:
        True if resource is enabled (density > 0)
    """
    return 0.0 < resourcedensity


def compute_tile_profile_weight_14073f750(
    ctx: ReplayContext,
    world_pos: tuple[float, float, float],
) -> tuple[float, tuple[float, float] | None, tuple[float, float] | None, float, float]:
    """Compute profile weight for a tile position.

    Corresponds to FUN_14073f750 profile evaluation.

    C++ call chain:
        FUN_14073f750
          -> Boundary::check_intersection_0x10 (broadphase, radius * 1.5)
          -> Boundary::get_lateral_interval_0x58
          -> Boundary::get_radial_interval_0x70
          -> eval_profile_avg_1414ed970

    Args:
        ctx: Replay context with field and boundary data
        world_pos: World position (x, y, z)

    Returns:
        Tuple of (combined_weight, lateral_interval, radial_interval, lateral_weight, radial_weight)
    """
    boundary = ctx.boundary

    # ========================================================================
    # Step 1: Broadphase intersection test (vtable+0x10)
    # Corresponds to C++:
    #   DAT_1477709a4 = 55425.625  (query_radius)
    #   DAT_142d80234 = 1.5        (expansion factor)
    #   cVar2 = boundary->vfunc(+0x10)(boundary, &local_108, query_radius * 1.5)
    # ========================================================================
    broadphase_radius = QUERY_RADIUS_14073F750 * DAT_142d80234  # 83138.4375
    if not boundary.check_intersection_0x10(world_pos, broadphase_radius):
        # No intersection with broadphase sphere, skip tile
        return (0.0, None, None, 0.0, 0.0)

    # ========================================================================
    # Step 2: Get intervals from boundary (vtable+0x58, vtable+0x70)
    # These use the actual query_radius (55425.625), not expanded
    # ========================================================================
    lateral_interval = boundary.get_lateral_interval_0x58(world_pos, QUERY_RADIUS_14073F750)
    radial_interval = boundary.get_radial_interval_0x70(world_pos, QUERY_RADIUS_14073F750)

    # Handle no intersection case
    if lateral_interval is None:
        return (0.0, None, radial_interval, 0.0, 0.0)

    # ========================================================================
    # Step 3: Evaluate profile averages via FUN_1414ed970
    # Corresponds to C++ FUN_14093bf90 internal logic
    # ========================================================================
    lateral_weight = eval_profile_avg_1414ed970(ctx.falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg_1414ed970(ctx.falloff.radial, radial_interval)

    combined = f32(f32(lateral_weight) * f32(radial_weight))
    return (combined, lateral_interval, radial_interval, lateral_weight, radial_weight)


def compute_tile_contribution_14073f750(
    ctx: ReplayContext,
    world_pos: tuple[float, float, float],
    ware_id: str = "*",
) -> dict[str, float]:
    """Compute contribution values for a single tile.

    Corresponds to FUN_14073f750.

    This is the main tile contribution function that:
    1. Computes profile weight from boundary intervals
    2. Applies base multiplier for each resource
    3. Returns per-ware contribution values

    Args:
        ctx: Replay context with all field data
        world_pos: World position (x, y, z)
        ware_id: Ware to compute ("*" for all wares)

    Returns:
        Dict mapping ware_key to contribution value
    """
    # Compute profile weight
    profile_weight, _, _, _, _ = compute_tile_profile_weight_14073f750(ctx, world_pos)

    if profile_weight <= 0.0:
        return {r.ware_key: 0.0 for r in ctx.resources}

    # Compute contribution for each resource
    results: dict[str, float] = {}
    for resource in ctx.resources:
        if ware_id != "*" and resource.ware_key != ware_id:
            continue

        if not resource_field_is_enabled_140e802d0(resource.resourcedensity):
            results[resource.ware_key] = 0.0
            continue

        # Get universe yield density
        universe_yield_density = ctx.universe_yield_density.get(resource.ware_key, 1.0)

        # Compute base multiplier
        base_multiplier = compute_resource_field_base_multiplier_140e80260(
            universe_yield_density,
            resource.resourcedensity,
        )

        # Compute tile value
        tile_value = f32(f32(base_multiplier) * f32(profile_weight))
        results[resource.ware_key] = tile_value

    return results


def compute_tile_result(
    ctx: ReplayContext,
    storage_coord: tuple[int, int, int],
) -> dict:
    """Compute full result for a single tile.

    Args:
        ctx: Replay context
        storage_coord: Storage coordinate (x, y, z)

    Returns:
        Dict with coord, world_coord, weights, and per-ware values
    """
    from .grid_enumeration import storage_coord_to_world_coord_140760320

    world_coord = storage_coord_to_world_coord_140760320(
        ctx.field_grid_window,
        storage_coord,
    )
    world_pos = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))

    profile_weight, _, _, _, _ = compute_tile_profile_weight_14073f750(ctx, world_pos)
    contributions = compute_tile_contribution_14073f750(ctx, world_pos, ctx.ware_id)

    return {
        "coord": storage_coord,
        "world_coord": world_coord,
        "profile_weight": profile_weight,
        "contributions": contributions,
    }