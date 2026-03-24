"""Resource object field initialization - reverse engineered from X4.exe.

C++ entry: FUN_140e842e0

Used by:
- AsteroidField (case 0x08)
- DebrisField (case 0x13)
- ObjectField (case 0x4f)
- PositionalField (case 0x56)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from .field_type_detection import FieldType, fun_140e81620_is_solid_field

if TYPE_CHECKING:
    pass


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAW_ROOT = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries"
REGIONOBJECTGROUPS_XML = RAW_ROOT / "regionobjectgroups" / "final.xml"


@dataclass
class RegionObjectGroup:
    """Region object group from regionobjectgroups XML.

    C++: Loaded via DAT_1477496f0 hash map lookup
    """
    name: str
    resource: str
    yield_value: float
    yieldvariation: float = 0.0


@dataclass
class ResourceObjectFieldState:
    """Resource object field state (AsteroidField/DebrisField).

    Corresponds to C++ ResourceObjectField structure.
    Size: 0x11b0 bytes (AsteroidField/DebrisField)
    """
    # Base ResourceField data (from FUN_140e83d30)
    field_type: FieldType
    name: str = ""

    # From FUN_140e842e0
    groupref: str = ""
    densityfactor: float = 1.0
    noisescale: float = 5000.0
    seed: str = ""
    minnoisevalue: float = 0.0
    maxnoisevalue: float = 1.0

    # Object group data (resolved from groupref)
    ware_key: str = ""
    yield_value: float = 0.0
    yieldvariation: float = 0.0

    # Additional params
    gather_speed_factor: float = 1.0
    recharge_time_seconds: float = 0.0

    # Runtime state
    field_0x22a: float = 0.0  # densityfactor * 0.01
    field_0x22c: float = 0.0  # gather_speed_factor
    field_0x22d: float = 0.0  # resourcedensity * scale

    # List of objects (param_1[0x22f] to param_1[0x235])
    objects: list = field(default_factory=list)


def load_region_object_groups() -> dict[str, RegionObjectGroup]:
    """Load region object groups from XML.

    C++: DAT_1477496f0 hash map
    """
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


def fun_140e842e0_init_resource_object_field(
    field_data: dict,
    field_type: FieldType,
) -> ResourceObjectFieldState | None:
    """Initialize resource object field from JSON data.

    Corresponds to C++ FUN_140e842e0.

    C++ logic:
    1. FUN_140e83d30 (base initialization)
    2. *param_1 = U::Regions::ResourceObjectField::vftable
    3. Parse groupref from param_3 + 0x68
    4. Load object group data from DAT_1477496f0
    5. Parse additional params (densityfactor, noisescale, etc.)

    Args:
        field_data: Field data from JSON
        field_type: Field type (AsteroidField or DebrisField)

    Returns:
        ResourceObjectFieldState or None if initialization fails
    """
    # Base initialization (FUN_140e83d30)
    state = ResourceObjectFieldState(field_type=field_type)

    # Parse groupref (C++: *(longlong *)(param_3 + 0x68))
    state.groupref = field_data.get("groupref", "")

    # Parse other params
    state.densityfactor = float(field_data.get("densityfactor", 1.0))
    state.noisescale = float(field_data.get("noisescale", 5000.0))
    state.seed = str(field_data.get("seed", ""))
    state.minnoisevalue = float(field_data.get("minnoisevalue", 0.0))
    state.maxnoisevalue = float(field_data.get("maxnoisevalue", 1.0))

    # Compute field_0x22a (C++: *(float *)(param_1 + 0x22a) = parsed_value * DAT_142d7fcd8)
    # DAT_142d7fcd8 = 0.01
    state.field_0x22a = state.densityfactor * 0.01

    # Resolve groupref to ware and yield
    if state.groupref:
        object_groups = load_region_object_groups()
        if state.groupref in object_groups:
            group = object_groups[state.groupref]
            state.ware_key = group.resource
            state.yield_value = group.yield_value
            state.yieldvariation = group.yieldvariation

    return state


def fun_140e842e0_build_field_states(
    fields: list[dict],
    field_type: FieldType,
) -> list[ResourceObjectFieldState]:
    """Build field states for all matching fields.

    Args:
        fields: List of field data from JSON
        field_type: Target field type

    Returns:
        List of initialized ResourceObjectFieldState
    """
    states = []
    for field_data in fields:
        tag = field_data.get("tag", "")
        current_type = None

        if tag == "asteroid":
            current_type = FieldType.ASTEROID_FIELD
        elif tag == "debris":
            current_type = FieldType.DEBRIS_FIELD
        elif tag == "object":
            current_type = FieldType.OBJECT_FIELD

        if current_type == field_type:
            state = fun_140e842e0_init_resource_object_field(field_data, field_type)
            if state:
                states.append(state)

    return states
