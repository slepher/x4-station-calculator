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


DependencyExpr = Dict[str, Any]


def _expr_key(expr: DependencyExpr) -> str:
    return json.dumps(expr, sort_keys=True, separators=(",", ":"))


def _simplify_dependency_expr(expr: DependencyExpr | None) -> DependencyExpr | None:
    if expr is None:
        return None

    if "all" in expr:
        items: List[DependencyExpr] = []
        for child in expr["all"]:
            simplified = _simplify_dependency_expr(child)
            if simplified is None:
                continue
            if "all" in simplified:
                items.extend(simplified["all"])
            else:
                items.append(simplified)
        deduped = list({_expr_key(item): item for item in items}.values())
        if len(deduped) == 0:
            return None
        if len(deduped) == 1:
            return deduped[0]
        return {"all": deduped}

    if "any" in expr:
        items = []
        for child in expr["any"]:
            simplified = _simplify_dependency_expr(child)
            if simplified is None:
                continue
            if "any" in simplified:
                items.extend(simplified["any"])
            else:
                items.append(simplified)
        deduped = list({_expr_key(item): item for item in items}.values())
        if len(deduped) == 0:
            return None
        if len(deduped) == 1:
            return deduped[0]
        return {"any": deduped}

    return expr


def _completed_expr(pred: Dict[str, Any]) -> DependencyExpr:
    ref = pred.get("ref", "")
    if pred.get("type") == "group":
        return {"groupCompleted": ref}
    return {"completed": ref}


def _append_predecessor(project: Dict[str, Any], predecessor: Dict[str, Any]) -> None:
    predecessors = project.setdefault("predecessors", [])
    key = (
        predecessor.get("type"),
        predecessor.get("ref"),
        bool(predecessor.get("any", False)),
    )
    for existing in predecessors:
        existing_key = (
            existing.get("type"),
            existing.get("ref"),
            bool(existing.get("any", False)),
        )
        if existing_key == key:
            return
    predecessors.append(predecessor)


