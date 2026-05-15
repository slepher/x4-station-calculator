"""Orchestrate parsing of terraforming data and build the final JSON structure.

Exports process_terraforming(loader) which attaches `loader.terraforming_data`.
"""

import os
import json
import xml.etree.ElementTree as ET
from typing import Any, List, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.x4_data_processor import X4PrecisionLoader  # type: ignore

from .parse_library import parse_stats, parse_project_groups, parse_projects
from .parse_md import parse_md, resolve_cluster_objective_texts


def process_terraforming(loader: Any) -> None:
    """Parse terraforming XML files and attach data to loader.

    Args:
        loader: X4PrecisionLoader instance with .raw_path and .needed_raw_names
    """
    base_path = loader.raw_path

    library_path = os.path.join(base_path, "libraries", "terraforming", "final.xml")
    md_path = os.path.join(base_path, "md", "terraforming", "final.xml")

    if not os.path.exists(library_path):
        print("   ⚠️ 警告: 找不到 terraforming library 文件: " + library_path)
        loader.terraforming_data = None
        return

    try:
        lib_tree = ET.parse(library_path)
        lib_root = lib_tree.getroot()

        stats = parse_stats(lib_root)
        project_groups = parse_project_groups(lib_root)
        projects, lib_name_ids = parse_projects(lib_root)

        # Collect nameIds from library
        for nid in lib_name_ids:
            if nid:
                loader.needed_raw_names.add(nid)

        # Parse MD for clusters and predecessors
        clusters: List[Dict[str, Any]] = []
        predecessors_map: Dict[str, List[Dict[str, Any]]] = {}

        if os.path.exists(md_path):
            try:
                md_tree = ET.parse(md_path)
                md_root = md_tree.getroot()
                clusters, predecessors_map = parse_md(md_root)
            except Exception as e:
                print(f"   ⚠️ 警告: MD terraforming 解析失败: {e}")

        # Load maps.json to resolve cluster nameIds
        cluster_name_map = _load_cluster_name_ids(base_path)

        # Resolve $Variable textIds in objectives → i18n source templates
        md_i18n_keys = resolve_cluster_objective_texts(clusters, cluster_name_map)
        for key in md_i18n_keys:
            if key:
                loader.needed_raw_names.add(key)
        # Also collect cluster/sector nameIds for i18n
        for name_id in cluster_name_map.values():
            if name_id:
                loader.needed_raw_names.add(name_id)

        # Merge predecessors into projects
        for proj in projects:
            pid = proj["id"]
            if pid in predecessors_map:
                proj["predecessors"] = predecessors_map[pid]

        # Ensure predecessor uniqueness (prefer first occurrence)
        seen_predecessors: Dict[str, List[Dict[str, Any]]] = {}
        for proj in projects:
            pid = proj["id"]
            if pid in seen_predecessors and proj.get("predecessors"):
                # Already has predecessors from earlier, don't overwrite
                pass
            elif proj.get("predecessors"):
                seen_predecessors[pid] = proj["predecessors"]

        # Collect stats nameIds
        for s in stats:
            if s.get("nameId"):
                loader.needed_raw_names.add(s["nameId"])
            if s.get("inactiveTextId"):
                loader.needed_raw_names.add(s["inactiveTextId"])
            for r in s.get("ranges", []):
                if r.get("descriptionId"):
                    loader.needed_raw_names.add(r["descriptionId"])

        # Collect projectGroups nameIds
        for pg in project_groups:
            if pg.get("nameId"):
                loader.needed_raw_names.add(pg["nameId"])

        loader.terraforming_data = {
            "stats": stats,
            "projectGroups": project_groups,
            "projects": projects,
            "clusters": clusters,
        }

        print(f"   ✅ 解析 terraforming: {len(stats)} stats, {len(project_groups)} groups, "
              f"{len(projects)} projects, {len(clusters)} clusters")

    except Exception as e:
        print(f"   ❌ Terraforming XML Error: {e}")
        loader.terraforming_data = None


def _load_cluster_name_ids(base_path: str) -> Dict[str, str]:
    """Load maps.json and build {macro_id: display_nameId} for location resolution.

    Rule: multi-sector cluster → cluster nameId; single-sector → sector nameId.
    Returns {macro_id: nameId} mapping.
    """
    alt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(base_path))),
                            "src", "assets", "x4_game_data",
                            os.path.basename(base_path), "data", "maps.json")
    for path in [alt_path]:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    maps_data = json.load(f)
                result: Dict[str, str] = {}
                clusters = maps_data.get("clusters", {})
                sectors_map = maps_data.get("sectors", {})
                for macro_id, cluster_info in clusters.items():
                    sector_list = cluster_info.get("sectors", [])
                    if len(sector_list) == 1:
                        # Single sector: use sector name
                        sector = sectors_map.get(sector_list[0], {})
                        name_id = sector.get("nameId", "")
                    else:
                        # Multi sector: use cluster name
                        name_id = cluster_info.get("nameId", "")
                    if name_id:
                        result[macro_id] = name_id
                return result
            except Exception:
                pass
    return {}
