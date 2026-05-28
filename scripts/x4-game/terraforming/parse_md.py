"""Parse clusters and project dependencies from md/terraforming/final.xml."""

import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Set, Optional, Tuple


def parse_md(root: ET.Element) -> Tuple[List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]], Dict[str, List[Dict[str, Any]]]]:
    """Parse MD terraforming XML for cluster initializations and project predecessors.

    Returns (clusters, predecessors_map, project_descriptions).
    predecessors_map: {project_id: [{ref: str, type: "project"|"group", any: bool}]}
    project_descriptions: {project_id: [{type: str, ...}]}
    """
    clusters = []
    predecessors_map: Dict[str, List[Dict[str, Any]]] = {}

    # Find top-level terraforming cues under the Start cue's <cues>
    # Structure: mdscript/cues/cue[name="Start"]/cues/cue[name="Terraforming_<X>"]
    # First pass: collect all predecessors from ALL add_terraforming_project in the file
    global_predecessors = _collect_all_predecessors(root)
    
    for cue in root.findall(".//cue[@name='Start']/cues/cue"):
        name = cue.get("name", "")
        # Match Terraforming_<Name> but not debug cues and not sub-cues
        if not name.startswith("Terraforming_") or name.startswith("DEBUG_"):
            continue

        # Exclude sub-cues: they don't have find_cluster / initialise_terraforming
        actions = cue.find("actions")
        if actions is None:
            continue
        # Must have find_cluster or initialise_terraforming to be a cluster-level cue
        if actions.find(".//find_cluster") is None and actions.find(".//initialise_terraforming") is None:
            continue

        cluster_id = name.replace("Terraforming_", "")
        if not cluster_id:
            continue

        actions = cue.find("actions")
        if actions is None:
            continue

        cluster = _parse_cluster_actions(cue, cluster_id, predecessors_map)
        if cluster:
            cluster["objectives"] = _extract_objectives(cue)
            cluster["variableTexts"] = _extract_variable_texts(cue)
            cluster_rewards = _extract_cluster_rewards(cue)
            if cluster_rewards["factionRewards"]:
                cluster["factionRewards"] = cluster_rewards["factionRewards"]
            if cluster_rewards["rewardNameIds"]:
                cluster["rewardNameIds"] = cluster_rewards["rewardNameIds"]
            if cluster_rewards["blueprintWares"]:
                cluster["blueprintWares"] = cluster_rewards["blueprintWares"]
            if cluster_rewards["npcNameIds"]:
                cluster["npcNameIds"] = cluster_rewards["npcNameIds"]
            clusters.append(cluster)

    # Merge global predecessors into the map (library-level predecessors)
    for proj_id, preds in global_predecessors.items():
        if proj_id not in predecessors_map:
            predecessors_map[proj_id] = preds

    # Extract human-readable effect descriptions from event_terraforming_project_succeeded
    project_descriptions = _extract_project_descriptions(root)

    return clusters, predecessors_map, project_descriptions


def _collect_all_predecessors(root: ET.Element) -> Dict[str, List[Dict[str, Any]]]:
    """Scan the entire MD file for add_terraforming_project with predecessors.

    This captures predecessors defined inside library <actions> blocks,
    not just in cluster-specific cues.
    """
    result: Dict[str, List[Dict[str, Any]]] = {}
    for atp in root.iter("add_terraforming_project"):
        proj_id = _clean_xpath_str(atp.get("id", ""))
        if not proj_id:
            continue
        preds_elem = atp.find("predecessors")
        if preds_elem is not None:
            preds = _parse_predecessors(preds_elem)
            if preds and proj_id not in result:
                result[proj_id] = preds
    return result


def resolve_cluster_objective_texts(
    clusters: List[Dict[str, Any]],
    cluster_name_map: Dict[str, str] | None = None,
) -> List[str]:
    """Post-process clusters: resolve $Variable textIds in objectives to source templates.

    Also collects i18n source keys (like {1004,1090}) for the translation pipeline.
    Returns list of i18n source keys to add to needed_raw_names.
    """
    import re as _re

    _SECTOR_KNOWN_RE = _re.compile(r"\$Sector_(\w+)\.knownname")

    if cluster_name_map is None:
        cluster_name_map = {}
    i18n_keys: List[str] = []

    for cluster in clusters:
        objs = cluster.get("objectives", [])
        var_texts = cluster.get("variableTexts", {})

        # Filter: remove empty textId and duplicate steps
        seen_steps: set[int] = set()
        filtered: list[dict] = []
        for obj in objs:
            text_id = obj.get("textId", "")
            step = obj.get("step", 0)
            if not text_id:
                continue
            if step in seen_steps:
                continue
            seen_steps.add(step)
            filtered.append(obj)
        cluster["objectives"] = filtered

        for obj in filtered:
            text_id = obj.get("textId", "")
            if not text_id.startswith("$"):
                continue

            var_info = var_texts.get(text_id)
            if not var_info:
                continue

            source = var_info.get("source", "")
            replaces = var_info.get("replaces", [])

            # Resolve textId to source template
            obj["textId"] = source
            if source:
                i18n_keys.append(source)

            # Resolve known numeric values in replaces
            resolved_replaces = []
            for r in replaces:
                to_val = r.get("to", "")
                from_val = r.get("from", "")
                resolved_to = _resolve_replace_value(to_val, cluster, cluster_name_map)
                resolved_replaces.append({
                    "from": from_val,
                    "to": resolved_to,
                })
                # Detect sector-level relocate target
                if _SECTOR_KNOWN_RE.match(str(to_val)):
                    obj["relocateTarget"] = "sector"
            if resolved_replaces:
                obj["textReplaces"] = resolved_replaces

    return i18n_keys


