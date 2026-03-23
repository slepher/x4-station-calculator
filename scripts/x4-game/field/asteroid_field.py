"""AsteroidField class - reverse engineered from X4.exe.

C++ class: U::AsteroidField
Base class: U::ResourceField
Constructor: 0x140e842e0
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .resource_field import ResourceField

if TYPE_CHECKING:
    from boundary import CylinderBoundary


@dataclass
class AsteroidField(ResourceField):
    """AsteroidField - solid resource field (ice, ore, silicon, etc.).

    C++ class: U::AsteroidField
    Extends: U::ResourceField
    Constructor: 0x140e842e0

    Memory layout (offsets from this pointer):
        +0x10d0: noise_table[1024] (float array)
        +0x10d4: noisescale (float)
        +0x10e0: minnoisevalue (float)
        +0x10e4: maxnoisevalue (float)
        +0x1110: ware_key (uint/string)
        +0x1118: yield (float)
        +0x111c: region_yields[0] (float)
        +0x1120: region_yields[1] (float)
        +0x1150: density_multiplier (float)
        +0x1158: ref (string) -> class_id lookup
        +0x1190: resourcepercentage (float)
        +0x1194: yieldvariation (float)
        +0x2b0: boundary (CylinderBoundary)

    VTable slots:
        +0x18 -> 0x140e84940: set_groupref
        +0x20 -> 0x140e83f80: receive_region_payload
        +0x28 -> 0x140e84990: writeback_per_field_value
        +0x98 -> 0x140e803e0: get_multiplier_b
        +0xa0 -> 0x140e85b80: compute_field_weight
        +0x1b8 -> 0x140e80300: get_multiplier_a

    Solid fields are harvested by mining ships.
    """

    field_type: str = "asteroid"

    # Asteroid-specific attributes
    # Region yields payload (+0x111c, +0x1120)
    region_yield_0: float = 0.0
    region_yield_1: float = 0.0

    # ========================================================================
    # vtable+0x18 -> 0x140e84940: set_groupref
    # ========================================================================

    def set_groupref_0x18_140e84940(
        self,
        group_resource: str,
        group_yield: float,
        group_yieldvariation: float,
    ) -> None:
        """Set fields from RegionObjectGroup.

        Corresponds to vtable+0x18, function 0x140e84940.

        C++ logic:
            if field.ware_key == 0:
                field.ware_key = group.resource
            if field.yield < epsilon:
                field.yield = group.yield
                field.yieldvariation = group.yieldvariation
                field.resourcepercentage = 0

        Args:
            group_resource: Resource ware key from group
            group_yield: Yield value from group
            group_yieldvariation: Yield variation from group
        """
        if not self.ware_key:
            self.ware_key = group_resource

        if self.yield_value < 1e-6:
            self.yield_value = group_yield
            self.yieldvariation = group_yieldvariation
            self.resourcepercentage = 0.0

    def set_groupref_0x18(self, group_resource: str, group_yield: float, group_yieldvariation: float) -> None:
        """Unified interface at vtable+0x18."""
        self.set_groupref_0x18_140e84940(group_resource, group_yield, group_yieldvariation)

    # ========================================================================
    # vtable+0x20 -> 0x140e83f80: receive_region_payload
    # ========================================================================

    def receive_region_payload_0x20_140e83f80(
        self,
        payload_0: float,
        payload_1: float,
        payload_2: float,
    ) -> None:
        """Receive region yields payload.

        Corresponds to vtable+0x20, function 0x140e83f80.

        C++ logic:
            if field.yield == 0:
                field.yield = payload[2]
            field.region_yield_0 = payload[0]
            field.region_yield_1 = payload[1]

        Args:
            payload_0: First payload value
            payload_1: Second payload value
            payload_2: Third payload value (yield)
        """
        if self.yield_value < 1e-6:
            self.yield_value = payload_2

        self.region_yield_0 = payload_0
        self.region_yield_1 = payload_1

    def receive_region_payload_0x20(self, payload_0: float, payload_1: float, payload_2: float) -> None:
        """Unified interface at vtable+0x20."""
        self.receive_region_payload_0x20_140e83f80(payload_0, payload_1, payload_2)

    # ========================================================================
    # vtable+0x28 -> 0x140e84990: writeback_per_field_value
    # ========================================================================

    def writeback_per_field_value_0x28_140e84990(
        self,
        per_field_value: float,
    ) -> None:
        """Write back per-field value after allocation.

        Corresponds to vtable+0x28, function 0x140e84990.

        C++ logic:
            field.resourcepercentage = per_field_value
            field.yield = max(field.yield, per_field_value)

        Args:
            per_field_value: Computed per-field value
        """
        self.resourcepercentage = per_field_value
        self.yield_value = max(self.yield_value, per_field_value)

    def writeback_per_field_value_0x28(self, per_field_value: float) -> None:
        """Unified interface at vtable+0x28."""
        self.writeback_per_field_value_0x28_140e84990(per_field_value)

    # ========================================================================
    # Factory methods
    # ========================================================================

    @classmethod
    def from_region_json(
        cls,
        region_data: dict,
        area_position: tuple[float, float, float] | None = None,
        ware_key: str = "",
    ) -> 'AsteroidField':
        """Create AsteroidField from regions.json data.

        Args:
            region_data: Region dict from regions.json
            area_position: Optional position from resourceareas.json
            ware_key: Ware key (ice, ore, silicon, etc.)

        Returns:
            AsteroidField instance
        """
        from boundary import Boundary

        # Get position
        if area_position:
            pos_x, pos_y, pos_z = area_position
        else:
            pos_x = float(region_data.get('position_x', 0) or 0)
            pos_y = float(region_data.get('position_y', 0) or 0)
            pos_z = float(region_data.get('position_z', 0) or 0)

        # Create boundary
        boundary_data = region_data.get('boundary', {})
        boundary = Boundary.from_json(boundary_data, (pos_x, pos_y, pos_z))

        # Get noise parameters
        noisescale = float(region_data.get('noisescale', 1.0) or 1.0)
        minnoisevalue = float(region_data.get('minnoisevalue', 0.0) or 0.0)
        maxnoisevalue = float(region_data.get('maxnoisevalue', 1.0) or 1.0)

        # Get yield and resource percentage
        yield_value = float(region_data.get('yield', 1.0) or 1.0)
        resourcepercentage = float(region_data.get('resourcepercentage', 100.0) or 100.0) / 100.0
        yieldvariation = float(region_data.get('yieldvariation', 0.0) or 0.0)

        # Get density multiplier (densityfactor * region.density * 0.01)
        density = float(region_data.get('density', 1.0) or 1.0)
        densityfactor = float(region_data.get('densityfactor', 1.0) or 1.0)
        density_multiplier = densityfactor * density * 0.01

        return cls(
            name=region_data.get('id', ''),
            field_type='asteroid',
            position_x=pos_x,
            position_y=pos_y,
            position_z=pos_z,
            noisescale=noisescale,
            minnoisevalue=minnoisevalue,
            maxnoisevalue=maxnoisevalue,
            ware_key=ware_key,
            yield_value=yield_value,
            density_multiplier=density_multiplier,
            ref=region_data.get('ref', ''),
            resourcepercentage=resourcepercentage,
            yieldvariation=yieldvariation,
            boundary=boundary,
        )