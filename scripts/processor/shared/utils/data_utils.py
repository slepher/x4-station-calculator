"""数据转换工具 - X4 Map Data Processor."""

from typing import Dict, List, Optional, Tuple


def split_tags(tags: Optional[str]) -> List[str]:
    """分割标签字符串。"""
    if not tags:
        return []
    raw = tags.strip()
    # 去除包裹的方括号（如 "[defence]" -> "defence"）
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    return [item.strip() for item in raw.split() if item.strip()]


def parse_select_tags(tags: Optional[str]) -> List[str]:
    """解析选择标签。"""
    if not tags:
        return []
    raw = tags.strip()
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    import re
    parts = [item.strip() for item in re.split(r"[\s,]+", raw) if item.strip()]
    return parts


def station_type_priority(station_type: str) -> int:
    """站点类型优先级。"""
    return 1 if station_type in {"tradingstation", "shipyard"} else 0


def station_tag_priority(tags: List[str]) -> int:
    """站点标签优先级。"""
    preferred = {"tradingstation", "wharf", "shipyard", "equipmentdock"}
    return 1 if any(tag in preferred for tag in tags) else 0


def coerce_attr_value(value):
    """强制转换属性值。"""
    if value is None:
        return ""
    raw = value.strip()
    if raw == "":
        return ""
    try:
        if any(char in raw for char in (".", "e", "E")):
            return float(raw)
        return int(raw)
    except ValueError:
        return raw


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


def round_sig(value: float, digits: int = 4) -> float:
    """四舍五入到指定有效数字。"""
    import math
    if value == 0 or not math.isfinite(value):
        return value
    return round(value, digits - 1 - int(math.floor(math.log10(abs(value)))))


def classify_density_tier(ware: str, density: float) -> Tuple[str, int]:
    """分类密度层级。"""
    value = max(0.0, density)
    if ware == "nividium":
        thresholds = [0.1, 1.0, 10.0, 100.0, 1000.0]
    else:
        thresholds = [1.0, 10.0, 100.0, 1000.0, 10000.0]
    names = ["low", "midlow", "medium", "midhigh", "high"]
    for index in range(len(thresholds) - 1):
        if value < thresholds[index + 1]:
            return names[index], index + 1
    return names[-1], len(names)


def normalize_noise_bound(value: Optional[float], default: float) -> float:
    """标准化噪声边界。"""
    return min(1.0, max(0.0, default if value is None else float(value)))