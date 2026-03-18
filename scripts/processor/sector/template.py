"""Sector 模板位置计算 - X4 Map Data Processor."""

import itertools
import math
from typing import Dict, List, Tuple


def centered_local_positions(points: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
    """计算中心化的本地位置。"""
    if not points:
        return {}
    avg_x = sum(point["x"] for point in points.values()) / len(points)
    avg_z = sum(point["z"] for point in points.values()) / len(points)
    return {
        key: {"x": point["x"] - avg_x, "z": point["z"] - avg_z}
        for key, point in points.items()
    }


def unit_vec(x: float, y: float) -> Tuple[float, float]:
    """计算单位向量。"""
    length = math.hypot(x, y)
    if length <= 1e-6:
        return (0.0, 0.0)
    return (x / length, y / length)


def template_positions_ratio(sector_count: int, variant: int = 0) -> Dict[str, Dict[str, float]]:
    """模板位置比例。"""
    s = math.sqrt(3.0) / 4.0
    if sector_count == 1:
        return {"single": {"x": 0.0, "y": 0.0}}
    if sector_count == 2:
        templates = [
            {"upper": {"x": -0.25, "y": -s}, "lower": {"x": 0.25, "y": s}},
            {"upper": {"x": 0.25, "y": -s}, "lower": {"x": -0.25, "y": s}},
        ]
        return templates[variant % len(templates)]
    if sector_count == 3:
        templates = [
            {
                "left": {"x": -0.5, "y": 0.0},
                "center": {"x": 0.25, "y": s},
                "upper_right": {"x": 0.25, "y": -s},
            },
            {
                "upper_left": {"x": -0.25, "y": -s},
                "lower_left": {"x": -0.25, "y": s},
                "right": {"x": 0.5, "y": 0.0},
            },
        ]
        return templates[variant % len(templates)]
    raise ValueError(f"Unsupported sector count: {sector_count}")


def best_slot_assignment(local_positions: Dict[str, Dict[str, float]], slots: Dict[str, Dict[str, float]]) -> Dict[str, str]:
    """最佳槽位分配。"""
    centered = centered_local_positions(local_positions)
    actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
    slot_vectors = {slot: unit_vec(value["x"], value["y"]) for slot, value in slots.items()}
    slot_names = list(slots.keys())
    sector_names = list(local_positions.keys())
    best_score = None
    best_mapping: Dict[str, str] = {}
    for perm in itertools.permutations(sector_names, len(slot_names)):
        score = 0.0
        mapping: Dict[str, str] = {}
        for slot_name, sector_name in zip(slot_names, perm):
            ax, ay = actual_vectors[sector_name]
            sx, sy = slot_vectors[slot_name]
            score += (ax - sx) ** 2 + (ay - sy) ** 2
            mapping[sector_name] = slot_name
        if best_score is None or score < best_score:
            best_score = score
            best_mapping = mapping
    return best_mapping


def choose_sector_template(local_positions: Dict[str, Dict[str, float]]) -> Tuple[str, Dict[str, str], Dict[str, Dict[str, float]]]:
    """选择 sector 模板。"""
    names = list(local_positions.keys())
    count = len(names)
    if count == 1:
        slots = template_positions_ratio(1)
        return ("single", {names[0]: "single"}, slots)
    if count == 2:
        centered = centered_local_positions(local_positions)
        x_values = [point["x"] for point in centered.values()]
        x_span = max(x_values) - min(x_values) if x_values else 0.0
        best = None
        for variant in [0, 1]:
            slots = template_positions_ratio(2, variant)
            mapping = best_slot_assignment(local_positions, slots)
            score = 0.0
            actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
            for sector_name, slot_name in mapping.items():
                ax, ay = actual_vectors[sector_name]
                sx, sy = unit_vec(slots[slot_name]["x"], slots[slot_name]["y"])
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if x_span <= 1e-6:
                score += 0.0 if variant == 1 else 1e-3
            if best is None or score < best[0]:
                best = (score, variant, mapping, slots)
        assert best is not None
        return ("dual_b" if best[1] == 1 else "dual_a", best[2], best[3])
    if count == 3:
        best = None
        centered = centered_local_positions(local_positions)
        actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
        for variant in [0, 1]:
            slots = template_positions_ratio(3, variant)
            mapping = best_slot_assignment(local_positions, slots)
            score = 0.0
            for sector_name, slot_name in mapping.items():
                ax, ay = actual_vectors[sector_name]
                sx, sy = unit_vec(slots[slot_name]["x"], slots[slot_name]["y"])
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if best is None or score < best[0]:
                best = (score, variant, mapping, slots)
        assert best is not None
        return ("triple_b" if best[1] == 1 else "triple_a", best[2], best[3])
    return (f"multi_{count}", {}, {})


def sector_radius_ratio(sector_count: int) -> float:
    """sector 半径比例。"""
    if sector_count <= 1:
        return 1.0
    if sector_count in (2, 3):
        return 0.5
    return 0.36
