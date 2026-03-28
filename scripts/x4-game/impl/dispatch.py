"""Region dispatch to spatial managers - C++ Layer 3 replication.

Based on Ghidra decompilation:
- FUN_140385c50: dispatch_region_to_managers
- FUN_14075bd20: spatial_manager_process_region
- FUN_14075c250: spatial_index_insert_region (pending)
- FUN_14075cc00: spatial_manager_flush (pending)
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from impl.compile_hit import CompiledRegionRuntime
    from field.resource_object_field import ResourceObjectField


@dataclass
class SpatialDispatchOwner:
    """C++ owner-like wrapper holding the manager container at +0xa8."""

    sector_id: str
    managers: list["SpatialManagerRuntime"]
    _0xa8: object = None


@dataclass
class SpatialManagerRuntime:
    """Runtime manager context for FUN_14075bd20 / FUN_14075c250 / FUN_14075cc00."""

    sector_id: str
    _0x408: dict | None = None
    _0x410: list = None
    _0x430: int = 0
    _0x438: int = 0
    _0x440: list = None
    _0x448: int = 0
    _0x460: list = None
    _0x468: int = 0
    _0x480: list = None
    _0x488: int = 0
    _0x4a0: list = None
    _0x4a8: int = 0
    _0x81: object = None
    _0x90: object = None
    _0x91: object = None
    _0x94: object = None
    _0x98: dict = None
    _0x9d: int = 0
    _compiled: object = None
    _resource_tiles: dict | None = None

    def __post_init__(self) -> None:
        if self._0x410 is None:
            self._0x410 = []
        if self._0x440 is None:
            self._0x440 = []
        if self._0x460 is None:
            self._0x460 = []
        if self._0x480 is None:
            self._0x480 = []
        if self._0x4a0 is None:
            self._0x4a0 = []
        if self._0x98 is None:
            self._0x98 = {}
        if self._0x90 is None:
            self._0x90 = object()
        if self._resource_tiles is None:
            self._resource_tiles = {}


def compute_region_clamp_weight_140e84c30(region: object) -> float:
    """Compute the shared clamp factor used by solid-field tile contribution."""

    boundary_list = getattr(region, "boundary_list", None)
    if boundary_list is None or not hasattr(boundary_list, "get_volume_0x78"):
        return 0.0

    volume = float(boundary_list.get_volume_0x78())
    return min(volume * 9.999999717180685e-10, 262144.0)


def compiled_resource_object_fields(field_list: list[object]) -> list["ResourceObjectField"]:
    """Select solid resource fields from the compiled region field list."""

    return [
        field
        for field in field_list
        if hasattr(field, "ware_key_0x1110")
        and hasattr(field, "resourcepercentage_0x1190")
        and hasattr(field, "get_multiplier_b_0x98")
        and hasattr(field, "get_multiplier_a_0x1b8")
    ]


def _aggregate_tile_currents_from_manager(
    manager: SpatialManagerRuntime,
    ware_filter: str | None = None,
) -> tuple[dict[str, int], list[dict]]:
    """Materialize tile totals from dispatch-side replay aggregation."""

    resource_tiles = manager._resource_tiles or {}
    if not resource_tiles:
        return {}, []

    totals: dict[str, int] = {}
    per_tile: list[dict] = []

    for coord in sorted(resource_tiles):
        tile_bucket = resource_tiles[coord]
        tile_values: dict[str, int] = {}
        field_traces: list[object] = []
        for ware, item in sorted(tile_bucket.items()):
            if ware_filter and ware != ware_filter:
                continue
            current = int(item.get("current", 0))
            if current <= 0:
                continue
            tile_values[ware] = current
            totals[ware] = totals.get(ware, 0) + current
            field_traces.extend(item.get("field_traces", []))

        if tile_values:
            per_tile.append(
                {
                    "coord": coord,
                    "tile_values": tile_values,
                    "field_traces": field_traces,
                }
            )

    return totals, per_tile


def replay_region_runtime_14075BD20(
    compiled: "CompiledRegionRuntime",
    ware_filter: str | None = None,
) -> tuple[dict[str, int], list[dict]]:
    """Replay one compiled region through the verified FUN_14075bd20 entry."""

    manager = SpatialManagerRuntime(sector_id=compiled.sector_id)
    manager._compiled = compiled
    spatial_manager_process_region_14075BD20(manager, compiled.region, None, True)
    return _aggregate_tile_currents_from_manager(manager, ware_filter=ware_filter)


def _get_field_recharge_time_0x1f8(field_obj: object) -> float:
    """Best-effort replay for the time-like field forwarded before FUN_14075ff10."""

    time_value = float(getattr(field_obj, "field_0x111c", 0.0) or 0.0)
    if time_value > 0.0:
        return time_value
    return 108000.0


def _dispatch_recharge_add_14075e070(item: dict, contribution: int) -> None:
    """Minimal FUN_14075e070 replay: current += contribution, rate = current / time."""

    item["current"] = int(item.get("current", 0)) + int(contribution)
    time_value = float(item.get("time", 0.0) or 0.0)
    item["rate"] = 0.0 if time_value <= 0.0 else float(item["current"]) / time_value


def _dispatch_recharge_insert_14075e000(
    tile_bucket: dict[str, dict],
    ware_key: str,
    payload_name: str,
    time_value: float,
    contribution: int,
    trace: object,
) -> None:
    """Minimal FUN_14075e000 replay: construct one recharge entry then add current."""

    item = tile_bucket.setdefault(
        ware_key,
        {
            "current": 0,
            "rate": 0.0,
            "time": float(time_value),
            "payload_name": payload_name,
            "field_traces": [],
        },
    )
    item["field_traces"].append(trace)
    _dispatch_recharge_add_14075e070(item, contribution)


def _dispatch_recharge_update_14075ff10(
    manager: SpatialManagerRuntime,
    tile_coord: tuple[int, int, int],
    ware_key: str,
    contribution: int,
    payload_name: str,
    time_value: float,
    trace: object,
) -> None:
    """Minimal FUN_14075ff10 replay for tile/resource aggregation."""

    if not ware_key or contribution <= 0:
        return

    tile_bucket = manager._resource_tiles.setdefault(tile_coord, {})
    if ware_key in tile_bucket:
        tile_bucket[ware_key]["field_traces"].append(trace)
        _dispatch_recharge_add_14075e070(tile_bucket[ware_key], contribution)
        return

    _dispatch_recharge_insert_14075e000(
        tile_bucket=tile_bucket,
        ware_key=ware_key,
        payload_name=payload_name,
        time_value=time_value,
        contribution=contribution,
        trace=trace,
    )


# =============================================================================
# FUN_140385c50: dispatch_region_to_managers
# =============================================================================

def dispatch_region_to_managers_140385C50(
    param_1: object,
    param_2: object,
    param_3: bool,
    param_4: bool,
) -> None:
    """Dispatch region to managers - C++ FUN_140385c50 replication.

    C++ pseudocode:
    if (param_3 != '\0') {
        local_res18[0] = 1;
        if (*(longlong *)(param_1 + 0xa8) == 0) {
            // Initialize default values from globals
        } else {
            FUN_1404724c0(&local_38, *(longlong *)(param_1 + 0xa8), 2, local_res18);
        }
        // Iterate through list and call FUN_14075bd20 for each
        while (true) {
            if ((plVar1 == plVar5) && (uStack_50 == uVar3)) break;
            // Get item from list
            FUN_14075bd20(uVar4, param_2, 0, 1);
            FUN_1402ed890(&local_58);
        }
    }
    if (param_4 != '\0') {
        // Similar loop with FUN_14070eb70
    }
    """
    managers = list(param_1.managers)

    if param_3:
        for uVar4 in managers:
            if uVar4 != 0:
                spatial_manager_process_region_14075BD20(uVar4, param_2, None, True)

    # param_4 branch: similar but calls FUN_14070eb70
    if param_4:
        # C++: if (DAT_143df3f88 == 0) { plVar5 = &DAT_143defb18; }
        # else { plVar5 = (longlong *)(DAT_143df3f88 + 0x230); }
        DAT_143df3f88 = 0  # Global

        if DAT_143df3f88 == 0:
            plVar5 = 0  # &DAT_143defb18
        else:
            plVar5 = DAT_143df3f88 + 0x230

        # C++: if (*plVar5 != 0)
        if plVar5 != 0:
            # Similar iteration logic calling FUN_14070eb70
            pass  # Optional branch


# =============================================================================
# FUN_14075bd20: spatial_manager_process_region
# =============================================================================

def spatial_manager_process_region_14075BD20(
    manager: object,
    region: object,
    param_3: list[float] | None,
    flush_after: bool,
) -> None:
    """Process region for spatial manager - C++ FUN_14075bd20 replication.

    C++ pseudocode:
    if ((param_2[0x57] == param_2[0x58]) && (param_2[0x5a] == param_2[0x5b])) {
        return;  // Empty boundary list
    }
    // Initialize local_118, local_108, local_f8, local_e8 from globals
    FUN_1403a7e40(param_2, &local_118, param_1, 0);
    pfVar6 = (float *)(**(code **)(*param_2 + 0x1430))();  // vfunc+0x1430
    // ... SIMD operations for bounds calculation ...
    FUN_14075c250(param_1, param_2, &local_118, &local_d8, uVar13, param_3);
    if (param_4 != '\0') {
        FUN_14075cc00(param_1);
    }
    """
    boundary_list = region.boundary_list
    if boundary_list is None or boundary_list.is_empty():
        return

    transform = [0.0] * 16
    build_transform_matrix_1403A7E40(region, transform, manager, 0)
    transformed_bounds = transform_bounds_1414EF820(region.get_bounds_0x1430(), transform)

    min_x = transformed_bounds[0]
    min_y = transformed_bounds[1]
    min_z = transformed_bounds[2]
    max_x = transformed_bounds[4]
    max_y = transformed_bounds[5]
    max_z = transformed_bounds[6]

    extent_x = max_x - min_x
    extent_y = max_y - min_y
    extent_z = max_z - min_z
    max_extent = max(extent_x, extent_y, extent_z)

    if manager._0x408 is None:
        manager._0x408 = {}

    level = 0
    cell_size = _DAT_142d80994
    while cell_size < max_extent * _DAT_142d7ff50:
        level += 1
        cell_size += cell_size
        if level > 10:
            break

    span = cell_size * _DAT_142d7ff50
    min_grid_x = math.floor((min_x + span) * _DAT_142d83660)
    min_grid_y = math.floor((min_y + span) * _DAT_142d83660)
    min_grid_z = math.floor((min_z + span) * _DAT_142d83660)
    max_grid_x = math.floor((max_x - span) * _DAT_142d83660)
    max_grid_y = math.floor((max_y - span) * _DAT_142d83660)
    max_grid_z = math.floor((max_z - span) * _DAT_142d83660)
    grid_x = math.floor((min_grid_x + max_grid_x) * 0.5)
    grid_y = math.floor((min_grid_y + max_grid_y) * 0.5)
    grid_z = math.floor((min_grid_z + max_grid_z) * 0.5)
    grid_origin4 = [
        grid_x * _DAT_142d842b0 + _DAT_142d84280,
        grid_y * _DAT_142d842b0 + _DAT_142d84280,
        grid_z * _DAT_142d842b0 + _DAT_142d84280,
        0.0,
    ]

    spatial_index_insert_region_14075C250(
        manager, region,
        transform,
        grid_origin4,
        level,
        param_3,
    )

    # C++: if (param_4 != '\0') { FUN_14075cc00(param_1); }
    if flush_after:
        spatial_manager_flush_14075CC00(manager)


# =============================================================================
# FUN_1403a7e40: build_transform_matrix (stub - complex function)
# =============================================================================

def build_transform_matrix_1403A7E40(
    param_1: object,
    param_2: list,
    param_3: object,
    param_4: int,
) -> None:
    """Build transform matrix - C++ FUN_1403a7e40 replication.

    This is a complex function that builds a transformation matrix.
    Full implementation requires understanding the matrix stack logic.
    """
    # C++: if (param_3 != param_1) { ... complex logic ... }
    # Simplified: identity matrix
    if len(param_2) >= 16:
        # Identity matrix
        param_2[0] = 1.0
        param_2[1] = 0.0
        param_2[2] = 0.0
        param_2[3] = 0.0
        param_2[4] = 0.0
        param_2[5] = 1.0
        param_2[6] = 0.0
        param_2[7] = 0.0
        param_2[8] = 0.0
        param_2[9] = 0.0
        param_2[10] = 1.0
        param_2[11] = 0.0
        param_2[12] = 0.0
        param_2[13] = 0.0
        param_2[14] = 0.0
        param_2[15] = 1.0


# =============================================================================
# FUN_1414ef820: transform_bounds
# =============================================================================

def transform_bounds_1414EF820(
    param_1: list,
    param_2: list,
) -> list:
    """Transform bounds - C++ FUN_1414ef820 replication.

    C++: Complex SIMD operations transforming AABB by matrix.
    Returns transformed bounds.
    """
    # C++: Extract values from inputs
    fVar6 = param_2[0xc] if len(param_2) > 0xc else 0.0
    fVar7 = param_2[0xd] if len(param_2) > 0xd else 0.0
    fVar8 = param_2[0xe] if len(param_2) > 0xe else 0.0
    fVar9 = param_2[0xf] if len(param_2) > 0xf else 0.0

    fVar18 = param_1[4] - param_1[0] if len(param_1) > 4 else 0.0
    fVar30 = param_1[0] + param_1[4] if len(param_1) > 4 else 0.0

    # C++: Matrix multiplication (simplified)
    # Return 8 floats representing transformed bounds
    result = [0.0] * 9

    # Simplified: just copy input
    for i in range(min(len(param_1), 9)):
        result[i] = param_1[i]

    return result


# =============================================================================
# FUN_14075c250: spatial_index_insert_region
# =============================================================================

# C++ globals referenced by this function
_DAT_142d7ff50 = 0.5  # Grid offset constant
_DAT_142d80994 = 64000.0  # Base grid cell size
_DAT_142d83660 = 1.5625e-05  # 1/64000 - grid to world scale
_DAT_142d842b0 = 64000.0  # World to grid scale
_DAT_142d84280 = 32000.0  # Grid cell center offset
_DAT_142d80300 = 1.7320508  # Bounding radius multiplier (sqrt(3))
_DAT_142d7fbe8 = 0.0  # Minimum occupancy threshold
_DAT_142d843a0 = 0xFFFFFFFF  # Occupancy mask


def spatial_index_insert_region_14075C250(
    manager: object,
    region: object,
    transform: list,
    grid_origin4: list,
    depth: int,
    param_6: list[float] | None,
) -> None:
    """Insert region into spatial index - C++ FUN_14075c250 replication.

    C++ pseudocode (from Ghidra decompilation):
        fVar38 = (float)(1L << param_5) * DAT_142d80994;
        fVar3 = DAT_142d7ff50;

        for (pvVar7 = 0; pvVar7 < 2; pvVar7++) {
            for (pvVar14 = 0; pvVar14 < 2; pvVar14++) {
                for (pvVar11 = 0; pvVar11 < 2; pvVar11++) {
                    // Calculate grid position for this octant
                    local_f8[0] = ((float)pvVar7 - fVar3) * fVar38 + param_4[0];
                    local_f8[1] = ((float)pvVar14 - fVar3) * fVar38 + param_4[1];
                    local_f8[2] = ((float)pvVar11 - fVar3) * fVar38 + param_4[2];

                    if (param_5 == 0) {
                        // Leaf node: query tile and insert into spatial index
                        // Grid alignment and snap to integer coordinates
                        local_138[0] = DAT_142d83660 * local_f8[0];
                        local_138[1] = DAT_142d83660 * local_f8[1];
                        local_138[2] = DAT_142d83660 * local_f8[2];

                        // Convert to integers (grid snap)
                        iVar12 = (int)local_138[0];
                        if ((iVar12 != -0x80000000) && ((float)iVar12 != local_138[0])) {
                            local_138[0] = (float)(iVar12 - (local_138[0] < 0 ? 1 : 0));
                        }
                        // ... repeat for y, z

                        // Scale back to world coordinates
                        local_138[0] = local_138[0] * DAT_142d842b0;
                        local_138[1] = local_138[1] * DAT_142d842b0;
                        local_138[2] = local_138[2] * DAT_142d842b0;

                        // Query tile occupancy
                        uVar6 = FUN_14073f750(param_2, param_1, local_138, 0);

                        if (DAT_142d7fbe8 <= (float)(uVar6 & DAT_142d843a0)) {
                            // Insert into spatial structure at param_1 + 0x408
                            // Complex tree insertion logic...
                        }
                    } else {
                        // Non-leaf: check intersection and recurse
                        // Transform to local coordinates
                        local_138[0] = local_f8[0] - param_3[0xc];
                        local_138[1] = local_f8[1] - param_3[0xd];
                        local_138[2] = local_f8[2] - param_3[0xe];

                        // Matrix multiply (simplified)
                        local_128[0] = param_3[4] * local_138[0] + param_3[5] * local_138[1] + param_3[6] * local_138[2];
                        local_128[1] = param_3[8] * local_138[0] + param_3[9] * local_138[1] + param_3[10] * local_138[2];
                        local_128[2] = param_3[12] * local_138[0] + param_3[13] * local_138[1] + param_3[14] * local_138[2];

                        // Check intersection with boundary (vfunc+0x10)
                        cVar5 = (**(code **)(*(longlong *)(param_2 + 0x2b0) + 0x10))(
                            param_2 + 0x2b0, local_128, fVar38 * DAT_142d80300);

                        if (cVar5 != '\0') {
                            FUN_14075c250(param_1, param_2, param_3, local_f8, param_5 - 1, param_6);
                        }
                    }
                }
            }
        }

    Args:
        param_1: Manager context (spatial index owner)
        param_2: Region object
        param_3: Transform matrix (16 floats, column-major)
        param_4: Grid base coordinates (4 floats: x, y, z, w)
        param_5: Level (recursion depth, 0 = leaf)
        param_6: Random array or None
    """
    # C++: fVar38 = (float)(1L << param_5) * DAT_142d80994
    fVar38 = float(1 << depth) * _DAT_142d80994
    fVar3 = _DAT_142d7ff50

    # C++: Triple nested loop (2x2x2 octree traversal)
    for pvVar7 in range(2):  # x dimension
        for pvVar14 in range(2):  # y dimension
            for pvVar11 in range(2):  # z dimension
                # C++: Calculate grid position for this octant
                # local_f8[0] = ((float)pvVar7 - fVar3) * fVar38 + param_4[0]
                local_f8_0 = (float(pvVar7) - fVar3) * fVar38 + grid_origin4[0]
                local_f8_1 = (float(pvVar14) - fVar3) * fVar38 + grid_origin4[1]
                local_f8_2 = (float(pvVar11) - fVar3) * fVar38 + grid_origin4[2]
                local_f8_3 = grid_origin4[3] if len(grid_origin4) > 3 else 0.0

                if depth == 0:
                    # C++: Leaf level - query tile and insert into spatial index
                    # Grid alignment with DAT_142d83660 (1/64000)
                    local_138_0 = _DAT_142d83660 * local_f8_0 + _DAT_142d7ff50
                    local_138_1 = _DAT_142d83660 * local_f8_1 + _DAT_142d7ff50
                    local_138_2 = _DAT_142d83660 * local_f8_2 + _DAT_142d7ff50

                    # C++: Convert to integers and back (grid snap)
                    # This handles the truncation toward negative infinity
                    local_138_0 = float(math.floor(local_138_0))
                    local_138_1 = float(math.floor(local_138_1))
                    local_138_2 = float(math.floor(local_138_2))

                    # C++: Scale back to world coordinates
                    local_138_0 = local_138_0 * _DAT_142d842b0
                    local_138_1 = local_138_1 * _DAT_142d842b0
                    local_138_2 = local_138_2 * _DAT_142d842b0

                    # C++: Call FUN_14073f750 for tile occupancy query
                    # uVar6 = FUN_14073f750(param_2, param_1, local_138, 0)
                    from impl.tile_processing import query_tile_occupancy_14073f750

                    uVar6 = query_tile_occupancy_14073f750(
                        region,
                        manager,
                        (local_138_0, local_138_1, local_138_2),
                        0
                    )

                    # C++: Check if contribution is significant
                    # if (DAT_142d7fbe8 <= (float)(uVar6 & DAT_142d843a0))
                    if float(uVar6) > _DAT_142d7fbe8:
                        # C++: Insert into spatial structure at param_1 + 0x408
                        _insert_into_spatial_index(manager, region, local_138_0, local_138_1, local_138_2, uVar6)
                        _dispatch_tile_resource_fields_14075C250(
                            manager=manager,
                            region=region,
                            tile_world=(local_138_0, local_138_1, local_138_2),
                            query_weight=float(uVar6),
                        )

                else:
                    # C++: Non-leaf: check intersection and recurse
                    # Transform to local coordinates
                    if len(transform) >= 16:
                        # C++: local_138 = local_f8 - param_3 translation (elements 12,13,14 are translation in column-major)
                        # Actually in column-major: [12]=m41, [13]=m42, [14]=m43 (translation)
                        local_138_0 = local_f8_0 - transform[12]
                        local_138_1 = local_f8_1 - transform[13]
                        local_138_2 = local_f8_2 - transform[14]

                        # C++: Matrix multiply to get local coordinates
                        # local_128[0] = param_3[0] * local_138[0] + param_3[4] * local_138[1] + param_3[8] * local_138[2]
                        # local_128[1] = param_3[1] * local_138[0] + param_3[5] * local_138[1] + param_3[9] * local_138[2]
                        # local_128[2] = param_3[2] * local_138[0] + param_3[6] * local_138[1] + param_3[10] * local_138[2]
                        # Note: Row-major vs column-major handling
                        local_128_0 = transform[0] * local_138_0 + transform[4] * local_138_1 + transform[8] * local_138_2
                        local_128_1 = transform[1] * local_138_0 + transform[5] * local_138_1 + transform[9] * local_138_2
                        local_128_2 = transform[2] * local_138_0 + transform[6] * local_138_1 + transform[10] * local_138_2

                        # C++: Opaque +0x10 gate on the embedded BoundaryList
                        # subobject at field/region + 0x2b0.
                        boundary_list = region.boundary_list
                        cVar5 = False
                        if boundary_list is not None:
                            cVar5 = boundary_list.slot_gate_0x10(
                                (local_128_0, local_128_1, local_128_2, 0.0),
                                fVar38 * _DAT_142d80300
                            )

                        if cVar5:
                            # C++: Recursive call with param_5 - 1
                            spatial_index_insert_region_14075C250(
                                manager, region, transform,
                                [local_f8_0, local_f8_1, local_f8_2, local_f8_3],
                                depth - 1, param_6
                            )


def _dispatch_tile_resource_fields_14075C250(
    manager: SpatialManagerRuntime,
    region: object,
    tile_world: tuple[float, float, float],
    query_weight: float,
) -> None:
    """Replay the verified field-vector -> +0x1c8/+0x1f0 -> 75ff10 path."""

    compiled = getattr(manager, "_compiled", None)
    if compiled is None:
        return

    solid_fields = compiled_resource_object_fields(getattr(compiled, "field_list", []))
    if not solid_fields:
        return

    clamp_weight = compute_region_clamp_weight_140e84c30(region)
    tile_coord = (int(tile_world[0]), int(tile_world[1]), int(tile_world[2]))

    for field_obj in solid_fields:
        ware_key = ""
        if hasattr(field_obj, "get_ware_key_0x1c8"):
            ware_key = field_obj.get_ware_key_0x1c8() or ""
        if not ware_key:
            continue

        trace = field_obj.compute_tile_contribution_140e84c30(
            tile_world,
            query_weight=query_weight,
            clamp_weight=clamp_weight,
        )
        if trace.contribution <= 0:
            continue

        payload_name = ""
        if hasattr(field_obj, "get_payload_name_ptr_0xb8"):
            payload_name = field_obj.get_payload_name_ptr_0xb8() or ""

        time_value = _get_field_recharge_time_0x1f8(field_obj)
        _dispatch_recharge_update_14075ff10(
            manager=manager,
            tile_coord=tile_coord,
            ware_key=ware_key,
            contribution=trace.contribution,
            payload_name=payload_name,
            time_value=time_value,
            trace=trace,
        )


def _insert_into_spatial_index(
    manager: object,
    region: object,
    x: float,
    y: float,
    z: float,
    occupancy: float
) -> None:
    """Insert node into spatial index structure - C++ helper.

    C++: Corresponds to the complex insertion logic at param_1 + 0x408.
    This involves traversing/allocating an octree-like structure.

    Args:
        manager: Manager context (param_1)
        region: Region object (param_2)
        x, y, z: Tile coordinates
        occupancy: Occupancy value from FUN_14073f750
    """
    # C++: plVar1 = *(longlong **)(param_1 + 0x408)
    ptr_408 = manager._0x408
    if ptr_408 is None:
        ptr_408 = {}
        manager._0x408 = ptr_408
    ptr_408.setdefault('nodes', [])
    ptr_408.setdefault('regions', set())

    # C++: Complex tree insertion logic
    # For now, simplified flat list - full octree would require more structure
    node = {
        'x': x,
        'y': y,
        'z': z,
        'region': region,
        'occupancy': occupancy,
    }

    region_id = region.id
    node_key = (x, y, z, region_id)
    node_keys = ptr_408.setdefault('node_keys', set())
    if node_key not in node_keys:
        ptr_408['nodes'].append(node)
        node_keys.add(node_key)

    # Track which regions are in the index
    if region_id is not None:
        ptr_408['regions'].add(region_id)


# =============================================================================
# FUN_14073f750: query_tile_occupancy
# =============================================================================

# Note: Full implementation is in impl/tile_processing.py
# This import provides access for FUN_14075c250
from impl.tile_processing import query_tile_occupancy_14073f750

# Keep a deprecated alias for backwards compatibility
query_tile_occupancy_14073F750 = query_tile_occupancy_14073f750


# =============================================================================
# FUN_14075cc00: spatial_manager_flush
# =============================================================================

def spatial_manager_flush_14075CC00(
    param_1: object,
) -> None:
    """Flush spatial manager - C++ FUN_14075cc00 replication.

    C++ pseudocode:
    param_1[0x9d] = 0;  // Clear flag
    lVar6 = param_1[0x81];
    if (lVar6 != 0) {
        // Iterate through resource nodes
        Sector_FindResourcePositionsByMinYield(lVar6, &local_88, 0, lVar6, lVar6 + 0x90, 1);
        for (pppppppuVar12 = local_d8; pppppppuVar12 != pppppppuVar3 + lVar6; pppppppuVar12 += 2) {
            // Process each node, update metrics
            uVar13 = (ulonglong)*pppppppuVar12 ^ (ulonglong)pppppppuVar12;
            uVar10 = (uint)*pppppppuVar12 & 0x7fffffff ^ *(uint *)(pppppppuVar12 + 1);
            if (0 < (int)uVar10) {
                // Tree traversal and updates
                plVar4 = (longlong *)param_1[0x91];
                // ... binary tree operations ...
                FUN_1408bb5d0(param_1 + 0x98, uVar13, uVar1 & 0xffffffff, 0);
            }
        }
    }
    // Iterate through sector tree
    plVar4 = (longlong *)param_1[0x94];
    do {
        if (plVar4 == param_1 + 0x90) {
            return;
        }
        // Check for integer overflow
        uVar13 = plVar4[5];
        if (0x7fffffff < uVar13) {
            // Log overflow warning
            FUN_1414caae0("Ware %s in sector %s (%s) has total amount %llu...");
        }
        // Tree traversal
        plVar11 = (longlong *)plVar4[2];
        if (plVar11 == (longlong *)0x0) {
            // Move to parent/sibling
            plVar11 = (longlong *)*plVar4;
            // ...
        }
        plVar4 = plVar11;
    } while (true);

    Args:
        param_1: Manager context
    """
    # C++: param_1[0x9d] = 0
    param_1._0x9d = 0

    # C++: lVar6 = param_1[0x81]
    lVar6 = param_1._0x81

    if lVar6 is not None and lVar6 != 0:
        # C++: Initialize locals from globals
        DAT_142d823f0 = 0
        UNK_142d823f8 = 0

        # C++: Call Sector_FindResourcePositionsByMinYield (simplified)
        # This would find all resource positions with minimum yield

        # C++: Iterate through found positions
        local_d8 = []  # Would be filled by the above call
        local_b8 = 2  # Default/empty indicator

        if local_b8 == 2:
            pppppppuVar12 = local_d8
        else:
            pppppppuVar3 = local_d8[0] if local_d8 else None

        # Simplified: skip complex tree traversal for now
        pass

    # C++: Second loop - iterate through sector tree
    DAT_142d7fb7c = 1.0  # Scale factor for overflow warning
    fVar2 = DAT_142d7fb7c

    plVar4 = param_1._0x94
    target = param_1._0x90

    if plVar4 is None:
        return

    max_iterations = 10000  # Safety limit
    iteration = 0

    while plVar4 != target and iteration < max_iterations:
        iteration += 1

        # C++: uVar13 = plVar4[5] - total amount
        uVar13 = plVar4[5] if len(plVar4) > 5 else 0

        # C++: Check for integer overflow
        if uVar13 > 0x7FFFFFFF:
            # C++: Log warning message
            # FUN_1414caae0("Ware %s in sector %s (%s) has total amount %llu...")
            # Simplified: just note the overflow
            pass

        # C++: Tree traversal - move to next node
        plVar11 = plVar4[2] if len(plVar4) > 2 else None

        if plVar11 is None or plVar11 == 0:
            # C++: Move up and find sibling
            plVar11 = plVar4[0] if len(plVar4) > 0 else None
            # Complex sibling/parent traversal logic
            # Simplified: just move to parent
            plVar4 = plVar11
        else:
            # C++: Move to rightmost descendant
            plVar4 = plVar11

        if plVar4 is None or plVar4 == target:
            break


# =============================================================================
# FUN_14070eb70: global_system_register (optional)
# =============================================================================

def global_system_register_14070EB70(
    param_1: object,
    param_2: object,
) -> None:
    """Register region to global system - C++ FUN_14070eb70.

    Args:
        param_1: Global system pointer
        param_2: Region object
    """
    # Optional branch from FUN_140385c50
    pass
