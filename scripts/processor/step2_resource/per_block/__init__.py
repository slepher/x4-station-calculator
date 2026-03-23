"""Per-block resource calculation module.

This module provides functions for calculating resource yields on a per-block basis.
Code is extracted from verified replay scripts with address suffixes removed.
"""

from processor.step2_resource.per_block.common import (
    AREA_SIZE,
    AREA_HALF,
    QUERY_RADIUS,
    FalloffProfiles,
    ProfilePoint,
    SplineControlPoint,
    QueryGridWindow,
    build_query_grid_window,
    world_coord_from_storage_coord,
    eval_profile_avg,
    f32,
    clamp,
    truncate_to_runtime_int,
)

from processor.step2_resource.per_block.solid import (
    SolidFieldState,
    SolidRegionState,
    RegionYieldPayload,
    RegionObjectGroup,
    SolidFieldDefinition,
    compute_noise_cdf,
    compute_local_noise_fast_path,
    compute_cylinder_axial_interval,
    compute_cylinder_radial_interval,
    compute_cylinder_falloff_weight,
    compute_falloff_weight_for_query,
    enumerate_candidate_area_centers,
    replay_region_solid_sum_weights_and_areas,
)

from processor.step2_resource.per_block.gas import (
    GasResourceEntry,
    NebulaFieldState,
    compute_resource_field_base_multiplier,
    resource_field_is_enabled,
    compute_cylinder_profile_weight_for_query,
    compute_sphere_radial_interval,
    compute_box_interval,
    enumerate_candidate_area_centers_for_cylinder,
    enumerate_candidate_area_centers_for_sphere,
    enumerate_candidate_area_centers_for_box,
    replay_cylinder_field,
    replay_sphere_field,
    replay_box_field,
    replay_splinetube_field,
    replay_gas_area_values_for_field,
)


__all__ = [
    # Common utilities
    "AREA_SIZE",
    "AREA_HALF",
    "QUERY_RADIUS",
    "FalloffProfiles",
    "ProfilePoint",
    "SplineControlPoint",
    "QueryGridWindow",
    "build_query_grid_window",
    "world_coord_from_storage_coord",
    "eval_profile_avg",
    "f32",
    "clamp",
    "truncate_to_runtime_int",
    # Solid types and functions
    "SolidFieldState",
    "SolidRegionState",
    "RegionYieldPayload",
    "RegionObjectGroup",
    "SolidFieldDefinition",
    "compute_noise_cdf",
    "compute_local_noise_fast_path",
    "compute_cylinder_axial_interval",
    "compute_cylinder_radial_interval",
    "compute_cylinder_falloff_weight",
    "compute_falloff_weight_for_query",
    "enumerate_candidate_area_centers",
    "replay_region_solid_sum_weights_and_areas",
    # Gas types and functions
    "GasResourceEntry",
    "NebulaFieldState",
    "compute_resource_field_base_multiplier",
    "resource_field_is_enabled",
    "compute_cylinder_profile_weight_for_query",
    "compute_sphere_radial_interval",
    "compute_box_interval",
    "enumerate_candidate_area_centers_for_cylinder",
    "enumerate_candidate_area_centers_for_sphere",
    "enumerate_candidate_area_centers_for_box",
    "replay_cylinder_field",
    "replay_sphere_field",
    "replay_box_field",
    "replay_splinetube_field",
    "replay_gas_area_values_for_field",
]