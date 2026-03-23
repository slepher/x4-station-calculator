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
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from .profile_eval import ProfilePoint, eval_profile_avg_1414ed970
from .grid_enumeration import (
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

if TYPE_CHECKING:
    pass


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RAW_ROOT = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries"
REGIONS_JSON = DATA_ROOT / "regions.json"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"
REGIONOBJECTGROUPS_XML = RAW_ROOT / "regionobjectgroups" / "final.xml"


@dataclass
class RegionObjectGroup:
    """Region object group from regionobjectgroups XML."""
    name: str
    resource: str
    yield_value: float
    yieldvariation: float = 0.0


def load_region_object_groups() -> dict[str, RegionObjectGroup]:
    """Load region object groups from XML."""
    import xml.etree.ElementTree as ET

    if not REGIONOBJECTGROUPS_XML.exists():
        return {}

    tree = ET.parse(REGIONOBJECTGROUPS_XML)
    root = tree.getroot()

    groups = {}
    for group in root.findall("group"):
        name = group.get("name", "")
        groups[name] = RegionObjectGroup(
            name=name,
            resource=group.get("resource", ""),
            yield_value=float(group.get("yield", "0")),
            yieldvariation=float(group.get("yieldvariation", "0")),
        )

    return groups


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


def replay_solid_field_14073E110(
    sector_id: str,
    region_data: dict,
    area_data: dict,
    fields: list[FieldInfo],
    resources: list[ResourceInfo],
    ware_filter: str | None = None,
) -> FieldReplayResult:
    """Replay solid field computation.

    Corresponds to FUN_14073E110 solid field path.

    Args:
        sector_id: Sector identifier
        region_data: Region JSON data
        area_data: Area JSON data
        fields: List of FieldInfo (asteroid fields only)
        resources: List of ResourceInfo
        ware_filter: Optional ware to filter

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
    region_density = float(region_data.get("density", 1.0))
    solid_volume_km3 = float(region_data.get("volume_km3", 0))

    # Filter asteroid fields
    asteroid_fields = [f for f in fields if is_solid_field(f)]

    if not asteroid_fields:
        return FieldReplayResult(
            field_type="solid",
            field_name=region_id,
            boundary_class=boundary.get("class", "cylinder"),
            sector_id=sector_id,
            region_id=region_id,
            ware_id="",
        )

    # Build boundary
    half_height = linear / 2.0
    p0 = (pos_x, pos_y - half_height, pos_z)
    p1 = (pos_x, pos_y + half_height, pos_z)
    boundary_obj = CylinderBoundary.from_endpoints(p0, p1, radius)

    # Build grid
    box_min, box_max, _ = compute_solid_field_bounding_box(region_data, area_data)
    grid = build_query_grid_window_140760320(pos_x, pos_y, pos_z)
    storage_coords = enumerate_storage_coords_for_bbox(box_min, box_max, grid, "full")

    # Parse falloff profiles
    falloff_data = region_data.get("falloff", {})
    falloff = FalloffProfiles(
        lateral=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff_data.get("lateral", [])],
        radial=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff_data.get("radial", [])],
    )

    # Load region object groups for groupref resolution
    # C++ evidence: FUN_140e81ff0 looks up groupref in regionobjectgroups
    object_groups = load_region_object_groups()

    # Build field states for weight calculation
    # C++ evidence: field with groupref uses group.yield, group.resource
    field_states = []
    for f in asteroid_fields:
        # Resolve ware and yield from groupref if available
        if f.groupref and f.groupref in object_groups:
            group = object_groups[f.groupref]
            ware_key = group.resource
            yield_value = group.yield_value
        else:
            # Fallback: use resources
            matching_resources = [r for r in resources if not ware_filter or r.ware == ware_filter]
            if not matching_resources:
                matching_resources = resources[:1] if resources else []
            res = matching_resources[0] if matching_resources else None
            ware_key = res.ware if res else ""
            yield_value = res.resourcedensity if res else 1.0

        # Apply ware filter
        if ware_filter and ware_key != ware_filter:
            continue

        field_states.append(SolidFieldState(
            name=f.groupref or "default",
            ware_key=ware_key,
            yield_value=yield_value,
            densityfactor=f.densityfactor,
            region_density=region_density,
            field_0x1150_density_base_scaled=f.densityfactor * region_density * 0.01,
            noisescale=f.noisescale,
            seed=f.seed,
            minnoisevalue=f.minnoisevalue,
            maxnoisevalue=f.maxnoisevalue,
            universe_yield_density_by_ware={ware_key: 1.0},
            universe_object_yield_density_by_ware={ware_key: 1.0},
        ))

    if not field_states:
        return FieldReplayResult(
            field_type="solid",
            field_name=region_id,
            boundary_class=boundary.get("class", "cylinder"),
            sector_id=sector_id,
            region_id=region_id,
            ware_id=ware_filter or "",
        )

    # Phase 1: Region allocation
    sum_weights = 0.0
    for fs in field_states:
        noise_window = compute_local_noise_fast_path_1414F4840(fs)
        field_weight = (
            compute_multiplier_a_140E80300(fs)
            * compute_multiplier_b_140E803E0(fs)
            * noise_window
        )
        sum_weights += field_weight

    resourcedensity = resources[0].resourcedensity if resources else 1.0
    per_field_value = resourcedensity / sum_weights if sum_weights > 0 else 0.0

    # Writeback
    for fs in field_states:
        if per_field_value > 1.0:
            fs.resourcepercentage = 1.0
            fs.yield_value *= per_field_value
        else:
            fs.resourcepercentage = per_field_value

    # Phase 2: Area contribution
    clamp_factor = min(solid_volume_km3, 262144.0)

    per_tile: list[TileResult] = []
    ware_totals: dict[str, float] = {}

    for coord in storage_coords:
        world_coord = storage_coord_to_world_coord_140760320(grid, coord)
        world_pos = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))

        # Get intervals
        lateral_interval = boundary_obj.get_lateral_interval_0x58(world_pos, QUERY_RADIUS_14073F750)
        radial_interval = boundary_obj.get_radial_interval_0x70(world_pos, QUERY_RADIUS_14073F750)

        if lateral_interval is None:
            continue

        lateral_weight = eval_profile_avg_1414ed970(falloff.lateral, lateral_interval)
        radial_weight = eval_profile_avg_1414ed970(falloff.radial, radial_interval)
        profile_weight = lateral_weight * radial_weight

        if profile_weight <= 0:
            continue

        tile_values: dict[str, float] = {}

        for fs in field_states:
            noise = compute_local_noise_fast_path_1414F4840(fs)
            weight = (
                fs.resourcepercentage
                * compute_multiplier_b_140E803E0(fs)
                * noise
                * compute_multiplier_a_140E80300(fs)
                * profile_weight
                * clamp_factor
            )

            ware = fs.ware_key
            if ware not in tile_values:
                tile_values[ware] = 0.0
            tile_values[ware] += weight

        for ware, value in tile_values.items():
            if ware not in ware_totals:
                ware_totals[ware] = 0.0
            ware_totals[ware] += value

        per_tile.append(TileResult(
            storage_coord=coord,
            world_coord=world_coord,
            profile_weight=profile_weight,
            lateral_interval=lateral_interval,
            radial_interval=radial_interval,
            lateral_weight=lateral_weight,
            radial_weight=radial_weight,
            tile_values=tile_values,
        ))

    # Determine primary ware from field states
    if field_states:
        primary_ware = ware_filter or field_states[0].ware_key
    else:
        primary_ware = ware_filter or ""

    return FieldReplayResult(
        field_type="solid",
        field_name=region_id,
        boundary_class=boundary.get("class", "cylinder"),
        sector_id=sector_id,
        region_id=region_id,
        ware_id=primary_ware,
        yield_name=resources[0].yield_name if resources else "",
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
    """Replay gas field computation.

    Corresponds to FUN_14075bd20 gas field path.

    Args:
        sector_id: Sector identifier
        region_data: Region JSON data
        area_data: Area JSON data
        fields: List of FieldInfo (nebula fields only)
        resources: List of ResourceInfo
        ware_filter: Optional ware to filter

    Returns:
        FieldReplayResult with computed values
    """
    from impl.replay_context import ReplayContext, GasResourceEntry, build_replay_context_140e860c0

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

    # Use existing gas replay context for now
    # TODO: Integrate with unified implementation
    ctx = build_replay_context_140e860c0(
        sector_id=sector_id,
        region_id=region_id,
        ware_id=gas_resources[0].ware,
    )

    from impl.gas_replay import replay_gas_field_14075bd20 as gas_replay_impl
    result = gas_replay_impl(ctx)

    return FieldReplayResult(
        field_type="gas",
        field_name=result.field_name,
        boundary_class=result.boundary_class,
        sector_id=sector_id,
        region_id=region_id,
        ware_id=result.ware_id,
        yield_name="",
        tile_count=result.tile_count,
        ware_totals=result.ware_totals,
        per_tile=result.per_tile,
    )


# ============================================================================
# Main entry point (FUN_14073e110)
# ============================================================================

def replay_region_14073E110(
    sector_id: str,
    region_id: str,
    ware_filter: str | None = None,
) -> RegionReplayResult:
    """Replay region computation.

    Main entry point corresponding to FUN_14073E110.

    C++ logic:
    1. Load region definition (FUN_140e80d20)
    2. For each field, detect type via switch(element_type) in FUN_140e81620
    3. Dispatch to appropriate handler:
       - case 0x08: AsteroidField -> solid
       - case 0x4c: Nebula -> gas

    Args:
        sector_id: Sector identifier
        region_id: Region identifier
        ware_filter: Optional ware to filter

    Returns:
        RegionReplayResult with all field results
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