def _resolve_replace_value(
    raw_value: str,
    cluster: Dict[str, Any],
    cluster_name_map: Dict[str, str],
) -> str:
    """Try to resolve a replace 'to' value.

    - Numeric values from cluster.values (e.g., housing target)
    - $Cluster_X.knownname → sector/cluster nameId from maps.json
    - $Sector_X.knownname → sector nameId from maps.json (single-sector clusters)
    - $HQName → fallback {20102,2011}
    """
    import re as _re

    known_values = cluster.get("values", {})

    # $Cluster_Xxx.knownname → resolve to cluster/sector nameId
    knownname_match = _re.match(r"\$Cluster_(\w+)\.knownname", raw_value)
    if knownname_match and cluster_name_map:
        macro = cluster.get("macro", "")
        macro_id = macro.replace("macro.", "", 1)
        sector_name_id = cluster_name_map.get(macro_id, "")
        if sector_name_id:
            return sector_name_id
        return raw_value

    # $Sector_Xxx.knownname → resolve to sector nameId
    sector_known_match = _re.match(r"\$Sector_(\w+)\.knownname", raw_value)
    if sector_known_match and cluster_name_map:
        macro = cluster.get("macro", "")
        macro_id = macro.replace("macro.", "", 1)
        sector_name_id = cluster_name_map.get(macro_id, "")
        if sector_name_id:
            return sector_name_id
        return raw_value

    # Sector_Xxx (e.g. Sector_MemoryOfProfit)
    sector_match = _re.match(r"Sector_(\w+)", raw_value)
    if sector_match and cluster_name_map:
        macro = cluster.get("macro", "")
        macro_id = macro.replace("macro.", "", 1)
        sector_name_id = cluster_name_map.get(macro_id, "")
        if sector_name_id:
            return sector_name_id
        return raw_value

    # $Variable → check known_values or fallback
    # Also handles '%,s'.[$Variable] format (XPath formatting)
    var_match = _re.match(r"(?:'[^']*'\.\[)?\$(\w+)\]?", raw_value)
    if var_match:
        var_name = var_match.group(1)
        known = known_values.get("$" + var_name)
        if known is not None:
            return known
        if var_name == "HQName":
            return "{20102,2011}"
        return raw_value

    return raw_value


_CLUSTER_NAME_RE = re.compile(r"\$Cluster_(\w+)")


