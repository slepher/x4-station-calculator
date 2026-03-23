"""CompositeSpline<3> class - reverse engineered from X4.exe.

C++ class: Math::CompositeSpline<3>
Used by: SplineTubeBoundary (at offset +0x10)

VTable slots:
    +0x08 -> sample: Sample point at parameter t
    +0x40 -> find_nearest_parameter: Find nearest t to query point
    +0x70 -> get_parameter_interval: Get parameter interval for query sphere
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass


def vec3_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec3_dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec3_length(a: tuple[float, float, float]) -> float:
    return math.sqrt(vec3_dot(a, a))


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


# C++ constants
DAT_142d7fbe8 = 1e-6
DAT_142d800e8 = 1.0
DAT_142d7ff50 = 0.5
DAT_142d80b2c = -1.0


@dataclass
class CompositeSpline:
    """CompositeSpline<3> - A composite Bezier spline in 3D space.

    C++ class: Math::CompositeSpline<3>
    Used by SplineTubeBoundary at offset +0x10.

    VTable slots:
        +0x08 -> 0x1402d55c0: sample(global_t) -> point
        +0x40 -> 0x1402d4ff0: find_nearest_parameter(query) -> t
        +0x70 -> 0x1414f3b30: get_parameter_interval(query, radius, sample_count) -> [lower, upper]
    """

    # Sampled points on the spline
    sampled_points: list[tuple[float, float, float]] = field(default_factory=list)

    # Segment lengths and accumulators for arc-length parameterization
    seg_lengths: list[float] = field(default_factory=list)
    accum: list[float] = field(default_factory=list)

    # Total spline length
    total_length: float = 0.0

    # ========================================================================
    # vtable+0x08 -> 0x1402d55c0: Sample point at parameter t
    # ========================================================================

    def sample_0x08_1402d55c0(self, t: float) -> tuple[float, float, float]:
        """Sample point on spline at normalized parameter t.

        Corresponds to vtable+0x08, function 0x1402d55c0.

        Args:
            t: Normalized parameter in [0, 1]

        Returns:
            Point on the spline (x, y, z)
        """
        t = clamp(t, 0.0, 1.0)

        if t >= 1.0:
            return self.sampled_points[-1]

        if not self.sampled_points:
            return (0.0, 0.0, 0.0)

        target = t * self.total_length

        for i, seg_len in enumerate(self.seg_lengths):
            seg_start = self.accum[i]
            seg_end = self.accum[i + 1]

            if target <= seg_end or i == len(self.seg_lengths) - 1:
                if seg_len <= 1e-6:
                    return self.sampled_points[i]

                local_t = clamp((target - seg_start) / seg_len, 0.0, 1.0)
                a = self.sampled_points[i]
                b = self.sampled_points[i + 1]
                return (
                    a[0] + (b[0] - a[0]) * local_t,
                    a[1] + (b[1] - a[1]) * local_t,
                    a[2] + (b[2] - a[2]) * local_t,
                )

        return self.sampled_points[-1]

    # ========================================================================
    # vtable+0x40 -> 0x1402d4ff0: Find nearest parameter
    # ========================================================================

    def find_nearest_parameter_0x40_1402d4ff0(
        self,
        query: tuple[float, float, float]
    ) -> float:
        """Find normalized parameter t of nearest point on spline.

        Corresponds to vtable+0x40, function 0x1402d4ff0.

        Args:
            query: Query point in world coordinates

        Returns:
            Normalized parameter t in [0, 1]
        """
        best_dist = float('inf')
        best_t = 0.0

        for i, (a, b) in enumerate(zip(self.sampled_points, self.sampled_points[1:])):
            ab = vec3_sub(b, a)
            ab2 = vec3_dot(ab, ab)

            if ab2 <= 1e-6:
                dist = vec3_length(vec3_sub(query, a))
                t = 0.0
            else:
                local_t = clamp(vec3_dot(vec3_sub(query, a), ab) / ab2, 0.0, 1.0)
                closest = (
                    a[0] + ab[0] * local_t,
                    a[1] + ab[1] * local_t,
                    a[2] + ab[2] * local_t
                )
                dist = vec3_length(vec3_sub(query, closest))
                t = (self.accum[i] + self.seg_lengths[i] * local_t) / self.total_length

            if dist < best_dist:
                best_dist = dist
                best_t = t

        return best_t

    def find_nearest_parameter_with_distance(
        self,
        query: tuple[float, float, float]
    ) -> tuple[float, float]:
        """Find normalized parameter t and distance of nearest point.

        Args:
            query: Query point in world coordinates

        Returns:
            (t, distance) tuple
        """
        best_dist = float('inf')
        best_t = 0.0

        for i, (a, b) in enumerate(zip(self.sampled_points, self.sampled_points[1:])):
            ab = vec3_sub(b, a)
            ab2 = vec3_dot(ab, ab)

            if ab2 <= 1e-6:
                dist = vec3_length(vec3_sub(query, a))
                t = 0.0
            else:
                local_t = clamp(vec3_dot(vec3_sub(query, a), ab) / ab2, 0.0, 1.0)
                closest = (
                    a[0] + ab[0] * local_t,
                    a[1] + ab[1] * local_t,
                    a[2] + ab[2] * local_t
                )
                dist = vec3_length(vec3_sub(query, closest))
                t = (self.accum[i] + self.seg_lengths[i] * local_t) / self.total_length

            if dist < best_dist:
                best_dist = dist
                best_t = t

        return best_t, best_dist

    # ========================================================================
    # vtable+0x70 -> 0x1414f3b30: Get parameter interval
    # ========================================================================

    def get_parameter_interval_0x70_1414f3b30(
        self,
        query: tuple[float, float, float],
        radius: float,
        sample_count: int = 5
    ) -> tuple[float, float] | None:
        """Get parameter interval where spline is within radius of query.

        Corresponds to vtable+0x70, function 0x1414f3b30.

        C++ implementation:
            fVar5 = (radius * 2) / total_length         // window
            fVar2 = nearest_t - fVar5                    // start
            fVar6 = fVar5 * 2 + fVar2 + fVar5/sample_count * 0.5  // end
            step = fVar5 / sample_count

            for t in [start, end):
                point = sample(t)
                if distance(point, query) < radius:
                    record hit

            return [first_hit, last_hit]  or [-1, -1] if no hit

        Args:
            query: Query point in world coordinates
            radius: Effective radius (query_radius + tube_radius for splinetube)
            sample_count: Number of samples per window (default 5)

        Returns:
            (lower, upper) parameter interval in [0, 1], or None if no intersection
        """
        if radius <= DAT_142d7fbe8:
            return None

        if self.total_length <= 1e-6 or not self.sampled_points:
            return None

        # Window = 2 * radius / total_length
        window = (radius + radius) / self.total_length

        # Find nearest parameter
        nearest_t = self.find_nearest_parameter_0x40_1402d4ff0(query)

        # Scan range
        start = nearest_t - window
        end = window + window + start + (window / sample_count) * DAT_142d7ff50

        # Scan for hits
        first_hit: float | None = None
        last_hit: float | None = None

        step = window / sample_count
        t = start

        while t < end:
            # Sample point at t
            point = self.sample_0x08_1402d55c0(clamp(t, 0.0, 1.0))

            # Check distance
            diff = vec3_sub(point, query)
            dist_sq = vec3_dot(diff, diff)

            if dist_sq < radius * radius:
                hit_t = clamp(t, 0.0, 1.0)
                if first_hit is None:
                    first_hit = hit_t
                last_hit = hit_t

            t += step

        if first_hit is None or last_hit is None:
            return None

        return (first_hit, last_hit)

    # ========================================================================
    # Build from sampled points
    # ========================================================================

    def build_from_points(self, points: list[tuple[float, float, float]]) -> None:
        """Build spline from sampled points.

        Args:
            points: List of sampled points on the spline
        """
        self.sampled_points = points
        self.seg_lengths = []
        self.accum = [0.0]

        total = 0.0
        for a, b in zip(points, points[1:]):
            seg_len = vec3_length(vec3_sub(b, a))
            self.seg_lengths.append(seg_len)
            total += seg_len
            self.accum.append(total)

        self.total_length = total