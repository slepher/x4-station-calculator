"""Field factory and initialization - reverse engineered from X4.exe.

C++ functions:
- FUN_140e81620: Field factory dispatch (switch on element_type)
- FUN_140e81ff0: Groupref resolution and field creation
- FUN_140e82530: Resource iteration and field initialization

Call chain:
FUN_14073e110
  -> FUN_140e82530
    -> FUN_140e81ff0
      -> FUN_140e81620 (field factory)
        -> ResourceObjectField.from_xml_140e842e0 (for AsteroidField/DebrisField)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING
import xml.etree.ElementTree as ET

if TYPE_CHECKING:
    from .resource_object_field import ResourceObjectField

from .asteroid_field import AsteroidField
from .debris_field import DebrisField


# Field type cases from FUN_140e81620
FIELD_TYPE_ASTEROID = 0x08  # 8
FIELD_TYPE_DEBRIS = 0x13    # 19
FIELD_TYPE_NEBULA = 0x4c    # 76


@dataclass
class RegionObjectGroup:
    """Region object group from regionobjectgroups XML.

    C++ evidence from FUN_140e81ff0:
    - group.resource -> field + 0x1110 (ware_key)
    - group.yield -> field + 0x1118 (yield_value)
    - group.yieldvariation -> field + 0x1194
    """
    name: str
    resource: str
    yield_value: float
    yieldvariation: float = 0.0


# =============================================================================
# Region Object Groups (FUN_140E950A0 equivalent)
# =============================================================================

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_REGIONOBJECTGROUPS_XML = _PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "regionobjectgroups" / "final.xml"


def parse_region_object_groups_140E950A0() -> dict[str, RegionObjectGroup]:
    """Parse region object groups from regionobjectgroups XML.

    Corresponds to FUN_140E950A0.

    Returns:
        Dict mapping group name to RegionObjectGroup
    """
    if not _REGIONOBJECTGROUPS_XML.exists():
        return {}

    tree = ET.parse(_REGIONOBJECTGROUPS_XML)
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


# =============================================================================
# Field Factory (FUN_140e81620)
# =============================================================================

def field_factory_140e81620(
    xml_element: dict,
    position_x: float,
    position_y: float,
    position_z: float,
    radius: float,
    linear: float = 0.0,
) -> ResourceObjectField | None:
    """Field factory dispatch based on element type.

    Corresponds to FUN_140e81620.

    C++ switch statement on *(undefined4 *)(param_4 + 0xc):
    - case 0x08: AsteroidField -> FUN_140e842e0
    - case 0x13: DebrisField -> FUN_140e842e0 (same as AsteroidField)
    - case 0x4c: Nebula -> FUN_140e860c0 (gas, handled separately)
    - ... other cases

    Args:
        xml_element: XML element data with 'type' field
        position_x: X position
        position_y: Y position
        position_z: Z position
        radius: Field radius
        linear: Linear size

    Returns:
        ResourceObjectField instance or None
    """
    # Get element type from XML
    element_type = xml_element.get("type", 0)

    # Switch on element type
    if element_type == FIELD_TYPE_ASTEROID:
        # C++: case 8 - AsteroidField
        # Call FUN_140e842e0 via ResourceObjectField factory, then set U::Regions::AsteroidField::vftable
        field = AsteroidField.from_xml_140e842e0(
            xml_element, position_x, position_y, position_z, radius, linear
        )
        return field

    elif element_type == FIELD_TYPE_DEBRIS:
        # C++: case 0x13 (19) - DebrisField
        # Call FUN_140e842e0 via ResourceObjectField factory, then set U::Regions::DebrisField::vftable
        field = DebrisField.from_xml_140e842e0(
            xml_element, position_x, position_y, position_z, radius, linear
        )
        return field

    elif element_type == FIELD_TYPE_NEBULA:
        # C++: case 0x4c (76) - Nebula (gas)
        # This is handled separately in gas replay via NebulaField
        return None

    else:
        # C++: default case - return nullptr
        return None


# =============================================================================
# Groupref Resolution (FUN_140e81ff0)
# =============================================================================

def resolve_groupref_140e81ff0(
    field_list: list,
    xml_element: dict,
    position_x: float,
    position_y: float,
    position_z: float,
    radius: float,
    scale_factor: float = 1.0,
    linear: float = 0.0,
) -> list[ResourceObjectField]:
    """Resolve groupref and create fields.

    Corresponds to FUN_140e81ff0.

    C++ logic:
    1. Check for groupref attribute (XML 0x2b = 43)
    2. If no groupref:
       - Call FUN_140e81620 directly
       - Add result to field list
    3. If groupref exists:
       - Look up group in regionobjectgroups
       - Iterate through group's resources
       - For each resource, call FUN_140e81620 with scaled parameters
       - Call vfunc(+0x18) on created field
       - Add to field list

    Args:
        field_list: List to append created fields to
        xml_element: XML element data
        position_x: X position
        position_y: Y position
        position_z: Z position
        radius: Field radius
        scale_factor: Scale factor for multi-resource groups
        linear: Linear size

    Returns:
        List of created ResourceObjectField instances
    """
    created_fields = []

    # Get groupref from XML (C++: attribute 0x2b = 43)
    groupref = xml_element.get("groupref", "")

    if not groupref:
        # No groupref - create field directly via factory
        result = field_factory_140e81620(
            xml_element, position_x, position_y, position_z, radius, linear
        )
        if result:
            created_fields.append(result)
            field_list.append(result)
    else:
        # Groupref exists - look up in regionobjectgroups
        object_groups = parse_region_object_groups_140E950A0()

        if groupref not in object_groups:
            # C++: Error "Could not find region object group with name '%s'"
            # For now, fallback to direct creation
            result = field_factory_140e81620(
                xml_element, position_x, position_y, position_z, radius, linear
            )
            if result:
                created_fields.append(result)
                field_list.append(result)
        else:
            group = object_groups[groupref]

            # C++: Iterate through group resources
            # For simplicity, we create one field per group (as current implementation)
            # In full C++, this would iterate group.resources
            result = field_factory_140e81620(
                xml_element, position_x, position_y, position_z, radius, linear
            )
            if result:
                # C++: Set field values from group
                # field + 0x1110 = group.resource (ware_key)
                # field + 0x1118 = group.yield (yield_value)
                # field + 0x1194 = group.yieldvariation
                result.ware_key = group.resource
                result.yield_value = group.yield_value
                result.yieldvariation = group.yieldvariation

                # C++: Call vfunc(+0x18) - set_groupref
                # This links the field to its group resource
                result.set_groupref_0x18_140e83a90(
                    group.resource, group.yield_value, group.yieldvariation
                )

                created_fields.append(result)
                field_list.append(result)

    return created_fields


# =============================================================================
# Resource Iteration (FUN_140e82530)
# =============================================================================

def iterate_resources_140e82530(
    field_list: list,
    xml_data: dict,
    position_x: float,
    position_y: float,
    position_z: float,
    radius: float,
    scale_factor: float = 1.0,
    linear: float = 0.0,
) -> list[ResourceObjectField]:
    """Iterate resources and initialize fields.

    Corresponds to FUN_140e82530.

    C++ logic:
    1. Read XML attribute 0x68 (104) - resources
    2. Parse resources list (FUN_1408b7f60)
    3. If no resources:
       - Call FUN_140e81ff0 with resource = 0
    4. If resources exist:
       - For each resource:
         - Call FUN_140e81ff0 with param_4 / resource_count

    Args:
        field_list: List to append created fields to
        xml_data: XML data dict
        position_x: X position
        position_y: Y position
        position_z: Z position
        radius: Field radius
        scale_factor: Scale factor to apply
        linear: Linear size

    Returns:
        List of created ResourceObjectField instances
    """
    created_fields = []

    # C++: Read XML attribute 0x68 (104) - resources
    resources = xml_data.get("resources", [])

    if not resources:
        # No resources - call FUN_140e81ff0 with resource=0
        fields = resolve_groupref_140e81ff0(
            field_list, xml_data,
            position_x, position_y, position_z, radius,
            scale_factor, linear
        )
        created_fields.extend(fields)
    else:
        # Resources exist - iterate and call FUN_140e81ff0 for each
        resource_count = len(resources)

        for resource in resources:
            # C++: Scale factor divided by resource count
            per_resource_scale = scale_factor / resource_count

            # Create XML element data for this resource
            element_data = {
                **xml_data,
                "resource": resource,
            }

            fields = resolve_groupref_140e81ff0(
                field_list, element_data,
                position_x, position_y, position_z, radius,
                per_resource_scale, linear
            )
            created_fields.extend(fields)

    return created_fields
