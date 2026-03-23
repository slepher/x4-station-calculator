"""NebulaField class - reverse engineered from X4.exe.

C++ class: U::NebulaField
Base class: U::ResourceField
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .resource_field import ResourceField

if TYPE_CHECKING:
    from boundary import SplineTubeBoundary, CylinderBoundary


@dataclass
class NebulaField(ResourceField):
    """NebulaField - gas resource field (helium, hydrogen, etc.).

    C++ class: U::NebulaField
    Extends: U::ResourceField

    Gas fields are harvested by ships with gas collectors.

    Additional memory layout:
        +0x10d0: noise_table[1024] (float array) - initialized by FUN_140e80d20
        +0x2b0: boundary - SplineTubeBoundary or CylinderBoundary

    Key differences from AsteroidField:
        - Uses spline tubes for irregular gas cloud shapes
        - No solid resource percentage calculation
        - Different yield density tables
    """

    field_type: str = "nebula"

    # Gas-specific attributes
    gather_speed_factor: float = 1.0
    recharge_time_seconds: float = 0.0

    # ========================================================================
    # Factory methods
    # ========================================================================

    @classmethod
    def from_region_json(
        cls,
        region_data: dict,
        area_position: tuple[float, float, float] | None = None,
        ware_key: str = "",
    ) -> 'NebulaField':
        """Create NebulaField from regions.json data.

        Args:
            region_data: Region dict from regions.json
            area_position: Optional position from resourceareas.json
            ware_key: Ware key (helium, hydrogen, etc.)

        Returns:
            NebulaField instance
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

        # Get yield
        yield_value = float(region_data.get('yield', 1.0) or 1.0)

        return cls(
            name=region_data.get('id', ''),
            field_type='nebula',
            position_x=pos_x,
            position_y=pos_y,
            position_z=pos_z,
            noisescale=noisescale,
            minnoisevalue=minnoisevalue,
            maxnoisevalue=maxnoisevalue,
            ware_key=ware_key,
            yield_value=yield_value,
            ref=region_data.get('ref', ''),
            boundary=boundary,
        )