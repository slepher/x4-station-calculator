"""Solid field replay main entry - reverse engineered from X4.exe.

C++ functions:
- FUN_14073E110: build_solid_region_state (region initialization)
- FUN_14073F750: compute_falloff_weight (per-query falloff)
- FUN_14075C250: replay_solid_region (main replay loop for solid)

Data sources:
- regions.json: boundary, falloff, resources
- resourceareas.json: sector placement, position
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
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
    AREA_SIZE,
)
from .solid_context import (
    SolidRegionState,
    SolidFieldState,
    SplineControlPoint,
    FalloffProfiles,
    RegionYieldPayload,
    compute_multiplier_a_140E80300,
    compute_multiplier_b_140E803E0,
)
from .noise import (
    compute_local_noise_fast_path_1414F4840,
    compute_local_noise_1414F4840,
)
from boundary.spline_tube_boundary import SplineTubeBoundary
from boundary.cylinder_boundary import CylinderBoundary

if TYPE_CHECKING:
    pass


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RAW_ROOT = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"
REGIONS_JSON = DATA_ROOT / "regions.json"
REGION_DEFINITIONS_XML = RAW_ROOT / "region_definitions" / "final.xml"
REGIONOBJECTGROUPS_XML = RAW_ROOT / "regionobjectgroups" / "final.xml"
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"


# Constants
CLAMP_UPPER_140E84C30 = 262144.0


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
class ReplayResult:
    """Result for a solid field replay."""
    field_name: str
    boundary_class: str
    sector_id: str
    field_ref: str
    ware_id: str
    yield_name: str
    tile_count: int
    ware_totals: dict[str, float]
    per_tile: list[TileResult] = field(default_factory=list)


@dataclass
class SolidResourceEntry:
    """Resource entry from regions.json."""
    ware: str
    resourcedensity: float
    delay: float = 0.0
    gatherfactor: float = 1.0
    yield_name: str = ""


@dataclass
class AsteroidFieldDef:
    """Asteroid field definition from region_definitions XML.

    Corresponds to <asteroid> element in <fields>.

    C++ evidence from FUN_140e81ff0:
    - offset 0x2b (43) -> groupref attribute
    - offset 0x19 (25) -> densityfactor attribute
    - noise attributes: noisescale, seed, minnoisevalue, maxnoisevalue
    """
    groupref: str = ""
    densityfactor: float = 1.0
    noisescale: float = 5000.0
    seed: str = ""
    minnoisevalue: float = 0.0
    maxnoisevalue: float = 1.0
    resourcepercentage: float = 1.0
    rotation: float = 0.0
    rotationvariation: float = 0.0


@dataclass
class RegionObjectGroup:
    """Region object group from regionobjectgroups XML.

    Corresponds to C++ RegionObjectGroup structure.

    C++ evidence from FUN_140e84940:
    - group.resource -> field + 0x1110 (ware_key)
    - group.yield -> field + 0x1118 (yield_value)
    - group.yieldvariation -> field + 0x1194
    """
    name: str
    resource: str
    yield_value: float
    yieldvariation: float = 0.0


# ============================================================================
# Data loading helpers
# ============================================================================

def index_regions_by_id() -> dict[str, dict]:
    """Index regions.json by region ID."""
    with REGIONS_JSON.open("r", encoding="utf-8") as f:
        regions = json.load(f)
    return {r["id"]: r for r in regions}


def find_sector_area_entry(sector_id: str, field_ref: str) -> dict:
    """Find area entry for a sector/field combination."""
    with RESOURCEAREAS_JSON.open("r", encoding="utf-8") as f:
        areas = json.load(f)

    for entry in areas:
        if entry.get("sector_id") != sector_id:
            continue
        for area in entry.get("areas", []):
            if area.get("ref") == field_ref:
                return area

    raise ValueError(f"Area not found: {sector_id} / {field_ref}")


# ============================================================================
# XML parsing for field definitions (FUN_140E80D20, FUN_140E950A0)
# ============================================================================

def parse_region_field_definitions_140E80D20(field_ref: str) -> list[AsteroidFieldDef]:
    """Parse asteroid field definitions from region_definitions XML.

    Corresponds to FUN_140E80D20 field parsing.

    C++ evidence:
    - Iterates over <fields> element
    - Each <asteroid> has: groupref (0x2b), densityfactor (0x19),
      noisescale, seed, minnoisevalue, maxnoisevalue

    Args:
        field_ref: Region name to look up

    Returns:
        List of AsteroidFieldDef for the region
    """
    if not REGION_DEFINITIONS_XML.exists():
        return []

    tree = ET.parse(REGION_DEFINITIONS_XML)
    root = tree.getroot()

    for region in root.findall("region"):
        if region.get("name") != field_ref:
            continue

        fields = []
        fields_elem = region.find("fields")
        if fields_elem is None:
            return []

        for asteroid in fields_elem.findall("asteroid"):
            fields.append(AsteroidFieldDef(
                groupref=asteroid.get("groupref", ""),
                densityfactor=float(asteroid.get("densityfactor", "1.0")),
                noisescale=float(asteroid.get("noisescale", "5000")),
                seed=asteroid.get("seed", ""),
                minnoisevalue=float(asteroid.get("minnoisevalue", "0")),
                maxnoisevalue=float(asteroid.get("maxnoisevalue", "1")),
                resourcepercentage=float(asteroid.get("resourcepercentage", "100")) * 0.01,
                rotation=float(asteroid.get("rotation", "0")),
                rotationvariation=float(asteroid.get("rotationvariation", "0")),
            ))

        return fields

    return []


def parse_region_object_groups_140E950A0() -> dict[str, RegionObjectGroup]:
    """Parse region object groups from regionobjectgroups XML.

    Corresponds to FUN_140E950A0.

    C++ evidence:
    - group.resource -> field.ware_key
    - group.yield -> field.yield_value (for fields with groupref)
    - group.yieldvariation -> field.yieldvariation

    Returns:
        Dict mapping group name to RegionObjectGroup
    """
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


def build_field_states_from_definitions(
    field_defs: list[AsteroidFieldDef],
    object_groups: dict[str, RegionObjectGroup],
    payload: RegionYieldPayload,
    region_density: float,
) -> list[SolidFieldState]:
    """Build SolidFieldState list from field definitions.

    C++ evidence from FUN_14073e110, FUN_140e82530, FUN_140e81ff0:

    For each field:
    1. If groupref exists:
       - yield = object_groups[groupref].yield
       - ware = object_groups[groupref].resource
    2. If no groupref:
       - yield = payload.resourcedensity (from regionyields)
       - ware = payload.ware

    Args:
        field_defs: List of AsteroidFieldDef from XML
        object_groups: Dict of RegionObjectGroup from XML
        payload: RegionYieldPayload from regions.json
        region_density: Region density factor

    Returns:
        List of SolidFieldState with correct yield values
    """
    if not field_defs:
        # Fallback: single field using payload values
        return [
            SolidFieldState(
                name="default",
                ware_key=payload.ware,
                yield_value=payload.resourcedensity,
                region_density=region_density,
                universe_yield_density_by_ware={payload.ware: 1.0},
                universe_object_yield_density_by_ware={payload.ware: 1.0},
            )
        ]

    fields = []
    for i, defn in enumerate(field_defs):
        # Resolve yield value based on C++ logic
        if defn.groupref and defn.groupref in object_groups:
            # Field with groupref: use group yield
            group = object_groups[defn.groupref]
            ware_key = group.resource
            yield_value = group.yield_value
            yieldvariation = group.yieldvariation
        else:
            # Field without groupref: use payload resourcedensity
            ware_key = payload.ware
            yield_value = payload.resourcedensity
            yieldvariation = 0.0

        # Build field state
        # C++ evidence: field_0x1150 = densityfactor * region_density * 0.01
        field_0x1150 = defn.densityfactor * region_density * 0.01

        fields.append(SolidFieldState(
            name=f"field_{i}" if defn.groupref else "default",
            ware_key=ware_key,
            yield_value=yield_value,
            resourcepercentage=defn.resourcepercentage,
            yieldvariation=yieldvariation,
            densityfactor=defn.densityfactor,
            region_density=region_density,
            field_0x1150_density_base_scaled=field_0x1150,
            noisescale=defn.noisescale,
            seed=defn.seed,
            minnoisevalue=defn.minnoisevalue,
            maxnoisevalue=defn.maxnoisevalue,
            universe_yield_density_by_ware={ware_key: 1.0},
            universe_object_yield_density_by_ware={ware_key: 1.0},
        ))

    return fields


# ============================================================================
# Build solid region state from JSON (FUN_14073E110)
# ============================================================================

def build_solid_region_state_14073E110(
    sector_id: str,
    field_ref: str,
    area: dict = None,
    ware: str = None,
    yield_name: str = None,
) -> SolidRegionState:
    """Build SolidRegionState from JSON data.

    Corresponds to FUN_14073E110.

    Args:
        sector_id: Sector ID
        field_ref: Field reference (region ID)
        area: Optional area data (if not provided, looks up)
        ware: Optional ware type (if not provided, uses first resource)
        yield_name: Optional yield name

    Returns:
        SolidRegionState ready for weight computation
    """
    if area is None:
        area = find_sector_area_entry(sector_id, field_ref)

    region_json = index_regions_by_id()[field_ref]
    position = area["position"]
    boundary = region_json["boundary"]
    size = boundary["size"]
    falloff = region_json["falloff"]

    # Build spline control points if present (for splinetube)
    spline = []
    if boundary.get("class") == "splinetube" and "spline" in boundary:
        spline = [
            SplineControlPoint(
                x=float(row["x"]) + float(position["x"]),
                y=float(row["y"]) + float(position["y"]),
                z=float(row["z"]) + float(position["z"]),
                tx=float(row.get("tx", 0)),
                ty=float(row.get("ty", 0)),
                tz=float(row.get("tz", 0)),
                inlength=float(row.get("inlength", 0)),
                outlength=float(row.get("outlength", 0)),
            )
            for row in boundary["spline"]
        ]

    # Parse resources from JSON
    resources_json = region_json.get("resources", [])
    if not resources_json:
        raise ValueError(f"No resources in region: {field_ref}")

    # Use first resource if not specified
    if ware is None:
        first_resource = resources_json[0]
        ware = first_resource.get("ware", "")
        yield_name = first_resource.get("yield_name", "")

    # Find matching resource
    resource_entry = None
    for r in resources_json:
        if r.get("ware") == ware:
            resource_entry = r
            break

    if resource_entry is None:
        resource_entry = resources_json[0]

    payload = RegionYieldPayload(
        ware=resource_entry.get("ware", ware),
        yield_name=resource_entry.get("yield_name", yield_name or ""),
        resourcedensity=float(resource_entry.get("resourcedensity", 1.0)),
        replenishtime=float(resource_entry.get("delay", 0)),
        gatherspeedfactor=float(resource_entry.get("gatherfactor", 1.0)),
    )

    # Get region density from XML (C++ evidence: region.@density)
    region_density = float(region_json.get("density", 1.0))

    # Parse field definitions from XML
    # C++ evidence: FUN_14073e110 iterates <fields> to build field states
    field_defs = parse_region_field_definitions_140E80D20(field_ref)

    # Parse object groups for groupref resolution
    # C++ evidence: FUN_140e81ff0 looks up groupref in regionobjectgroups
    object_groups = parse_region_object_groups_140E950A0()

    # Build field states with correct yield values
    # C++ evidence: field with groupref uses group.yield, not regionyields.resourcedensity
    fields = build_field_states_from_definitions(
        field_defs, object_groups, payload, region_density
    )

    return SolidRegionState(
        sector_id=sector_id,
        field_ref=field_ref,
        boundary_class=str(boundary["class"]),
        position_x=float(position["x"]),
        position_y=float(position["y"]),
        position_z=float(position["z"]),
        radius=float(size["r"]),
        linear=float(size.get("linear", 0)),
        region_density=region_density,
        falloff=FalloffProfiles(
            lateral=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff["lateral"]],
            radial=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff["radial"]],
        ),
        payload=payload,
        fields=fields,
        spline=spline,
    )


# ============================================================================
# Falloff weight computation (FUN_14073F750 for splinetube)
# ============================================================================

def compute_splinetube_falloff_weight_14073F750(
    region: SolidRegionState,
    query: tuple[float, float, float],
    boundary: SplineTubeBoundary,
) -> dict[str, object] | None:
    """Compute falloff weight for splinetube boundary.

    Corresponds to FUN_14073F750 for splinetube.

    Args:
        region: SolidRegionState
        query: Query point in world coordinates
        boundary: SplineTubeBoundary with sampled points

    Returns:
        Dict with lateral_interval, radial_interval, lateral_weight, radial_weight
    """
    # Get lateral interval
    lateral_interval = boundary.get_lateral_interval_0x58(query, QUERY_RADIUS_14073F750)

    if lateral_interval is None:
        return None

    # Get radial interval
    radial_interval = boundary.get_radial_interval_0x70(query, QUERY_RADIUS_14073F750)

    # Evaluate profiles
    lateral_weight = eval_profile_avg_1414ed970(region.falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg_1414ed970(region.falloff.radial, radial_interval)

    return {
        "lateral_interval": lateral_interval,
        "radial_interval": radial_interval,
        "lateral_weight": lateral_weight,
        "radial_weight": radial_weight,
    }


def compute_splinetube_bounding_box(region: SolidRegionState) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Compute bounding box for splinetube region.

    Args:
        region: SolidRegionState with spline data

    Returns:
        (min_point, max_point) tuples
    """
    if not region.spline:
        # Fallback to center + radius
        return (
            (region.position_x - region.radius, region.position_y - region.radius, region.position_z - region.radius),
            (region.position_x + region.radius, region.position_y + region.radius, region.position_z + region.radius),
        )

    # Get spline point range
    xs = [p.x for p in region.spline]
    ys = [p.y for p in region.spline]
    zs = [p.z for p in region.spline]

    # Expand by radius
    return (
        (min(xs) - region.radius, min(ys) - region.radius, min(zs) - region.radius),
        (max(xs) + region.radius, max(ys) + region.radius, max(zs) + region.radius),
    )


