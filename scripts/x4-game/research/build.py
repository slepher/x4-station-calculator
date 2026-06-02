"""Parse research wares from wares.xml and build research.json data.

Exports process_research(loader) which attaches `loader.research_data`.
Also exports build_research_data() for standalone usage via run.py.
"""

import os
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from scripts.x4_data_processor import X4PrecisionLoader  # type: ignore


DEFAULT_SET: frozenset = frozenset({
    "research_high_mass_teleportation",
    "research_module_build",
    "research_module_defence",
    "research_module_dock",
    "research_module_habitation",
    "research_module_production",
    "research_module_storage",
    "research_module_venture",
    "research_mod_engine_mk1",
    "research_mod_engine_mk2",
    "research_mod_engine_mk3",
    "research_mod_shield_mk1",
    "research_mod_shield_mk2",
    "research_mod_shield_mk3",
    "research_mod_ship_mk1",
    "research_mod_ship_mk2",
    "research_mod_ship_mk3",
    "research_mod_weapon_mk1",
    "research_mod_weapon_mk2",
    "research_mod_weapon_mk3",
    "research_teleportation",
    "research_teleportation_range_01",
    "research_teleportation_range_02",
    "research_teleportation_range_03",
    "research_warp_hq_01",
    "research_warp_hq_02",
    "research_module_welfare_1",
    "research_module_welfare_2",
    "research_seta",
    "research_diplomacy_network",
})


NPC_NAME_ID = "{30201,2}"  # Boso Ta


UNLOCK_MAP: Dict[str, Dict[str, Any]] = {
    "research_agentslot_01":            {"key": "embassy"},
    "research_agentslot_02":            {"key": "embassy"},
    "research_equipment_xenon":         {"key": "xen_equipment", "params": {"itemWareId": "inv_quantum_data_shard"}},
    "research_interference_network":    {"key": "interference_network", "params": {"count": 2}},
    "research_xenon_crisis_01":         {"key": "xenon_crisis_01"},
    "research_xenon_crisis_02":         {"key": "xenon_crisis_02"},
    "research_condensate_sample":       {"key": "condensate_sample", "params": {"npcNameId": NPC_NAME_ID, "itemWareId": "inv_condensate_sample"}},
    "research_erlking_core":            {"key": "erlking", "params": {"shipWareId": "ship_pir_xl_battleship_01_a", "sectorMacro": "cluster_502_sector001_macro"}},
    "research_ship_ter_s_fighter_01":   {"key": "abandoned_ship", "params": {"sectorMacro": "cluster_31_sector001_macro", "shipWareId": "ship_ter_s_fighter_04_a"}},
    "research_ship_ter_m_corvette_01":  {"key": "abandoned_ship", "params": {"sectorMacro": "cluster_48_sector001_macro", "shipWareId": "ship_ter_m_corvette_02_a"}},
    "research_ship_ter_l_flagship_01":  {"key": "abandoned_ship", "params": {"sectorMacro": "cluster_715_sector001_macro", "shipWareId": "ship_ter_l_flagship_01_a"}},
    "research_ship_arg_s_racing_01":    {"key": "abandoned_ship", "params": {"sectorMacro": "cluster_713_sector001_macro", "shipWareId": "ship_arg_s_racer_01_a"}},
    "research_ship_tel_s_racing_01":    {"key": "abandoned_ship", "params": {"sectorMacro": "cluster_714_sector001_macro", "shipWareId": "ship_tel_s_racer_01_a"}},
    "research_ship_par_s_racing_01":    {"key": "abandoned_ship", "params": {"sectorMacro": "cluster_710_sector001_macro", "shipWareId": "ship_par_s_racer_01_a"}},
    "research_ship_gen_m_corvette_02":  {"key": "abandoned_ship", "params": {"shipWareId": "ship_gen_m_corvette_02"}},
}

SECTOR_NAMEIDS: Dict[str, str] = {
    "cluster_31_sector001_macro":  "{20004,310011}",
    "cluster_48_sector001_macro":  "{20004,480011}",
    "cluster_715_sector001_macro": "{20004,7150011}",
    "cluster_713_sector001_macro": "{20004,7130011}",
    "cluster_714_sector001_macro": "{20004,7140011}",
    "cluster_710_sector001_macro": "{20004,7100011}",
    "cluster_502_sector001_macro": "{20004,5020011}",
}


def _split_tags(tags_str: str) -> List[str]:
    return [t for t in tags_str.split() if t]


def _classify(ware_id: str, tags: List[str], research_time: int, cost: Dict[str, int]) -> str:
    is_hidden = "hidden" in tags
    is_missiononly = "missiononly" in tags
    if is_hidden or is_missiononly:
        if is_hidden and not is_missiononly:
            return "abandoned"
        return "mission_progress"
    if ware_id in DEFAULT_SET:
        if research_time == 0 and not cost:
            return "abandoned"
        return "default"
    return "conditional"


