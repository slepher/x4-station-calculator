"""Field classes for X4 resource computation.

This module contains reverse-engineered field classes from X4.exe.

Naming convention:
    Implementation: method_name_offset_address
        Example: set_groupref_0x18_140e84940
        - method: set_groupref
        - vtable offset: +0x18
        - function address: 0x140e84940

    External interface: method_name_offset
        Example: set_groupref_0x18
        - Unified interface for callers
        - Same offset across all Field subclasses (polymorphism)

Class hierarchy:
    ResourceField (base class)
    ├── ResourceObjectField (intermediate base for solid fields)
    │   ├── AsteroidField (case 0x08)
    │   └── DebrisField (case 0x13)
    └── NebulaField (case 0x4c, separate branch)

Classes:
    ResourceField: Base class for all resource field types
    ResourceObjectField: Intermediate class for solid fields (Asteroid/Debris)
    NebulaField: Gas resource field (helium, hydrogen, etc.)
    AsteroidField: Solid resource field (ice, ore, silicon, etc.)
    DebrisField: Debris/wreckage field (scrap, etc.)
"""

from .resource_field import ResourceField
from .resource_object_field import ResourceObjectField
from .nebula_field import NebulaField
from .asteroid_field import AsteroidField
from .debris_field import DebrisField

__all__ = ['ResourceField', 'ResourceObjectField', 'NebulaField', 'AsteroidField', 'DebrisField']