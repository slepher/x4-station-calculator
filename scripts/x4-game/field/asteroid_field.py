"""AsteroidField class - reverse engineered from X4.exe.

C++ class: U::AsteroidField
Base class: U::ResourceObjectField (inherits from U::ResourceField)

Case 0x08 in FUN_140e81620 field factory.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .resource_object_field import ResourceObjectField

if TYPE_CHECKING:
    from boundary import CylinderBoundary


@dataclass
class AsteroidField(ResourceObjectField):
    """AsteroidField - solid resource field (ice, ore, silicon, etc.).

    C++ class: U::AsteroidField
    Extends: U::ResourceObjectField
    VTable: 0x142b2b780 (AsteroidField::vftable)

    Case: 0x08 in FUN_140e81620

    Memory layout (inherits ResourceObjectField offsets):
        +0x10d0: noise_table[1024] (float array)
        +0x10d4: noisescale (float)
        +0x10e0: minnoisevalue (float)
        +0x10e4: maxnoisevalue (float)
        +0x1110: ware_key (uint/string)
        +0x1118: yield (float)
        +0x111c: region_yields[0] (float)
        +0x1120: region_yields[1] (float)
        +0x1150: density_multiplier (float)
        +0x1158: ref (string)
        +0x1190: resourcepercentage (float)
        +0x1194: yieldvariation (float)
        +0x1198: groupref (string) - from ResourceObjectField
        +0x2b0: boundary (CylinderBoundary)

    VTable (inherits from ResourceObjectField at 0x142b2b9a0):
        +0x18: set_groupref_0x18 (inherited from ResourceObjectField)
        +0x20: receive_region_payload_0x20 (inherited from ResourceObjectField)
        +0x28: writeback_per_field_value_0x28 (inherited from ResourceObjectField)
        +0x98: get_multiplier_b_0x98 (inherited from ResourceField)
        +0xa0: compute_field_weight_0xa0 (inherited from ResourceField)
        +0x1b8: get_multiplier_a_0x1b8 (inherited from ResourceField)
        +0x1c8: get_field_type_0x1c8_140e85b40 (OVERRIDE - returns 0x08)

    Note: AsteroidField does NOT override ResourceObjectField methods.
    It uses the base implementation from ResourceObjectField.
    Only get_field_type is overridden for case dispatch.

    Solid fields are harvested by mining ships.
    """

    field_type: str = "asteroid"

    # ========================================================================
    # vtable+0x1c8 -> FUN_140e85b40: get_field_type (AsteroidField override)
    # ========================================================================

    def get_field_type_0x1c8_140e85b40(self) -> int:
        """Get field type - returns AsteroidField case value.

        Overrides ResourceObjectField.get_field_type_0x1c8_140e85b40.

        Returns:
            0x08 (AsteroidField case in FUN_140e81620)
        """
        return 0x08

    # ========================================================================
    # Factory methods - delegates to parent class from_json
    # ========================================================================

    @classmethod
    def from_region_json(
        cls,
        region_data: dict,
        area_position: tuple[float, float, float] | None = None,
        ware_key: str = "",
    ) -> 'AsteroidField':
        """Create AsteroidField from regions.json data.

        Delegates to parent class from_json.
        field_type is automatically set to 'asteroid' via class default.

        Args:
            region_data: Region dict from regions.json
            area_position: Optional position from resourceareas.json
            ware_key: Ware key (ice, ore, silicon, etc.)

        Returns:
            AsteroidField instance
        """
        return super().from_json(region_data, area_position, ware_key)