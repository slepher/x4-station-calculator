"""Step 2 Resource 共用函数模块.

提供资源计算共用的聚合、评级、falloff 计算等函数。
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from processor.shared.utils.math_utils import round_to_int


# =============================================================================
# Rating 计算
# =============================================================================

def calculate_rating(respawn: float, ware: str = "") -> int:
    """根据 respawn 值计算资源评级 (1-5 分)。

    Nividium 使用基础阈值，其他矿物阈值放大 100 倍。

    Nividium 评级标准：
    - 1 分: respawn < 100
    - 2 分: 100 ≤ respawn < 300
    - 3 分: 300 ≤ respawn < 1000
    - 4 分: 1000 ≤ respawn < 3000
    - 5 分: respawn ≥ 3000

    其他矿物（阈值 ×100）：
    - 1 分: respawn < 10000
    - 2 分: 10000 ≤ respawn < 30000
    - 3 分: 30000 ≤ respawn < 100000
    - 4 分: 100000 ≤ respawn < 300000
    - 5 分: respawn ≥ 300000

    Args:
        respawn: 每小时回复量
        ware: 资源类型（用于区分 nividium）

    Returns:
        评级 (1-5)
    """
    is_nividium = ware.lower() == "nividium"

    if is_nividium:
        threshold = respawn
    else:
        threshold = respawn / 100.0

    if threshold < 100:
        return 1
    elif threshold < 300:
        return 2
    elif threshold < 1000:
        return 3
    elif threshold < 3000:
        return 4
    else:
        return 5


# =============================================================================
# Falloff 因子计算
# =============================================================================

def calculate_falloff_factors(falloff: Optional[dict]) -> Tuple[float, float, float]:
    """从 falloff 对象计算一元因子。

    Args:
        falloff: falloff 定义字典，包含 lateral_factor 和 radial_factor

    Returns:
        (lateral_factor, radial_factor, total_factor)
    """
    if not falloff:
        return (1.0, 1.0, 1.0)

    lateral_factor = _as_number(falloff.get("lateral_factor"), 1.0)
    radial_factor = _as_number(falloff.get("radial_factor"), 1.0)
    return (lateral_factor, radial_factor, lateral_factor * radial_factor)


def _as_number(value, default: float = 0.0) -> float:
    """将值转换为数字，失败则返回默认值。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# =============================================================================
# Sector 资源聚合
# =============================================================================

def aggregate_sector_resources_from_resourceareas(
    resourceareas_rows: List[dict],
) -> Dict[str, List[dict]]:
    """从 resourceareas_rows 聚合出 sector.resources。

    输出字段：
    - reserve/respawn: 预留给存档真实值（初始为 0）
    - replay_reserve/replay_respawn: 逐格计算值
    - theoretical_reserve/theoretical_respawn: 理论估算值

    Args:
        resourceareas_rows: resourceareas 行数据列表

    Returns:
        按 sector_id 分组的资源聚合结果
    """
    result: Dict[str, List[dict]] = {}
    by_sector: Dict[str, Dict[str, dict]] = {}

    for area in resourceareas_rows:
        sector_id = area.get("sector_id", "")
        if not sector_id:
            continue

        amount = area.get("amount", 1)
        resources = area.get("resources", [])
        if not resources:
            continue

        sector_map = by_sector.setdefault(sector_id, {})
        for res in resources:
            ware = res.get("ware", "")
            if not ware:
                continue

            entry = sector_map.setdefault(ware, {
                "ware": ware,
                "reserve": 0.0,
                "respawn": 0.0,
                "replay_reserve": 0.0,
                "replay_respawn": 0.0,
                "theoretical_reserve": 0.0,
                "theoretical_respawn": 0.0,
            })

            # replay_reserve/replay_respawn 使用逐格计算值
            if "reserve" in res:
                entry["replay_reserve"] += res.get("reserve", 0) * amount

            if "respawn" in res:
                entry["replay_respawn"] += res.get("respawn", 0) * amount

            # theoretical_* 字段仅用于参考展示
            if "theoretical_reserve" in res:
                entry["theoretical_reserve"] += res.get("theoretical_reserve", 0)
            if "theoretical_respawn" in res:
                entry["theoretical_respawn"] += res.get("theoretical_respawn", 0)

    for sector_id, ware_map in by_sector.items():
        result[sector_id] = []
        for e in sorted(ware_map.values(), key=lambda x: x["ware"]):
            entry = {
                "ware": e["ware"],
                "reserve": round_to_int(e["reserve"]),
                "respawn": round_to_int(e["respawn"]),
                "replay_reserve": round_to_int(e["replay_reserve"]),
                "replay_respawn": round_to_int(e["replay_respawn"]),
                "rating": 0,
            }
            if e["theoretical_reserve"] != 0:
                entry["theoretical_reserve"] = round_to_int(e["theoretical_reserve"])
            if e["theoretical_respawn"] != 0:
                entry["theoretical_respawn"] = round_to_int(e["theoretical_respawn"])
            result[sector_id].append(entry)

    return result


