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


def _build_delivery_ships(projects: List[Dict[str, Any]], component_to_ware: dict, ware_index: dict) -> List[Dict[str, Any]]:
    """Build top-level deliveryShips list: deduplicated {macro, nameId, buildDuration}."""
    seen: Dict[str, Dict[str, Any]] = {}
    for proj in projects:
        for d in proj.get("deliveries", []):
            macro = d.get("macro", "")
            if macro in seen:
                continue
            bd = d.get("buildDuration", 0)
            entry: Dict[str, Any] = {"macro": macro, "buildDuration": bd}
            ware_id = component_to_ware.get(macro)
            if ware_id:
                ware_info = ware_index.get(ware_id)
                if ware_info and ware_info.get("nameId"):
                    entry["nameId"] = ware_info["nameId"]
            seen[macro] = entry
    return sorted(seen.values(), key=lambda x: x["macro"])


def _compute_actual_ware_amounts(projects: List[Dict[str, Any]], wares_data: List[Dict[str, Any]]) -> None:
    """Inject actualAmount into resources.wares using formula:
       scale = floor(price / sum(ware.amount * maxPrice(ware)))
       actualAmount = ware.amount * scale
    """
    max_price_map: Dict[str, int] = {
        w["id"]: w.get("maxPrice", 0)
        for w in wares_data if isinstance(w, dict) and "id" in w
    }
    for proj in projects:
        res = proj.get("resources")
        if not res or not res.get("wares"):
            continue
        price = res.get("price", 0)
        if price <= 0:
            continue
        bundle = 0
        for w in res["wares"]:
            mp = max_price_map.get(w.get("ware", ""))
            if mp is not None:
                bundle += w.get("amount", 0) * mp
        if bundle <= 0:
            continue
        scale = price // bundle
        for w in res["wares"]:
            w["actualAmount"] = w.get("amount", 0) * scale


def _build_library_descriptions(
    projects: List[Dict[str, Any]],
    ware_index: dict,
    needed_raw_names: set,
) -> None:
    """Append structured descriptions for payout, chance, and research fields."""
    for proj in projects:
        descs = proj.get("descriptions") or []

        res = proj.get("resources", {})
        payout = res.get("payout")
        pricescale = res.get("pricescale")
        max_price = res.get("maxPrice")

        if payout:
            item: Dict[str, Any] = {"type": "payout", "amount": payout, "price": res.get("price", 0)}
            if pricescale and pricescale != "absolute":
                item["pricescale"] = pricescale
            if max_price:
                item["maxPrice"] = max_price
            descs.append(item)

        chance = proj.get("chance", 100)
        if chance < 100:
            descs.append({"type": "chance", "value": chance})

        research_ware_id = proj.get("research")
        if research_ware_id:
            research_item: Dict[str, Any] = {"type": "research", "id": research_ware_id}
            ware_info = ware_index.get(research_ware_id)
            if ware_info and ware_info.get("nameId"):
                nid = ware_info["nameId"]
                research_item["nameId"] = nid
                needed_raw_names.add(nid)
            descs.append(research_item)

        if descs:
            proj["descriptions"] = descs


