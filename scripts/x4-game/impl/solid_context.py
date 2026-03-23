"""Solid field data structures and context - reverse engineered from X4.exe.

C++ classes and functions referenced:
- SolidRegionState corresponds to runtime region state
- SolidFieldState corresponds to per-field state in FUN_14073E110
- RegionYieldPayload from regionyields/final.xml
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING
import xml.etree.ElementTree as ET

if TYPE_CHECKING:
    pass


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
REGION_DEFINITIONS_XML = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "region_definitions" / "final.xml"
REGIONOBJECTGROUPS_XML = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "regionobjectgroups" / "final.xml"
REGIONYIELDS_XML = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "regionyields" / "final.xml"


@dataclass
class RegionYieldPayload:
    """Region yield payload from regionyields/final.xml.

    Corresponds to C++ payload structure in FUN_140E83F80.
    """
    ware: str
    yield_name: str
    resourcedensity: float
    replenishtime: float
    gatherspeedfactor: float


@dataclass
class RegionObjectGroup:
    """Region object group from regionobjectgroups/final.xml.

    Corresponds to C++ group structure.
    """
    name: str
    resource: str
    yield_value: float
    yieldvariation: float


@dataclass
class SolidFieldDefinition:
    """Solid field definition from region_definitions/final.xml.

    Corresponds to C++ field definition in FUN_140E80D20.
    """
    groupref: str
    densityfactor: float
    noisescale: float
    seed: str
    minnoisevalue: float
    maxnoisevalue: float


@dataclass
class SolidFieldState:
    """Per-field state for solid resource computation.

    Corresponds to C++ field state used in FUN_14073E110.

    Attributes are applied in sequence:
    1. initialize_field_from_region_definition_140E842E0
    2. apply_groupref_to_field_140E84940
    3. apply_region_yield_payload_to_field_140E83F80
    """
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
    _noise_table: list[float] | None = field(default=None, repr=False)


@dataclass
class SplineControlPoint:
    """Spline control point for splinetube boundary.

    Corresponds to C++ spline point structure.
    """
    x: float
    y: float
    z: float
    tx: float
    ty: float
    tz: float
    inlength: float
    outlength: float


@dataclass
class SolidRegionState:
    """Complete solid region state for weight computation.

    Corresponds to C++ region state built by FUN_14073E110.
    """
    sector_id: str
    field_ref: str
    boundary_class: str
    position_x: float
    position_y: float
    position_z: float
    radius: float
    linear: float
    region_density: float
    falloff: "FalloffProfiles"
    payload: RegionYieldPayload
    fields: list[SolidFieldState]
    spline: list[SplineControlPoint] = field(default_factory=list)
    solid_volume_km3: float = 0.0  # Volume factor for clamp (FUN_14093c2c0)


# Import FalloffProfiles from profile_eval
from .profile_eval import ProfilePoint


@dataclass
class FalloffProfiles:
    """Falloff profile curves for lateral and radial directions."""
    lateral: list[ProfilePoint]
    radial: list[ProfilePoint]


# ============================================================================
# XML Parsing functions (FUN_140E80D20, FUN_140E950A0, FUN_140E83F80)
# ============================================================================

def load_xml_root(path: Path) -> ET.Element:
    """Load XML root element."""
    return ET.parse(path).getroot()


def parse_region_definition_140E80D20(field_ref: str) -> tuple[float, list[SolidFieldDefinition], list[tuple[str, str]]]:
    """Parse region definition from XML.

    Corresponds to FUN_140E80D20.

    Args:
        field_ref: Field reference (region name)

    Returns:
        (density, field_defs, resources): 密度、字段定义、资源列表[(ware, yield_name), ...]
    """
    root = load_xml_root(REGION_DEFINITIONS_XML)
    for region in root.findall("region"):
        # Use 'name' attribute (XML uses name, not id)
        if region.get("name") != field_ref:
            continue

        density = float(region.get("density", "1.0"))

        field_defs = []
        for field_node in region.findall("field"):
            field_defs.append(SolidFieldDefinition(
                groupref=field_node.get("groupref", ""),
                densityfactor=float(field_node.get("densityfactor", "1.0")),
                noisescale=float(field_node.get("noisescale", "5000")),
                seed=field_node.get("seed", ""),
                minnoisevalue=float(field_node.get("minnoisevalue", "0")),
                maxnoisevalue=float(field_node.get("maxnoisevalue", "1")),
            ))

        resources = []
        for resource in region.findall("resource"):
            resources.append(
                (str(resource.get("ware")), str(resource.get("yield")))
            )

        return density, field_defs, resources

    raise ValueError(f"Region definition not found: {field_ref}")


def parse_region_object_groups_140E950A0() -> dict[str, RegionObjectGroup]:
    """Parse region object groups from XML.

    Corresponds to FUN_140E950A0.

    Returns:
        Dict mapping group name to RegionObjectGroup
    """
    root = load_xml_root(REGIONOBJECTGROUPS_XML)
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


def parse_region_yield_payload_140E83F80(ware: str, yield_name: str) -> RegionYieldPayload:
    """Parse region yield payload from XML.

    Corresponds to FUN_140E83F80.

    Args:
        ware: Ware type (e.g., "ore", "silicon")
        yield_name: Yield name (e.g., "high", "medium")

    Returns:
        RegionYieldPayload for the ware/yield combination
    """
    root = load_xml_root(REGIONYIELDS_XML)
    for resource in root.findall("resource"):
        if resource.get("ware") != ware:
            continue
        for node in resource.findall("yield"):
            if node.get("name") != yield_name:
                continue
            return RegionYieldPayload(
                ware=ware,
                yield_name=yield_name,
                resourcedensity=float(node.get("resourcedensity", "0")),
                replenishtime=float(node.get("replenishtime", "0")),
                gatherspeedfactor=1.0,
            )
    raise ValueError(f"Region yield row not found: {ware} / {yield_name}")


# ============================================================================
# Field initialization functions (FUN_140E842E0, FUN_140E84940, FUN_140E83F80)
# ============================================================================

def initialize_field_from_region_definition_140E842E0(
    field: SolidFieldState,
    *,
    densityfactor: float,
    region_density: float,
    noisescale: float,
    seed: str,
    minnoisevalue: float,
    maxnoisevalue: float,
) -> None:
    """Initialize field from region definition.

    Corresponds to FUN_140E842E0.
    """
    field.densityfactor = densityfactor
    field.region_density = region_density
    field.field_0x1150_density_base_scaled = densityfactor * region_density * 0.01
    field.noisescale = noisescale
    field.seed = seed
    field.minnoisevalue = minnoisevalue
    field.maxnoisevalue = maxnoisevalue


def apply_groupref_to_field_140E84940(field: SolidFieldState, group: RegionObjectGroup) -> None:
    """Apply group reference to field.

    Corresponds to FUN_140E84940.
    """
    if not field.ware_key:
        field.ware_key = group.resource
    if field.yield_value <= 0.0:
        field.yield_value = group.yield_value
        field.yieldvariation = group.yieldvariation
        field.resourcepercentage = 0.0


def apply_region_yield_payload_to_field_140E83F80(field: SolidFieldState, payload: RegionYieldPayload) -> None:
    """Apply region yield payload to field.

    Corresponds to FUN_140E83F80.
    """
    if field.yield_value <= 0.0:
        field.yield_value = payload.resourcedensity


# ============================================================================
# Multiplier computation (FUN_140E80300, FUN_140E803E0)
# ============================================================================

def compute_multiplier_a_140E80300(field: SolidFieldState) -> float:
    """Compute multiplier A.

    Corresponds to FUN_140E80300.
    """
    return field.field_0x1150_density_base_scaled * field.class_density_by_id.get(field.ref_target_class_id, 1.0)


def compute_multiplier_b_140E803E0(field: SolidFieldState) -> float:
    """Compute multiplier B.

    Corresponds to FUN_140E803E0.
    """
    return (
        field.universe_yield_density_by_ware.get(field.ware_key, 1.0)
        * field.yield_value
        * field.universe_object_yield_density_by_ware.get(field.ware_key, 1.0)
    )