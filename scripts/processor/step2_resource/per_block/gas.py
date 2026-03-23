"""Gas resource per-block calculation functions.

This module provides functions for calculating gas resource yields on a per-block basis.
Code is extracted from verified replay scripts with address suffixes removed from function names.

Source: scripts/x4-game/gas_sum_weights_replay.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from processor.step2_resource.per_block.common import (
    AREA_HALF,
    AREA_SIZE,
    QUERY_RADIUS,
    SAVE_GRID_MAX_CENTER_XZ,
    SAVE_GRID_MAX_CENTER_Y,
    SAVE_GRID_MIN_CENTER_XZ,
    SAVE_GRID_MIN_CENTER_Y,
    SPLINETUBE_INTERVAL_SAMPLE_COUNT,
    FalloffProfiles,
    ProfilePoint,
    QueryGridWindow,
    SplineControlPoint,
    build_polyline_arclength_table,
    build_query_grid_window,
    build_runtime_sampled_splinetube_points,
    clamp,
    compute_composite_spline_interval_scan,
    compute_splinetube_radial_interval,
    compute_storage_axis_range,
    dot,
    eval_profile_avg,
    f32,
    truncate_to_runtime_int,
    vec_add,
    vec_length,
    vec_mul,
    vec_sub,
)


# =============================================================================
# Hexagonal Grid Constants (from C++)
# =============================================================================

DAT_142d80234 = 1.5  # hex X step multiplier
DAT_142d80300 = 1.7320508  # sqrt(3)
DAT_142d80044 = 0.8660254  # sqrt(3)/2


# =============================================================================
# Gas Data Classes
# =============================================================================

@dataclass
class GasResourceEntry:
    """A gas resource entry in a nebula field."""
    ware_key: str
    resourcedensity: float
    recharge_time_seconds: float
    gather_speed_factor: float
    yield_name: str = ""


@dataclass
class NebulaFieldState:
    """Runtime state for a nebula (gas) field during calculation."""
    name: str
    boundary_class: str
    position_x: float
    position_y: float
    position_z: float
    radius: float
    linear: float
    falloff: FalloffProfiles
    resources: list[GasResourceEntry]
    size_x: float = 0.0
    size_y: float = 0.0
    size_z: float = 0.0
    spline: list[SplineControlPoint] = field(default_factory=list)
    universe_yield_density_by_ware: dict[str, float] = field(default_factory=dict)


# =============================================================================
# Resource Field Functions
# =============================================================================

def compute_resource_field_base_multiplier(
    field: NebulaFieldState,
    resource: GasResourceEntry,
) -> float:
    """Compute the base multiplier for a gas resource field."""
    universe_multiplier = field.universe_yield_density_by_ware.get(resource.ware_key, 1.0)
    return f32(f32(universe_multiplier) * f32(resource.resourcedensity))


def resource_field_is_enabled(resource: GasResourceEntry) -> bool:
    """Check if a gas resource field is enabled."""
    return 0.0 < resource.resourcedensity


def compute_uniform_profile_weight_for_cylinder(field: NebulaFieldState) -> float:
    """Compute uniform profile weight for a 40km cylinder."""
    if field.falloff.lateral_factor is None or field.falloff.radial_factor is None:
        raise ValueError("cylinder replay path requires precomputed lateral/radial factors")
    return f32(f32(field.falloff.lateral_factor) * f32(field.falloff.radial_factor))


# =============================================================================
# Cylinder Functions
# =============================================================================

def compute_cylinder_axial_interval(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the axial interval for a gas cylinder at a query point."""
    p0 = (field.position_x, field.position_y, field.position_z)
    p1 = (field.position_x, field.position_y + field.linear, field.position_z)
    axis = vec_sub(p1, p0)
    axis_len = vec_length(axis)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    delta = QUERY_RADIUS / axis_len
    return (clamp(t - delta, 0.0, 1.0), clamp(t + delta, 0.0, 1.0))


