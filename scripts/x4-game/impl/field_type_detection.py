"""Field type detection - reverse engineered from X4.exe.

C++ entry: FUN_140e81620

Switch logic for field type creation:
- case 0x08 (8): AsteroidField
- case 0x13 (19): DebrisField
- case 0x4c (76): Nebula
- case 0x12 (18): LockboxField
- case 0x27 (39): VantageField
- case 0x1c (28): GateField
- case 0x30 (48): ResourceSourceField
- case 0x4f (79): ObjectField
- case 0x56 (86): PositionalField
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Callable


class FieldType(IntEnum):
    """Field type IDs from C++ FUN_140e81620 switch cases."""
    AMBIENT_SOUND_FIELD = 0x07  # 7
    ASTEROID_FIELD = 0x08       # 8
    LOCKBOX_FIELD = 0x12        # 18
    DEBRIS_FIELD = 0x13         # 19
    GATE_FIELD = 0x1c           # 28
    VANTAGE_FIELD = 0x27        # 39
    GRAVIDAR_FIELD = 0x2a       # 42
    RESOURCE_SOURCE_FIELD = 0x30  # 48
    NEBULA = 0x4c               # 76
    OBJECT_FIELD = 0x4f         # 79
    POSITIONAL_FIELD = 0x56     # 86
    VIEW_CORRECTION = 0x8d      # 141
    HAZARD_FIELD = 0x91         # 145
    FORGE_FIELD = 0x92          # 146


@dataclass
class FieldTypeInfo:
    """Field type information."""
    type_id: FieldType
    name: str
    init_function: str  # C++ initialization function name
    vtable_name: str    # C++ vtable name


# Field type mapping from C++
FIELD_TYPE_MAP: dict[FieldType, FieldTypeInfo] = {
    FieldType.ASTEROID_FIELD: FieldTypeInfo(
        type_id=FieldType.ASTEROID_FIELD,
        name="AsteroidField",
        init_function="FUN_140e842e0",
        vtable_name="U::Regions::AsteroidField::vftable",
    ),
    FieldType.DEBRIS_FIELD: FieldTypeInfo(
        type_id=FieldType.DEBRIS_FIELD,
        name="DebrisField",
        init_function="FUN_140e842e0",
        vtable_name="U::Regions::DebrisField::vftable",
    ),
    FieldType.NEBULA: FieldTypeInfo(
        type_id=FieldType.NEBULA,
        name="Nebula",
        init_function="FUN_140e860c0",
        vtable_name="U::Regions::Nebula::vftable",
    ),
    FieldType.OBJECT_FIELD: FieldTypeInfo(
        type_id=FieldType.OBJECT_FIELD,
        name="ObjectField",
        init_function="FUN_140e842e0",
        vtable_name="U::Regions::ObjectField::vftable",
    ),
    FieldType.POSITIONAL_FIELD: FieldTypeInfo(
        type_id=FieldType.POSITIONAL_FIELD,
        name="PositionalField",
        init_function="FUN_140e842e0",
        vtable_name="U::Regions::PositionalField::vftable",
    ),
}


# Tag to field type mapping (from JSON data)
TAG_TO_FIELD_TYPE: dict[str, FieldType] = {
    "asteroid": FieldType.ASTEROID_FIELD,
    "debris": FieldType.DEBRIS_FIELD,
    "nebula": FieldType.NEBULA,
    "object": FieldType.OBJECT_FIELD,
}


def fun_140e81620_detect_field_type(tag: str) -> FieldType | None:
    """Detect field type from tag string.

    Corresponds to C++ FUN_140e81620 switch logic.
    In C++, this uses *(int *)(param_4 + 0xc) to get type ID.
    In JSON, we map from tag string.

    Args:
        tag: Field tag from JSON (e.g., "asteroid", "debris", "nebula")

    Returns:
        FieldType enum value or None if unknown
    """
    return TAG_TO_FIELD_TYPE.get(tag)


def fun_140e81620_get_init_function(type_id: FieldType) -> str | None:
    """Get initialization function name for field type.

    Args:
        type_id: Field type ID

    Returns:
        C++ initialization function name or None
    """
    info = FIELD_TYPE_MAP.get(type_id)
    return info.init_function if info else None


def fun_140e81620_get_vtable_name(type_id: FieldType) -> str | None:
    """Get vtable name for field type.

    Args:
        type_id: Field type ID

    Returns:
        C++ vtable name or None
    """
    info = FIELD_TYPE_MAP.get(type_id)
    return info.vtable_name if info else None


def fun_140e81620_is_solid_field(type_id: FieldType) -> bool:
    """Check if field type is solid (AsteroidField or DebrisField).

    C++ evidence:
    - case 0x08: AsteroidField
    - case 0x13: DebrisField
    Both use FUN_140e842e0 for initialization.

    Args:
        type_id: Field type ID

    Returns:
        True if solid field type
    """
    return type_id in {FieldType.ASTEROID_FIELD, FieldType.DEBRIS_FIELD}


def fun_140e81620_is_gas_field(type_id: FieldType) -> bool:
    """Check if field type is gas (Nebula).

    C++ evidence: case 0x4c

    Args:
        type_id: Field type ID

    Returns:
        True if gas field type
    """
    return type_id == FieldType.NEBULA


def fun_140e81620_uses_resource_object_field_init(type_id: FieldType) -> bool:
    """Check if field type uses FUN_140e842e0 for initialization.

    C++ evidence:
    - case 0x08: AsteroidField -> FUN_140e842e0
    - case 0x13: DebrisField -> FUN_140e842e0
    - case 0x4f: ObjectField -> FUN_140e842e0
    - case 0x56: PositionalField -> FUN_140e842e0

    Args:
        type_id: Field type ID

    Returns:
        True if uses FUN_140e842e0
    """
    return type_id in {
        FieldType.ASTEROID_FIELD,
        FieldType.DEBRIS_FIELD,
        FieldType.OBJECT_FIELD,
        FieldType.POSITIONAL_FIELD,
    }