def compute_falloff_weight_14073F750(
    region: SolidRegionState,
    query: tuple[float, float, float],
    boundary,
) -> dict[str, object] | None:
    """Compute falloff weight for any boundary type.

    Unified interface for SplineTube and Cylinder boundaries.

    Args:
        region: SolidRegionState
        query: Query point in world coordinates
        boundary: Boundary object (SplineTubeBoundary or CylinderBoundary)

    Returns:
        Dict with lateral_interval, radial_interval, lateral_weight, radial_weight
    """
    # Get lateral interval
    lateral_interval = boundary.get_lateral_interval_0x58(query, QUERY_RADIUS_14073F750)

    if lateral_interval is None:
        return None

    # Get radial interval
    radial_interval = boundary.get_radial_interval_0x70(query, QUERY_RADIUS_14073F750)

    # Evaluate profiles
    lateral_weight = eval_profile_avg_1414ed970(region.falloff.lateral, lateral_interval)
    radial_weight = eval_profile_avg_1414ed970(region.falloff.radial, radial_interval)

    return {
        "lateral_interval": lateral_interval,
        "radial_interval": radial_interval,
        "lateral_weight": lateral_weight,
        "radial_weight": radial_weight,
    }


# ============================================================================
# Main replay function
# ============================================================================

def replay_solid_region_14073E110(
    region: SolidRegionState,
    cut_mode: str = "full",
) -> ReplayResult:
    """Replay solid region weight computation.

    Corresponds to FUN_14073E110 main loop.

    Args:
        region: SolidRegionState
        cut_mode: "full" or "15x15x3" for limited grid range

    Returns:
        ReplayResult with totals and per-tile data
    """
    # Build boundary from region data
    if region.boundary_class == "splinetube" and region.spline:
        boundary = SplineTubeBoundary.from_region_spline(region.spline, region.radius)
        boundary._ensure_sampled()
        box_min, box_max = compute_splinetube_bounding_box(region)
    else:
        # Cylinder boundary
        boundary = CylinderBoundary(region.position_x, region.position_y, region.position_z, region.radius, region.linear)
        # Compute bounding box for cylinder
        box_min = (
            region.position_x - region.radius,
            region.position_y - region.linear / 2,
            region.position_z - region.radius,
        )
        box_max = (
            region.position_x + region.radius,
            region.position_y + region.linear / 2,
            region.position_z + region.radius,
        )

    # Build grid window
    grid = build_query_grid_window_140760320(
        region.position_x,
        region.position_y,
        region.position_z,
    )

    # Enumerate storage coords
    storage_coords = enumerate_storage_coords_for_bbox(box_min, box_max, grid, cut_mode)

    # Process each tile
    per_tile: list[TileResult] = []
    ware_totals: dict[str, float] = {}

    for coord in storage_coords:
        world_coord = storage_coord_to_world_coord_140760320(grid, coord)
        world_pos = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))

        # Compute falloff weight
        falloff_info = compute_falloff_weight_14073F750(region, world_pos, boundary)

        if falloff_info is None:
            continue

        profile_weight = falloff_info["lateral_weight"] * falloff_info["radial_weight"]

        if profile_weight <= 0:
            continue

        # Compute tile value for each field
        tile_values: dict[str, float] = {}

        for field in region.fields:
            # Use fast path noise for now
            noise = compute_local_noise_fast_path_1414F4840(field)

            # Compute weight
            weight = (
                compute_multiplier_a_140E80300(field)
                * compute_multiplier_b_140E803E0(field)
                * profile_weight
                * noise
            )

            ware = field.ware_key
            if ware not in tile_values:
                tile_values[ware] = 0.0
            tile_values[ware] += weight

        # Update totals
        for ware, value in tile_values.items():
            if ware not in ware_totals:
                ware_totals[ware] = 0.0
            ware_totals[ware] += value

        per_tile.append(TileResult(
            storage_coord=coord,
            world_coord=world_coord,
            profile_weight=profile_weight,
            lateral_interval=falloff_info["lateral_interval"],
            radial_interval=falloff_info["radial_interval"],
            lateral_weight=falloff_info["lateral_weight"],
            radial_weight=falloff_info["radial_weight"],
            tile_values=tile_values,
        ))

    return ReplayResult(
        field_name=region.field_ref,
        boundary_class=region.boundary_class,
        sector_id=region.sector_id,
        field_ref=region.field_ref,
        ware_id=region.payload.ware,
        yield_name=region.payload.yield_name,
        tile_count=len(per_tile),
        ware_totals=ware_totals,
        per_tile=per_tile,
    )


