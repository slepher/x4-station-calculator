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

Classes:
    ResourceField: Base class for all resource field types
    NebulaField: Gas resource field (helium, hydrogen, etc.)
    AsteroidField: Solid resource field (ice, ore, silicon, etc.)
    DebrisField: Debris/wreckage field (scrap, etc.)
"""

from .resource_field import ResourceField
from .nebula_field import NebulaField
from .asteroid_field import AsteroidField
from .debris_field import DebrisField

__all__ = ['ResourceField', 'NebulaField', 'AsteroidField', 'DebrisField']