# =============================================================================
# 坐标变换函数
# =============================================================================

def transform_position_to_local(
    position: dict,
    rotation: Optional[dict],
    world_coord: Tuple[float, float, float],
) -> Tuple[float, float, float]:
    """将世界坐标转换为相对于 region 的局部坐标。

    Args:
        position: region 的位置字典 {"x": ..., "y": ..., "z": ...}
        rotation: region 的旋转四元数 {"x": ..., "y": ..., "z": ..., "w": ...}
        world_coord: 世界坐标 (x, y, z)

    Returns:
        局部坐标 (x, y, z)
    """
    # 平移：减去 region 中心位置
    px = _as_number(position.get("x"), 0.0)
    py = _as_number(position.get("y"), 0.0)
    pz = _as_number(position.get("z"), 0.0)

    dx = world_coord[0] - px
    dy = world_coord[1] - py
    dz = world_coord[2] - pz

    # 如果没有旋转，直接返回平移后的坐标
    if not rotation:
        return (dx, dy, dz)

    # 旋转：应用四元数逆变换
    # 提取四元数分量
    qx = _as_number(rotation.get("x"), 0.0)
    qy = _as_number(rotation.get("y"), 0.0)
    qz = _as_number(rotation.get("z"), 0.0)
    qw = _as_number(rotation.get("w"), 1.0)

    # 检查是否为单位四元数（或接近单位四元数）
    # 如果是单位四元数 (0, 0, 0, 1)，则没有旋转
    if abs(qx) < 1e-10 and abs(qy) < 1e-10 and abs(qz) < 1e-10 and abs(qw - 1.0) < 1e-10:
        return (dx, dy, dz)

    # 应用旋转逆变换：使用四元数共轭
    q = (qx, qy, qz, qw)
    local_coord = rotate_vector_by_quaternion((dx, dy, dz), quaternion_conjugate(q))
    return local_coord


def quaternion_multiply(
    q1: Tuple[float, float, float, float],
    q2: Tuple[float, float, float, float],
) -> Tuple[float, float, float, float]:
    """四元数乘法。

    Args:
        q1: 第一个四元数 (x, y, z, w)
        q2: 第二个四元数 (x, y, z, w)

    Returns:
        乘积四元数 (x, y, z, w)
    """
    x1, y1, z1, w1 = q1
    x2, y2, z2, w2 = q2

    return (
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
    )


def quaternion_conjugate(q: Tuple[float, float, float, float]) -> Tuple[float, float, float, float]:
    """四元数共轭（用于求逆）。"""
    x, y, z, w = q
    return (-x, -y, -z, w)


def rotate_vector_by_quaternion(
    v: Tuple[float, float, float],
    q: Tuple[float, float, float, float],
) -> Tuple[float, float, float]:
    """用四元数旋转向量。

    Args:
        v: 向量 (x, y, z)
        q: 四元数 (x, y, z, w)

    Returns:
        旋转后的向量
    """
    # 将向量转换为纯四元数
    v_quat = (v[0], v[1], v[2], 0.0)
    q_conj = quaternion_conjugate(q)

    # q * v * q^-1
    result = quaternion_multiply(quaternion_multiply(q, v_quat), q_conj)
    return (result[0], result[1], result[2])


__all__ = [
    # Rating 计算
    "calculate_rating",
    # Falloff 因子计算
    "calculate_falloff_factors",
    # Sector 资源聚合
    "aggregate_sector_resources_from_resourceareas",
    # 坐标变换
    "transform_position_to_local",
    "quaternion_multiply",
    "quaternion_conjugate",
    "rotate_vector_by_quaternion",
]