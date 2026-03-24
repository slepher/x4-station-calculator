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
DAT_142d800e8 = 1.0  # Initial accumulator value
DAT_142d80974 = 32000.0  # Bounding box margin for tile filtering
DAT_142d8098c = 55425.625  # QUERY_RADIUS


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


# ============================================================================
# FUN_14093bf90: Compute combined profile weight from boundary list
# ============================================================================

def fun_14093bf90(
    positive_boundaries: list,
    negative_boundaries: list,
    lateral_falloff: list,
    radial_falloff: list,
    local_78: tuple[float, float, float],
    query_radius: float,
) -> float:
    """Compute combined profile weight from boundary list.

    Corresponds to FUN_14093bf90.

    C++ signature:
        float FUN_14093bf90(
            longlong param_1,      // BoundaryList structure
            undefined8 param_2,    // lateral falloff profile
            undefined8 param_3,    // radial falloff profile
            float *param_4,        // query position (unused, already transformed)
            undefined4 param_5     // QUERY_RADIUS
        )

    C++ logic (decompiled):
        fVar11 = DAT_142d800e8;  // = 1.0

        // Positive boundaries: multiply weights
        for each boundary in positive_boundaries:
            if boundary->vfunc(+0x48)():  // is_enabled
                interval = boundary->vfunc(+0x58)(boundary, local_res8, &local_78, param_5)
                fVar7 = FUN_1414ed970(param_2, interval)  // lateral_weight
            if boundary->vfunc(+0x60)():  // has_radial
                interval = boundary->vfunc(+0x70)(boundary, local_88, &local_78, param_5)
                fVar8 = FUN_1414ed970(param_3, interval)  // radial_weight
                fVar7 = fVar7 * fVar8
            fVar11 = fVar11 * fVar7

        // Negative boundaries: multiply (1 - weight)
        for each boundary in negative_boundaries:
            // same logic but: fVar11 = fVar11 * (1 - fVar7)

        return fVar11

    Args:
        positive_boundaries: List of boundaries that add contribution
        negative_boundaries: List of boundaries that subtract contribution
        lateral_falloff: Lateral falloff profile (list of ProfilePoint)
        radial_falloff: Radial falloff profile (list of ProfilePoint)
        local_78: Transformed query position relative to boundary reference
        query_radius: QUERY_RADIUS constant (55425.625)

    Returns:
        Combined profile weight (product of all boundary weights)
    """
    from .profile_eval import ProfilePoint

    fVar11 = DAT_142d800e8  # 1.0
    fVar2 = DAT_142d800e8   # 1.0

    # ========================================================================
    # Loop 1: Positive boundaries (param_1 + 8 to param_1 + 0x10)
    # Multiply weights: fVar11 = fVar11 * weight
    # ========================================================================
    for boundary in positive_boundaries:
        fVar7 = fVar2  # default 1.0

        # vtable+0x48: Check if boundary is enabled
        if hasattr(boundary, 'is_enabled_0x48') and boundary.is_enabled_0x48():
            # vtable+0x58: Get lateral interval
            lateral_interval = boundary.get_lateral_interval_0x58(local_78, query_radius)
            if lateral_interval is not None:
                fVar7 = eval_profile_avg_1414ed970(lateral_falloff, lateral_interval)

        # vtable+0x60: Check if boundary has radial dimension
        if hasattr(boundary, 'has_radial_0x60') and boundary.has_radial_0x60():
            # vtable+0x70: Get radial interval
            radial_interval = boundary.get_radial_interval_0x70(local_78, query_radius)
            if radial_interval is not None:
                fVar8 = eval_profile_avg_1414ed970(radial_falloff, radial_interval)
                fVar7 = fVar7 * fVar8

        fVar11 = fVar11 * fVar7

    # ========================================================================
    # Loop 2: Negative boundaries (param_1 + 0x20 to param_1 + 0x28)
    # Multiply (1 - weight): fVar11 = fVar11 * (1 - fVar7)
    # ========================================================================
    for boundary in negative_boundaries:
        fVar7 = fVar2  # default 1.0

        # vtable+0x48: Check if boundary is enabled
        if hasattr(boundary, 'is_enabled_0x48') and boundary.is_enabled_0x48():
            # vtable+0x58: Get lateral interval
            lateral_interval = boundary.get_lateral_interval_0x58(local_78, query_radius)
            if lateral_interval is not None:
                fVar7 = eval_profile_avg_1414ed970(lateral_falloff, lateral_interval)

        # vtable+0x60: Check if boundary has radial dimension
        if hasattr(boundary, 'has_radial_0x60') and boundary.has_radial_0x60():
            # vtable+0x70: Get radial interval
            radial_interval = boundary.get_radial_interval_0x70(local_78, query_radius)
            if radial_interval is not None:
                fVar8 = eval_profile_avg_1414ed970(radial_falloff, radial_interval)
                fVar7 = fVar7 * fVar8

        fVar11 = fVar11 * (fVar2 - fVar7)  # (1 - weight)

    return fVar11