def _parse_cluster_actions(
    cue: ET.Element,
    cluster_id: str,
    predecessors_map: Dict[str, List[Dict[str, Any]]],
) -> Optional[Dict[str, Any]]:
    """Parse a single cluster cue for initialization data."""
    actions = cue.find("actions")
    if actions is None:
        return None

    cluster: Dict[str, Any] = {
        "id": cluster_id,
        "macro": "",
        "partName": "",
        "initialStats": {},
        "projectIds": [],
        "values": {},
        "removedStats": [],
    }

    initial_stats: Dict[str, int] = {}
    project_ids: List[str] = []
    known_values: Dict[str, str] = {}
    removed_stats: Set[str] = set()

    def _process_element(elem: ET.Element):
        tag = elem.tag
        # find_cluster
        if tag == "find_cluster":
            macro = elem.get("macro", "")
            if macro:
                cluster["macro"] = macro
        # initialise_terraforming
        elif tag == "initialise_terraforming":
            part = elem.get("partname", "")
            if part:
                cluster["partName"] = part
        # set_terraforming_stat
        elif tag == "set_terraforming_stat":
            stat_id = _clean_xpath_str(elem.get("id", ""))
            value = _int_or(elem.get("value"))
            if stat_id and value is not None:
                initial_stats[stat_id] = value
                removed_stats.discard(stat_id)
        elif tag == "remove_terraforming_stat":
            stat_id = _clean_xpath_str(elem.get("id", ""))
            if stat_id:
                removed_stats.add(stat_id)
                initial_stats.pop(stat_id, None)
        # set_value (capture known variables like housing target)
        elif tag == "set_value":
            var_name = elem.get("name", "")
            exact = elem.get("exact", "")
            if var_name and exact:
                known_values[var_name] = exact
        # add_terraforming_project
        elif tag == "add_terraforming_project":
            proj_id = _clean_xpath_str(elem.get("id", ""))
            if proj_id and proj_id not in project_ids:
                project_ids.append(proj_id)
            # Extract predecessors
            preds_elem = elem.find("predecessors")
            if preds_elem is not None:
                preds = _parse_predecessors(preds_elem)
                if preds:
                    if proj_id not in predecessors_map:
                        predecessors_map[proj_id] = preds
        # add_terraforming_event
        elif tag == "add_terraforming_event":
            evt_id = _clean_xpath_str(elem.get("id", ""))
            if evt_id and evt_id not in project_ids:
                project_ids.append(evt_id)
        # do_if / do_elseif / do_else: recurse into children
        elif tag in ("do_if", "do_elseif", "do_else"):
            for child in elem:
                _process_element(child)
        # run_actions: expand library calls
        elif tag == "run_actions":
            _process_library_call(elem, project_ids, predecessors_map, cluster)

    for child in actions:
        _process_element(child)
    for patch in cue.findall("patch"):
        for child in patch:
            _process_element(child)

    cluster["initialStats"] = initial_stats
    cluster["projectIds"] = project_ids
    cluster["removedStats"] = sorted(removed_stats)
    # Merge values written directly to cluster["values"] by library expansion
    known_values.update({k: v for k, v in cluster.get("values", {}).items() if k not in known_values})
    cluster["values"] = known_values

    # Pass ignore params from SetupGeneralProjects call
    # They're accumulated in known_values during processing

    # Apply stat-dependent projects based on cluster's initial stats
    _add_stat_dependent_projects_static(cluster, predecessors_map)

    # Resolve $PilotTrainingCourseProject variable in predecessors
    pilot_course = cluster.get("values", {}).get("$PilotTrainingCourseProject", "trn_pilot")
    for proj_id in list(predecessors_map.keys()):
        if proj_id not in project_ids:
            continue
        resolved = []
        for p in predecessors_map[proj_id]:
            if p["ref"] == "$PilotTrainingCourseProject":
                resolved.append({**p, "ref": pilot_course})
            else:
                resolved.append(p)
        predecessors_map[proj_id] = resolved

    return cluster


def _extract_objectives(cue: ET.Element) -> List[Dict[str, Any]]:
    """Extract mission objectives from create_offer or update_mission sub-cues.

    Returns objectives list from update_mission (preferred) or create_offer (fallback).
    """
    offer_objs: List[Dict[str, Any]] = []
    mission_objs: List[Dict[str, Any]] = []

    for sub_cue in cue.iter("cue"):
        # Extract from create_offer/briefing/objective
        for offer in sub_cue.findall(".//create_offer"):
            briefing = offer.find("briefing")
            if briefing is not None:
                offer_objs.extend(_parse_briefing_objectives(briefing))

        # Extract from update_mission/briefing/objective
        for um in sub_cue.findall(".//update_mission"):
            briefing = um.find("briefing")
            if briefing is not None:
                mission_objs = _parse_briefing_objectives(briefing) or mission_objs

    # Prefer update_mission objectives (more complete, contain dynamic conditions)
    if mission_objs:
        return mission_objs
    return offer_objs


def _parse_briefing_objectives(briefing: ET.Element) -> List[Dict[str, Any]]:
    """Parse <objective> elements from a briefing block."""
    result = []
    for obj in briefing.findall("objective"):
        entry: Dict[str, Any] = {
            "step": _int_or(obj.get("step"), 0),
            "action": obj.get("action", ""),
            "textId": obj.get("text", ""),
        }
        encyclopedia = obj.get("encyclopedia")
        if encyclopedia:
            entry["encyclopedia"] = encyclopedia
        completed = obj.get("completed")
        if completed:
            entry["completedVariable"] = completed
        result.append(entry)
    return result


def _extract_variable_texts(cue: ET.Element) -> Dict[str, Any]:
    """Extract substitute_text mappings for runtime variables used in objectives.

    Returns {variableName: {source: str, replaces: [{from: str, to: str}]}}
    """
    result: Dict[str, Any] = {}
    for st in cue.iter("substitute_text"):
        var_name = st.get("text", "")
        source = st.get("source", "")
        if not var_name or not source:
            continue
        replaces = []
        for r in st.findall("replace"):
            from_val = _clean_xpath_str(r.get("string", ""))
            to_val = r.get("with", "")
            # Strip single quotes from to_val if it's a quoted string
            if to_val.startswith("'") and to_val.endswith("'"):
                to_val = to_val[1:-1]
            replaces.append({
                "from": from_val,
                "to": to_val,
            })
        result[var_name] = {
            "source": source,
            "replaces": replaces,
        }
    return result