def _build_dependency_expressions(projects: List[Dict[str, Any]]) -> None:
    """Normalize non-tree dependency rules into boolean expressions."""
    side_effect_sources_by_target: Dict[str, List[str]] = {}
    project_by_id: Dict[str, Dict[str, Any]] = {
        project.get("id", ""): project
        for project in projects
        if project.get("id")
    }

    def same_group(source_id: str, target_id: str) -> bool:
        source = project_by_id.get(source_id)
        target = project_by_id.get(target_id)
        return bool(source and target and source.get("group") == target.get("group"))

    def branch_blocker_ids(pred_ref: str, target_id: str, target_group: str) -> List[str]:
        blockers: List[str] = []
        for blocker in projects:
            blocker_id = blocker.get("id", "")
            if not blocker_id:
                continue
            if pred_ref not in side_effect_sources_by_target.get(blocker_id, []):
                continue
            blocks_project = target_id in blocker.get("blockedProjects", [])
            blocks_group = target_group in blocker.get("blockedGroups", [])
            if blocks_project or blocks_group:
                blockers.append(blocker_id)
        return blockers

    def mutually_exclusive_projects(left_id: str, right_id: str) -> bool:
        left = project_by_id.get(left_id)
        right = project_by_id.get(right_id)
        if not left or not right:
            return False
        return (
            right_id in left.get("removedProjects", [])
            or left_id in right.get("removedProjects", [])
        )

    def blocker_dependency_exprs(blocker_ids: List[str]) -> List[DependencyExpr]:
        remaining = list(dict.fromkeys(blocker_ids))
        expressions: List[DependencyExpr] = []
        while remaining:
            seed = remaining.pop(0)
            group = [seed]
            changed = True
            while changed:
                changed = False
                for blocker_id in list(remaining):
                    if any(mutually_exclusive_projects(blocker_id, grouped_id) for grouped_id in group):
                        group.append(blocker_id)
                        remaining.remove(blocker_id)
                        changed = True
            if len(group) == 1:
                expressions.append({"completed": group[0]})
            else:
                expressions.append({"any": [{"completed": blocker_id} for blocker_id in group]})
        return expressions

    for project in projects:
        project.pop("dependencyConditions", None)

    for project in projects:
        source_id = project.get("id", "")
        if not source_id:
            continue
        for side_effect in project.get("sideEffects", []):
            target_id = side_effect.get("project")
            if not target_id:
                continue
            sources = side_effect_sources_by_target.setdefault(target_id, [])
            if source_id not in sources:
                sources.append(source_id)

    for project in projects:
        expressions: List[DependencyExpr] = []
        target_id = project.get("id", "")
        target_group = project.get("group", "")
        attached_blockers: set[tuple[str, str]] = set()
        side_effect_sources = side_effect_sources_by_target.get(target_id, [])

        if len(side_effect_sources) == 1:
            source_id = side_effect_sources[0]
            if same_group(source_id, target_id):
                _append_predecessor(project, {
                    "ref": source_id,
                    "type": "project",
                    "any": False,
                })
            else:
                expressions.append({"completed": source_id})
        elif len(side_effect_sources) > 1:
            expressions.append({
                "any": [{"completed": source_id} for source_id in side_effect_sources],
            })

        original_predecessors = list(project.get("predecessors", []))
        retained_predecessors: List[Dict[str, Any]] = []
        any_preds: List[Dict[str, Any]] = []
        all_preds: List[Dict[str, Any]] = []
        for pred in original_predecessors:
            if pred.get("type") != "project":
                retained_predecessors.append(pred)
                continue
            if pred.get("any", False):
                any_preds.append(pred)
            else:
                all_preds.append(pred)

        any_preds_require_dependencies = any(
            not same_group(pred.get("ref", ""), target_id)
            or len(branch_blocker_ids(pred.get("ref", ""), target_id, target_group)) > 0
            for pred in any_preds
        )

        if any_preds and any_preds_require_dependencies:
            branches: List[DependencyExpr] = []
            for pred in any_preds:
                branch_items = [_completed_expr(pred)]
                pred_ref = pred.get("ref", "")
                for blocker_id in branch_blocker_ids(pred_ref, target_id, target_group):
                    branch_items.append({"completed": blocker_id})
                    attached_blockers.add((blocker_id, pred_ref))
                branches.append(_simplify_dependency_expr({"all": branch_items}) or branch_items[0])
            expressions.append({"any": branches})
        else:
            retained_predecessors.extend(any_preds)

        for pred in all_preds:
            pred_ref = pred.get("ref", "")
            if same_group(pred_ref, target_id):
                retained_predecessors.append(pred)
            else:
                expressions.append(_completed_expr(pred))

        project["predecessors"] = retained_predecessors

        plain_blocker_ids: List[str] = []
        for blocker in projects:
            blocker_id = blocker.get("id", "")
            if not blocker_id:
                continue

            blocks_project = target_id in blocker.get("blockedProjects", [])
            blocks_group = target_group in blocker.get("blockedGroups", [])
            if not blocks_project and not blocks_group:
                continue

            side_effect_sources = side_effect_sources_by_target.get(blocker_id, [])
            if side_effect_sources:
                for source_id in side_effect_sources:
                    if (blocker_id, source_id) in attached_blockers:
                        continue
                    expressions.append({
                        "any": [
                            {"notCompleted": source_id},
                            {"completed": blocker_id},
                        ],
                    })
                continue

            plain_blocker_ids.append(blocker_id)

        expressions.extend(blocker_dependency_exprs(plain_blocker_ids))

        for remover in projects:
            remover_id = remover.get("id", "")
            if not remover_id:
                continue
            if target_id in remover.get("removedProjects", []):
                expressions.append({"notCompleted": remover_id})

        dependency_expr = _simplify_dependency_expr({"all": expressions})
        if dependency_expr is not None:
            project["dependencies"] = dependency_expr
        else:
            project.pop("dependencies", None)


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

    _build_dependency_expressions(projects)

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
