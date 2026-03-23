"""Step 2 Resource 处理模块 - X4 Map Data Processor.

提供资源计算功能，执行 64k area 级资源计算并回填产量字段。

模块结构:
- per_block/: 逐格计算模块
  - common.py: 共用数据结构和工具函数
  - solid.py: 固体资源计算
  - gas.py: 气体资源计算
- model_detector.py: 版本检测
"""

from processor.step2_resource.per_block import (
    # Common utilities
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
    # Solid types
    SolidFieldState,
    SolidRegionState,
    RegionYieldPayload,
    RegionObjectGroup,
    SolidFieldDefinition,
    # Gas types
    GasResourceEntry,
    NebulaFieldState,
    # Main replay functions
    replay_region_solid_sum_weights_and_areas,
    replay_gas_area_values_for_field,
)

# TODO: Implement service.py for high-level orchestration
# from processor.step2_resource.service import process_resources_for_version

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
    # Solid types
    "SolidFieldState",
    "SolidRegionState",
    "RegionYieldPayload",
    "RegionObjectGroup",
    "SolidFieldDefinition",
    # Gas types
    "GasResourceEntry",
    "NebulaFieldState",
    # Main replay functions
    "replay_region_solid_sum_weights_and_areas",
    "replay_gas_area_values_for_field",
]