def _process_library_call(
    run_elem: ET.Element,
    project_ids: List[str],
    predecessors_map: Dict[str, List[Dict[str, Any]]],
    cluster: Dict[str, Any],
):
    """Expand library ref calls to extract project additions."""
    ref = run_elem.get("ref", "")

    # Capture Ignore* params from direct SetupStatDependentProjects calls
    if ref == "SetupStatDependentProjects":
        for flag in ["IgnoreTemperature", "IgnoreOxygen", "IgnoreMethane",
                     "IgnoreCarbonDioxide", "IgnoreToxicity", "IgnoreRadioactivity",
                     "IgnoreHumidity", "IgnoreAirPressure"]:
            for param in run_elem.findall("param"):
                if param.get("name", "") == flag and param.get("value", "").lower() == "true":
                    cluster["values"]["$" + flag] = "true"
        return

    resolved_params = _resolve_params(run_elem)
    projects_to_add = _expand_library(ref, resolved_params)

    # Honor Biosphere param: skip biosphere projects when false
    if resolved_params.get("Biosphere", "").lower() == "false":
        biosphere_ids = set(_expand_library("SetupGeneralProjects_Biosphere", {}))
        projects_to_add = [p for p in projects_to_add if p not in biosphere_ids]

    # Honor EnergyProject param: replace pwr_antimatter with alternative
    energy_project = resolved_params.get("EnergyProject", "")
    if energy_project and energy_project != "pwr_antimatter":
        clean_energy = _clean_xpath_str(energy_project)
        if "pwr_antimatter" in projects_to_add and clean_energy:
            projects_to_add = [p if p != "pwr_antimatter" else clean_energy for p in projects_to_add]

    # Store PilotTrainingCourseProject param for later predecessor resolution
    pilot_project = resolved_params.get("PilotTrainingCourseProject", "")
    if pilot_project:
        cluster["values"]["$PilotTrainingCourseProject"] = _clean_xpath_str(pilot_project)

    for proj_id in projects_to_add:
        if proj_id not in project_ids:
            project_ids.append(proj_id)

    # Store ignore flags from SetupStatDependentProjects for later use
    for flag in ["IgnoreTemperature", "IgnoreOxygen", "IgnoreMethane",
                 "IgnoreCarbonDioxide", "IgnoreToxicity", "IgnoreRadioactivity",
                 "IgnoreHumidity", "IgnoreAirPressure"]:
        val = resolved_params.get(flag, "")
        if val.lower() == "true":
            cluster["values"]["$" + flag] = "true"


