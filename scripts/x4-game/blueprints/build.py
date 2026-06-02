"""Build blueprints.json from X4 game data XML (wares/final.xml + macro XMLs).

Output: { blueprints: [...], types: [...], classes: [...] }
"""

import os
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional


CLASS_NAMEIDS = {
    "connectionmodule": "{20104,59901}",
    "production": "{1001,2421}",
    "storage": "{1001,2422}",
    "defencemodule": "{1001,2424}",
    "habitation": "{1001,2451}",
    "dockarea": "{20104,79901}",
    "pier": "{20104,79801}",
    "buildmodule": "{1001,2439}",
    "radar": "{1001,1706}",
    "processingmodule": "{1001,9621}",
    "welfaremodule": "{1001,9620}",
    "ventureplatform": "{1001,2454}",
    "ship_s": "{1001,11000}",
    "ship_m": "{1001,11001}",
    "ship_l": "{1001,11002}",
    "ship_xl": "{1001,11003}",
    "engine": "{20109,15101}",
    "shieldgenerator": "{20109,15501}",
    "turret": "{1001,1319}",
    "weapon": "{20109,15301}",
    "drone": "{1001,8}",
    "consumable": "{1001,8003}",
    "missile": "{1001,1304}",
}

CLASS_TO_TYPE = {
    "connectionmodule": "module", "production": "module", "storage": "module",
    "defencemodule": "module", "habitation": "module", "dockarea": "module",
    "pier": "module", "buildmodule": "module", "radar": "module",
    "processingmodule": "module", "welfaremodule": "module", "ventureplatform": "module",
    "ship_s": "ship", "ship_m": "ship", "ship_l": "ship", "ship_xl": "ship",
    "engine": "equipment", "shieldgenerator": "equipment", "turret": "equipment",
    "weapon": "equipment", "drone": "equipment", "consumable": "equipment",
}

TYPES = [
    {"id": "module", "name": "", "nameId": "{1001,56}"},
    {"id": "ship", "name": "", "nameId": "{1001,6}"},
    {"id": "equipment", "name": "", "nameId": "{1001,7935}"},
]


def _resolve_class(
    component_ref: Optional[str],
    macro_class_map: Dict[str, str],
) -> str:
    if component_ref and component_ref in macro_class_map:
        return macro_class_map[component_ref]
    return ""


def _build_macro_class_map(raw_path: str, xml_filename: str) -> Dict[str, str]:
    path = os.path.join(raw_path, "libraries", xml_filename)
    result: Dict[str, str] = {}
    if not os.path.exists(path):
        return result
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag == "macro":
            name = elem.get("name")
            cls = elem.get("class", "")
            if name and cls:
                result[name] = cls
        elem.clear()
    return result


def build_blueprints_data(
    raw_path: str,
    i18n_collector: Optional[set] = None,
) -> Dict[str, Any]:
    wares_xml = os.path.join(raw_path, "libraries", "wares", "final.xml")

    module_class_map = _build_macro_class_map(raw_path, "module_macros.xml")
    ship_class_map = _build_macro_class_map(raw_path, "ship_macros.xml")
    equipment_class_map = _build_macro_class_map(raw_path, "equipment_macros.xml")
    macro_class_map = {**module_class_map, **ship_class_map, **equipment_class_map}

    items: List[Dict[str, Any]] = []

    for _, elem in ET.iterparse(wares_xml, events=("end",)):
        if elem.tag != "ware":
            continue

        ware_id = elem.get("id", "")
        name = elem.get("name", "")
        tags_str = elem.get("tags", "")

        tags = set(tags_str.split())
        if "noblueprint" in tags:
            elem.clear()
            continue
        if "module" in tags:
            item_type = "module"
        elif "ship" in tags:
            item_type = "ship"
        elif "equipment" in tags:
            item_type = "equipment"
        else:
            elem.clear()
            continue

        entry: Dict[str, Any] = {
            "id": ware_id,
            "name": "",
            "nameId": name,
            "type": item_type,
        }

        price_el = elem.find("price")
        if price_el is not None:
            avg = price_el.get("average")
            if avg:
                entry["price"] = float(avg)

        restriction = elem.find("restriction")
        if restriction is not None:
            licence = restriction.get("licence")
            if licence:
                entry["licence"] = licence

        owner = elem.find("owner")
        if owner is not None:
            faction = owner.get("faction")
            if faction:
                entry["factions"] = [faction]

        owners = elem.findall("owner")
        if owners:
            factions = []
            for ow in owners:
                fac = ow.get("faction")
                if fac:
                    factions.append(fac)
            if factions:
                entry["factions"] = factions

        comp = elem.find("component")
        comp_ref = comp.get("ref") if comp is not None else None
        cls = _resolve_class(comp_ref, macro_class_map)
        if item_type == "equipment" and cls in ("ship_xs", "ship_s"):
            cls = "drone"
        elif item_type == "equipment" and cls in ("mine", "satellite", "scanner", "countermeasure", "navbeacon", "resourceprobe"):
            cls = "consumable"
        elif cls == "missileturret":
            cls = "turret"
        elif cls == "missilelauncher":
            cls = "weapon"
        if cls:
            entry["class"] = cls

        if "missiononly" in tags:
            entry["missiononly"] = True
        if "noplayerblueprint" in tags:
            entry["noplayerblueprint"] = True

        if i18n_collector is not None:
            i18n_collector.add(name)

        items.append(entry)
        elem.clear()

    # Build classes array from unique (class, type) pairs in items
    seen_classes: Dict[str, str] = {}
    for item in items:
        cls_id = item.get("class")
        type_id = item.get("type")
        if cls_id and cls_id not in seen_classes:
            seen_classes[cls_id] = type_id

    class_entries: List[Dict[str, Any]] = []
    for cls_id, type_id in sorted(seen_classes.items()):
        ce: Dict[str, Any] = {"id": cls_id, "name": "", "nameId": "", "type": type_id}
        name_id = CLASS_NAMEIDS.get(cls_id)
        if name_id:
            ce["nameId"] = name_id
            if i18n_collector is not None:
                i18n_collector.add(name_id)
        class_entries.append(ce)

    for t in TYPES:
        if i18n_collector is not None and t["nameId"]:
            i18n_collector.add(t["nameId"])

    return {
        "blueprints": items,
        "types": TYPES,
        "classes": class_entries,
    }


def process_blueprints(loader: Any) -> None:
    from collections import Counter

    data = build_blueprints_data(
        raw_path=loader.raw_path,
        i18n_collector=loader.needed_raw_names,
    )
    loader.blueprints_data = data

    by_type = Counter(i["type"] for i in data["blueprints"])
    total = len(data["blueprints"])
    print(f"   ✅ 生成 {total} 条 blueprints 数据。")
    for t, c in by_type.most_common():
        print(f"      {t}: {c}")
    print(f"      types: {len(data['types'])}, classes: {len(data['classes'])}")
