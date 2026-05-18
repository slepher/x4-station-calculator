"""Map 数据输出管理器 - X4 Map Data Processor.

集中管理所有 Map 相关 JSON 输出文件的写入操作。
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


def _write_json(data: Any, output_path: str, indent: int = 2) -> None:
    """
    写入 JSON 文件的内部辅助函数。

    Args:
        data: 要写入的数据
        output_path: 输出文件路径（字符串）
        indent: JSON 缩进空格数，默认 2
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=indent), encoding="utf-8")


def write_regionyields(regionyields_rows: List[dict], output_path: str) -> None:
    """
    写入 regionyields JSON 文件。

    Args:
        regionyields_rows: regionyields 数据列表
        output_path: 输出文件路径
    """
    _write_json(regionyields_rows, output_path)


def write_factions(factions_rows: List[dict], output_path: str) -> None:
    """
    写入 factions JSON 文件。

    Args:
        factions_rows: factions 数据列表
        output_path: 输出文件路径
    """
    _write_json(factions_rows, output_path)


def write_regions(regions_rows: List[dict], output_path: str) -> None:
    """
    写入 regions JSON 文件。

    Args:
        regions_rows: regions 数据列表
        output_path: 输出文件路径
    """
    _write_json(regions_rows, output_path)


def write_resourceareas(resourceareas_rows: List[dict], output_path: str) -> None:
    """
    写入 resourceareas JSON 文件。

    Args:
        resourceareas_rows: resourceareas 数据列表
        output_path: 输出文件路径
    """
    _write_json(resourceareas_rows, output_path)


def write_regionyield_definitions(definitions: List[dict], output_path: str) -> None:
    """
    写入 regionyield_definitions JSON 文件。

    Args:
        definitions: regionyield definitions 数据列表
        output_path: 输出文件路径
    """
    _write_json(definitions, output_path)


def write_map_resources(payload: dict, output_path: str) -> None:
    """写入地图资源副文件 (map_resources.json)。"""
    _write_json(payload, output_path)


def write_map(payload: dict, output_path: str) -> None:
    """
    写入地图主文件 (maps.json)。

    Args:
        payload: 地图数据
        output_path: 输出文件路径
    """
    _write_json(payload, output_path)


def write_resourcearea_blocks(blocks_rows: List[dict], output_path: str) -> None:
    """
    写入 resourcearea_blocks JSON 文件。

    Args:
        blocks_rows: resourcearea blocks 数据列表
        output_path: 输出文件路径
    """
    _write_json(blocks_rows, output_path)


def write_all_map_outputs(
    regionyields_rows: Optional[List[dict]] = None,
    regionyields_output: Optional[str] = None,
    factions_rows: Optional[List[dict]] = None,
    factions_output: Optional[str] = None,
    regions_rows: Optional[List[dict]] = None,
    regions_output: Optional[str] = None,
    resourceareas_rows: Optional[List[dict]] = None,
    resourceareas_output: Optional[str] = None,
    regionyield_definitions: Optional[List[dict]] = None,
    regionyield_definitions_output: Optional[str] = None,
    map_payload: Optional[dict] = None,
    map_output: Optional[str] = None,
) -> Dict[str, int]:
    """
    批量写入所有 Map 输出文件。

    Args:
        regionyields_rows: regionyields 数据
        regionyields_output: regionyields 输出路径
        factions_rows: factions 数据
        factions_output: factions 输出路径
        regions_rows: regions 数据
        regions_output: regions 输出路径
        resourceareas_rows: resourceareas 数据
        resourceareas_output: resourceareas 输出路径
        regionyield_definitions: regionyield definitions 数据
        regionyield_definitions_output: regionyield definitions 输出路径
        map_payload: 地图主数据
        map_output: 地图主输出路径

    Returns:
        写入的文件数量统计
    """
    count = 0

    if regionyields_rows is not None and regionyields_output:
        write_regionyields(regionyields_rows, regionyields_output)
        count += 1

    if factions_rows is not None and factions_output:
        write_factions(factions_rows, factions_output)
        count += 1

    if regions_rows is not None and regions_output:
        write_regions(regions_rows, regions_output)
        count += 1

    if resourceareas_rows is not None and resourceareas_output:
        write_resourceareas(resourceareas_rows, resourceareas_output)
        count += 1

    if regionyield_definitions is not None and regionyield_definitions_output:
        write_regionyield_definitions(regionyield_definitions, regionyield_definitions_output)
        count += 1

    if map_payload is not None and map_output:
        write_map(map_payload, map_output)
        count += 1

    return {"files_written": count}
