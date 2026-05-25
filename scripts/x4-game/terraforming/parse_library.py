"""Parse stats, projectGroups, and projects from libraries/terraforming/final.xml."""

import xml.etree.ElementTree as ET
from typing import Tuple, List, Dict, Any, Optional


def parse_stats(root: ET.Element) -> List[Dict[str, Any]]:
    """Parse <stats> section into list of stat definitions with ranges."""
    stats = []
    for stat_elem in root.findall(".//stats/stat"):
        stat_id = stat_elem.get("id", "")
        if not stat_id:
            continue
        entry: Dict[str, Any] = {
            "id": stat_id,
            "nameId": stat_elem.get("name", ""),
            "default": _int_or(stat_elem.get("default"), 0),
            "dynamic": stat_elem.get("dynamic", "false") == "true",
            "icon": stat_elem.get("icon", ""),
            "inactiveTextId": stat_elem.get("inactivetext", ""),
        }
        ranges = []
        is_dynamic = entry["dynamic"]
        for range_elem in stat_elem.findall("range"):
            r = int(range_elem.get("r", 0))
            g = int(range_elem.get("g", 0))
            b = int(range_elem.get("b", 0))
            end_val = _int_or(range_elem.get("end"), 0)

            range_entry: Dict[str, Any] = {
                "end": end_val,
                "state": _int_or(range_elem.get("state"), 0),
                "rgb": f"#{r:02X}{g:02X}{b:02X}",
                "descriptionId": range_elem.get("description", ""),
            }
            habitable = range_elem.get("habitable")
            if habitable is not None:
                range_entry["habitable"] = habitable == "true"

            ranges.append(range_entry)

        if is_dynamic and ranges and ranges[0].get("end") != 0:
            ranges.insert(0, {
                "end": 0,
                "state": 0,
                "rgb": "#000000",
                "descriptionId": "",
            })

        next_start = 0
        for range_entry in ranges:
            range_entry["start"] = next_start
            next_start = _int_or(range_entry.get("end"), 0) + 1

        entry["ranges"] = ranges
        stats.append(entry)
    return stats


def parse_project_groups(root: ET.Element) -> List[Dict[str, str]]:
    """Parse <projectgroups> into list of {id, nameId}."""
    groups = []
    for pg_elem in root.findall(".//projectgroups/projectgroup"):
        pg_id = pg_elem.get("id", "")
        if pg_id:
            groups.append({
                "id": pg_id,
                "nameId": pg_elem.get("name", ""),
            })
    return groups