# ============================================================================
# Save sample loading
# ============================================================================

def load_save_sample_for_ware(sector_id: str, ware: str, yield_name: str) -> dict[tuple[int, int, int], dict]:
    """Load save sample data for a ware.

    Args:
        sector_id: Sector identifier
        ware: Ware type
        yield_name: Yield name (not used in current format)

    Returns:
        Dict mapping (x, y, z) coord to entry dict
    """
    save_path = SAVE_SAMPLE_ROOT / f"{sector_id.lower()}.json"
    if not save_path.exists():
        return {}

    with save_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if ware not in data.get("ware", {}):
        return {}

    ware_data = data["ware"][ware]

    if isinstance(ware_data, list):
        rows = ware_data
    elif "resources" in ware_data:
        rows = ware_data.get("resources", [])
    else:
        rows = []
        for yn, yd in ware_data.items():
            if isinstance(yd, dict) and "resources" in yd:
                rows.extend(yd["resources"])

    return {(int(row["x"]), int(row["y"]), int(row["z"])): row for row in rows}


def load_total_sample_for_ware(sector_id: str, ware: str, region_filter: str = "") -> dict:
    """Load total sample for a ware in a sector.

    Args:
        sector_id: Sector identifier
        ware: Ware type (ice, ore, silicon, etc.)
        region_filter: Optional region name filter
    """
    total_path = SAVE_SAMPLE_ROOT / "total.json"
    if not total_path.exists():
        return {}
    with total_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    for sector in data.get("sectors", []):
        if sector.get("sector_id") == sector_id.lower():
            ware_data = sector.get("ware", {}).get(ware, {})
            # Handle new format: ware_data is a list
            if isinstance(ware_data, list):
                total = {"max": 0, "cutted": 0}
                for entry in ware_data:
                    if region_filter:
                        regions = entry.get("regions", [])
                        if not any(region_filter in r.get("ref", "") for r in regions):
                            continue
                    total["max"] += entry.get("max", 0)
                    total["cutted"] += entry.get("cutted", 0)
                return total if total["max"] > 0 else {}
            # Handle old format: ware_data is a dict
            if region_filter and region_filter in ware_data:
                return ware_data[region_filter]
            return ware_data
    return {}