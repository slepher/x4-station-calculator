"""Implementation modules for sum_weights_replay."""

from .replay_context import (
    ReplayContext,
    GasResourceEntry,
    FalloffProfiles,
    build_replay_context_140e860c0,
)
from .profile_eval import ProfilePoint, eval_profile_avg_1414ed970, eval_profile_max_1414ed700
from .grid_enumeration import (
    QueryGridWindow,
    build_query_grid_window_140760320,
    storage_coord_to_world_coord_140760320,
    enumerate_storage_coords_for_bbox,
    AREA_SIZE,
    QUERY_RADIUS_14073F750,
)
from .weight_computation import (
    compute_tile_contribution_14073f750,
    compute_tile_profile_weight_14073f750,
    compute_resource_field_base_multiplier_140e80260,
)
from .gas_replay import (
    replay_gas_field_14075bd20,
    ReplayResult,
    TileResult,
)
from .solid_context import (
    SolidRegionState,
    SolidFieldState,
    SplineControlPoint,
    RegionYieldPayload,
    RegionObjectGroup,
    SolidFieldDefinition,
    parse_region_definition_140E80D20,
    parse_region_object_groups_140E950A0,
    parse_region_yield_payload_140E83F80,
)
from .solid_replay import (
    build_solid_region_state_14073E110,
    replay_solid_region_14073E110,
    load_save_sample_for_ware as load_solid_save_sample,
    load_total_sample_for_ware as load_solid_total_sample,
)
from .region_replay import (
    replay_region_unified,
    RegionReplayResult,
    FieldReplayResult,
    TileResult as UnifiedTileResult,
    is_gas_ware,
    is_solid_field,
    is_gas_field,
)
from .region_resource_field import (
    region_resource_field_14073E110,
    RegionResourceFieldResult,
    FieldInfo,
    ResourceInfo,
)
from .save_sample_loader import (
    load_save_sample,
    load_total_save_sample,
)

__all__ = [
    # Context
    'ReplayContext',
    'GasResourceEntry',
    'FalloffProfiles',
    'build_replay_context_140e860c0',
    # Profile eval
    'ProfilePoint',
    'eval_profile_avg_1414ed970',
    'eval_profile_max_1414ed700',
    # Grid enumeration
    'QueryGridWindow',
    'build_query_grid_window_140760320',
    'storage_coord_to_world_coord_140760320',
    'enumerate_storage_coords_for_bbox',
    'AREA_SIZE',
    'QUERY_RADIUS_14073F750',
    # Weight computation
    'compute_tile_contribution_14073f750',
    'compute_tile_profile_weight_14073f750',
    'compute_resource_field_base_multiplier_140e80260',
    # Gas replay
    'replay_gas_field_14075bd20',
    'ReplayResult',
    'TileResult',
    # Solid context
    'SolidRegionState',
    'SolidFieldState',
    'SplineControlPoint',
    'RegionYieldPayload',
    'RegionObjectGroup',
    'SolidFieldDefinition',
    'parse_region_definition_140E80D20',
    'parse_region_object_groups_140E950A0',
    'parse_region_yield_payload_140E83F80',
    # Solid replay
    'build_solid_region_state_14073E110',
    'replay_solid_region_14073E110',
    'load_solid_save_sample',
    'load_solid_total_sample',
    # Unified region replay
    'replay_region_unified',
    'RegionReplayResult',
    'FieldReplayResult',
    'UnifiedTileResult',
    'is_gas_ware',
    'is_solid_field',
    'is_gas_field',
    # Region resource field (FUN_14073e110)
    'region_resource_field_14073E110',
    'RegionResourceFieldResult',
    'FieldInfo',
    'ResourceInfo',
    # Save sample loader
    'load_save_sample',
    'load_total_save_sample',
]