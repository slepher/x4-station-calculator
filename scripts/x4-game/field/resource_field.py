"""Base ResourceField class - reverse engineered from X4.exe.

C++ class: U::ResourceField (base class for NebulaField, AsteroidField, etc.)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Tuple

if TYPE_CHECKING:
    from boundary import SplineTubeBoundary, CylinderBoundary


@dataclass
class ResourceField:
    """ResourceField - base class for all resource field types.

    C++ class: U::ResourceField

    Memory layout (common offsets shared by subclasses):
        +0x00: vptr
        +0x10d4: noisescale (float)
        +0x10e0: minnoisevalue (float)
        +0x10e4: maxnoisevalue (float)
        +0x1110: ware_key (string/uint)
        +0x1118: yield (float)
        +0x1150: density_multiplier (float) - densityfactor * region.density * 0.01
        +0x1158: ref (string) - reference to region definition
        +0x1190: resourcepercentage (float) - 0.0 to 1.0
        +0x1194: yieldvariation (float)
        +0x2b0: boundary_list (pointer) - BoundaryList with shape(s)

    Common vtable slots:
        +0x18: set_groupref
        +0x20: receive_region_payload
        +0x28: writeback_per_field_value
        +0x98: get_multiplier_b
        +0xa0: compute_field_weight
        +0x1b8: get_multiplier_a
    """

    # Identity
    name: str = ""
    field_type: str = ""  # 'nebula', 'asteroid', 'debris'

    # Position and boundary
    position_x: float = 0.0
    position_y: float = 0.0
    position_z: float = 0.0

    # Noise parameters (+0x10d4, +0x10e0, +0x10e4)
    noisescale: float = 1.0  # +0x10d4
    minnoisevalue: float = 0.0  # +0x10e0
    maxnoisevalue: float = 1.0  # +0x10e4

    # Resource parameters (+0x1110, +0x1118, +0x1150, +0x1158, +0x1190, +0x1194)
    ware_key: str = ""  # +0x1110
    yield_value: float = 1.0  # +0x1118
    density_multiplier: float = 1.0  # +0x1150
    ref: str = ""  # +0x1158
    resourcepercentage: float = 1.0  # +0x1190
    yieldvariation: float = 0.0  # +0x1194

    # Boundary (+0x2b0)
    boundary: 'SplineTubeBoundary | CylinderBoundary | None' = None

    # ========================================================================
    # vtable+0x98 -> 0x140e803e0: MultiplierB
    # ========================================================================

    def get_multiplier_b_0x98_140e803e0(self) -> float:
        """Compute MultiplierB.

        Corresponds to vtable+0x98, function 0x140e803e0.

        Formula:
            MultiplierB = universe_yield_density(ware)
                        * yield
                        * universe_object_yield_density(ware)

        Returns:
            MultiplierB value
        """
        # Base implementation - subclasses may override
        return self.yield_value

    def get_multiplier_b_0x98(self) -> float:
        """Unified interface at vtable+0x98."""
        return self.get_multiplier_b_0x98_140e803e0()

    # ========================================================================
    # vtable+0x1b8 -> 0x140e80300: MultiplierA
    # ========================================================================

    def get_multiplier_a_0x1b8_140e80300(self) -> float:
        """Compute MultiplierA.

        Corresponds to vtable+0x1b8, function 0x140e80300.

        Formula:
            MultiplierA = density_multiplier * class_multiplier(ref)

        Returns:
            MultiplierA value
        """
        # Base implementation - subclasses may override
        return self.density_multiplier

    def get_multiplier_a_0x1b8(self) -> float:
        """Unified interface at vtable+0x1b8."""
        return self.get_multiplier_a_0x1b8_140e80300()

    # ========================================================================
    # vtable+0xa0 -> 0x140e85b80: Field weight (region allocation)
    # ========================================================================

    def compute_field_weight_0xa0_140e85b80(self, use_resourcepercentage: bool = False) -> float:
        """Compute field weight for region allocation.

        Corresponds to vtable+0xa0, function 0x140e85b80.

        Formula:
            weight = MultiplierA * MultiplierB * gate * (F(maxnoise) - F(minnoise))

        Where:
            gate = resourcepercentage if use_resourcepercentage else 1.0
            F(x) = noise CDF approximation (FUN_1414f5870)

        Args:
            use_resourcepercentage: If True, use resourcepercentage as gate

        Returns:
            Field weight
        """
        gate = self.resourcepercentage if use_resourcepercentage else 1.0

        # Fast path: F(maxnoisevalue) - F(minnoisevalue)
        # For typical fields, this simplifies
        noise_factor = self._noise_cdf(self.maxnoisevalue) - self._noise_cdf(self.minnoisevalue)

        return self.get_multiplier_a_0x1b8() * self.get_multiplier_b_0x98() * gate * noise_factor

    def compute_field_weight_0xa0(self, use_resourcepercentage: bool = False) -> float:
        """Unified interface at vtable+0xa0."""
        return self.compute_field_weight_0xa0_140e85b80(use_resourcepercentage)

    # ========================================================================
    # Noise CDF approximation (FUN_1414f5870)
    # ========================================================================

    @staticmethod
    def _noise_cdf(x: float) -> float:
        """Noise CDF approximation.

        Corresponds to function 0x1414f5870.

        Args:
            x: Input value [0, 1]

        Returns:
            CDF value
        """
        if x <= 0.0:
            return 0.0
        if x >= 1.0:
            return 1.0

        # Polynomial approximation from C++
        cx = x - 0.5
        sign = -1.0 if cx < 0 else (1.0 if cx > 0 else 0.0)
        abs_scaled = abs(cx) * 4.5

        cx2 = cx * cx
        poly = (cx2 * 4.665377140045166
                + abs_scaled * 0.30000001192092896
                + abs_scaled * 0.0009720000089146197 * cx2 * 20.25
                + cx2 * cx2 * 32.02915954589844
                + 1.0)

        return ((sign - sign / (poly ** 4)) + 1.0) * 0.5