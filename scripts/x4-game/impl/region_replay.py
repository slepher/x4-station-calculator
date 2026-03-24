"""Unified region replay - reverse engineered from X4.exe.

This module provides the unified entry point for region replay,
coordinating between gas field and solid field processing.

C++ entry points:
- Gas: FUN_14075bd20
- Solid field initialization: FUN_14073e110 (moved to region_resource_field.py)
- Tile processing: FUN_14073f750

Field type detection (FUN_140e81620):
- case 0x08 (8): AsteroidField -> solid
- case 0x13 (19): DebrisField -> solid
- case 0x4c (76): Nebula -> gas

In JSON data:
- Solid: fields array contains tag="asteroid" or tag="debris"
- Gas: fields array contains tag="nebula"
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from .profile_eval import ProfilePoint, eval_profile_avg_1414ed970
from .grid_enumeration import (
    build_query_grid_window_140760320,
    storage_coord_to_world_coord_140760320,
    enumerate_storage_coords_for_bbox,
    QUERY_RADIUS_14073F750,
)
from .solid_context import (
    FalloffProfiles,
)
from .noise import compute_local_noise_fast_path_1414F4840
from boundary.cylinder_boundary import CylinderBoundary
from .region_resource_field import (
    region_resource_field_14073E110,
    RegionResourceFieldResult,
    ResourceInfo,
    FieldInfo,
)

if TYPE_CHECKING:
    from field.resource_object_field import ResourceObjectField


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RAW_ROOT = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries"
REGIONS_JSON = DATA_ROOT / "regions.json"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"


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
    """Check if field is solid (AsteroidField or DebrisField)."""
    return field.tag in SOLID_FIELD_TAGS


def is_gas_field(field: FieldInfo) -> bool:
    """Check if field is gas (Nebula)."""
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
# Tile processing - C++ FUN_14073f750
# ============================================================================

def _process_single_tile_14073f750(
    coord: tuple[int, int, int],
    world_coord: tuple[int, int, int],
    world_pos: tuple[float, float, float],
    boundary_obj: CylinderBoundary,
    falloff: FalloffProfiles,
    field_list: list,
    clamp_factor: float,
) -> TileResult | None:
    """Process single tile - C++ FUN_14073f750 replication.

    Args:
        coord: Storage coordinate
        world_coord: World coordinate
        world_pos: World position (float)
        boundary_obj: CylinderBoundary instance
        falloff: FalloffProfiles
        field_list: List of ResourceObjectField
        clamp_factor: Clamp factor

    Returns:
        TileResult if tile is within boundary, None otherwise
    """
    # vfunc(+0x58) and vfunc(+0x70) - boundary interval queries
    lateral_interval = boundary_obj.get_lateral_interval_0x58(world_pos, QUERY_RADIUS_14073F750)
    radial_interval = boundary_obj.get_radial_interval_0x70(world_pos, QUERY_RADIUS_14073F750)

    if lateral_interval is None:
        return None

    # FUN_1414ed970 - eval_profile_avg
    lateral_weight = eval_profile_avg_1414ed970(falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg_1414ed970(falloff.radial, radial_interval)
    profile_weight = lateral_weight * radial_weight

    if profile_weight <= 0:
        return None

    tile_values: dict[str, float] = {}

    for field_obj in field_list:
        # FUN_1414F4840 - compute_local_noise
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


def replay_solid_field_14073E110(
    sector_id: str,
    region_data: dict,
    area_data: dict,
    fields: list[FieldInfo],
    resources: list[ResourceInfo],
    ware_filter: str | None = None,
) -> FieldReplayResult:
    """Replay solid field computation.

    This function coordinates:
    1. Field initialization (region_resource_field_14073E110)
    2. Tile processing (_process_single_tile_14073f750)

    Args:
        sector_id: Sector identifier
        region_data: Region JSON data
        area_data: Area JSON data
        fields: List of FieldInfo
        resources: List of ResourceInfo
        ware_filter: Optional ware filter

    Returns:
        FieldReplayResult with computed values
    """
    region_id = region_data["id"]
    position = area_data.get("position", {})
    boundary = region_data.get("boundary", {})
    size = boundary.get("size", {})

    pos_x = float(position.get("x", 0))
    pos_y = float(position.get("y", 0))
    pos_z = float(position.get("z", 0))
    radius = float(size.get("r", 0))
    linear = float(size.get("linear", 0))
    solid_volume_km3 = float(region_data.get("volume_km3", 0))

    # Step 1: Initialize resource fields (FUN_14073e110)
    init_result = region_resource_field_14073E110(
        sector_id=sector_id,
        region_data=region_data,
        area_data=area_data,
        fields=fields,
        resources=resources,
        ware_filter=ware_filter,
    )

    if not init_result.field_list:
        return FieldReplayResult(
            field_type="solid",
            field_name=region_id,
            boundary_class=boundary.get("class", "cylinder"),
            sector_id=sector_id,
            region_id=region_id,
            ware_id=ware_filter or "",
        )

    field_list = init_result.field_list

    # Step 2: Process tiles (FUN_14073f750 loop)
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

    for coord in storage_coords:
        world_coord = storage_coord_to_world_coord_140760320(grid, coord)
        world_pos = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))

        tile_result = _process_single_tile_14073f750(
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
    primary_yield = ""
    for r in resources:
        if r.ware == primary_ware:
            primary_yield = r.yield_name
            break

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
    from impl.replay_context import ReplayContext, build_replay_context_140e860c0
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
        tile_count=len(all_per_tile),
        ware_totals=all_ware_totals,
        per_tile=all_per_tile,
    )


# ============================================================================
# Unified entry point
# ============================================================================

def replay_region_unified(
    sector_id: str,
    region_id: str,
    ware_filter: str | None = None,
) -> RegionReplayResult:
    """Unified region replay entry point.

    Automatically detects field type and dispatches to appropriate handler.

    Args:
        sector_id: Sector identifier
        region_id: Region identifier
        ware_filter: Optional ware to filter

    Returns:
        RegionReplayResult
    """
    region_data = load_region_data(region_id)
    area_data = load_area_data(sector_id, region_id)

    fields = parse_fields_from_region(region_data)
    resources = parse_resources_from_region(region_data)

    # Detect field type from fields array
    has_solid = any(is_solid_field(f) for f in fields)
    has_gas = any(is_gas_field(f) for f in fields)

    result = RegionReplayResult(sector_id=sector_id, region_id=region_id)

    if has_solid:
        solid_result = replay_solid_field_14073E110(
            sector_id=sector_id,
            region_data=region_data,
            area_data=area_data,
            fields=fields,
            resources=resources,
            ware_filter=ware_filter,
        )
        result.fields.append(solid_result)

    if has_gas:
        gas_result = replay_gas_field_14075bd20(
            sector_id=sector_id,
            region_data=region_data,
            area_data=area_data,
            fields=fields,
            resources=resources,
            ware_filter=ware_filter,
        )
        result.fields.append(gas_result)

    return result
