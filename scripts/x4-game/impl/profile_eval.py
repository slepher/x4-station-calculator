"""Profile evaluation functions - reverse engineered from X4.exe.

FUN_1414ed970: Profile average evaluator over an interval.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING


@dataclass
class ProfilePoint:
    """Control point for a profile curve.

    Corresponds to C++ profile control point structure.
    """
    position: float  # x-coordinate in [0, 1]
    value: float     # y-value


def eval_profile_avg_1414ed970(
    profile: list[ProfilePoint],
    interval: tuple[float, float],
) -> float:
    """Evaluate average profile value over an interval using trapezoidal integration.

    Corresponds to vtable slot function, FUN_1414ed970.

    This function computes the average value of a piecewise linear profile
    over the given interval [lower, upper].

    C++ implementation details:
    - Collects all breakpoints within the interval (profile nodes + interval boundaries)
    - Performs trapezoidal integration over each segment
    - Returns the average (total area / interval width)

    Args:
        profile: List of ProfilePoint defining the piecewise linear curve.
                 Points should be sorted by position.
        interval: (lower, upper) bounds in [0, 1]

    Returns:
        Average profile value over the interval
    """
    lower, upper = interval

    # Handle degenerate interval (zero width)
    # C++ returns 0.0 for zero-width intervals because area / 0 is undefined
    if upper <= lower:
        return 0.0

    # Collect all x-coordinates where we need to evaluate
    # This includes: interval boundaries and profile nodes within the interval
    xs: list[float] = [lower, upper]

    for point in profile:
        if lower < point.position < upper:
            xs.append(point.position)

    xs.sort()

    # Trapezoidal integration
    area = 0.0
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        y0 = _eval_profile_at(profile, x0)
        y1 = _eval_profile_at(profile, x1)
        area += (y0 + y1) * 0.5 * (x1 - x0)

    return area / (upper - lower)


def _eval_profile_at(profile: list[ProfilePoint], x: float) -> float:
    """Evaluate profile value at a single point using linear interpolation.

    Args:
        profile: Sorted list of ProfilePoint
        x: Position to evaluate

    Returns:
        Interpolated value at x
    """
    if not profile:
        return 1.0

    # Clamp to profile bounds
    if x <= profile[0].position:
        return profile[0].value
    if x >= profile[-1].position:
        return profile[-1].value

    # Find the segment containing x
    for i in range(len(profile) - 1):
        p0, p1 = profile[i], profile[i + 1]
        if p0.position <= x <= p1.position:
            # Linear interpolation
            t = (x - p0.position) / (p1.position - p0.position) if p1.position != p0.position else 0.0
            return p0.value + t * (p1.value - p0.value)

    return profile[-1].value


def eval_profile_max_1414ed700(
    profile: list[ProfilePoint],
    interval: tuple[float, float],
) -> float:
    """Evaluate maximum profile value over an interval.

    Corresponds to FUN_1414ed700.

    Args:
        profile: List of ProfilePoint defining the piecewise linear curve
        interval: (lower, upper) bounds in [0, 1]

    Returns:
        Maximum profile value over the interval
    """
    lower, upper = interval

    if upper <= lower:
        return _eval_profile_at(profile, lower)

    max_val = _eval_profile_at(profile, lower)
    max_val = max(max_val, _eval_profile_at(profile, upper))

    for point in profile:
        if lower <= point.position <= upper:
            max_val = max(max_val, point.value)

    return max_val