def _add_stat_dependent_projects_static(
    cluster: Dict[str, Any],
    predecessors_map: Dict[str, List[Dict[str, Any]]],
):
    """Apply SetupStatDependentProjects logic based on cluster initialStats."""
    stats = cluster.get("initialStats", {})
    project_ids = cluster["projectIds"]

    # Temperature-dependent: only if temperature stat exists on this cluster
    if "temperature" in stats:
        if stats.get("temperature", 0) < 5:
            temps = ["tmp_moholes", "tmp_blackdust", "atm_methane_import"]
            for pid in temps:
                if pid not in project_ids:
                    project_ids.append(pid)
        if stats.get("temperature", 0) > 5:
            pid = "tmp_cloudparticles"
            if pid not in project_ids:
                project_ids.append(pid)
            if pid not in predecessors_map:
                predecessors_map[pid] = [
                    {"ref": "wat_import", "type": "project", "any": True},
                    {"ref": "wat_surfacing", "type": "project", "any": True},
                ]

    # Temperature-dependent: only if temperature stat exists on this cluster
    if "temperature" in stats and cluster.get("values", {}).get("$IgnoreTemperature") != "true":
        if stats.get("temperature", 0) < 5:
            temps = ["tmp_moholes", "tmp_blackdust", "atm_methane_import"]
            for pid in temps:
                if pid not in project_ids:
                    project_ids.append(pid)
        if stats.get("temperature", 0) > 5:
            pid = "tmp_cloudparticles"
            if pid not in project_ids:
                project_ids.append(pid)
            if pid not in predecessors_map:
                predecessors_map[pid] = [
                    {"ref": "wat_import", "type": "project", "any": True},
                    {"ref": "wat_surfacing", "type": "project", "any": True},
                ]

    # Oxygen < 4 → bio_cyanobacteria
    if cluster.get("values", {}).get("$IgnoreOxygen") != "true":
        if "oxygen" in stats and stats.get("oxygen", 0) < 4:
            pid = "bio_cyanobacteria"
            if pid not in project_ids:
                project_ids.append(pid)
            if pid not in predecessors_map:
                predecessors_map[pid] = [
                    {"ref": "bio_tailored", "type": "project", "any": True},
                    {"ref": "bio_jumpstart", "type": "project", "any": True},
                ]

    # Methane > 0 → methane projects + warming event
    if cluster.get("values", {}).get("$IgnoreMethane") != "true":
        if "methane" in stats and stats.get("methane", 0) > 0:
            for pid in ["atm_methane_oxidizers", "atm_methane_oxidize", "evt_globalwarming_methane"]:
                if pid not in project_ids:
                    project_ids.append(pid)
            if "atm_methane_oxidizers" not in predecessors_map:
                predecessors_map["atm_methane_oxidizers"] = [
                    {"ref": "power", "type": "group", "any": False},
                ]
            if "atm_methane_oxidize" not in predecessors_map:
                predecessors_map["atm_methane_oxidize"] = [
                    {"ref": "atm_methane_oxidizers", "type": "project", "any": False},
                ]

    # CarbonDioxide > 0 → CO2 projects + warming event
    if cluster.get("values", {}).get("$IgnoreCarbonDioxide") != "true":
        if "carbondioxide" in stats and stats.get("carbondioxide", 0) > 0:
            for pid in ["atm_carbon_mineralizers", "atm_carbon_mineralize", "evt_globalwarming_co2"]:
                if pid not in project_ids:
                    project_ids.append(pid)
            if "atm_carbon_mineralizers" not in predecessors_map:
                predecessors_map["atm_carbon_mineralizers"] = [
                    {"ref": "power", "type": "group", "any": False},
                ]
            if "atm_carbon_mineralize" not in predecessors_map:
                predecessors_map["atm_carbon_mineralize"] = [
                    {"ref": "atm_carbon_mineralizers", "type": "project", "any": False},
                ]

    # Toxicity > 0 → atm_toxin_cleanup
    if cluster.get("values", {}).get("$IgnoreToxicity") != "true":
        if "toxicity" in stats and stats.get("toxicity", 0) > 0:
            pid = "atm_toxin_cleanup"
            if pid not in project_ids:
                project_ids.append(pid)
            if pid not in predecessors_map:
                predecessors_map[pid] = [
                    {"ref": "src_toxicity", "type": "group", "any": False},
                ]

    # Radioactivity > 0 → ter_radioactive_cleanup
    if cluster.get("values", {}).get("$IgnoreRadioactivity") != "true":
        if "radioactivity" in stats and stats.get("radioactivity", 0) > 0:
            pid = "ter_radioactive_cleanup"
            if pid not in project_ids:
                project_ids.append(pid)

    # Humidity < 6 → water projects
    if cluster.get("values", {}).get("$IgnoreHumidity") != "true":
        if "humidity" in stats and stats.get("humidity", 9) < 6:
            water_projects = ["wat_import", "wat_irrigation", "wat_surfacing"]
            for pid in water_projects:
                if pid not in project_ids:
                    project_ids.append(pid)

    # AirPressure exists → nitrogen_fix, helium_import
    if cluster.get("values", {}).get("$IgnoreAirPressure") != "true":
        if "airpressure" in stats:
            for pid in ["atm_nitrogen_fix", "atm_helium_import"]:
                if pid not in project_ids:
                    project_ids.append(pid)
            if "atm_nitrogen_fix" not in predecessors_map:
                predecessors_map["atm_nitrogen_fix"] = [
                    {"ref": "agr_fertilize", "type": "project", "any": False},
                ]

    # AirPressure < 5 → outgassing (only if airpressure exists)
    if "airpressure" in stats and stats.get("airpressure", 0) < 5:
        pid = "atm_outgassing"
        if pid not in project_ids:
            project_ids.append(pid)

    # SeismicActivity > 0 → quake events + tectonic_scaffolding
    if "seismicactivity" in stats and stats.get("seismicactivity", 0) > 0:
        for pid in ["evt_quake_mild", "evt_quake_moderate", "evt_quake_severe", "ter_tectonic_scaffolding"]:
            if pid not in project_ids:
                project_ids.append(pid)


def _resolve_params(run_elem: ET.Element) -> Dict[str, str]:
    """Extract param values from a run_actions element."""
    params: Dict[str, str] = {}
    for param in run_elem.findall("param"):
        name = param.get("name", "")
        value = param.get("value", "")
        if name:
            params[name] = value
    return params