def build_research_data(
    raw_path: str,
    ware_dlc_tags: Dict[str, str],
    i18n_collector: set,
) -> List[Dict[str, Any]]:
    wares_path = os.path.join(raw_path, "libraries", "wares", "final.xml")
    if not os.path.exists(wares_path):
        return []

    tree = ET.parse(wares_path)
    root = tree.getroot()

    ware_nameid_map: Dict[str, str] = {}
    items: List[Dict[str, Any]] = []

    for ware in root.findall("ware"):
        w_id = ware.get("id", "")
        name_id = ware.get("name", "")
        if w_id and name_id:
            ware_nameid_map[w_id] = name_id

    for ware in root.findall("ware"):
        w_id = ware.get("id", "")
        if not w_id.startswith("research_"):
            continue
        transport = ware.get("transport", "")
        if transport != "research":
            continue

        name_id = ware.get("name", "")
        if name_id:
            i18n_collector.add(name_id)

        desc_id = ware.get("description", "")
        if desc_id:
            i18n_collector.add(desc_id)

        tags = _split_tags(ware.get("tags", ""))
        dlc_tag = ware_dlc_tags.get(w_id, "base")

        research_time = 0
        cost: Dict[str, int] = {}
        dependencies: List[str] = []

        research_elem = ware.find("research")
        if research_elem is not None:
            research_time = int(float(research_elem.get("time", "0")))

            primary = research_elem.find("primary")
            if primary is not None:
                for pw in primary.findall("ware"):
                    cost_ware = pw.get("ware", "")
                    cost_amount = int(float(pw.get("amount", "0")))
                    if cost_ware and cost_amount:
                        cost[cost_ware] = cost_amount

            inner_research = research_elem.find("research")
            if inner_research is not None:
                for dw in inner_research.findall("ware"):
                    dep_ware = dw.get("ware", "")
                    if dep_ware.startswith("research_") and dep_ware not in dependencies:
                        dependencies.append(dep_ware)

        category = _classify(w_id, tags, research_time, cost)

        item: Dict[str, Any] = {
            "id": w_id,
            "nameId": name_id,
            "name": name_id,
            "descriptionId": desc_id,
            "dlcTag": dlc_tag,
            "tags": tags,
            "category": category,
            "researchTime": research_time,
            "cost": cost,
            "dependencies": dependencies,
        }

        if category == "conditional":
            unlock = UNLOCK_MAP.get(w_id)
            if unlock:
                resolved_unlock = {"key": unlock["key"]}
                raw_params = unlock.get("params", {})
                resolved_params: Dict[str, Any] = {}
                if raw_params:
                    for pk, pv in raw_params.items():
                        resolved_params[pk] = pv
                        if pk == "shipWareId" and pv in ware_nameid_map:
                            resolved_params["shipNameId"] = ware_nameid_map[pv]
                        if pk == "itemWareId" and pv in ware_nameid_map:
                            resolved_params["itemNameId"] = ware_nameid_map[pv]
                        if pk == "sectorMacro" and pv in SECTOR_NAMEIDS:
                            resolved_params["sectorNameId"] = SECTOR_NAMEIDS[pv]
                if resolved_params:
                    resolved_unlock["params"] = resolved_params
                item["unlock"] = resolved_unlock

                if "npcNameId" in resolved_params:
                    i18n_collector.add(resolved_params["npcNameId"])
                if "shipNameId" in resolved_params:
                    i18n_collector.add(resolved_params["shipNameId"])
                if "itemNameId" in resolved_params:
                    i18n_collector.add(resolved_params["itemNameId"])
                if "sectorNameId" in resolved_params:
                    i18n_collector.add(resolved_params["sectorNameId"])

        items.append(item)

    return items


def process_research(loader: Any) -> None:
    base_path = loader.raw_path
    wares_path = os.path.join(base_path, "libraries", "wares", "final.xml")
    if not os.path.exists(wares_path):
        print("   ⚠️ 警告: 找不到 wares library 文件: " + base_path)
        loader.research_data = None
        return

    try:
        items = build_research_data(
            raw_path=base_path,
            ware_dlc_tags=getattr(loader, "ware_dlc_tags", {}),
            i18n_collector=loader.needed_raw_names,
        )
        loader.research_data = {"items": items}
    except Exception as e:
        print(f"   ❌ Research XML Error: {e}")
        loader.research_data = None

    if loader.research_data:
        d = loader.research_data
        categories: Dict[str, int] = {}
        for item in d["items"]:
            cat = item["category"]
            categories[cat] = categories.get(cat, 0) + 1
        cat_summary = ", ".join(f"{k}: {v}" for k, v in sorted(categories.items()))
        print(f"   ✅ 解析 research: {len(d['items'])} 个研究项 ({cat_summary})")
