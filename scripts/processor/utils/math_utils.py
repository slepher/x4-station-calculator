"""数学工具函数 - X4 Map Data Processor."""

import math
from typing import Dict, Optional, Tuple

try:
    import xml.etree.ElementTree as ET
except ImportError:
    pass


def as_float(value: Optional[str], default: float = 0.0) -> float:
    """将值安全转换为 float。"""
    return float(value) if value is not None else default


def as_number(value, default: float = 0.0) -> float:
    """将值安全转换为 number。"""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value.strip()
        if raw:
            try:
                return float(raw)
            except ValueError:
                return default
    return default


def round_significant(value: float, sig_digits: int = 5) -> float:
    """
    四舍五入到指定有效数字。
    如果整数部分超过 sig_digits 位，则直接取整。
    """
    if value == 0:
        return 0
    abs_val = abs(value)
    int_digits = int(math.floor(math.log10(abs_val))) + 1
    if int_digits > sig_digits:
        return round(value)
    return round(value, sig_digits - int_digits)


def round_to_int(value: float) -> int:
    """四舍五入到整数。"""
    return round(value)


def round_sig(value: float, digits: int = 4) -> float:
    """四舍五入到指定有效数字（别名）。"""
    if value == 0 or not math.isfinite(value):
        return value
    return round(value, digits - 1 - int(math.floor(math.log10(abs(value)))))


def pos_from(parent) -> Dict[str, float]:
    """获取 2D 坐标 (x, z)，兼容旧代码。"""
    position = None
    if parent is not None:
        position = parent.find("./offset/position")
    if position is None:
        return {"x": 0.0, "z": 0.0}
    return {"x": as_float(position.get("x")), "z": as_float(position.get("z"))}


def pos3d_from(parent) -> Dict[str, float]:
    """获取 3D 坐标 (x, y, z)。"""
    position = None
    if parent is not None:
        position = parent.find("./offset/position")
    if position is None:
        return {"x": 0.0, "y": 0.0, "z": 0.0}
    return {
        "x": as_float(position.get("x"), 0.0),
        "y": as_float(position.get("y"), 0.0),
        "z": as_float(position.get("z"), 0.0),
    }


def quaternion_from(parent) -> Optional[Dict[str, float]]:
    """获取四元数旋转 (qx, qy, qz, qw)。"""
    quaternion = None
    if parent is not None:
        quaternion = parent.find("./offset/quaternion")
    if quaternion is None:
        return None
    return {
        "qx": as_float(quaternion.get("qx"), 0.0),
        "qy": as_float(quaternion.get("qy"), 0.0),
        "qz": as_float(quaternion.get("qz"), 0.0),
        "qw": as_float(quaternion.get("qw"), 1.0),
    }


def vec_add(left: Dict[str, float], right: Dict[str, float]) -> Dict[str, float]:
    """2D 向量加法 (x, z)。"""
    return {"x": left["x"] + right["x"], "z": left["z"] + right["z"]}


def vec_add_3d(left: Dict[str, float], right: Dict[str, float]) -> Dict[str, float]:
    """3D 向量加法。"""
    return {
        "x": left.get("x", 0.0) + right.get("x", 0.0),
        "y": left.get("y", 0.0) + right.get("y", 0.0),
        "z": left.get("z", 0.0) + right.get("z", 0.0),
    }


def cluster_world_to_axial(pos: Dict[str, float]) -> Dict[str, int]:
    """世界坐标转轴向坐标。"""
    q = round(pos["x"] / 15000000.0)
    r = round((pos["z"] - 8660000.0 * q) / 17320000.0)
    return {"q": int(q), "r": int(r)}


def axial_to_pixel_flat(q: int, r: int, size: float = 1.0) -> Dict[str, float]:
    """轴向坐标转像素坐标。"""
    return {
        "x": size * 1.5 * q,
        "y": size * math.sqrt(3.0) * (r + q / 2.0),
    }


def distance_3d(left: dict, right: dict) -> float:
    """计算 3D 距离。"""
    return math.sqrt(
        (as_number(left.get("x")) - as_number(right.get("x"))) ** 2
        + (as_number(left.get("y")) - as_number(right.get("y"))) ** 2
        + (as_number(left.get("z")) - as_number(right.get("z"))) ** 2
    )


def cubic_bezier_point_3d(p0: dict, p1: dict, p2: dict, p3: dict, t: float) -> Dict[str, float]:
    """计算三次贝塞尔曲线在 t∈[0,1] 的 3D 点。"""
    omt = 1.0 - t
    omt2 = omt * omt
    omt3 = omt2 * omt
    t2 = t * t
    t3 = t2 * t
    return {
        "x": (
            omt3 * as_number(p0.get("x"))
            + 3.0 * omt2 * t * as_number(p1.get("x"))
            + 3.0 * omt * t2 * as_number(p2.get("x"))
            + t3 * as_number(p3.get("x"))
        ),
        "y": (
            omt3 * as_number(p0.get("y"))
            + 3.0 * omt2 * t * as_number(p1.get("y"))
            + 3.0 * omt * t2 * as_number(p2.get("y"))
            + t3 * as_number(p3.get("y"))
        ),
        "z": (
            omt3 * as_number(p0.get("z"))
            + 3.0 * omt2 * t * as_number(p1.get("z"))
            + 3.0 * omt * t2 * as_number(p2.get("z"))
            + t3 * as_number(p3.get("z"))
        ),
    }