# Known library → project IDs mapping (extracted from the XML structure)
_KNOWN_LIBRARIES: Dict[str, List[str]] = {
    "SetupGeneralProjects_Industrial": [
        # Energy
        # "$EnergyProject" defaults to "pwr_antimatter"
        "pwr_antimatter",
        "ind_refineries_clean",
        "ind_refineries_cheap",
        "ind_factories",
        "ind_von_neumann",
    ],
    "SetupGeneralProjects_Biosphere": [
        "bio_tailored",
        "bio_jumpstart",
        "agr_fertilize",
        "agr_fields_scruffin",
    ],
    "SetupGeneralProjects_Water": [
        "wat_import",
        "wat_irrigation",
        "wat_surfacing",
    ],
    "SetupGeneralProjects_Agriculture": [
        "agr_hydroponics",
        "agr_forestation",
        "agr_fields_wheat",
        "agr_fields_sunrise",
        "agr_fields_soja",
        "agr_fields_spices",
    ],
    "SetupGeneralProjects_Amenities": [
        "ame_themepark",
        "ame_venues",
        "ame_temple",
        "ame_finedining",
    ],
    "SetupGeneralProjects_Residential": [
        "res_bubblecity",
        "res_habmodule",
        "res_housing_dense",
        "res_arcology",
        "res_housing_luxury",
    ],
    "SetupGeneralProjects_Training": [
        "trn_boarding",
        "trn_boarding_group",
        "trn_boarding_single",
        "trn_boarding_competition",
        "trn_pilot",
        "trn_pilot_group",
        "trn_pilot_single",
        "trn_pilot_competition",
    ],
    "SetupGeneralProjects_Economy": [
        "eco_clinic",
        "eco_clinic_supply",
        "eco_campus",
        "eco_campus_supply",
        "eco_bank",
        "eco_bank_supply",
    ],
}

_KNOWN_LIBRARY_REF_MAP: Dict[str, List[str]] = {
    "SetupGeneralProjects": [
        "SetupStatDependentProjects",
        "SetupGeneralProjects_Industrial",
        "SetupGeneralProjects_Biosphere",
        "SetupGeneralProjects_Water",
        "SetupGeneralProjects_Agriculture",
        "SetupGeneralProjects_Amenities",
        "SetupGeneralProjects_Residential",
        "SetupGeneralProjects_Training",
        "SetupGeneralProjects_Economy",
    ],
    "SetupStatDependentProjects": [
        # Note: handled directly in _add_stat_dependent_projects, not via expand_library
    ],
}


def _expand_library(ref: str, params: Dict[str, str]) -> List[str]:
    """Expand a library reference to its project IDs."""
    result: List[str] = []

    # Direct project library
    if ref in _KNOWN_LIBRARIES:
        return list(_KNOWN_LIBRARIES[ref])

    # Composite library
    if ref in _KNOWN_LIBRARY_REF_MAP:
        for sub_ref in _KNOWN_LIBRARY_REF_MAP[ref]:
            result.extend(_expand_library(sub_ref, params))
        return result

    # Temperature-dependent projects
    if ref == "TemperatureProjectsHelper":
        return ["tmp_moholes", "tmp_blackdust", "atm_methane_import", "tmp_cloudparticles"]

    return result


def _parse_predecessors(preds_elem: ET.Element) -> List[Dict[str, Any]]:
    """Parse <predecessors> element into predecessor list."""
    predecessors = []
    any_val = preds_elem.get("any", "false") == "true"

    for pred in preds_elem.findall("predecessor"):
        pred_id = _clean_xpath_str(pred.get("id", ""))
        pred_group = _clean_xpath_str(pred.get("group", ""))
        pred_any = pred.get("any", "false") == "true"

        if pred_id:
            predecessors.append({
                "ref": pred_id,
                "type": "project",
                "any": any_val or pred_any,
            })
        elif pred_group:
            predecessors.append({
                "ref": pred_group,
                "type": "group",
                "any": any_val or pred_any,
            })

    return predecessors


def _clean_xpath_str(val: Optional[str]) -> str:
    """Clean XPath string like "'agr_fertilize'" -> 'agr_fertilize'."""
    if val is None:
        return ""
    s = val.strip()
    s = re.sub(r"^'+", "", s)
    s = re.sub(r"'+$", "", s)
    return s


def _extract_project_descriptions(root: ET.Element) -> Dict[str, List[Dict[str, Any]]]:
    """Extract structured effect descriptions from event_terraforming_project_succeeded cues.

    Returns {project_id: [{type: str, ...}, ...]}.
    Types: skill_add, recruitment
    """
    results: Dict[str, List[Dict[str, Any]]] = {}

    for cue in root.iter("cue"):
        conditions = cue.find("conditions")
        if conditions is None:
            continue
        event = conditions.find("event_terraforming_project_succeeded")
        if event is None:
            continue

        project_id = _clean_xpath_str(event.get("project", ""))
        if not project_id:
            continue

        actions = cue.find("actions")
        if actions is None:
            continue

        desc = _generate_effect_description(project_id, actions)
        if desc:
            results[project_id] = [desc]

    return results