def parse_projects(root: ET.Element) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Parse <projects> into list of project definitions.

    Returns (projects, collected_name_ids).
    """
    projects = []
    collected_name_ids: List[str] = []

    def _add_name(name_id: str):
        if name_id:
            collected_name_ids.append(name_id)

    for proj_elem in root.findall(".//projects/project"):
        proj_id = proj_elem.get("id", "")
        if not proj_id:
            continue

        name_id = proj_elem.get("name", "")
        desc_id = proj_elem.get("description", "")
        _add_name(name_id)
        _add_name(desc_id)

        duration = _int_or(proj_elem.get("duration"))
        # repeatCooldown: null = one-time (attribute absent), 0 = infinitely repeatable, >0 = timed cooldown
        rcd = proj_elem.get("repeatcooldown")
        repeat_cooldown: int | None = None if rcd is None else _int_or(rcd, 0)
        research = proj_elem.get("research") or None

        entry: Dict[str, Any] = {
            "id": proj_id,
            "group": proj_elem.get("group", ""),
            "nameId": name_id,
            "descriptionId": desc_id,
            "duration": duration,
            "repeatCooldown": repeat_cooldown,
            "resilient": proj_elem.get("resilient") == "true",
            "chance": _int_or(proj_elem.get("chance"), 100),
            "version": proj_elem.get("version") or None,
            "research": research,
            "conditions": [],
            "effects": [],
            "sideEffects": [],
            "resources": {"price": 0, "wares": []},
            "deliveries": [],
            "rebates": [],
            "removedProjects": [],
            "blockedProjects": [],
            "blockedGroups": [],
            "predecessors": [],
        }

        # conditions
        cond_elem = proj_elem.find("conditions")
        if cond_elem is not None:
            for c in cond_elem.findall("condition"):
                entry["conditions"].append(_parse_stat_condition(c))

        # effects
        eff_elem = proj_elem.find("effects")
        if eff_elem is not None:
            for e in eff_elem.findall("effect"):
                entry["effects"].append(_parse_stat_effect(e))

        # sideEffects
        se_elem = proj_elem.find("sideeffects")
        if se_elem is not None:
            for se in se_elem.findall("sideeffect"):
                side_text = se.get("text", "")
                _add_name(side_text)
                entry["sideEffects"].append({
                    "chance": _int_or(se.get("chance"), 0),
                    "setback": _int_or(se.get("setback"), 0),
                    "project": se.get("project") or None,
                    "stat": se.get("stat") or None,
                    "change": _int_or(se.get("change")),
                    "beneficial": se.get("beneficial", "true") == "true",
                    "textId": side_text or None,
                })

        # resources
        res_elem = proj_elem.find("resources")
        if res_elem is not None:
            entry["resources"] = {
                "price": _int_or(res_elem.get("price"), 0),
                "wares": [],
            }
            ps = res_elem.get("pricescale")
            if ps is not None:
                entry["resources"]["pricescale"] = ps
            po = res_elem.get("payout")
            if po is not None:
                entry["resources"]["payout"] = _int_or(po)
            mw = res_elem.get("minwares")
            if mw is not None:
                entry["resources"]["minWares"] = _int_or(mw)
            xw = res_elem.get("maxwares")
            if xw is not None:
                entry["resources"]["maxWares"] = _int_or(xw)
            mp = res_elem.get("maxprice")
            if mp is not None:
                entry["resources"]["maxPrice"] = _int_or(mp)
            for w in res_elem.findall("ware"):
                entry["resources"]["wares"].append({
                    "ware": w.get("ware", ""),
                    "amount": _int_or(w.get("amount"), 0),
                })

        # deliveries
        for d in proj_elem.findall("deliveries/ship"):
            entry["deliveries"].append({
                "macro": d.get("macro", ""),
                "amount": _int_or(d.get("amount"), 0),
                "buildDuration": _int_or(d.get("buildduration"), 0),
            })

        # rebates
        for rb in proj_elem.findall("rebates/rebate"):
            entry["rebates"].append({
                "ware": rb.get("ware") or None,
                "wareGroup": rb.get("waregroup") or None,
                "value": _int_or(rb.get("value"), 0),
            })

        # removedProjects
        for rp in proj_elem.findall("removedprojects/project"):
            rp_id = rp.get("id", "")
            if rp_id:
                entry["removedProjects"].append(rp_id)

        # blockedProjects
        for bp in proj_elem.findall("blockedprojects/project"):
            bp_id = bp.get("id", "")
            if bp_id:
                entry["blockedProjects"].append(bp_id)

        # blockedGroups
        for bg in proj_elem.findall("blockedgroups/group"):
            bg_id = bg.get("id", "")
            if bg_id:
                entry["blockedGroups"].append(bg_id)

        projects.append(entry)

    return projects, collected_name_ids


def _parse_stat_condition(elem: ET.Element) -> Dict[str, Any]:
    cond: Dict[str, Any] = {"stat": elem.get("stat", "")}
    min_val = _int_or(elem.get("min"))
    max_val = _int_or(elem.get("max"))
    min_val2 = _int_or(elem.get("minvalue"))
    max_val2 = _int_or(elem.get("maxvalue"))
    if min_val is not None:
        cond["min"] = min_val
    if max_val is not None:
        cond["max"] = max_val
    if min_val2 is not None:
        cond["minvalue"] = min_val2
    if max_val2 is not None:
        cond["maxvalue"] = max_val2
    cond["usesStateBounds"] = "min" in cond or "max" in cond
    cond["usesValueBounds"] = "minvalue" in cond or "maxvalue" in cond
    return cond


def _parse_stat_effect(elem: ET.Element) -> Dict[str, Any]:
    eff: Dict[str, Any] = {"stat": elem.get("stat", "")}
    change = _int_or(elem.get("change"))
    value = _int_or(elem.get("value"))
    min_v = _int_or(elem.get("min"))
    max_v = _int_or(elem.get("max"))

    if change is not None:
        eff["change"] = change
    if value is not None:
        eff["value"] = value
    if min_v is not None:
        eff["min"] = min_v
    if max_v is not None:
        eff["max"] = max_v

    if "change" not in eff and "value" not in eff:
        eff["value"] = 0

    return eff


def _int_or(val: Optional[str], default: Optional[int] = None) -> Optional[int]:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default
