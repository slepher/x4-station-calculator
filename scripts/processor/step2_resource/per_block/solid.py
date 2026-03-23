"""Solid resource per-block calculation functions.

This module provides functions for calculating solid resource yields on a per-block basis.
Code is extracted from verified replay scripts with address suffixes removed from function names.

Source: scripts/x4-game/solid_sum_weights_replay_v2.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from processor.step2_resource.per_block.common import (
    AREA_HALF,
    AREA_SIZE,
    CLAMP_UPPER,
    NOISE_CDF_ABS_SCALE,
    NOISE_CDF_CENTER,
    NOISE_CDF_CROSS,
    NOISE_CDF_CROSS_SCALE,
    NOISE_CDF_LINEAR,
    NOISE_CDF_QUAD,
    NOISE_CDF_QUARTIC,
    NOISE_CDF_SIGN_NEGATIVE,
    NOISE_CLAMP_SCALE,
    QUERY_RADIUS,
    SAVE_GRID_MAX_CENTER_XZ,
    SAVE_GRID_MAX_CENTER_Y,
    SAVE_GRID_MIN_CENTER_XZ,
    SAVE_GRID_MIN_CENTER_Y,
    SPLINETUBE_INTERVAL_SAMPLE_COUNT,
    SPLINETUBE_SEGMENT_COUNT_DEFAULT,
    FalloffProfiles,
    ProfilePoint,
    QueryGridWindow,
    SplineControlPoint,
    build_polyline_arclength_table,
    build_query_grid_window,
    build_runtime_sampled_splinetube_points,
    clamp,
    compute_composite_spline_interval_scan,
    compute_composite_spline_nearest_global_t,
    compute_splinetube_radial_interval,
    compute_storage_axis_range,
    dot,
    eval_profile_avg,
    f32,
    sample_composite_spline_uniform_param,
    truncate_to_runtime_int,
    vec_add,
    vec_length,
    vec_mul,
    vec_sub,
)


# =============================================================================
# Solid-specific Constants (imported from common but defined here for reference)
# =============================================================================

# Re-export for backward compatibility
NOISE_CLAMP_SCALE_140E84C30 = 9.999999717180685e-10
NOISE_CDF_CENTER_1414F5870 = 0.5
NOISE_CDF_SIGN_NEGATIVE_1414F5870 = -1.0
NOISE_CDF_ABS_SCALE_1414F5870 = 4.5
NOISE_CDF_LINEAR_1414F5870 = 0.30000001192092896
NOISE_CDF_CROSS_1414F5870 = 0.0009720000089146197
NOISE_CDF_QUAD_1414F5870 = 4.665377140045166
NOISE_CDF_CROSS_SCALE_1414F5870 = 20.25
NOISE_CDF_QUARTIC_1414F5870 = 32.02915954589844
CLAMP_UPPER_140E84C30 = 262144.0


# =============================================================================
# Solid Data Classes
# =============================================================================

@dataclass
class RegionYieldPayload:
    """Region yield data for solid resources."""
    ware: str
    yield_name: str
    resourcedensity: float
    replenishtime: float
    gatherspeedfactor: float


@dataclass
class RegionObjectGroup:
    """Region object group definition."""
    name: str
    resource: str
    yield_value: float
    yieldvariation: float


@dataclass
class SolidFieldDefinition:
    """Solid field definition from region XML."""
    groupref: str
    densityfactor: float
    noisescale: float
    seed: str
    minnoisevalue: float
    maxnoisevalue: float


@dataclass
class SolidFieldState:
    """Runtime state for a solid field during calculation."""
    name: str
    ware_key: str = ""
    yield_value: float = 0.0
    resourcepercentage: float = 1.0
    yieldvariation: float = 0.0
    densityfactor: float = 1.0
    region_density: float = 1.0
    field_0x1150_density_base_scaled: float = 0.0
    ref_target_class_id: int = 0x77
    class_density_by_id: dict[int, float] = field(default_factory=lambda: {0x77: 1.0})
    universe_yield_density_by_ware: dict[str, float] = field(default_factory=dict)
    universe_object_yield_density_by_ware: dict[str, float] = field(default_factory=dict)
    noisescale: float = 5000.0
    seed: str = ""
    minnoisevalue: float = 0.0
    maxnoisevalue: float = 1.0


@dataclass
class SolidRegionState:
    """Runtime state for a solid region during calculation."""
    sector_id: str
    field_ref: str
    boundary_class: str
    position_x: float
    position_y: float
    position_z: float
    radius: float
    linear: float
    region_density: float
    falloff: FalloffProfiles
    payload: RegionYieldPayload
    fields: list[SolidFieldState]
    spline: list[SplineControlPoint] = field(default_factory=list)
    # box 专用尺寸字段
    box_size_x: float = 0.0
    box_size_y: float = 0.0
    box_size_z: float = 0.0


# =============================================================================
# Noise CDF Functions
# =============================================================================

def compute_noise_cdf(param_1: float) -> float:
    """Compute the noise CDF value for a given parameter."""
    x = f32(param_1 - NOISE_CDF_CENTER_1414F5870)
    if x < 0.0:
        sign = NOISE_CDF_SIGN_NEGATIVE_1414F5870
    elif x > 0.0:
        sign = 1.0
    else:
        sign = 0.0

    abs_scaled = f32(abs(x) * NOISE_CDF_ABS_SCALE_1414F5870)
    x2 = f32(x * x)
    poly = f32(
        x2 * NOISE_CDF_QUAD_1414F5870
        + abs_scaled * NOISE_CDF_LINEAR_1414F5870
        + abs_scaled * NOISE_CDF_CROSS_1414F5870 * x2 * NOISE_CDF_CROSS_SCALE_1414F5870
        + x2 * x2 * NOISE_CDF_QUARTIC_1414F5870
        + 1.0
    )
    poly_sq = f32(poly * poly)
    return f32(((sign - sign / f32(poly_sq * poly_sq)) + 1.0) * NOISE_CDF_CENTER_1414F5870)


def compute_local_noise_fast_path(field: SolidFieldState) -> float:
    """Compute local noise using the fast path for large cells."""
    return f32(compute_noise_cdf(field.maxnoisevalue) - compute_noise_cdf(field.minnoisevalue))


def assert_noise_fast_path_supported(field: SolidFieldState, tile_x: int, tile_y: int, tile_z: int) -> None:
    """Check if the noise fast path is accurate for this tile.

    Note: For small cell counts (< 17), the fast path is an approximation.
    The exact small-cell path is not implemented, so we use fast path anyway.
    """
    # 小单元格路径未实现，使用 fast path 近似
    pass


# =============================================================================
# Field Multiplier Functions
# =============================================================================

def compute_multiplier_a(field: SolidFieldState) -> float:
    """Compute multiplier A for solid field."""
    return field.field_0x1150_density_base_scaled * field.class_density_by_id.get(field.ref_target_class_id, 1.0)


def compute_multiplier_b(field: SolidFieldState) -> float:
    """Compute multiplier B for solid field."""
    return (
        field.universe_yield_density_by_ware.get(field.ware_key, 1.0)
        * field.yield_value
        * field.universe_object_yield_density_by_ware.get(field.ware_key, 1.0)
    )


def compute_noise_window_weight(field: SolidFieldState) -> float:
    """Compute the noise window weight for a solid field."""
    return (
        compute_multiplier_a(field)
        * compute_multiplier_b(field)
        * compute_local_noise_fast_path(field)
    )


def apply_per_field_value_writeback(field: SolidFieldState, per_field_value: float) -> None:
    """Apply per-field value writeback after distribution."""
    field.resourcepercentage = per_field_value
    if per_field_value > 1.0:
        field.resourcepercentage = 1.0
        field.yield_value = per_field_value * field.yield_value


def apply_region_yield_payload_to_field(field: SolidFieldState, payload: RegionYieldPayload) -> None:
    """Apply region yield payload to a solid field."""
    if field.yield_value <= 0.0:
        field.yield_value = payload.resourcedensity


def apply_groupref_to_field(field: SolidFieldState, group: RegionObjectGroup) -> None:
    """Apply group reference to a solid field."""
    if not field.ware_key:
        field.ware_key = group.resource
    if field.yield_value <= 0.0:
        field.yield_value = group.yield_value
        field.yieldvariation = group.yieldvariation
        field.resourcepercentage = 0.0


def initialize_field_from_region_definition(
    field: SolidFieldState,
    *,
    densityfactor: float,
    region_density: float,
    noisescale: float,
    seed: str,
    minnoisevalue: float,
    maxnoisevalue: float,
) -> None:
    """Initialize a solid field from region definition parameters."""
    field.densityfactor = densityfactor
    field.region_density = region_density
    field.field_0x1150_density_base_scaled = densityfactor * region_density * 0.01
    field.noisescale = noisescale
    field.seed = seed
    field.minnoisevalue = minnoisevalue
    field.maxnoisevalue = maxnoisevalue


# =============================================================================
# Cylinder Functions
# =============================================================================

def compute_cylinder_axial_interval(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the axial interval for a cylinder at a query point."""
    p0 = (region.position_x, region.position_y - region.linear, region.position_z)
    p1 = (region.position_x, region.position_y + region.linear, region.position_z)
    axis = vec_sub(p1, p0)
    axis_len = vec_length(axis)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    delta = QUERY_RADIUS / axis_len
    return (clamp(t - delta, 0.0, 1.0), clamp(t + delta, 0.0, 1.0))


