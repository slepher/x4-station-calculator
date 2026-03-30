"""CylinderBoundary class - reverse engineered from X4.exe.

C++ class: U::CylinderBoundary
Base class: U::Boundary
VTable: 0x142bde490
COL(offset=0): 0x142db9920
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Tuple

from .boundary import Boundary


def vec3_sub(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec3_add(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec3_mul(a: Tuple[float, float, float], s: float) -> Tuple[float, float, float]:
    return (a[0] * s, a[1] * s, a[2] * s)


def vec3_dot(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec3_length(a: Tuple[float, float, float]) -> float:
    return math.sqrt(vec3_dot(a, a))


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


# Constants from C++
PI_0x40490fdb = 3.14159265358979323846


@dataclass
class CylinderBoundary(Boundary):
    """CylinderBoundary - a cylinder defined by two endpoints and radius.

    C++ class: U::CylinderBoundary
    VTable: 0x142bde490
    COL(offset=0): 0x142db9920

    Memory layout (offsets from this pointer):
        +0x00: vptr
        +0x08: vptr (secondary)
        +0x10: P0.x (float)
        +0x14: P0.y (float)
        +0x18: P0.z (float)
        +0x1c: P0.w (float, usually 0)
        +0x20: P1.x (float)
        +0x24: P1.y (float)
        +0x28: P1.z (float)
        +0x2c: P1.w (float, usually 0)
        +0x30: R (float) - radius

    VTable slots:
        +0x58 -> 0x14093dd10: get_axial_interval
        +0x70 -> 0x14093de40: get_radial_interval
        +0x78 -> 0x14093e1a0: get_volume
    """

    # Endpoint P0 (start of cylinder axis)
    # Offset: +0x10 .. +0x1c
    p0_x: float = 0.0
    p0_y: float = 0.0
    p0_z: float = 0.0

    # Endpoint P1 (end of cylinder axis)
    # Offset: +0x20 .. +0x2c
    p1_x: float = 0.0
    p1_y: float = 0.0
    p1_z: float = 0.0

    # Radius
    # Offset: +0x30
    radius: float = 0.0

    # ========================================================================
    # Derived properties
    # ========================================================================

    @property
    def p0(self) -> Tuple[float, float, float]:
        """Start point of cylinder axis."""
        return (self.p0_x, self.p0_y, self.p0_z)

    @property
    def p1(self) -> Tuple[float, float, float]:
        """End point of cylinder axis."""
        return (self.p1_x, self.p1_y, self.p1_z)

    @property
    def axis(self) -> Tuple[float, float, float]:
        """Axis vector from P0 to P1."""
        return vec3_sub(self.p1, self.p0)

    @property
    def axis_length(self) -> float:
        """Length of cylinder axis."""
        return vec3_length(self.axis)

    @property
    def axis_length_sq(self) -> float:
        """Squared length of cylinder axis."""
        axis = self.axis
        return vec3_dot(axis, axis)

    # ========================================================================
    # vtable+0x10 -> 0x14011b510: Sphere intersection test
    # ========================================================================

    def check_intersection_0x10_14011b510(
        self,
        pos: Tuple[float, float, float],
        bounding_radius: float,
    ) -> bool:
        """Check if sphere intersects with cylinder.

        Corresponds to vtable+0x10, function 0x14011b510.

        Formula:
            V = P1 - P0
            t = dot(Q - P0, V) / dot(V, V)
            t = clamp(t, 0, 1)
            closest = P0 + t * V
            d = distance(Q, closest)
            return d < (radius + bounding_radius)

        Args:
            pos: Sphere center position
            bounding_radius: Sphere radius

        Returns:
            True if sphere intersects cylinder
        """
        axis = self.axis
        axis_sq = self.axis_length_sq

        if axis_sq <= 1e-10:
            # Degenerate cylinder (point)
            d = vec3_length(vec3_sub(pos, self.p0))
        else:
            # t = dot(Q - P0, V) / dot(V, V)
            rel = vec3_sub(pos, self.p0)
            t = vec3_dot(rel, axis) / axis_sq
            t = clamp(t, 0.0, 1.0)

            # closest = P0 + t * V
            closest = vec3_add(self.p0, vec3_mul(axis, t))

            # d = distance(Q, closest)
            d = vec3_length(vec3_sub(pos, closest))

        return d < (self.radius + bounding_radius)

    # ========================================================================
    # vtable+0x58 -> 0x14093dd10: Axial interval
    # ========================================================================

    def get_axial_interval_0x58_14093dd10(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Compute axial interval normalized to [0, 1].

        Corresponds to vtable+0x58, function 0x14093dd10.

        Formula:
            V = P1 - P0
            L = |V|
            t = dot(Q - P0, V) / dot(V, V)
            delta = query_radius / L
            lower = max(t - delta, 0)
            upper = min(t + delta, 1)

        Args:
            query: Query point (center of 64k area)
            query_radius: Query radius (55425.625 for gas)

        Returns:
            (lower, upper) interval normalized to [0, 1]
        """
        axis = self.axis
        axis_sq = self.axis_length_sq
        axis_len = self.axis_length

        if axis_sq <= 1e-10:
            return (0.0, 1.0)

        # t = dot(Q - P0, V) / dot(V, V)
        rel = vec3_sub(query, self.p0)
        t = vec3_dot(rel, axis) / axis_sq

        # delta = query_radius / |V|
        delta = query_radius / axis_len

        # Clamp to [0, 1]
        lower = clamp(t - delta, 0.0, 1.0)
        upper = clamp(t + delta, 0.0, 1.0)

        return (lower, upper)

    # ========================================================================
    # vtable+0x70 -> 0x14093de40: Radial interval
    # ========================================================================

    def get_radial_interval_0x70_14093de40(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Compute radial interval normalized to [0, 1].

        Corresponds to vtable+0x70, function 0x14093de40.

        Formula:
            V = P1 - P0
            t = dot(Q - P0, V) / dot(V, V)
            closest = P0 + t * V
            d = distance(Q, closest)
            lower = max((d - query_radius) / R, 0)
            upper = min((d + query_radius) / R, 1)

        Args:
            query: Query point (center of 64k area)
            query_radius: Query radius (55425.625 for gas)

        Returns:
            (lower, upper) interval normalized to [0, 1]
        """
        if self.radius <= 1e-10:
            return (0.0, 1.0)

        axis = self.axis
        axis_sq = self.axis_length_sq

        if axis_sq <= 1e-10:
            # Degenerate cylinder (point)
            d = vec3_length(vec3_sub(query, self.p0))
        else:
            # t = dot(Q - P0, V) / dot(V, V)
            rel = vec3_sub(query, self.p0)
            t = vec3_dot(rel, axis) / axis_sq
            t = clamp(t, 0.0, 1.0)

            # closest = P0 + t * V
            closest = vec3_add(self.p0, vec3_mul(axis, t))

            # d = distance(Q, closest)
            d = vec3_length(vec3_sub(query, closest))

        # Normalize by radius
        lower = clamp((d - query_radius) / self.radius, 0.0, 1.0)
        upper = clamp((d + query_radius) / self.radius, 0.0, 1.0)

        return (lower, upper)

    # ========================================================================
    # vtable+0x78 -> 0x14093e1a0: Volume
    # ========================================================================

    def get_volume_0x78_14093e1a0(self) -> float:
        """Compute cylinder volume.

        Corresponds to vtable+0x78, function 0x14093e1a0.

        Formula:
            Volume = |V| * π * R²

        Returns:
            Cylinder volume
        """
        return self.axis_length * PI_0x40490fdb * self.radius * self.radius

    # ========================================================================
    # Unified interface (for external callers like BoundaryList)
    # vtable slots are same offset across all Boundary subclasses
    # ========================================================================

    def check_intersection_0x10(self, pos: Tuple[float, float, float], bounding_radius: float) -> bool:
        """Unified interface at vtable+0x10 - forwards to implementation."""
        return self.check_intersection_0x10_14011b510(pos, bounding_radius)

    def get_lateral_interval_0x58(self, query: Tuple[float, float, float], query_radius: float) -> Tuple[float, float]:
        """Unified interface at vtable+0x58 - forwards to implementation."""
        return self.get_axial_interval_0x58_14093dd10(query, query_radius)

    def get_radial_interval_0x70(self, query: Tuple[float, float, float], query_radius: float) -> Tuple[float, float]:
        """Unified interface at vtable+0x70 - forwards to implementation."""
        return self.get_radial_interval_0x70_14093de40(query, query_radius)

    def get_volume_0x78(self) -> float:
        """Unified interface at vtable+0x78 - forwards to implementation."""
        return self.get_volume_0x78_14093e1a0()

    # ========================================================================
    # Factory methods
    # ========================================================================

    @classmethod
    def from_endpoints(
        cls,
        p0: Tuple[float, float, float],
        p1: Tuple[float, float, float],
        radius: float,
    ) -> 'CylinderBoundary':
        """Create CylinderBoundary from two endpoints and radius.

        Args:
            p0: Start point of cylinder axis
            p1: End point of cylinder axis
            radius: Cylinder radius

        Returns:
            CylinderBoundary instance
        """
        return cls(
            p0_x=p0[0],
            p0_y=p0[1],
            p0_z=p0[2],
            p1_x=p1[0],
            p1_y=p1[1],
            p1_z=p1[2],
            radius=radius,
        )