def spline_segment_length(left: dict, right: dict, samples: int = 32) -> float:
    """
    计算两个 spline 控制点之间的曲线长度。

    若缺少切线/控制长度，则退回折线距离。
    """
    left_out = as_number(left.get("outlength"), 0.0)
    right_in = as_number(right.get("inlength"), 0.0)
    left_has_tangent = any(key in left for key in ("tx", "ty", "tz"))
    right_has_tangent = any(key in right for key in ("tx", "ty", "tz"))
    if (left_out <= 0 and right_in <= 0) or (not left_has_tangent and not right_has_tangent):
        return distance_3d(left, right)

    p0 = {
        "x": as_number(left.get("x")),
        "y": as_number(left.get("y")),
        "z": as_number(left.get("z")),
    }
    p3 = {
        "x": as_number(right.get("x")),
        "y": as_number(right.get("y")),
        "z": as_number(right.get("z")),
    }
    p1 = {
        "x": p0["x"] + as_number(left.get("tx")) * left_out,
        "y": p0["y"] + as_number(left.get("ty")) * left_out,
        "z": p0["z"] + as_number(left.get("tz")) * left_out,
    }
    p2 = {
        "x": p3["x"] - as_number(right.get("tx")) * right_in,
        "y": p3["y"] - as_number(right.get("ty")) * right_in,
        "z": p3["z"] - as_number(right.get("tz")) * right_in,
    }

    total = 0.0
    prev = p0
    for step in range(1, max(2, samples) + 1):
        t = step / max(2, samples)
        current = cubic_bezier_point_3d(p0, p1, p2, p3, t)
        total += distance_3d(prev, current)
        prev = current
    return total


def compute_spline_curve_length(spline: list[dict], samples_per_segment: int = 32) -> float:
    """计算 spline 曲线总弧长。"""
    if len(spline) < 2:
        return 0.0
    total = 0.0
    for left, right in zip(spline, spline[1:]):
        total += spline_segment_length(left, right, samples=samples_per_segment)
    return total


def sample_spline_curve_points(spline: list[dict], samples_per_segment: int = 16) -> list[Dict[str, float]]:
    """
    将 spline 曲线采样成折线点列。

    返回包含首尾点在内的点序列；若缺少切线/控制长度则退回原始控制点折线。
    """
    if len(spline) < 2:
        return list(spline)

    sampled: list[Dict[str, float]] = []
    segment_samples = max(2, samples_per_segment)
    for index, (left, right) in enumerate(zip(spline, spline[1:])):
        left_out = as_number(left.get("outlength"), 0.0)
        right_in = as_number(right.get("inlength"), 0.0)
        left_has_tangent = any(key in left for key in ("tx", "ty", "tz"))
        right_has_tangent = any(key in right for key in ("tx", "ty", "tz"))

        if (left_out <= 0 and right_in <= 0) or (not left_has_tangent and not right_has_tangent):
            if index == 0:
                sampled.append(
                    {
                        "x": as_number(left.get("x")),
                        "y": as_number(left.get("y")),
                        "z": as_number(left.get("z")),
                    }
                )
            sampled.append(
                {
                    "x": as_number(right.get("x")),
                    "y": as_number(right.get("y")),
                    "z": as_number(right.get("z")),
                }
            )
            continue

        p0 = {
            "x": as_number(left.get("x")),
            "y": as_number(left.get("y")),
            "z": as_number(left.get("z")),
        }
        p3 = {
            "x": as_number(right.get("x")),
            "y": as_number(right.get("y")),
            "z": as_number(right.get("z")),
        }
        p1 = {
            "x": p0["x"] + as_number(left.get("tx")) * left_out,
            "y": p0["y"] + as_number(left.get("ty")) * left_out,
            "z": p0["z"] + as_number(left.get("tz")) * left_out,
        }
        p2 = {
            "x": p3["x"] - as_number(right.get("tx")) * right_in,
            "y": p3["y"] - as_number(right.get("ty")) * right_in,
            "z": p3["z"] - as_number(right.get("tz")) * right_in,
        }

        if index == 0:
            sampled.append(p0)
        for step in range(1, segment_samples + 1):
            t = step / segment_samples
            sampled.append(cubic_bezier_point_3d(p0, p1, p2, p3, t))

    return sampled


def unit_vec(x: float, y: float) -> Tuple[float, float]:
    """计算单位向量。"""
    length = math.hypot(x, y)
    if length <= 1e-6:
        return (0.0, 0.0)
    return (x / length, y / length)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """RGB 转十六进制颜色。"""
    return f"#{r:02X}{g:02X}{b:02X}"