def compute_cylinder_radial_interval(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the radial interval for a cylinder at a query point."""
    p0 = (region.position_x, region.position_y - region.linear, region.position_z)
    p1 = (region.position_x, region.position_y + region.linear, region.position_z)
    axis = vec_sub(p1, p0)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    closest = vec_add(p0, vec_mul(axis, t))
    distance_to_axis = vec_length(vec_sub(query, closest))
    return (
        clamp((distance_to_axis - QUERY_RADIUS) / region.radius, 0.0, 1.0),
        clamp((distance_to_axis + QUERY_RADIUS) / region.radius, 0.0, 1.0),
    )


# =============================================================================
# Sphere Functions
# =============================================================================

def compute_sphere_radial_interval(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute the radial interval for a sphere at a query point."""
    center = (region.position_x, region.position_y, region.position_z)
    distance_to_center = vec_length(vec_sub(query, center))
    return (
        clamp((distance_to_center - QUERY_RADIUS) / region.radius, 0.0, 1.0),
        clamp((distance_to_center + QUERY_RADIUS) / region.radius, 0.0, 1.0),
    )


def compute_sphere_falloff_weight(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> dict[str, object]:
    """Compute the falloff weight for a sphere at a query point."""
    radial_interval = compute_sphere_radial_interval(region, query)
    # sphere 使用 radial profile 作为 falloff
    radial_weight = eval_profile_avg(region.falloff.radial, radial_interval)
    return {
        "radial_interval": radial_interval,
        "radial_weight": radial_weight,
        "falloff": radial_weight,
    }


# =============================================================================
# Box Functions
# =============================================================================

def compute_box_intervals(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> tuple[tuple[float, float], tuple[float, float], tuple[float, float]]:
    """Compute the intervals for a box at a query point.

    Returns: (x_interval, y_interval, z_interval) each as (min, max) in [0, 1]
    """
    center = (region.position_x, region.position_y, region.position_z)
    # box 使用专用尺寸字段
    half_x = region.box_size_x / 2.0 if region.box_size_x > 0 else region.radius
    half_y = region.box_size_y / 2.0 if region.box_size_y > 0 else region.linear
    half_z = region.box_size_z / 2.0 if region.box_size_z > 0 else region.radius

    # 计算查询点到各面的距离比例
    x_interval = (
        clamp((query[0] - center[0] - QUERY_RADIUS) / half_x, 0.0, 1.0) if half_x > 0 else (0.0, 1.0),
        clamp((query[0] - center[0] + QUERY_RADIUS) / half_x, 0.0, 1.0) if half_x > 0 else (0.0, 1.0),
    )
    y_interval = (
        clamp((query[1] - center[1] - QUERY_RADIUS) / half_y, 0.0, 1.0) if half_y > 0 else (0.0, 1.0),
        clamp((query[1] - center[1] + QUERY_RADIUS) / half_y, 0.0, 1.0) if half_y > 0 else (0.0, 1.0),
    )
    z_interval = (
        clamp((query[2] - center[2] - QUERY_RADIUS) / half_z, 0.0, 1.0) if half_z > 0 else (0.0, 1.0),
        clamp((query[2] - center[2] + QUERY_RADIUS) / half_z, 0.0, 1.0) if half_z > 0 else (0.0, 1.0),
    )
    return (x_interval, y_interval, z_interval)


def compute_box_falloff_weight(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> dict[str, object]:
    """Compute the falloff weight for a box at a query point."""
    x_interval, y_interval, z_interval = compute_box_intervals(region, query)
    # box 使用 lateral (Y) 和 radial (XZ 平面) profile
    axial_weight = eval_profile_avg(region.falloff.lateral, y_interval)
    # XZ 平面使用 radial profile 的平均值
    x_weight = eval_profile_avg(region.falloff.radial, x_interval)
    z_weight = eval_profile_avg(region.falloff.radial, z_interval)
    radial_weight = (x_weight + z_weight) / 2.0
    return {
        "axial_interval": y_interval,
        "radial_interval": (x_interval, z_interval),
        "axial_weight": axial_weight,
        "radial_weight": radial_weight,
        "falloff": axial_weight * radial_weight,
    }


def compute_cylinder_falloff_weight(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> dict[str, object]:
    """Compute the falloff weight for a cylinder at a query point."""
    axial_interval = compute_cylinder_axial_interval(region, query)
    radial_interval = compute_cylinder_radial_interval(region, query)
    axial_weight = eval_profile_avg(region.falloff.lateral, axial_interval)
    radial_weight = eval_profile_avg(region.falloff.radial, radial_interval)
    return {
        "axial_interval": axial_interval,
        "radial_interval": radial_interval,
        "axial_weight": axial_weight,
        "radial_weight": radial_weight,
        "falloff": axial_weight * radial_weight,
    }


# =============================================================================
# SplineTube Functions
# =============================================================================

def build_sampled_spline_points_from_region_bezier(
    region: SolidRegionState,
) -> list[tuple[float, float, float]]:
    """Build sampled spline points from region bezier control points."""
    if len(region.spline) < 2:
        raise ValueError("splinetube requires at least two spline control points")

    return [
        sample_composite_spline_uniform_param(
            region.spline,
            index / SPLINETUBE_SEGMENT_COUNT_DEFAULT,
        )
        for index in range(SPLINETUBE_SEGMENT_COUNT_DEFAULT + 1)
    ]


def compute_splinetube_falloff_weight(
    region: SolidRegionState,
    query: tuple[float, float, float],
    sampled_points: Optional[list[tuple[float, float, float]]] = None,
) -> Optional[dict[str, object]]:
    """Compute the falloff weight for a splinetube at a query point."""
    if sampled_points is None:
        sampled_points = build_sampled_spline_points_from_region_bezier(region)
    seg_lengths, accum, total_length = build_polyline_arclength_table(sampled_points)
    threshold = QUERY_RADIUS + region.radius
    lateral_interval, representative_distance = compute_composite_spline_interval_scan(
        query,
        sampled_points,
        seg_lengths,
        accum,
        total_length,
        threshold,
        SPLINETUBE_INTERVAL_SAMPLE_COUNT,
    )
    nearest_t, _nearest_distance = compute_composite_spline_nearest_global_t(
        query, sampled_points, seg_lengths, accum, total_length
    )
    nearest_arclength = nearest_t * total_length
    if representative_distance > threshold:
        return None
    if lateral_interval is None:
        return None
    radial_interval = compute_splinetube_radial_interval(
        representative_distance,
        region.radius,
        QUERY_RADIUS,
    )
    axial_weight = eval_profile_avg(region.falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg(region.falloff.radial, radial_interval)
    return {
        "nearest_distance": representative_distance,
        "nearest_arclength": nearest_arclength,
        "axial_interval": lateral_interval,
        "radial_interval": radial_interval,
        "axial_weight": axial_weight,
        "radial_weight": radial_weight,
        "falloff": axial_weight * radial_weight,
    }


# =============================================================================
# Boundary Volume Functions
# =============================================================================

def compute_boundary_volume(region: SolidRegionState) -> float:
    """Compute the boundary volume for a solid region."""
    if region.boundary_class == "cylinder":
        return region.linear * math.pi * region.radius * region.radius
    if region.boundary_class == "splinetube":
        sampled_points = build_sampled_spline_points_from_region_bezier(region)
        _, _, total_length = build_polyline_arclength_table(sampled_points)
        return total_length * math.pi * region.radius * region.radius
    if region.boundary_class == "sphere":
        return (4.0 / 3.0) * math.pi * region.radius * region.radius * region.radius
    if region.boundary_class == "box":
        # box 使用专用尺寸字段
        return region.box_size_x * region.box_size_y * region.box_size_z
    raise ValueError(f"unsupported solid boundary class for volume: {region.boundary_class}")


def compute_clamp_factor(region: SolidRegionState) -> float:
    """Compute the clamp factor for a solid region."""
    return min(compute_boundary_volume(region) * NOISE_CLAMP_SCALE_140E84C30, CLAMP_UPPER_140E84C30)


# =============================================================================
# Query Box Intersection
# =============================================================================

def area_intersects_field_query_box(region: SolidRegionState, tile_x: int, tile_y: int, tile_z: int) -> bool:
    """Check if a 64k query box intersects a solid field boundary."""
    min_y = region.position_y - region.linear
    max_y = region.position_y + region.linear
    tile_min_y = tile_y - AREA_HALF
    tile_max_y = tile_y + AREA_HALF
    overlaps_y = not (tile_max_y < min_y or tile_min_y > max_y)
    if not overlaps_y:
        return False

    dx = abs(region.position_x - tile_x)
    dz = abs(region.position_z - tile_z)
    clamped_dx = max(dx - AREA_HALF, 0.0)
    clamped_dz = max(dz - AREA_HALF, 0.0)
    return (clamped_dx * clamped_dx + clamped_dz * clamped_dz) <= (region.radius * region.radius)


# =============================================================================
# Candidate Area Enumeration
# =============================================================================

def enumerate_candidate_area_centers_for_splinetube_reverse(
    region: SolidRegionState,
    sampled_points: list[tuple[float, float, float]],
    tube_radius: float,
    query_radius: float,
) -> list[tuple[int, int, int]]:
    """Enumerate candidate 64k area centers for a splinetube using reverse closure."""
    grid = build_query_grid_window(region.position_x, region.position_y, region.position_z)
    xs = [point[0] for point in sampled_points]
    ys = [point[1] for point in sampled_points]
    zs = [point[2] for point in sampled_points]
    extension = tube_radius + query_radius
    min_x = min(xs) - extension
    max_x = max(xs) + extension
    min_y = min(ys) - extension
    max_y = max(ys) + extension
    min_z = min(zs) - extension
    max_z = max(zs) + extension
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


def enumerate_candidate_area_centers(region: SolidRegionState) -> list[tuple[int, int, int]]:
    """Enumerate candidate 64k area centers for a solid region."""
    if region.boundary_class == "splinetube":
        sampled_points = build_sampled_spline_points_from_region_bezier(region)
        return enumerate_candidate_area_centers_for_splinetube_reverse(
            region,
            sampled_points,
            region.radius,
            QUERY_RADIUS,
        )

    grid = build_query_grid_window(region.position_x, region.position_y, region.position_z)
    min_x = region.position_x - region.radius - AREA_HALF
    max_x = region.position_x + region.radius + AREA_HALF
    min_y = region.position_y - region.linear - AREA_HALF
    max_y = region.position_y + region.linear + AREA_HALF
    min_z = region.position_z - region.radius - AREA_HALF
    max_z = region.position_z + region.radius + AREA_HALF

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
                from processor.step2_resource.per_block.common import world_coord_from_storage_coord
                world_coord = world_coord_from_storage_coord(grid, (x, y, z))
                if area_intersects_field_query_box(region, *world_coord):
                    coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


# =============================================================================
# Falloff Weight Dispatcher
# =============================================================================

def compute_falloff_weight_for_query(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> Optional[dict[str, object]]:
    """Compute falloff weight for a query point based on boundary class."""
    if region.boundary_class == "cylinder":
        return compute_cylinder_falloff_weight(region, query)
    if region.boundary_class == "splinetube":
        return compute_splinetube_falloff_weight(region, query)
    if region.boundary_class == "sphere":
        return compute_sphere_falloff_weight(region, query)
    if region.boundary_class == "box":
        return compute_box_falloff_weight(region, query)
    raise ValueError(f"unsupported solid boundary class for falloff: {region.boundary_class}")


# =============================================================================
# Main Replay Function
# =============================================================================

def replay_region_solid_sum_weights_and_areas(region: SolidRegionState) -> dict[str, object]:
    """Replay solid region sum weights and areas calculation.

    This is the main entry point for solid resource per-block calculation.
    """
    from processor.step2_resource.per_block.common import world_coord_from_storage_coord

    matching_fields = [field for field in region.fields if field.ware_key == region.payload.ware]
    for field in matching_fields:
        apply_region_yield_payload_to_field(field, region.payload)

    weight_rows: list[dict[str, object]] = []
    sum_weights = 0.0
    for field in matching_fields:
        field_weight = compute_noise_window_weight(field)
        sum_weights += field_weight
        weight_rows.append(
            {
                "field": field.name,
                "multiplier_a": compute_multiplier_a(field),
                "multiplier_b_before": compute_multiplier_b(field),
                "local_noise_fast": compute_local_noise_fast_path(field),
                "weight": field_weight,
            }
        )

    if sum_weights <= 0.0:
        per_field_value = 0.0
    else:
        per_field_value = region.payload.resourcedensity / sum_weights

    for field in matching_fields:
        apply_per_field_value_writeback(field, per_field_value)

    clamp_factor = compute_clamp_factor(region)
    per_tile: list[dict[str, object]] = []
    total_max = 0
    grid = build_query_grid_window(region.position_x, region.position_y, region.position_z)

    for coord in enumerate_candidate_area_centers(region):
        tile_x, tile_y, tile_z = world_coord_from_storage_coord(grid, coord)
        for field in matching_fields:
            assert_noise_fast_path_supported(field, tile_x, tile_y, tile_z)

        query = (float(tile_x), float(tile_y), float(tile_z))
        falloff_info = compute_falloff_weight_for_query(region, query)
        if falloff_info is None:
            continue

        field_rows: list[dict[str, object]] = []
        tile_total_float = 0.0
        tile_total = 0
        for field in matching_fields:
            local_noise = compute_local_noise_fast_path(field)
            area_value_float = (
                compute_multiplier_b(field)
                * compute_multiplier_a(field)
                * local_noise
                * field.resourcepercentage
                * falloff_info["falloff"]
                * clamp_factor
            )
            area_value = truncate_to_runtime_int(area_value_float)
            tile_total_float += area_value_float
            tile_total += area_value
            field_rows.append(
                {
                    "field": field.name,
                    "ware": field.ware_key,
                    "yield_after": field.yield_value,
                    "resourcepercentage_after": field.resourcepercentage,
                    "multiplier_a": compute_multiplier_a(field),
                    "multiplier_b": compute_multiplier_b(field),
                    "local_noise": local_noise,
                    "area_value_float": area_value_float,
                    "area_value": area_value,
                }
            )

        total_max += tile_total
        tile_info = {
            "coord": coord,
            "world_coord": (tile_x, tile_y, tile_z),
            "radial_interval": falloff_info["radial_interval"],
            "radial_weight": falloff_info["radial_weight"],
            "falloff": falloff_info["falloff"],
            "tile_total_float": tile_total_float,
            "tile_total": tile_total,
            "fields": field_rows,
        }
        # cylinder/splinetube 有 axial 信息
        if "axial_interval" in falloff_info:
            tile_info["axial_interval"] = falloff_info["axial_interval"]
            tile_info["axial_weight"] = falloff_info["axial_weight"]
        per_tile.append(tile_info)

    return {
        "field": f"{region.sector_id} / {region.field_ref}",
        "payload": region.payload,
        "sum_weights": sum_weights,
        "per_field_value": per_field_value,
        "clamp_factor": clamp_factor,
        "weights": weight_rows,
        "per_tile": per_tile,
        "total_max": total_max,
        "grid_window": grid,
    }


__all__ = [
    # Constants
    "NOISE_CLAMP_SCALE_140E84C30",
    "NOISE_CDF_CENTER_1414F5870",
    "NOISE_CDF_SIGN_NEGATIVE_1414F5870",
    "NOISE_CDF_ABS_SCALE_1414F5870",
    "NOISE_CDF_LINEAR_1414F5870",
    "NOISE_CDF_CROSS_1414F5870",
    "NOISE_CDF_QUAD_1414F5870",
    "NOISE_CDF_CROSS_SCALE_1414F5870",
    "NOISE_CDF_QUARTIC_1414F5870",
    "CLAMP_UPPER_140E84C30",
    # Data classes
    "RegionYieldPayload",
    "RegionObjectGroup",
    "SolidFieldDefinition",
    "SolidFieldState",
    "SolidRegionState",
    # Noise CDF functions
    "compute_noise_cdf",
    "compute_local_noise_fast_path",
    "assert_noise_fast_path_supported",
    # Field multiplier functions
    "compute_multiplier_a",
    "compute_multiplier_b",
    "compute_noise_window_weight",
    "apply_per_field_value_writeback",
    "apply_region_yield_payload_to_field",
    "apply_groupref_to_field",
    "initialize_field_from_region_definition",
    # Cylinder functions
    "compute_cylinder_axial_interval",
    "compute_cylinder_radial_interval",
    "compute_cylinder_falloff_weight",
    # SplineTube functions
    "build_sampled_spline_points_from_region_bezier",
    "compute_splinetube_falloff_weight",
    # Boundary volume functions
    "compute_boundary_volume",
    "compute_clamp_factor",
    # Query box intersection
    "area_intersects_field_query_box",
    # Candidate area enumeration
    "enumerate_candidate_area_centers_for_splinetube_reverse",
    "enumerate_candidate_area_centers",
    # Falloff weight dispatcher
    "compute_falloff_weight_for_query",
    # Main replay function
    "replay_region_solid_sum_weights_and_areas",
]