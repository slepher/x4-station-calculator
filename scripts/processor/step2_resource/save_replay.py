"""存档资源提取模块 - 从 save_sample_data 提取真实资源数据。

处理存档 JSON 文件，筛选以 (0,0,0) 为中心的 15×15×3 方块，
聚合计算真实的 reserve 和 respawn 值。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from processor.utils.math_utils import round_significant

BLOCK_SIZE = 64000

X_MIN = -480000
X_MAX = 480000

Y_MIN = -64000
Y_MAX = 64000

Z_MIN = -480000
Z_MAX = 480000


def load_sector_save_data(save_dir: Path, sector_id: str) -> Optional[dict]:
    """根据 sector_id 加载对应存档文件。

    Args:
        save_dir: 存档数据目录
        sector_id: 星区 ID（如 Cluster_01_Sector001_macro）

    Returns:
        存档数据字典，或 None（文件不存在）
    """
    filename = f"{sector_id.lower()}.json"
    filepath = save_dir / filename

    if not filepath.exists():
        return None

    with filepath.open("r", encoding="utf-8") as f:
        return json.load(f)


def is_tile_in_range(tile: dict) -> bool:
    """检查方块坐标是否在筛选范围内。

    Args:
        tile: 方块数据，包含 x, y, z 字段

    Returns:
        True 如果在范围内
    """
    x = tile.get("x", 0)
    y = tile.get("y", 0)
    z = tile.get("z", 0)

    return X_MIN <= x <= X_MAX and Y_MIN <= y <= Y_MAX and Z_MIN <= z <= Z_MAX


def aggregate_tiles_for_ware(tiles: List[dict]) -> Tuple[int, float]:
    """聚合单个 ware 的所有方块数据。

    Args:
        tiles: 方块列表，每个包含 max 和 time 字段

    Returns:
        (reserve, respawn) 元组，reserve 为整数
    """
    reserve = 0
    respawn = 0.0

    for tile in tiles:
        if not is_tile_in_range(tile):
            continue

        max_val = tile.get("max", 0)
        time_val = tile.get("time", 0)

        if max_val <= 0:
            continue

        reserve += max_val

        if time_val > 0:
            respawn += max_val * 3600.0 / time_val

    return (reserve, respawn)


def calculate_save_resources_for_sector(save_data: dict) -> List[dict]:
    """从单个存档数据计算资源汇总。

    Args:
        save_data: 存档 JSON 数据，格式 {sector_id, ware: {wareName: [tiles]}}

    Returns:
        资源列表 [{ware, reserve, respawn}]
    """
    result: List[dict] = []

    ware_data = save_data.get("ware", {})
    if not ware_data:
        return result

    for ware_name, tiles in ware_data.items():
        if not tiles or not isinstance(tiles, list):
            continue

        reserve, respawn = aggregate_tiles_for_ware(tiles)

        if reserve <= 0:
            continue

        result.append({
            "ware": ware_name,
            "reserve": reserve,
            "respawn": round_significant(respawn, 3),
        })

    return result


def calculate_save_resources_all(
    save_dir: Path,
    sector_filter: Optional[str] = None,
) -> Dict[str, Dict[str, dict]]:
    """遍历所有存档文件，计算资源汇总。

    Args:
        save_dir: 存档数据目录
        sector_filter: 可选，仅处理指定星区

    Returns:
        {sector_id_lower: {ware: {reserve, respawn}}}
    """
    result: Dict[str, Dict[str, dict]] = {}

    if not save_dir.exists():
        return result

    for filepath in save_dir.glob("*.json"):
        filename = filepath.name

        if filename == "total.json":
            continue

        sector_id_from_file = filename.replace(".json", "")

        if sector_filter:
            if sector_id_from_file.lower() != sector_filter.lower():
                continue

        with filepath.open("r", encoding="utf-8") as f:
            save_data = json.load(f)

        sector_id = save_data.get("sector_id", sector_id_from_file)
        sector_id_lower = sector_id.lower()

        resources = calculate_save_resources_for_sector(save_data)

        if not resources:
            continue

        ware_map: Dict[str, dict] = {}
        for res in resources:
            ware = res.get("ware", "")
            if ware:
                ware_map[ware] = {
                    "reserve": res.get("reserve", 0),
                    "respawn": res.get("respawn", 0),
                }

        result[sector_id_lower] = ware_map

    return result


__all__ = [
    "load_sector_save_data",
    "is_tile_in_range",
    "aggregate_tiles_for_ware",
    "calculate_save_resources_for_sector",
    "calculate_save_resources_all",
]