def compute_cylinder_radial_interval(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the radial interval for a gas cylinder at a query point."""
    p0 = (field.position_x, field.position_y, field.position_z)
    p1 = (field.position_x, field.position_y + field.linear, field.position_z)
    axis = vec_sub(p1, p0)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    closest = vec_add(p0, vec_mul(axis, t))
    distance_to_axis = vec_length(vec_sub(query, closest))
    return (
        clamp((distance_to_axis - QUERY_RADIUS) / field.radius, 0.0, 1.0),
        clamp((distance_to_axis + QUERY_RADIUS) / field.radius, 0.0, 1.0),
    )


def compute_cylinder_profile_weight_for_query(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> float:
    """Compute the profile weight for a gas cylinder at a query point."""
    axial_interval = compute_cylinder_axial_interval(field, query)
    radial_interval = compute_cylinder_radial_interval(field, query)
    axial_weight = eval_profile_avg(field.falloff.lateral, axial_interval)
    radial_weight = eval_profile_avg(field.falloff.radial, radial_interval)
    return f32(f32(axial_weight) * f32(radial_weight))


# =============================================================================
# Sphere Functions
# =============================================================================

def compute_sphere_radial_interval(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the radial interval for a gas sphere at a query point."""
    center = (field.position_x, field.position_y, field.position_z)
    distance_to_center = vec_length(vec_sub(query, center))
    return (
        clamp((distance_to_center - QUERY_RADIUS) / field.radius, 0.0, 1.0),
        clamp((distance_to_center + QUERY_RADIUS) / field.radius, 0.0, 1.0),
    )


# =============================================================================
# Box Functions
# =============================================================================

def compute_box_normalized_scalar(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> float:
    """Compute the normalized scalar for a gas box at a query point."""
    dx = abs(query[0] - field.position_x)
    dy = abs(query[1] - field.position_y)
    dz = abs(query[2] - field.position_z)
    return max(
        dx / field.size_x if field.size_x > 0.0 else float("inf"),
        dy / field.size_y if field.size_y > 0.0 else float("inf"),
        dz / field.size_z if field.size_z > 0.0 else float("inf"),
    )


def compute_box_interval(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the interval for a gas box at a query point."""
    dx = abs(query[0] - field.position_x)
    dy = abs(query[1] - field.position_y)
    dz = abs(query[2] - field.position_z)
    lower = max(
        clamp((dx - QUERY_RADIUS) / field.size_x, 0.0, 1.0) if field.size_x > 0.0 else 1.0,
        clamp((dy - QUERY_RADIUS) / field.size_y, 0.0, 1.0) if field.size_y > 0.0 else 1.0,
        clamp((dz - QUERY_RADIUS) / field.size_z, 0.0, 1.0) if field.size_z > 0.0 else 1.0,
    )
    upper = min(
        max(
            clamp((dx + QUERY_RADIUS) / field.size_x, 0.0, 1.0) if field.size_x > 0.0 else 1.0,
            clamp((dy + QUERY_RADIUS) / field.size_y, 0.0, 1.0) if field.size_y > 0.0 else 1.0,
            clamp((dz + QUERY_RADIUS) / field.size_z, 0.0, 1.0) if field.size_z > 0.0 else 1.0,
        ),
        1.0,
    )
    return (lower, upper)


# =============================================================================
# Query Box Intersection
# =============================================================================

def area_intersects_field_query_box(
    field: NebulaFieldState,
    tile_x: int,
    tile_y: int,
    tile_z: int,
) -> bool:
    """Check if a 64k query box intersects a gas field boundary (cylinder)."""
    min_y = field.position_y
    max_y = field.position_y + field.linear
    tile_min_y = tile_y - AREA_HALF
    tile_max_y = tile_y + AREA_HALF
    overlaps_y = not (tile_max_y < min_y or tile_min_y > max_y)
    if not overlaps_y:
        return False

    dx = abs(field.position_x - tile_x)
    dz = abs(field.position_z - tile_z)
    clamped_dx = max(dx - AREA_HALF, 0.0)
    clamped_dz = max(dz - AREA_HALF, 0.0)
    return (clamped_dx * clamped_dx + clamped_dz * clamped_dz) <= (field.radius * field.radius)


# =============================================================================
# Candidate Area Enumeration
# =============================================================================

def enumerate_candidate_area_centers_for_cylinder(field: NebulaFieldState) -> list[tuple[int, int, int]]:
    """Enumerate candidate 64k area centers for a gas cylinder."""
    from processor.step2_resource.per_block.common import world_coord_from_storage_coord

    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
    min_x = field.position_x - field.radius - AREA_HALF
    max_x = field.position_x + field.radius + AREA_HALF
    min_y = field.position_y - AREA_HALF
    max_y = field.position_y + field.linear + AREA_HALF
    min_z = field.position_z - field.radius - AREA_HALF
    max_z = field.position_z + field.radius + AREA_HALF

    start_x, end_x = compute_storage_axis_range(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range(
        min_y, max_y, grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )

    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                world_coord = world_coord_from_storage_coord(grid, (x, y, z))
                if area_intersects_field_query_box(field, *world_coord):
                    coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def enumerate_hex_grid_for_boundary(
    field: NebulaFieldState,
    points: list[tuple[float, float, float]],
    tube_radius: float,
    query_radius: float,
) -> list[tuple[int, int, int]]:
    """Enumerate hex grid cells that may intersect the SplineTube boundary.

    Corresponds to FUN_14070f330 - main hexagonal grid enumeration function.

    C++ logic:
    1. Compute world coordinates from hex grid (col, row)
    2. Use FUN_14093b8b0 to check if point is inside boundary
    3. Return list of storage coordinates for matching cells

    Note: The actual C++ uses a more complex iteration with multiple passes
    and collision detection. This implementation focuses on the enumeration
    pattern that matches the save data (square grid, not hexagonal).

    Args:
        field: Nebula field state
        points: Sampled spline points
        tube_radius: Tube radius
        query_radius: Query radius

    Returns:
        List of (x, y, z) storage coordinates for candidate tiles
    """
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
    xs = [point[0] for point in points]
    zs = [point[2] for point in points]
    extension = tube_radius + query_radius
    min_x = min(xs) - extension
    max_x = max(xs) + extension
    min_z = min(zs) - extension
    max_z = max(zs) + extension

    start_x, end_x = compute_storage_axis_range(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_z, end_z = compute_storage_axis_range(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )

    # Use square grid enumeration (matches save data pattern)
    # The C++ FUN_14070f330 uses hexagonal grid, but actual save uses square grid
    # This suggests there's a different code path or the hex grid is transformed
    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        z = start_z
        while z <= end_z:
            coords.append((x, 0, z))
            z += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


# Legacy function name for backward compatibility
def enumerate_candidate_area_centers_for_splinetube(
    field: NebulaFieldState,
    sampled_points: list[tuple[float, float, float]],
    tube_radius: float,
    query_radius: float,
) -> list[tuple[int, int, int]]:
    """Enumerate candidate 64k area centers for a gas splinetube (planar).

    Deprecated: This function name was incorrectly assigned.
    The actual FUN_14093EB60 is a point containment check, not an enumeration function.
    Use enumerate_hex_grid_for_boundary instead.
    """
    return enumerate_hex_grid_for_boundary(field, sampled_points, tube_radius, query_radius)


def enumerate_candidate_area_centers_for_sphere(field: NebulaFieldState) -> list[tuple[int, int, int]]:
    """Enumerate candidate 64k area centers for a gas sphere."""
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
    extension = field.radius + QUERY_RADIUS
    min_x = field.position_x - extension
    max_x = field.position_x + extension
    min_y = field.position_y - extension
    max_y = field.position_y + extension
    min_z = field.position_z - extension
    max_z = field.position_z + extension
    start_x, end_x = compute_storage_axis_range(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range(
        min_y, max_y, grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def enumerate_candidate_area_centers_for_box(field: NebulaFieldState) -> list[tuple[int, int, int]]:
    """Enumerate candidate 64k area centers for a gas box."""
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
    extension_x = field.size_x + QUERY_RADIUS
    extension_y = field.size_y + QUERY_RADIUS
    extension_z = field.size_z + QUERY_RADIUS
    min_x = field.position_x - extension_x
    max_x = field.position_x + extension_x
    min_y = field.position_y - extension_y
    max_y = field.position_y + extension_y
    min_z = field.position_z - extension_z
    max_z = field.position_z + extension_z
    start_x, end_x = compute_storage_axis_range(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range(
        min_y, max_y, grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


# =============================================================================
# Main Replay Functions
# =============================================================================

def replay_cylinder_field(field: NebulaFieldState) -> dict[str, object]:
    """Replay gas cylinder field calculation."""
    from processor.step2_resource.per_block.common import world_coord_from_storage_coord

    if len(field.resources) != 1:
        raise ValueError("legacy cylinder replay path expects one gas resource row")
    resource = field.resources[0]
    tile_coords = enumerate_candidate_area_centers_for_cylinder(field)
    per_tile: list[dict[str, object]] = []
    total = 0
    if resource_field_is_enabled(resource):
        base_multiplier = compute_resource_field_base_multiplier(field, resource)
    else:
        base_multiplier = 0.0
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
    for coord in tile_coords:
        if base_multiplier <= 0.0:
            falloff_weight = 0.0
            tile_value = 0
        else:
            world_coord = world_coord_from_storage_coord(grid, coord)
            query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
            falloff_weight = compute_cylinder_profile_weight_for_query(field, query)
            tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(falloff_weight)))
        total += tile_value
        per_tile.append(
            {
                "coord": coord,
                "world_coord": world_coord_from_storage_coord(grid, coord),
                "falloff_weight": falloff_weight,
                resource.ware_key: tile_value,
            }
        )
    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(tile_coords),
        "tile_coords": sorted(tile_coords),
        "per_tile": per_tile,
        "ware_totals": {resource.ware_key: total},
        "grid_window": grid,
    }


def replay_splinetube_field(field: NebulaFieldState) -> dict[str, object]:
    """Replay gas splinetube field calculation."""
    from processor.step2_resource.per_block.common import world_coord_from_storage_coord

    bezier_points = build_runtime_sampled_splinetube_points(field.spline)
    sampled_points = bezier_points  # For gas, we use the same points
    seg_lengths, accum, total_length = build_polyline_arclength_table(sampled_points)
    threshold = QUERY_RADIUS + field.radius
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)
    candidate_tiles = enumerate_candidate_area_centers_for_splinetube(
        field,
        sampled_points,
        field.radius,
        QUERY_RADIUS,
    )

    per_tile: list[dict[str, object]] = []
    ware_totals = {resource.ware_key: 0 for resource in field.resources}

    for coord in candidate_tiles:
        world_coord = world_coord_from_storage_coord(grid, coord)
        query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
        lateral_interval, representative_distance = compute_composite_spline_interval_scan(
            query,
            sampled_points,
            seg_lengths,
            accum,
            total_length,
            threshold,
            SPLINETUBE_INTERVAL_SAMPLE_COUNT,
        )
        if lateral_interval is None:
            continue

        radial_interval = compute_splinetube_radial_interval(
            representative_distance,
            field.radius,
            QUERY_RADIUS,
        )

        lateral_weight = eval_profile_avg(field.falloff.lateral, lateral_interval)
        radial_weight = eval_profile_avg(field.falloff.radial, radial_interval)
        tile_weight = lateral_weight * radial_weight

        tile_entry: dict[str, object] = {
            "coord": coord,
            "world_coord": world_coord,
            "representative_distance": representative_distance,
            "lateral_interval": lateral_interval,
            "radial_interval": radial_interval,
            "lateral_weight": lateral_weight,
            "radial_weight": radial_weight,
            "tile_weight": tile_weight,
        }
        for resource in field.resources:
            if not resource_field_is_enabled(resource):
                tile_value = 0
            else:
                base_multiplier = compute_resource_field_base_multiplier(field, resource)
                tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(tile_weight)))
            tile_entry[resource.ware_key] = tile_value
            ware_totals[resource.ware_key] += tile_value
        per_tile.append(tile_entry)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(per_tile),
        "tile_coords": [entry["coord"] for entry in per_tile],
        "per_tile": per_tile,
        "ware_totals": ware_totals,
        "sampled_point_count": len(bezier_points),
        "sampled_segment_count": len(bezier_points) - 1,
        "query_radius": QUERY_RADIUS,
        "grid_window": grid,
    }


def replay_sphere_field(field: NebulaFieldState) -> dict[str, object]:
    """Replay gas sphere field calculation."""
    from processor.step2_resource.per_block.common import world_coord_from_storage_coord

    per_tile: list[dict[str, object]] = []
    ware_totals = {resource.ware_key: 0 for resource in field.resources}
    center = (field.position_x, field.position_y, field.position_z)
    threshold = field.radius + QUERY_RADIUS
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)

    for coord in enumerate_candidate_area_centers_for_sphere(field):
        world_coord = world_coord_from_storage_coord(grid, coord)
        query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
        distance_to_center = vec_length(vec_sub(query, center))
        if distance_to_center > threshold:
            continue
        radial_interval = compute_sphere_radial_interval(field, query)
        radial_weight = eval_profile_avg(field.falloff.radial, radial_interval)
        tile_entry: dict[str, object] = {
            "coord": coord,
            "world_coord": world_coord,
            "radial_interval": radial_interval,
            "radial_weight": radial_weight,
            "tile_weight": radial_weight,
        }
        for resource in field.resources:
            if not resource_field_is_enabled(resource):
                tile_value = 0
            else:
                base_multiplier = compute_resource_field_base_multiplier(field, resource)
                tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(radial_weight)))
            tile_entry[resource.ware_key] = tile_value
            ware_totals[resource.ware_key] += tile_value
        per_tile.append(tile_entry)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(per_tile),
        "tile_coords": [entry["coord"] for entry in per_tile],
        "per_tile": per_tile,
        "ware_totals": ware_totals,
        "query_radius": QUERY_RADIUS,
        "grid_window": grid,
    }


def replay_box_field(field: NebulaFieldState) -> dict[str, object]:
    """Replay gas box field calculation."""
    from processor.step2_resource.per_block.common import world_coord_from_storage_coord

    per_tile: list[dict[str, object]] = []
    ware_totals = {resource.ware_key: 0 for resource in field.resources}
    grid = build_query_grid_window(field.position_x, field.position_y, field.position_z)

    for coord in enumerate_candidate_area_centers_for_box(field):
        world_coord = world_coord_from_storage_coord(grid, coord)
        query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
        normalized_scalar = compute_box_normalized_scalar(field, query)
        if normalized_scalar > (1.0 + (QUERY_RADIUS / min(v for v in (field.size_x, field.size_y, field.size_z) if v > 0.0))):
            continue
        radial_interval = compute_box_interval(field, query)
        radial_weight = eval_profile_avg(field.falloff.radial, radial_interval)
        tile_entry: dict[str, object] = {
            "coord": coord,
            "world_coord": world_coord,
            "radial_interval": radial_interval,
            "radial_weight": radial_weight,
            "tile_weight": radial_weight,
        }
        for resource in field.resources:
            if not resource_field_is_enabled(resource):
                tile_value = 0
            else:
                base_multiplier = compute_resource_field_base_multiplier(field, resource)
                tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(radial_weight)))
            tile_entry[resource.ware_key] = tile_value
            ware_totals[resource.ware_key] += tile_value
        per_tile.append(tile_entry)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(per_tile),
        "tile_coords": [entry["coord"] for entry in per_tile],
        "per_tile": per_tile,
        "ware_totals": ware_totals,
        "query_radius": QUERY_RADIUS,
        "grid_window": grid,
    }


def replay_gas_area_values_for_field(field: NebulaFieldState) -> dict[str, object]:
    """Replay gas field calculation based on boundary class.

    This is the main entry point for gas resource per-block calculation.
    """
    if field.boundary_class == "cylinder":
        return replay_cylinder_field(field)
    if field.boundary_class == "sphere":
        return replay_sphere_field(field)
    if field.boundary_class == "box":
        return replay_box_field(field)
    if field.boundary_class == "splinetube":
        return replay_splinetube_field(field)
    raise ValueError(f"unsupported gas boundary class for replay: {field.boundary_class}")


__all__ = [
    # Data classes
    "GasResourceEntry",
    "NebulaFieldState",
    # Hexagonal grid constants
    "DAT_142d80234",
    "DAT_142d80300",
    "DAT_142d80044",
    # Resource field functions
    "compute_resource_field_base_multiplier",
    "resource_field_is_enabled",
    "compute_uniform_profile_weight_for_cylinder",
    # Cylinder functions
    "compute_cylinder_axial_interval",
    "compute_cylinder_radial_interval",
    "compute_cylinder_profile_weight_for_query",
    # Sphere functions
    "compute_sphere_radial_interval",
    # Box functions
    "compute_box_normalized_scalar",
    "compute_box_interval",
    # Query box intersection
    "area_intersects_field_query_box",
    # Candidate area enumeration
    "enumerate_candidate_area_centers_for_cylinder",
    "enumerate_hex_grid_for_boundary",
    "enumerate_candidate_area_centers_for_splinetube",  # backward compatible
    "enumerate_candidate_area_centers_for_sphere",
    "enumerate_candidate_area_centers_for_box",
    # Main replay functions
    "replay_cylinder_field",
    "replay_splinetube_field",
    "replay_sphere_field",
    "replay_box_field",
    "replay_gas_area_values_for_field",
]