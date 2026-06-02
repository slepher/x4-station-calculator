"""Faction data migration: parse factions/final.xml → factions dict.

Migrated from processor/step1_map/converter.py.
Enhanced with <licences> extraction per faction.
"""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from processor.utils.xml_utils import parse_xml
from processor.utils.data_utils import split_tags
from processor.utils.math_utils import as_float, rgb_to_hex


def load_color_map_from_xml(colors_xml_path: Path) -> Dict[str, str]:
    if not colors_xml_path.exists():
        return {}
    root = parse_xml(colors_xml_path)
    color_map: Dict[str, str] = {}
    for color_node in root.findall(".//colors/color[@id]"):
        color_id = (color_node.get("id") or "").strip()
        if not color_id:
            continue
        r = int(as_float(color_node.get("r"), 0.0))
        g = int(as_float(color_node.get("g"), 0.0))
        b = int(as_float(color_node.get("b"), 0.0))
        color_map[color_id] = rgb_to_hex(r, g, b)
    for mapping_node in root.findall(".//mappings/mapping[@id]"):
        mapping_id = (mapping_node.get("id") or "").strip()
        ref_id = (mapping_node.get("ref") or "").strip()
        if mapping_id and ref_id and ref_id in color_map:
            color_map[mapping_id] = color_map[ref_id]
    return color_map


def migrate_factions(
    factions_xml_path: Path,
    colors_xml_path: Path,
    i18n_collector: Optional[Set[str]] = None,
) -> Tuple[List[dict], Dict[str, dict]]:
    if not factions_xml_path.exists():
        return [], {}

    colors_by_name = load_color_map_from_xml(colors_xml_path)
    factions_root = parse_xml(factions_xml_path)
    rows: List[dict] = []
    by_id: Dict[str, dict] = {}

    for node in factions_root.findall("./faction[@id]"):
        faction_id = (node.get("id") or "").strip()
        if not faction_id:
            continue
        name_id = (node.get("name") or "").strip()
        name = ""
        tags = split_tags(node.get("tags"))
        color_node = node.find("./color")
        color_name = (color_node.get("ref") if color_node is not None else "") or ""
        color = colors_by_name.get(color_name, "#4b5563")

        licences: List[dict] = []
        licences_elem = node.find("licences")
        if licences_elem is not None:
            for l in licences_elem.findall("licence"):
                ltype = (l.get("type") or "").strip()
                lname_id = (l.get("name") or "").strip()
                entry = {"type": ltype, "nameId": lname_id, "name": ""}
                licences.append(entry)
                if i18n_collector is not None and lname_id:
                    i18n_collector.add(lname_id)

        item = {
            "id": faction_id,
            "name": name,
            "nameId": name_id,
            "tags": tags,
            "color_name": color_name,
            "color": color,
            "claimspace": "claimspace" in tags,
            "licences": licences,
        }
        rows.append(item)
        by_id[faction_id] = item

    rows.sort(key=lambda item: item["id"])
    return rows, by_id
