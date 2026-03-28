"""9.0+ 资源处理模块 - X4 Map Data Processor."""

import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import xml.etree.ElementTree as ET

from processor.shared.utils.math_utils import round_to_int

# 正则表达式模式
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
REGION_CONNECTION_RES = (
    re.compile(r"C(\d+)S(\d+)_", re.IGNORECASE),
    re.compile(r"Cluster(\d+)_Sector(\d+)_", re.IGNORECASE),
)
REGION_REF_RES = (
    re.compile(r"region_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
    re.compile(r"region(\d+)_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
)


def as_float(value: Optional[str], default: float = 0.0) -> float:
    """将值安全转换为 float。"""
    return float(value) if value is not None else default


def parse_xml(path: Path) -> ET.Element:
    """解析 XML 文件并返回根元素。"""
    tree = ET.parse(str(path))
    return tree.getroot()


def migrate_resourcearea_definitions(regionyields_xml_path: Path) -> Dict[str, dict]:
    """
    解析 9.0+ 版本的 regionyields_final.xml，提取 definition 节点。

    该版本使用 <definition> 元素定义资源区模板，而非旧版的 <resource><yield> 结构。

    Args:
        regionyields_xml_path: regionyields_final.xml 文件路径

    Returns:
        按 definition id 索引的定义字典
    """
    if not regionyields_xml_path.exists():
        return {}
    root = parse_xml(regionyields_xml_path)
    definitions: Dict[str, dict] = {}

    for def_node in root.findall("./definition[@id]"):
        def_id = (def_node.get("id") or "").strip()
        if not def_id:
            continue

        # 基础标识
        ware = (def_node.get("ware") or "").strip()
        tag = (def_node.get("tag") or "").strip()  # verylow/low/medium/high/veryhigh

        # 产能参数
        yield_val = as_float(def_node.get("yield"), 0.0)
        respawn_delay = as_float(def_node.get("respawndelay"), 0.0)  # 分钟

        # 展示参数
        rating = as_float(def_node.get("rating"), 0.0)
        scaneffect = (def_node.get("scaneffect") or "").strip()
        scaneffectintensity = as_float(def_node.get("scaneffectintensity"), 0.0)
        scaneffectcolor = (def_node.get("scaneffectcolor") or "").strip()

        # 类型系数：矿物用 objectyieldfactor，气体用 gatherspeedfactor
        objectyieldfactor = as_float(def_node.get("objectyieldfactor"), None)
        gatherspeedfactor = as_float(def_node.get("gatherspeedfactor"), None)

        # 尺寸参数：从 boundary/size/@r 读取半径
        radius = 0.0
        boundary_node = def_node.find("./boundary[@class='sphere']/size")
        if boundary_node is not None:
            radius = as_float(boundary_node.get("r"), 0.0)

        # 派生字段：从 id 命名中提取尺寸
        size = ""
        if "_tiny_" in def_id:
            size = "tiny"
        elif "_small_" in def_id:
            size = "small"
        elif "_medium_" in def_id:
            size = "medium"
        elif "_large_" in def_id:
            size = "large"

        # 派生字段：可持续产量/小时 = yield / respawnDelay * 60
        sustainable_yield_per_hour = 0.0
        if respawn_delay > 0:
            sustainable_yield_per_hour = yield_val / respawn_delay * 60.0

        definition: Dict[str, object] = {
            "id": def_id,
            "ware": ware,
            "tag": tag,
            "size": size,
            "radius": radius,
            "yield": yield_val,
            "respawnDelay": respawn_delay,
            "rating": rating,
            "sustainableYieldPerHour": sustainable_yield_per_hour,
        }

        # 可选字段
        if scaneffect:
            definition["scaneffect"] = scaneffect
        if scaneffectintensity > 0:
            definition["scaneffectintensity"] = scaneffectintensity
        if scaneffectcolor:
            definition["scaneffectcolor"] = scaneffectcolor
        if objectyieldfactor is not None:
            definition["objectyieldfactor"] = objectyieldfactor
        if gatherspeedfactor is not None:
            definition["gatherspeedfactor"] = gatherspeedfactor

        definitions[def_id] = definition

    return definitions


def migrate_sector_resourceareas(mapdefaults_xml_path: Path) -> Dict[str, List[dict]]:
    """
    解析 mapdefaults_final.xml 中各 sector 的 resourceareas 引用。

    Args:
        mapdefaults_xml_path: mapdefaults_final.xml 文件路径

    Returns:
        按 sector macro 索引的资源区引用列表
    """
    if not mapdefaults_xml_path.exists():
        return {}
    root = parse_xml(mapdefaults_xml_path)
    sector_resource_areas: Dict[str, List[dict]] = {}

    for dataset in root.findall("./dataset[@macro]"):
        macro = (dataset.get("macro") or "").strip().lower()
        if not macro:
            continue
        # 只处理 sector macro
        if not SECTOR_MACRO_RE.fullmatch(macro):
            continue

        resourceareas_node = dataset.find("./properties/resourceareas")
        if resourceareas_node is None:
            continue

        areas: List[dict] = []
        for area_node in resourceareas_node.findall("./resourcearea[@ref]"):
            ref = (area_node.get("ref") or "").strip()
            amount = as_float(area_node.get("amount"), 0.0)
            if ref:
                areas.append({
                    "ref": ref,
                    "amount": int(amount) if amount > 0 else 1,
                })

        if areas:
            sector_resource_areas[macro] = areas

    return sector_resource_areas


def build_sector_resource_summaries_from_resourceareas(
    sector_resource_areas: Dict[str, List[dict]],
    definitions: Dict[str, dict],
) -> Dict[str, List[dict]]:
    """
    从 resourceareas 数据聚合出 sector 级资源摘要，兼容现有 maps.json 的 sector.resources 结构。

    输出统一使用 reserve/respawn 字段：
    - reserve: 来自 definition.yield
    - respawn: 来自 yield / respawnDelay * 60

    Args:
        sector_resource_areas: sector 的资源区引用
        definitions: 资源区定义模板

    Returns:
        按 sector macro 索引的资源摘要列表
    """
    summaries: Dict[str, List[dict]] = {}

    for sector_macro, areas in sector_resource_areas.items():
        by_ware: Dict[str, dict] = {}

        for area in areas:
            ref = area.get("ref", "")
            amount = area.get("amount", 1)
            definition = definitions.get(ref, {})

            ware = definition.get("ware", "")
            if not ware:
                continue

            yield_val = as_float(definition.get("yield"), 0.0)
            respawn_delay = as_float(definition.get("respawnDelay"), 0.0)

            respawn = 0.0
            if respawn_delay > 0:
                respawn = yield_val * 60.0 / respawn_delay

            # 按 ware 聚合，reserve 和 respawn 需要乘以 amount
            entry = by_ware.setdefault(ware, {
                "ware": ware,
                "reserve": 0.0,
                "respawn": 0.0,
            })
            entry["reserve"] += yield_val * amount
            entry["respawn"] += respawn * amount

        # 转换为兼容格式
        resources: List[dict] = []
        for ware, entry in sorted(by_ware.items()):
            # rating 基于 respawn 计算
            respawn_val = entry["respawn"]
            if respawn_val < 30:
                rating = 1
            elif respawn_val < 100:
                rating = 2
            elif respawn_val < 300:
                rating = 3
            elif respawn_val < 1000:
                rating = 4
            else:
                rating = 5
            resources.append({
                "ware": ware,
                "reserve": round_to_int(entry["reserve"]),
                "respawn": round_to_int(entry["respawn"]),
                "rating": rating,
            })

        summaries[sector_macro] = resources

    return summaries


def build_resourceareas_json_payload(flat_rows: List[dict]) -> List[dict]:
    """
    将扁平的 resourceareas 数组转换为按 cluster_id + sector_id 分组的结构。

    Args:
        flat_rows: 扁平的 resourcearea 记录列表，每条包含 cluster_id, sector_id, resources 等字段

    Returns:
        分组后的数组，每组包含 cluster_id, sector_id, areas 三个字段
    """
    grouped: Dict[Tuple[str, str], List[dict]] = defaultdict(list)

    for row in flat_rows:
        key = (row.get("cluster_id", ""), row.get("sector_id", ""))
        # 移除 cluster_id 和 sector_id 后放入 areas
        area = {k: v for k, v in row.items() if k not in ("cluster_id", "sector_id")}
        grouped[key].append(area)

    result: List[dict] = []
    for (cluster_id, sector_id), areas in sorted(grouped.items()):
        result.append({
            "cluster_id": cluster_id,
            "sector_id": sector_id,
            "areas": areas,
        })
    return result


def resolve_sector_macro_from_region_connection(connection_name: str) -> Optional[str]:
    """从 region connection 名称解析 sector macro。"""
    for pattern in REGION_CONNECTION_RES:
        match = pattern.search(connection_name)
        if match is None:
            continue
        cluster_num = int(match.group(1))
        sector_num = int(match.group(2))
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None


def resolve_sector_macro_from_region_ref(region_ref: str) -> Optional[str]:
    """从 region ref 解析 sector macro。"""
    for pattern in REGION_REF_RES:
        match = pattern.search(region_ref)
        if match is None:
            continue
        groups = match.groups()
        if len(groups) == 3:
            cluster_num = int(groups[1])
            sector_num = int(groups[2])
        else:
            cluster_num = int(groups[0])
            sector_num = int(groups[1])
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None
