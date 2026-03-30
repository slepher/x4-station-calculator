"""ResourceObjectField class - reverse engineered from X4.exe.

C++ class: U::ResourceObjectField
Base class: U::ResourceField

This is the intermediate base class for AsteroidField and DebrisField.
Both share the same initialization path (FUN_140e842e0) and vtable structure.
"""

from __future__ import annotations

from dataclasses import dataclass, field as dataclass_field
from typing import TYPE_CHECKING

from .resource_field import ResourceField

if TYPE_CHECKING:
    pass


@dataclass
class ResourceObjectField(ResourceField):
    """ResourceObjectField - base class for solid resource fields.

    C++ class: U::ResourceObjectField
    Extends: U::ResourceField

    Memory layout (additional to ResourceField):
        +0x10f0: name (string)
        +0x1108: groupref (string) - links to regionobjectgroups
        +0x1110: ware_key (string/uint) - from group.resource
        +0x1118: yield (float) - from group.yield
        +0x1194: yieldvariation (float) - from group.yieldvariation

    VTable structure (ResourceObjectField vftable at 0x142b2b9a0):
        +0x18: set_groupref_0x18_140e83a90
        +0x20: receive_region_payload_0x20_140e84a90
        +0x28: writeback_per_field_value_0x28_140e85b50
        +0x98: get_multiplier_b_0x98_140e803e0 (inherited)
        +0xa0: compute_field_weight_0xa0_140e85b80 (inherited)
        +0x1b8: get_multiplier_a_0x1b8_140e80300 (inherited)
        +0x1c8: get_field_type_0x1c8_140e85b40
    """

    # Group reference (+0x1108)
    groupref: str = ""

    # Additional field attributes
    densityfactor: float = 1.0  # XML attribute 0x19 (25)
    seed: str = ""  # XML attribute
    rotation: float = 0.0  # XML attribute 0x40 (64)
    rotationvariation: float = 0.0  # XML attribute 0x41 (65)

    # ========================================================================
    # Factory methods
    # ========================================================================

    @classmethod
    def from_json(
        cls,
        region_data: dict,
        area_position: tuple[float, float, float] | None = None,
        ware_key: str = "",
    ) -> 'ResourceObjectField':
        """Create ResourceObjectField from regions.json data.

        This is the unified JSON constructor for solid resource fields.
        Called by from_xml_140e842e0 and subclass constructors.

        Args:
            region_data: Region dict from regions.json
            area_position: Optional position from resourceareas.json
            ware_key: Ware key (ice, ore, silicon, scrap, etc.)

        Returns:
            ResourceObjectField instance
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

        # Get density multiplier (densityfactor * density * 0.01)
        density = float(region_data.get('density', 1.0) or 1.0)
        densityfactor = float(region_data.get('densityfactor', 1.0) or 1.0)
        density_multiplier = densityfactor * density * 0.01

        return cls(
            name=region_data.get('id', ''),
            groupref=region_data.get('groupref', ''),
            ref=region_data.get('ref', ''),
            position_x=pos_x,
            position_y=pos_y,
            position_z=pos_z,
            noisescale=noisescale,
            minnoisevalue=minnoisevalue,
            maxnoisevalue=maxnoisevalue,
            ware_key=ware_key,
            yield_value=yield_value,
            density_multiplier=density_multiplier,
            densityfactor=densityfactor,
            resourcepercentage=resourcepercentage,
            yieldvariation=yieldvariation,
            boundary=boundary,
        )

    @classmethod
    def from_xml_140e842e0(
        cls,
        xml_data: dict,
        position_x: float,
        position_y: float,
        position_z: float,
        radius: float,
        linear: float = 0.0,
    ) -> 'ResourceObjectField':
        """Initialize ResourceObjectField from XML data.

        Corresponds to FUN_140e842e0.
        Delegates to from_json for actual construction.

        C++ operations:
        1. Call FUN_140e83d30() for base initialization
        2. Set ResourceObjectField vftable at 0x142b2b9a0
        3. Read XML attributes:
           - 0x19 (25): densityfactor
           - noisescale, seed, minnoisevalue, maxnoisevalue
           - 0x6a, 0x6b: ware related
           - 0x47, 0x48: yield related
        4. Process resources and yields

        Args:
            xml_data: XML data dict with field attributes
            position_x: X position
            position_y: Y position
            position_z: Z position
            radius: Field radius
            linear: Linear size (for cylinder)

        Returns:
            ResourceObjectField instance with initialized values
        """
        # C++: Base initialization (FUN_140e83d30 equivalent)
        # This sets up ResourceField base members

        # C++: Read XML attributes
        # XML attribute 0x19 (25) -> densityfactor
        densityfactor = float(xml_data.get("densityfactor", 1.0))

        # C++: XML attributes for noise
        noisescale = float(xml_data.get("noisescale", 5000.0))
        seed = str(xml_data.get("seed", ""))
        minnoisevalue = float(xml_data.get("minnoisevalue", 0.0))
        maxnoisevalue = float(xml_data.get("maxnoisevalue", 1.0))

        # C++: field_0x1150 = densityfactor * region_density * 0.01
        region_density = float(xml_data.get("region_density", 1.0))
        density_multiplier = densityfactor * region_density * 0.01

        # C++: Get rotation attributes (0x40 = 64, 0x41 = 65)
        rotation = float(xml_data.get("rotation", 0.0))
        rotationvariation = float(xml_data.get("rotationvariation", 0.0))

        return cls(
            name=xml_data.get("name", ""),
            groupref=xml_data.get("groupref", ""),
            densityfactor=densityfactor,
            density_multiplier=density_multiplier,
            noisescale=noisescale,
            seed=seed,
            minnoisevalue=minnoisevalue,
            maxnoisevalue=maxnoisevalue,
            rotation=rotation,
            rotationvariation=rotationvariation,
            position_x=position_x,
            position_y=position_y,
            position_z=position_z,
            resourcepercentage=1.0,  # Will be set by writeback
        )

    # ========================================================================
    # vtable+0x18 -> FUN_140e83a90: set_groupref
    # ========================================================================

    def set_groupref_0x18_140e83a90(
        self,
        group_resource: str,
        group_yield: float,
        group_yieldvariation: float = 0.0,
    ) -> None:
        """Set group reference (vfunc+0x18).

        Corresponds to FUN_140e83a90.

        C++ operations:
        - field + 0x1110 = group_resource (ware_key)
        - field + 0x1118 = group_yield (yield_value)
        - field + 0x1194 = group_yieldvariation

        Called by FUN_140e81ff0 after field creation.

        Args:
            group_resource: Resource from group (ware_key)
            group_yield: Yield value from group
            group_yieldvariation: Yield variation from group
        """
        self.ware_key = group_resource
        self.yield_value = group_yield
        self.yieldvariation = group_yieldvariation

    def set_groupref_0x18(self, *args, **kwargs) -> None:
        """Unified interface at vtable+0x18."""
        return self.set_groupref_0x18_140e83a90(*args, **kwargs)

    # ========================================================================
    # vtable+0x20 -> FUN_140e84a90: receive_region_payload
    # ========================================================================

    def receive_region_payload_0x20_140e84a90(
        self,
        payload_resourcedensity: float,
        payload_yield_name: str = "",
        payload_region_yield: float = 0.0,
    ) -> None:
        """Receive region payload (vfunc+0x20).

        Corresponds to FUN_140e84a90.

        C++ operations (from decompiler):
        - field + 0x1198 = some region data
        - Stores payload information for later computation

        Called at 14073e2d8 and 14073ec51 in FUN_14073e110.

        Args:
            payload_resourcedensity: Resource density from region
            payload_yield_name: Yield name identifier
            payload_region_yield: Region yield value
        """
        # Store payload data in instance
        # C++: This sets up data for vfunc(+0xa0) accumulate
        self._payload_resourcedensity = payload_resourcedensity
        self._payload_yield_name = payload_yield_name
        self._payload_region_yield = payload_region_yield

        # C++: field_0x1198 stores this info
        # For tracking purposes
        self.resourcedensity = payload_resourcedensity

    def receive_region_payload_0x20(self, *args, **kwargs) -> None:
        """Unified interface at vtable+0x20."""
        return self.receive_region_payload_0x20_140e84a90(*args, **kwargs)

    # ========================================================================
    # vtable+0x28 -> FUN_140e85b50: writeback_per_field_value
    # ========================================================================

    def writeback_per_field_value_0x28_140e85b50(self, per_field_value: float) -> None:
        """Write back per-field value (vfunc+0x28).

        Corresponds to FUN_140e85b50.

        C++ logic:
        if (per_field_value > 1.0) {
            field + 0x1190 = 1.0;  // resourcepercentage
            field + 0x1118 *= per_field_value;  // yield *= value
        } else {
            field + 0x1190 = per_field_value;  // resourcepercentage
        }

        Called at 14073ed5d in FUN_14073e110 after accumulation.

        Args:
            per_field_value: Computed per-field allocation value
        """
        if per_field_value > 1.0:
            # C++: field + 0x1190 = 1.0
            self.resourcepercentage = 1.0
            # C++: field + 0x1118 *= per_field_value
            self.yield_value *= per_field_value
        else:
            # C++: field + 0x1190 = per_field_value
            self.resourcepercentage = per_field_value

    def writeback_per_field_value_0x28(self, *args, **kwargs) -> None:
        """Unified interface at vtable+0x28."""
        return self.writeback_per_field_value_0x28_140e85b50(*args, **kwargs)

    # ========================================================================
    # vtable+0x1c8 -> FUN_140e85b40: get_field_type
    # ========================================================================

    def get_field_type_0x1c8_140e85b40(self) -> int:
        """Get field type (vfunc+0x1c8).

        Corresponds to FUN_140e85b40.

        Returns:
            Field type constant (0x08 for Asteroid, 0x13 for Debris)
        """
        # Base implementation - subclasses override
        # 0x08 = AsteroidField, 0x13 = DebrisField
        return 0x00

    def get_field_type_0x1c8(self) -> int:
        """Unified interface at vtable+0x1c8."""
        return self.get_field_type_0x1c8_140e85b40()

    # ========================================================================
    # vtable+0xb0 -> FUN_140e85b60: check_flags
    # ========================================================================

    def check_flags_0xb0_140e85b60(self) -> bool:
        """Check field flags (vfunc+0xb0).

        Corresponds to FUN_140e85b60.

        Called at 14073f2a3 in FUN_14073e110.

        Returns:
            True if field is active/valid
        """
        # C++: Checks various flags on field
        # Return True for active fields
        return True

    def check_flags_0xb0(self) -> bool:
        """Unified interface at vtable+0xb0."""
        return self.check_flags_0xb0_140e85b60()