def fun_14073f750(
    ctx: ReplayContext,
    world_pos: tuple[float, float, float],
) -> float:
    """Compute tile contribution weight.

    Corresponds to C++ FUN_14073f750.

    C++ logic flow:
    1. Check if position is within bounding box (+/- margin)
       - DAT_142d80974 = 32000.0 (margin)
    2. If passed, check broadphase intersection (QUERY_RADIUS * 1.5)
    3. If passed, call FUN_14093bf90 to compute profile weight

    Args:
        ctx: Replay context with field and boundary data
        world_pos: World position (x, y, z)

    Returns:
        Profile weight (0.0 if outside boundary)
    """
    # ========================================================================
    # Step 1: Bounding box check with margin DAT_142d80974 = 32000.0
    # C++: Check if tile center is within [bbox_center - extent - margin,
    #                                      bbox_center + extent + margin]
    # ========================================================================
    field = ctx.field
    margin = DAT_142d80974  # 32000.0

    # Get field bounding box (from field position and boundary size)
    # For cylinder: center (pos_x, pos_y, pos_z), extents (radius, half_height, radius)
    bbox_center = (field.position_x, field.position_y, field.position_z)

    # Get boundary extents from boundary object
    # CylinderBoundary has radius and half_height
    boundary = ctx.boundary
    if hasattr(boundary, 'radius'):
        extent_x = boundary.radius
        extent_z = boundary.radius
    else:
        # Fallback: use default or try to get from boundary
        extent_x = extent_z = 0.0

    if hasattr(boundary, 'half_height'):
        extent_y = boundary.half_height
    elif hasattr(boundary, 'height'):
        extent_y = boundary.height / 2.0
    else:
        extent_y = 0.0

    x, y, z = world_pos
    cx, cy, cz = bbox_center

    # Bounding box check with margin
    # C++: auVar10._0_4_ - local_138 <= fVar17 + DAT_142d80974
    #      fVar17 - DAT_142d80974 <= auVar10._0_4_ + local_138
    if not (cx - extent_x - margin <= x <= cx + extent_x + margin):
        return 0.0
    if not (cy - extent_y - margin <= y <= cy + extent_y + margin):
        return 0.0
    if not (cz - extent_z - margin <= z <= cz + extent_z + margin):
        return 0.0

    # ========================================================================
    # Step 2: Broadphase intersection test (vtable+0x10)
    # C++: cVar2 = boundary->vfunc(+0x10)(boundary, &local_108, DAT_1477709a4 * DAT_142d80234)
    # DAT_1477709a4 = DAT_142d8098c = 55425.625
    # ========================================================================
    broadphase_radius = QUERY_RADIUS_14073F750 * DAT_142d80234  # 83138.4375
    if not ctx.boundary.check_intersection_0x10(world_pos, broadphase_radius):
        return 0.0

    # ========================================================================
    # Step 3: Compute profile weight via FUN_14093bf90
    # C++: FUN_14093bf90(param_1 + 0x2b0, param_1 + 0x390, param_1 + 0x3c0, &local_108, DAT_1477709a4)
    # ========================================================================
    combined_weight = fun_14093bf90(
        positive_boundaries=[ctx.boundary],
        negative_boundaries=[],
        lateral_falloff=ctx.falloff.lateral,
        radial_falloff=ctx.falloff.radial,
        local_78=world_pos,
        query_radius=QUERY_RADIUS_14073F750,
    )

    return combined_weight


def compute_tile_profile_weight_14073f750(
    ctx: ReplayContext,
    world_pos: tuple[float, float, float],
) -> tuple[float, tuple[float, float] | None, tuple[float, float] | None, float, float]:
    """Compute profile weight for a tile position.

    Corresponds to FUN_14073f750 profile evaluation.

    C++ call chain:
        FUN_14073f750
          -> Boundary::check_intersection_0x10 (broadphase, radius * 1.5)
          -> FUN_14093bf90 (compute combined profile weight)
            -> Boundary::get_lateral_interval_0x58
            -> Boundary::get_radial_interval_0x70
            -> FUN_1414ed970 (eval_profile_avg)

    Args:
        ctx: Replay context with field and boundary data
        world_pos: World position (x, y, z)

    Returns:
        Tuple of (combined_weight, lateral_interval, radial_interval, lateral_weight, radial_weight)
    """
    # ========================================================================
    # Step 1: Broadphase intersection test (vtable+0x10)
    # C++: cVar2 = boundary->vfunc(+0x10)(boundary, &local_108, query_radius * 1.5)
    # ========================================================================
    broadphase_radius = QUERY_RADIUS_14073F750 * DAT_142d80234  # 83138.4375
    if not ctx.boundary.check_intersection_0x10(world_pos, broadphase_radius):
        return (0.0, None, None, 0.0, 0.0)

    # ========================================================================
    # Step 2: Compute combined weight via FUN_14093bf90
    # This function internally computes intervals and profile weights
    # ========================================================================
    combined = fun_14093bf90(
        positive_boundaries=[ctx.boundary],
        negative_boundaries=[],
        lateral_falloff=ctx.falloff.lateral,
        radial_falloff=ctx.falloff.radial,
        local_78=world_pos,
        query_radius=QUERY_RADIUS_14073F750,
    )

    # Get intervals for return value (for debugging)
    lateral_interval = ctx.boundary.get_lateral_interval_0x58(world_pos, QUERY_RADIUS_14073F750)
    radial_interval = ctx.boundary.get_radial_interval_0x70(world_pos, QUERY_RADIUS_14073F750)

    if lateral_interval is None:
        return (0.0, None, radial_interval, 0.0, 0.0)

    lateral_weight = eval_profile_avg_1414ed970(ctx.falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg_1414ed970(ctx.falloff.radial, radial_interval)

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