def _generate_effect_description(project_id: str, actions: ET.Element) -> Optional[Dict[str, Any]]:
    """Parse event_terraforming_project_succeeded actions into a structured description item.

    Returns None if no recognizable pattern is found.
    """
    add_skill_elem = actions.find(".//add_skill")
    if add_skill_elem is not None:
        skill_type = add_skill_elem.get("type", "")
        skill = _skill_type_to_name(skill_type)
        if not skill:
            return None

        max_stars = _extract_max_stars(actions, add_skill_elem)
        is_group = _is_group_training(actions)

        return {
            "type": "skill_add",
            "skill": skill,
            "stars": 1,
            "maxStars": max_stars or 4,
            "scope": "group" if is_group else "single",
        }

    create_npc = actions.find(".//create_npc_template")
    if create_npc is not None:
        primary_skill = _extract_primary_recruitment_skill(actions)
        if not primary_skill:
            return None

        gchar = actions.find(".//get_character_definition[@tags]")
        tags = gchar.get("tags", "") if gchar is not None else ""
        role = "marine" if "tag.marine" in tags else "pilot"

        return {
            "type": "recruitment",
            "role": role,
            "count": 3,
            "primarySkill": primary_skill,
            "skillMin": 13,
            "skillMax": 15,
            "morale": 13,
        }

    return None


def _skill_type_to_name(skill_type: str) -> str:
    """Convert skilltype.X to skill name for i18n key.
    e.g., skilltype.boarding → boarding, skilltype.piloting → piloting
    """
    SKILL_MAP = {
        "skilltype.boarding": "boarding",
        "skilltype.piloting": "piloting",
        "skilltype.engineering": "engineering",
        "skilltype.management": "management",
        "skilltype.morale": "morale",
    }
    return SKILL_MAP.get(skill_type, "")


def _extract_max_stars(actions: ET.Element, target_elem: ET.Element) -> int:
    """Find the enclosing do_if condition and extract max star level.
    e.g., <do_if value="$CurrentSkill lt 12" comment="4 stars"> → 4
    """
    # Search for do_if elements containing the target element
    for do_if in actions.iter("do_if"):
        value_attr = do_if.get("value", "")
        if "lt" in value_attr:
            # Extract the number from e.g. "$CurrentSkill lt 12"
            m = re.search(r"lt\s+(\d+)", value_attr)
            if m:
                max_val = int(m.group(1))
                if max_val > 0 and max_val % 3 == 0:
                    return max_val // 3
    return 0


def _is_group_training(actions: ET.Element) -> bool:
    """Check if training affects group or individual."""
    # Group training: uses do_for_each with entityrole.trainee_group
    for elem in actions.iter("do_for_each"):
        in_attr = elem.get("in", "")
        if "trainee_group" in in_attr:
            return True
    # Individual training: uses assignedcontrolentity
    for elem in actions.iter("set_value"):
        exact = elem.get("exact", "")
        if "trainee_individual" in exact:
            return False
    return False


def _extract_primary_recruitment_skill(actions: ET.Element) -> str:
    """Find the primary skill from set_skill calls in a recruitment action.
    The primary skill is the one with the highest max value (5 stars = 15).
    min values may contain XPath expressions like 'if $i == 1 then 15 else 13'.
    """
    skills: Dict[str, Dict[str, int]] = {}
    for ss in actions.iter("set_skill"):
        skill_type = ss.get("type", "")
        max_val = _int_or(ss.get("max"), 0)
        if skill_type:
            prev = skills.get(skill_type)
            if prev is None or max_val > prev.get("max", 0):
                skills[skill_type] = {"max": max_val}

    if not skills:
        return ""
    primary = max(skills.keys(), key=lambda k: skills[k]["max"])
    return _skill_type_to_name(primary)


def _clean_faction(faction: str) -> str:
    """Remove 'faction.' prefix from faction identifier."""
    return faction.replace("faction.", "")


def _is_player_owner(actions_elem: ET.Element, actor_var: str) -> bool:
    """Check if set_owner action exists in the element for the given actor to faction.player."""
    for elem in actions_elem.iter("set_owner"):
        obj = elem.get("object", "")
        fac = elem.get("faction", "")
        if obj == actor_var and "faction.player" in fac:
            return True
    return False


