"""Sector 资源汇总 - X4 Map Data Processor."""

from typing import Dict, List


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


def summarize_sector_resources(region_rows: List[dict]) -> List[dict]:
    """
    总结 sector 的资源产出，输出统一的 resources 格式。

    计算方式（与 9.0 统一）：
    - amount = sum(yield) - yield 已经是总量（density × volume_km3）
    - respawn = sum(respawn) - respawn 已经是每小时总回复量（respawn_density × volume_km3）
    """
    by_ware: Dict[str, dict] = {}
    for region in region_rows:
        for resource in region.get("resources", []):
            ware = str(resource.get("ware") or "").strip()
            if not ware:
                continue

            # yield 和 respawn 已经是总量
            yield_val = as_number(resource.get("yield"), 0.0)
            respawn_val = as_number(resource.get("respawn"), 0.0)

            entry = by_ware.setdefault(ware, {
                "ware": ware,
                "amount": 0.0,
                "respawn": 0.0,
            })
            entry["amount"] += yield_val
            entry["respawn"] += respawn_val

    summarized: List[dict] = []
    for ware, entry in sorted(by_ware.items()):
        summarized.append({
            "ware": ware,
            "amount": int(round(entry["amount"])),
            "respawn": int(round(entry["respawn"])),
        })
    return summarized
