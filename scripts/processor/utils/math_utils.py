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


def unit_vec(x: float, y: float) -> Tuple[float, float]:
    """计算单位向量。"""
    length = math.hypot(x, y)
    if length <= 1e-6:
        return (0.0, 0.0)
    return (x / length, y / length)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """RGB 转十六进制颜色。"""
    return f"#{r:02X}{g:02X}{b:02X}"