def build_terraforming_data(
    raw_path: str,
    component_to_ware: dict,
    ware_index: dict,
    wares_data: List[Dict[str, Any]],
    i18n_collector: set | None = None,
) -> Dict[str, Any] | None:
    """Core logic: parse terraforming XML → data dict. Shared by process_terraforming and run.py.
    
    Returns None on error, or dict with stats/projectGroups/projects/clusters/deliveryShips.
    i18n_collector: optional set to collect nameIds into (for full i18n pipeline).
    """
    if i18n_collector is None:
        i18n_collector = set()

    library_path = os.path.join(raw_path, "libraries", "terraforming", "final.xml")
    md_path = os.path.join(raw_path, "md", "terraforming", "final.xml")

    if not os.path.exists(library_path):
        return None

    lib_tree = ET.parse(library_path)
    lib_root = lib_tree.getroot()

    stats = parse_stats(lib_root)
    project_groups = parse_project_groups(lib_root)
    projects, lib_name_ids = parse_projects(lib_root)

    _compute_actual_ware_amounts(projects, wares_data)
    delivery_ships = _build_delivery_ships(projects, component_to_ware, ware_index)

    for proj in projects:
        for d in proj.get("deliveries", []):
            d.pop("buildDuration", None)

    for ds in delivery_ships:
        nid = ds.get("nameId")
        if nid:
            i18n_collector.add(nid)

    for nid in lib_name_ids:
        if nid:
            i18n_collector.add(nid)

    clusters: List[Dict[str, Any]] = []
    predecessors_map: Dict[str, List[Dict[str, Any]]] = {}
    project_descriptions: Dict[str, List[Dict[str, Any]]] = {}

    if os.path.exists(md_path):
        try:
            md_tree = ET.parse(md_path)
            md_root = md_tree.getroot()
            clusters, predecessors_map, project_descriptions = parse_md(md_root)
        except Exception as e:
            raise e

    clusters = [c for c in clusters if len(c.get("projectIds", [])) > 0]

    cluster_name_map = _load_cluster_name_ids(raw_path)

    md_i18n_keys = resolve_cluster_objective_texts(clusters, cluster_name_map)
    for key in md_i18n_keys:
        if key:
            i18n_collector.add(key)
    for name_id in cluster_name_map.values():
        if name_id:
            i18n_collector.add(name_id)

    for proj in projects:
        pid = proj["id"]
        if pid in predecessors_map:
            proj["predecessors"] = predecessors_map[pid]

    for proj in projects:
        pid = proj["id"]
        if pid in project_descriptions:
            proj["descriptions"] = project_descriptions[pid]

    _build_library_descriptions(projects, ware_index, i18n_collector)

    for proj in projects:
        preds = proj.get("predecessors")
        if not preds:
            continue
        resolved = []
        for p in preds:
            if p.get("ref") == "$PilotTrainingCourseProject":
                resolved.append({**p, "ref": "trn_pilot"})
            else:
                resolved.append(p)
        proj["predecessors"] = resolved

    seen_predecessors: Dict[str, List[Dict[str, Any]]] = {}
    for proj in projects:
        pid = proj["id"]
        if pid in seen_predecessors and proj.get("predecessors"):
            pass
        elif proj.get("predecessors"):
            seen_predecessors[pid] = proj["predecessors"]

    for s in stats:
        if s.get("nameId"):
            i18n_collector.add(s["nameId"])
        if s.get("inactiveTextId"):
            i18n_collector.add(s["inactiveTextId"])
        for r in s.get("ranges", []):
            if r.get("descriptionId"):
                i18n_collector.add(r["descriptionId"])

    for pg in project_groups:
        if pg.get("nameId"):
            i18n_collector.add(pg["nameId"])

    return {
        "stats": stats,
        "projectGroups": project_groups,
        "projects": projects,
        "clusters": clusters,
        "deliveryShips": delivery_ships,
    }


def process_terraforming(loader: Any) -> None:
    """Parse terraforming XML files and attach data to loader."""
    base_path = loader.raw_path
    if not os.path.exists(os.path.join(base_path, "libraries", "terraforming", "final.xml")):
        print("   ⚠️ 警告: 找不到 terraforming library 文件: " + base_path)
        loader.terraforming_data = None
        return

    try:
        loader.terraforming_data = build_terraforming_data(
            raw_path=base_path,
            component_to_ware=getattr(loader, 'component_to_ware', {}),
            ware_index=getattr(loader, 'ware_index', {}),
            wares_data=getattr(loader, 'wares_data', []),
            i18n_collector=loader.needed_raw_names,
        )
    except Exception as e:
        print(f"   ❌ Terraforming XML Error: {e}")
        loader.terraforming_data = None

    if loader.terraforming_data:
        d = loader.terraforming_data
        print(f"   ✅ 解析 terraforming: {len(d['stats'])} stats, {len(d['projectGroups'])} groups, "
              f"{len(d['projects'])} projects, {len(d['clusters'])} clusters")


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
