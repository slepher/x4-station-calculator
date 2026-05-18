"""Parse clusters and project dependencies from md/terraforming/final.xml."""

import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Set, Optional, Tuple


def parse_md(root: ET.Element) -> Tuple[List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]]]:
    """Parse MD terraforming XML for cluster initializations and project predecessors.

    Returns (clusters, predecessors_map).
    predecessors_map: {project_id: [{ref: str, type: "project"|"group", any: bool}]}
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

        cluster = _parse_cluster_actions(actions, cluster_id, predecessors_map)
        if cluster:
            cluster["objectives"] = _extract_objectives(cue)
            cluster["variableTexts"] = _extract_variable_texts(cue)
            clusters.append(cluster)

    # Merge global predecessors into the map (library-level predecessors)
    for proj_id, preds in global_predecessors.items():
        if proj_id not in predecessors_map:
            predecessors_map[proj_id] = preds

    return clusters, predecessors_map


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
    actions: ET.Element,
    cluster_id: str,
    predecessors_map: Dict[str, List[Dict[str, Any]]],
) -> Optional[Dict[str, Any]]:
    """Parse a single cluster's <actions> block for initialization data."""
    cluster: Dict[str, Any] = {
        "id": cluster_id,
        "macro": "",
        "partName": "",
        "initialStats": {},
        "projectIds": [],
        "values": {},
    }

    initial_stats: Dict[str, int] = {}
    project_ids: List[str] = []
    known_values: Dict[str, str] = {}

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

    cluster["initialStats"] = initial_stats
    cluster["projectIds"] = project_ids
    cluster["values"] = known_values
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

    # Handle known libraries
    resolved_params = _resolve_params(run_elem)
    projects_to_add = _expand_library(ref, resolved_params)

    for proj_id in projects_to_add:
        if proj_id not in project_ids:
            project_ids.append(proj_id)


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
        "_TemperatureDependent",
        "_OxygenDependent",
        "_MethaneDependent",
        "_CarbonDioxideDependent",
        "_ToxicityDependent",
        "_RadioactivityDependent",
        "_HumidityDependent",
        "_AirPressureDependent",
        "_SeismicDependent",
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

    # Stat-dependent: add cleanup/heating projects based on initial state
    if ref == "SetupStatDependentProjects":
        # Oxidation/carbon projects
        result.extend(["atm_methane_oxidizers", "atm_methane_oxidize"])
        result.extend(["atm_carbon_mineralizers", "atm_carbon_mineralize"])
        # Events
        result.extend(["evt_globalwarming_methane", "evt_globalwarming_co2"])
        result.extend(["evt_quake_mild", "evt_quake_moderate", "evt_quake_severe"])
        # General cleanup
        result.extend(["atm_toxin_cleanup", "ter_radioactive_cleanup"])
        result.extend(["atm_nitrogen_fix", "atm_helium_import"])
        result.extend(["atm_outgassing", "ter_tectonic_scaffolding"])
        return result
    if ref == "SetupStatProjectsAndEvents_Methane":
        return ["atm_methane_oxidizers", "atm_methane_oxidize", "evt_globalwarming_methane"]
    if ref == "SetupStatProjectsAndEvents_CO2":
        return ["atm_carbon_mineralizers", "atm_carbon_mineralize", "evt_globalwarming_co2"]
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


def _int_or(val: Optional[str], default: Optional[int] = None) -> Optional[int]:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default