def _milestone_condition_label(sub_cue: ET.Element) -> str:
    """Extract a human-readable condition label from a milestone cue's conditions."""
    conds = sub_cue.find("conditions")
    if conds is None:
        return ""

    text = ET.tostring(conds, encoding="unicode")

    if "event_terraforming_stat_changed" in text:
        if "habitable" in text:
            return "habitable"
        if "population" in text:
            return "population"
        if "temperature" in text:
            return "temperature_improved"
        if "toxicity" in text:
            return "stat_changed"
        return "stat_changed"

    if "event_terraforming_project_succeeded" in text:
        return "first_project"

    if "event_terraforming_project_completed" in text:
        return "basic_projects"

    return ""


def _extract_reward_actions(
    elem: ET.Element,
    milestone,
    faction_rewards: list,
    blueprint_wares: list,
    npc_name_ids: list,
    cast_map: dict,
    condition_label: str = "",
):
    """Extract reward actions from a single milestone/completion element."""
    label = condition_label
    if milestone == "complete":
        label = "mission_complete"
    actions = elem
    if elem.tag in ("cue", "patch"):
        actions = elem.find("actions")
    if actions is None:
        return

    for action in actions.iter():
        tag = action.tag
        if tag == "add_faction_relation":
            faction = _clean_faction(action.get("faction", ""))
            val_str = action.get("value", "0")
            try:
                val = float(val_str)
                faction_rewards.append({"faction": faction, "type": "add", "value": val, "milestone": milestone, "conditionLabel": label})
            except ValueError:
                pass
        elif tag == "set_faction_relation":
            faction = _clean_faction(action.get("faction", ""))
            val_str = action.get("value", "")
            if "friend" in val_str.lower():
                faction_rewards.append({"faction": faction, "type": "unlock", "milestone": milestone, "conditionLabel": label})
        elif tag == "add_blueprints":
            wares = action.get("wares", "")
            if wares:
                for w in wares.strip().split():
                    w = w.strip().lstrip("[")
                    if w.startswith("ware."):
                        blueprint_wares.append({"ware": w, "milestone": milestone, "conditionLabel": label})
        elif tag == "add_actor_to_room":
            actor_var = action.get("actor", "")
            if actor_var and actor_var in cast_map and _is_player_owner(actions, actor_var):
                name_id = cast_map[actor_var]
                npc_name_ids.append({"nameId": name_id, "milestone": milestone, "conditionLabel": label})


def _resolve_npc_nameid(cue: ET.Element, actor_var: str) -> Optional[str]:
    """Resolve NPC nameId from the cluster's mission page cast section.

    Uses a hardcoded mapping based on known terraforming NPC rewards.
    """
    cluster_name = cue.get("name", "")
    if "_BlackHoleSun" in cluster_name and "Contact_1" in actor_var:
        return "{30507,102}"
    return None


def _extract_cluster_rewards(cue: ET.Element) -> Dict[str, Any]:
    """Extract faction rewards, blueprints, and NPC rewards from milestone/completion cues."""
    faction_rewards: List[Dict[str, Any]] = []
    blueprint_wares: List[Dict[str, Any]] = []
    npc_name_ids: List[Dict[str, Any]] = []
    cast_map: Dict[str, str] = {}

    for cca in cue.iter("create_cue_actor"):
        actor_name = cca.get("name", "")
        if actor_name and actor_name.startswith("$"):
            npc = _resolve_npc_nameid(cue, actor_name)
            if npc:
                cast_map[actor_name] = npc

    sub_cues = cue.find("cues")
    if sub_cues is None:
        return {"factionRewards": [], "blueprintWares": [], "npcNameIds": [], "rewardNameIds": []}

    for sub_cue in sub_cues:
        sub_name = sub_cue.get("name", "")
        if sub_name is None:
            continue

        milestone = None
        if "_Milestone_" in sub_name:
            parts = sub_name.split("_")
            for p in reversed(parts):
                if p.isdigit():
                    milestone = int(p)
                    break
        elif sub_name.endswith("_MissionComplete"):
            milestone = "complete"

        if milestone is None:
            continue

        cond_label = _milestone_condition_label(sub_cue)
        _extract_reward_actions(sub_cue, milestone, faction_rewards, blueprint_wares, npc_name_ids, cast_map, cond_label)

        for patch in sub_cue.findall("patch"):
            _extract_reward_actions(patch, milestone, faction_rewards, blueprint_wares, npc_name_ids, cast_map)

    reward_name_ids: List[str] = []
    for npc in npc_name_ids:
        if npc["nameId"]:
            reward_name_ids.append(npc["nameId"])

    return {
        "factionRewards": faction_rewards,
        "blueprintWares": blueprint_wares,
        "npcNameIds": npc_name_ids,
        "rewardNameIds": reward_name_ids,
    }


def _int_or(val: Optional[str], default: Optional[int] = None) -> Optional[int]:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default
