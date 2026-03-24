"""Unified region replay - reverse engineered from X4.exe.

C++ entry: FUN_14073e110

Field type detection (FUN_140e81620):
- case 0x08 (8): AsteroidField -> solid
- case 0x13 (19): DebrisField -> solid (uses same FUN_140e842e0 as AsteroidField)
- case 0x4c (76): Nebula -> gas

In JSON data:
- Solid: fields array contains tag="asteroid" or tag="debris"
- Gas: fields array contains tag="nebula"
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from .profile_eval import ProfilePoint, eval_profile_avg_1414ed970
from .grid_enumeration import (
    AREA_SIZE,
    QueryGridWindow,
    build_query_grid_window_140760320,
    storage_coord_to_world_coord_140760320,
    enumerate_storage_coords_for_bbox,
    QUERY_RADIUS_14073F750,
)
from .solid_context import (
    SolidRegionState,
    SolidFieldState,
    FalloffProfiles,
    compute_multiplier_a_140E80300,
    compute_multiplier_b_140E803E0,
)
from .noise import compute_local_noise_fast_path_1414F4840
from .weight_computation import compute_resource_field_base_multiplier_140e80260
from boundary.spline_tube_boundary import SplineTubeBoundary
from boundary.cylinder_boundary import CylinderBoundary
from field.field_factory import (
    iterate_resources_140e82530,
    resolve_groupref_140e81ff0,
    field_factory_140e81620,
    parse_region_object_groups_140E950A0,
    FIELD_TYPE_ASTEROID,
    FIELD_TYPE_DEBRIS,
)

if TYPE_CHECKING:
    pass


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RAW_ROOT = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries"
REGIONS_JSON = DATA_ROOT / "regions.json"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"


@dataclass
class FieldInfo:
    """Field information extracted from region data."""
    tag: str
    groupref: str = ""
    densityfactor: float = 1.0
    noisescale: float = 5000.0
    seed: str = ""
    minnoisevalue: float = 0.0
    maxnoisevalue: float = 1.0


@dataclass
class ResourceInfo:
    """Resource information from region data."""
    ware: str
    resourcedensity: float
    delay: float = 0.0
    gatherfactor: float = 1.0
    yield_name: str = ""


@dataclass
class TileResult:
    """Result for a single tile."""
    storage_coord: tuple[int, int, int]
    world_coord: tuple[int, int, int]
    profile_weight: float
    lateral_interval: tuple[float, float] | None
    radial_interval: tuple[float, float] | None
    lateral_weight: float
    radial_weight: float
    tile_values: dict[str, float]


@dataclass
class FieldReplayResult:
    """Result for a single field replay."""
    field_type: str  # "gas" or "solid"
    field_name: str
    boundary_class: str
    sector_id: str
    region_id: str
    ware_id: str
    yield_name: str = ""
    tile_count: int = 0
    ware_totals: dict[str, float] = field(default_factory=dict)
    per_tile: list[TileResult] = field(default_factory=list)


@dataclass
class RegionReplayResult:
    """Result for a complete region replay."""
    sector_id: str
    region_id: str
    fields: list[FieldReplayResult] = field(default_factory=list)


# ============================================================================
# Region data loading
# ============================================================================

def load_region_data(region_id: str) -> dict:
    """Load region data from regions.json."""
    with REGIONS_JSON.open("r", encoding="utf-8") as f:
        regions = json.load(f)
    for r in regions:
        if r["id"] == region_id:
            return r
    raise ValueError(f"Region not found: {region_id}")


def load_area_data(sector_id: str, region_id: str) -> dict:
    """Load area data from resourceareas.json."""
    with RESOURCEAREAS_JSON.open("r", encoding="utf-8") as f:
        areas = json.load(f)
    for entry in areas:
        if entry.get("sector_id") != sector_id:
            continue
        for area in entry.get("areas", []):
            if area.get("ref") == region_id:
                return area
    raise ValueError(f"Area not found: {sector_id} / {region_id}")


def parse_fields_from_region(region_data: dict) -> list[FieldInfo]:
    """Parse field definitions from region data."""
    fields = []
    for f in region_data.get("fields", []):
        fields.append(FieldInfo(
            tag=f.get("tag", ""),
            groupref=f.get("groupref", ""),
            densityfactor=float(f.get("densityfactor", 1.0)),
            noisescale=float(f.get("noisescale", 5000.0)),
            seed=str(f.get("seed", "")),
            minnoisevalue=float(f.get("minnoisevalue", 0.0)),
            maxnoisevalue=float(f.get("maxnoisevalue", 1.0)),
        ))
    return fields


def parse_resources_from_region(region_data: dict) -> list[ResourceInfo]:
    """Parse resource definitions from region data."""
    resources = []
    for r in region_data.get("resources", []):
        resources.append(ResourceInfo(
            ware=r.get("ware", ""),
            resourcedensity=float(r.get("resourcedensity", 1.0)),
            delay=float(r.get("delay", 0)),
            gatherfactor=float(r.get("gatherfactor", 1.0)),
            yield_name=r.get("yield_name", ""),
        ))
    return resources


# ============================================================================
# Type detection (C++ FUN_140e81620 switch logic)
# ============================================================================

GAS_WARES = {"hydrogen", "helium", "methane"}

# Solid field tags (C++ cases 0x08, 0x13)
SOLID_FIELD_TAGS = {"asteroid", "debris"}


def is_gas_ware(ware: str) -> bool:
    """Check if ware is a gas type."""
    return ware in GAS_WARES


def is_solid_field(field: FieldInfo) -> bool:
    """Check if field is solid (AsteroidField or DebrisField).

    C++ evidence from FUN_140e81620:
    - case 0x08: AsteroidField
    - case 0x13: DebrisField (uses same FUN_140e842e0 as AsteroidField)
    """
    return field.tag in SOLID_FIELD_TAGS


def is_gas_field(field: FieldInfo) -> bool:
    """Check if field is gas (Nebula).

    C++ evidence: case 0x4c in FUN_140e81620
    """
    return field.tag == "nebula"


# ============================================================================
# Solid field computation
# ============================================================================

def compute_solid_field_bounding_box(region_data: dict, area_data: dict) -> tuple:
    """Compute bounding box for solid field enumeration."""
    boundary = region_data.get("boundary", {})
    size = boundary.get("size", {})
    position = area_data.get("position", {})

    radius = float(size.get("r", 0))
    linear = float(size.get("linear", 0))
    pos_x = float(position.get("x", 0))
    pos_y = float(position.get("y", 0))
    pos_z = float(position.get("z", 0))

    # Expand by query radius for tile overlap
    box_min = (
        pos_x - radius - QUERY_RADIUS_14073F750,
        pos_y - linear / 2 - QUERY_RADIUS_14073F750,
        pos_z - radius - QUERY_RADIUS_14073F750,
    )
    box_max = (
        pos_x + radius + QUERY_RADIUS_14073F750,
        pos_y + linear / 2 + QUERY_RADIUS_14073F750,
        pos_z + radius + QUERY_RADIUS_14073F750,
    )

    return box_min, box_max, (pos_x, pos_y, pos_z)


# ============================================================================
# FUN_14073e110 replication - Pending Ghidra verification
# ============================================================================

# Functions/vfuncs used in replay_solid_field_14073E110:
# 1. iterate_resources_140e82530 (FUN_140e82530) - CONFIRMED
# 2. receive_region_payload_0x20 (vfunc+0x20) - vfunc
# 3. compute_field_weight_0xa0 (vfunc+0xa0) - vfunc
# 4. writeback_per_field_value_0x28 (vfunc+0x28) - vfunc
# 5. eval_profile_avg_1414ed970 (FUN_1414ed970) - PENDING
# 6. get_lateral_interval_0x58 (vfunc+0x58) - vfunc
# 7. get_radial_interval_0x70 (vfunc+0x70) - vfunc
# 8. get_multiplier_b_0x98 (vfunc+0x98) - vfunc
# 9. get_multiplier_a_0x1b8 (vfunc+0x1b8) - vfunc
# 10. compute_local_noise_fast_path_1414F4840 (FUN_1414F4840) - PENDING
# 11. storage_coord_to_world_coord_140760320 (FUN_140760320) - PENDING
# 12. build_query_grid_window_140760320 (FUN_140760320) - PENDING


def replay_solid_field_14073E110(
    sector_id: str,
    region_data: dict,
    area_data: dict,
    fields: list[FieldInfo],
    resources: list[ResourceInfo],
    ware_filter: str | None = None,
) -> FieldReplayResult:
    """Replay solid field computation - C++ FUN_14073e110 replication.

    PENDING: Function-by-function verification via Ghidra.
    Each function/vfunc used below must be confirmed before finalizing.

    Args:
        sector_id: Sector identifier
        region_data: Region JSON data
        area_data: Area JSON data
        fields: List of FieldInfo (asteroid/debris fields only)
        resources: List of ResourceInfo
        ware_filter: Optional ware to filter

    Returns:
        FieldReplayResult with computed values
    """
    from field import ResourceObjectField

    region_id = region_data["id"]
    position = area_data.get("position", {})
    boundary = region_data.get("boundary", {})
    size = boundary.get("size", {})

    pos_x = float(position.get("x", 0))
    pos_y = float(position.get("y", 0))
    pos_z = float(position.get("z", 0))
    radius = float(size.get("r", 0))
    linear = float(size.get("linear", 0))
    region_density = float(region_data.get("density", 1.0))
    solid_volume_km3 = float(region_data.get("volume_km3", 0))

    # Filter solid fields (C++: case 0x08, 0x13 in FUN_140e81620)
    solid_field_infos = [f for f in fields if is_solid_field(f)]

    if not solid_field_infos:
        return _create_empty_solid_result(sector_id, region_id, boundary, ware_filter)

    # ========================================================================
    # Step 1: Build field list via FUN_140e82530 factory chain
    # ========================================================================
    field_list: list[ResourceObjectField] = []

    for f in solid_field_infos:
        xml_data = {
            "name": f.groupref or "default",
            "groupref": f.groupref,
            "densityfactor": f.densityfactor,
            "noisescale": f.noisescale,
            "seed": f.seed,
            "minnoisevalue": f.minnoisevalue,
            "maxnoisevalue": f.maxnoisevalue,
            "resourcepercentage": 100.0,
            "region_density": region_density,
            "type": FIELD_TYPE_ASTEROID if f.tag == "asteroid" else FIELD_TYPE_DEBRIS,
            "resources": [],
        }

        # CONFIRMED: FUN_140e82530
        created = iterate_resources_140e82530(
            field_list, xml_data,
            pos_x, pos_y, pos_z, radius,
            scale_factor=1.0, linear=linear
        )

        if ware_filter:
            created = [f for f in created if f.ware_key == ware_filter]

    if not field_list:
        return _create_empty_solid_result(sector_id, region_id, boundary, ware_filter)

    unique_wares = list(set(f.ware_key for f in field_list))

    # ========================================================================
    # Step 2: Inject payload via vfunc(+0x20) - INLINED from _inject_payload_for_fields
    # ========================================================================
    for field_obj in field_list:
        matching_res = [r for r in resources if r.ware == field_obj.ware_key]
        resourcedensity = matching_res[0].resourcedensity if matching_res else 1.0
        yield_name = matching_res[0].yield_name if matching_res else ""
        region_yield = matching_res[0].resourcedensity if matching_res else 0.0

        # vfunc(+0x20) - receive_region_payload
        field_obj.receive_region_payload_0x20(
            payload_resourcedensity=resourcedensity,
            payload_yield_name=yield_name,
            payload_region_yield=region_yield
        )

    # ========================================================================
    # Step 3: Accumulate weights via vfunc(+0xa0) - INLINED from _accumulate_weights_by_ware
    # ========================================================================
    sum_weights_by_ware: dict[str, float] = {}
    for field_obj in field_list:
        ware = field_obj.ware_key
        # vfunc(+0xa0) - use_resourcepercentage=False for region allocation
        field_weight = field_obj.compute_field_weight_0xa0(use_resourcepercentage=False)
        if ware not in sum_weights_by_ware:
            sum_weights_by_ware[ware] = 0.0
        sum_weights_by_ware[ware] += field_weight

    # ========================================================================
    # Step 4: Compute per_field_value - INLINED from _compute_per_field_value
    # ========================================================================
    per_field_value_by_ware: dict[str, float] = {}
    for ware in unique_wares:
        matching_res = [r for r in resources if r.ware == ware]
        resourcedensity = matching_res[0].resourcedensity if matching_res else 1.0
        sum_weights = sum_weights_by_ware.get(ware, 0.0)
        per_field_value = resourcedensity / sum_weights if sum_weights > 0 else 0.0
        per_field_value_by_ware[ware] = per_field_value

    # ========================================================================
    # Step 5: Writeback via vfunc(+0x28) - INLINED from _writeback_per_field_values
    # ========================================================================
    for field_obj in field_list:
        ware = field_obj.ware_key
        per_field_value = per_field_value_by_ware.get(ware, 0.0)
        # vfunc(+0x28) - writeback_per_field_value
        field_obj.writeback_per_field_value_0x28(per_field_value)

    # ========================================================================
    # Step 6: Process tiles - Setup grid and enumerate (FUN_14073e110 logic)
    # ========================================================================
    # Setup tile processing - This is part of FUN_14073e110, not FUN_14073f750
    half_height = linear / 2.0
    p0 = (pos_x, pos_y - half_height, pos_z)
    p1 = (pos_x, pos_y + half_height, pos_z)
    boundary_obj = CylinderBoundary.from_endpoints(p0, p1, radius)

    box_min, box_max, _ = compute_solid_field_bounding_box(region_data, area_data)
    grid = build_query_grid_window_140760320(pos_x, pos_y, pos_z)
    storage_coords = enumerate_storage_coords_for_bbox(box_min, box_max, grid, "full")

    falloff_data = region_data.get("falloff", {})
    falloff = FalloffProfiles(
        lateral=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff_data.get("lateral", [])],
        radial=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff_data.get("radial", [])],
    )

    clamp_factor = min(solid_volume_km3, 262144.0)

    per_tile: list[TileResult] = []
    ware_totals: dict[str, float] = {}

    # Tile loop - This is in FUN_14073e110
    for coord in storage_coords:
        world_coord = storage_coord_to_world_coord_140760320(grid, coord)
        world_pos = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))

        # Process single tile via FUN_14073f750
        tile_result = _process_tiles_14073f750(
            coord=coord,
            world_coord=world_coord,
            world_pos=world_pos,
            boundary_obj=boundary_obj,
            falloff=falloff,
            field_list=field_list,
            clamp_factor=clamp_factor,
        )

        if tile_result:
            per_tile.append(tile_result)
            for ware, value in tile_result.tile_values.items():
                if ware not in ware_totals:
                    ware_totals[ware] = 0.0
                ware_totals[ware] += value

    # Determine primary ware
    primary_ware = ware_filter if ware_filter else (field_list[0].ware_key if field_list else "")
    primary_yield = _find_yield_name(resources, primary_ware)

    return FieldReplayResult(
        field_type="solid",
        field_name=region_id,
        boundary_class=boundary.get("class", "cylinder"),
        sector_id=sector_id,
        region_id=region_id,
        ware_id=primary_ware,
        yield_name=primary_yield,
        tile_count=len(per_tile),
        ware_totals=ware_totals,
        per_tile=per_tile,
    )

def _process_tiles_14073f750(
    coord: tuple[int, int, int],
    world_coord: tuple[int, int, int],
    world_pos: tuple[float, float, float],
    boundary_obj: CylinderBoundary,
    falloff: FalloffProfiles,
    field_list: list,
    clamp_factor: float,
) -> TileResult | None:
    """Process single tile - C++ FUN_14073f750 replication.

    C++ FUN_14073f750 processes a single tile position:
    - Receives world position as parameter
    - Performs coordinate transformations (SIMD matrix ops)
    - Calls boundary queries (vfunc+0x58, vfunc+0x70)
    - Evaluates profile weights (FUN_1414ed970)
    - Computes local noise (FUN_1414F4840)
    - Applies multipliers (vfunc+0x98, vfunc+0x1b8)
    - Returns computed weight for the tile

    Note: The tile loop and grid enumeration are handled by the caller
    (FUN_14073e110), not by this function.

    Args:
        coord: Storage coordinate (tile index)
        world_coord: World coordinate tuple
        world_pos: World position tuple (float)
        boundary_obj: CylinderBoundary instance
        falloff: FalloffProfiles for lateral/radial evaluation
        field_list: List of field objects
        clamp_factor: Clamp factor from region volume

    Returns:
        TileResult if tile is within boundary, None otherwise
    """
    # vfunc(+0x58) and vfunc(+0x70) - boundary interval queries
    # These correspond to boundary checks in FUN_14073f750
    lateral_interval = boundary_obj.get_lateral_interval_0x58(world_pos, QUERY_RADIUS_14073F750)
    radial_interval = boundary_obj.get_radial_interval_0x70(world_pos, QUERY_RADIUS_14073F750)

    if lateral_interval is None:
        return None

    # FUN_1414ed970 - eval_profile_avg (CONFIRMED via Ghidra)
    lateral_weight = eval_profile_avg_1414ed970(falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg_1414ed970(falloff.radial, radial_interval)
    profile_weight = lateral_weight * radial_weight

    if profile_weight <= 0:
        return None

    tile_values: dict[str, float] = {}

    for field_obj in field_list:
        # FUN_1414F4840 - compute_local_noise (CONFIRMED via Ghidra)
        noise = compute_local_noise_fast_path_1414F4840(field_obj)

        # vfunc(+0x98) get_multiplier_b, vfunc(+0x1b8) get_multiplier_a
        weight = (
            field_obj.resourcepercentage
            * field_obj.get_multiplier_b_0x98()
            * noise
            * field_obj.get_multiplier_a_0x1b8()
            * profile_weight
            * clamp_factor
        )

        ware = field_obj.ware_key
        if ware not in tile_values:
            tile_values[ware] = 0.0
        tile_values[ware] += weight

    return TileResult(
        storage_coord=coord,
        world_coord=world_coord,
        profile_weight=profile_weight,
        lateral_interval=lateral_interval,
        radial_interval=radial_interval,
        lateral_weight=lateral_weight,
        radial_weight=radial_weight,
        tile_values=tile_values,
    )


# ============================================================================
# C++ Function Replication Helpers
# ============================================================================

def _create_empty_solid_result(
    sector_id: str,
    region_id: str,
    boundary: dict,
    ware_filter: str | None,
) -> FieldReplayResult:
    """Create empty result - helper for early returns."""
    return FieldReplayResult(
        field_type="solid",
        field_name=region_id,
        boundary_class=boundary.get("class", "cylinder"),
        sector_id=sector_id,
        region_id=region_id,
        ware_id=ware_filter or "",
    )


def _find_yield_name(resources: list[ResourceInfo], ware: str) -> str:
    """Find yield name for a ware."""
    for r in resources:
        if r.ware == ware:
            return r.yield_name
    return ""


# ============================================================================
# Gas field computation
# ============================================================================

def replay_gas_field_14075bd20(
    sector_id: str,
    region_data: dict,
    area_data: dict,
    fields: list[FieldInfo],
    resources: list[ResourceInfo],
    ware_filter: str | None = None,
) -> FieldReplayResult:
    """Replay gas field computation for all gas wares.

    Corresponds to FUN_14075bd20 gas field path.
    Computes all gas wares (hydrogen, helium, methane) in the region.

    Args:
        sector_id: Sector identifier
        region_data: Region JSON data
        area_data: Area JSON data
        fields: List of FieldInfo (nebula fields only)
        resources: List of ResourceInfo
        ware_filter: Optional ware to filter

    Returns:
        FieldReplayResult with computed values for all wares
    """
    from impl.replay_context import ReplayContext, GasResourceEntry, build_replay_context_140e860c0
    from impl.gas_replay import replay_gas_field_14075bd20 as gas_replay_impl

    region_id = region_data["id"]

    # Filter gas resources
    gas_resources = [r for r in resources if is_gas_ware(r.ware)]
    if ware_filter:
        gas_resources = [r for r in gas_resources if r.ware == ware_filter]

    if not gas_resources:
        return FieldReplayResult(
            field_type="gas",
            field_name=region_id,
            boundary_class=region_data.get("boundary", {}).get("class", "cylinder"),
            sector_id=sector_id,
            region_id=region_id,
            ware_id=ware_filter or "",
        )

    # Compute all gas wares
    all_per_tile: list[TileResult] = []
    all_ware_totals: dict[str, float] = {}

    # Use first resource's context as base (they share boundary/falloff)
    base_ctx = build_replay_context_140e860c0(
        sector_id=sector_id,
        region_id=region_id,
        ware_id="*",  # Compute all wares
    )

    # Compute for each gas resource
    for resource in gas_resources:
        # Create context for this specific ware
        ctx = build_replay_context_140e860c0(
            sector_id=sector_id,
            region_id=region_id,
            ware_id=resource.ware,
        )

        result = gas_replay_impl(ctx)

        # Merge results
        for ware_key, total in result.ware_totals.items():
            all_ware_totals[ware_key] = float(total)

        # Merge per-tile data
        for tile in result.per_tile:
            # Check if we already have this tile
            existing = None
            for existing_tile in all_per_tile:
                if existing_tile.storage_coord == tile.storage_coord:
                    existing = existing_tile
                    break

            if existing:
                # Merge tile values
                for ware_key, value in tile.tile_values.items():
                    existing.tile_values[ware_key] = float(value)
            else:
                # Create new tile result
                all_per_tile.append(TileResult(
                    storage_coord=tile.storage_coord,
                    world_coord=tile.world_coord,
                    profile_weight=tile.profile_weight,
                    lateral_interval=tile.lateral_interval,
                    radial_interval=tile.radial_interval,
                    lateral_weight=tile.lateral_weight,
                    radial_weight=tile.radial_weight,
                    tile_values={k: float(v) for k, v in tile.tile_values.items()},
                ))

    # Determine primary ware (first one or filter)
    primary_ware = ware_filter if ware_filter else (gas_resources[0].ware if gas_resources else "")

    return FieldReplayResult(
        field_type="gas",
        field_name=region_id,
        boundary_class=base_ctx.boundary.__class__.__name__.lower().replace("boundary", ""),
        sector_id=sector_id,
        region_id=region_id,
        ware_id=primary_ware,
        yield_name="",
        tile_count=len(all_per_tile),
        ware_totals=all_ware_totals,
        per_tile=all_per_tile,
    )


# ============================================================================
# Unified replay dispatch (Python helper, NOT a C++ function)
# ============================================================================
# Note: C++ has separate entry points:
#   - FUN_14073E110: Solid field processing
#   - FUN_14075BD20: Gas field processing
# This Python helper dispatches to the appropriate C++-corresponding function.
# ============================================================================

def replay_region_unified(
    sector_id: str,
    region_id: str,
    ware_filter: str | None = None,
) -> RegionReplayResult:
    """Unified replay dispatch - Python convenience helper.

    ⚠️ IMPORTANT: This is NOT a C++ function.
    C++ has separate entry points for solid and gas:
    - FUN_14073E110 (solid)
    - FUN_14075BD20 (gas)

    This helper detects field type and dispatches appropriately.
    """
    region_data = load_region_data(region_id)
    area_data = load_area_data(sector_id, region_id)

    fields = parse_fields_from_region(region_data)
    resources = parse_resources_from_region(region_data)

    result = RegionReplayResult(
        sector_id=sector_id,
        region_id=region_id,
    )

    # Separate fields by type
    solid_fields = [f for f in fields if is_solid_field(f)]
    gas_fields = [f for f in fields if is_gas_field(f)]

    # Process solid fields
    if solid_fields:
        solid_result = replay_solid_field_14073E110(
            sector_id, region_data, area_data, solid_fields, resources, ware_filter
        )
        result.fields.append(solid_result)

    # Process gas fields
    if gas_fields:
        gas_result = replay_gas_field_14075bd20(
            sector_id, region_data, area_data, gas_fields, resources, ware_filter
        )
        result.fields.append(gas_result)

    return result
