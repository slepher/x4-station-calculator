import argparse
from collections import Counter
import json
import os
import re
import shutil
import sys
from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from lxml import etree

KEY_ATTRS = ("id", "name", "ref", "macro", "method", "ware", "faction", "group", "class", "type", "race")
DISTILLED_LIBRARY_FILES = [
    "wares.xml",
    "waregroups.xml",
    "colors.xml",
    "mapdefaults.xml",
    "god.xml",
    "factions.xml",
    "region_definitions.xml",
    "regionyields.xml",
    "regionobjectgroups.xml",
    "ships.xml",
    "shipgroups.xml",
    "loadouts.xml",
    "defaults.xml",
]

def normalize_dlc_name(dlc_id: str) -> str:
    return dlc_id[4:] if dlc_id.startswith("ego_") else dlc_id


def load_configs() -> Tuple[dict, dict]:
    game_cfg_path = "x4-game.config.json"
    station_cfg_path = "x4-station-calculator.config.json"
    if not os.path.exists(game_cfg_path) or not os.path.exists(station_cfg_path):
        raise FileNotFoundError("Missing x4-game.config.json or x4-station-calculator.config.json")
    with open(game_cfg_path, "r", encoding="utf-8") as f:
        game_cfg = json.load(f)
    with open(station_cfg_path, "r", encoding="utf-8") as f:
        station_cfg = json.load(f)
    return game_cfg, station_cfg


def select_versions(station_cfg: dict, version: Optional[str], beta: Optional[bool], all_versions: bool) -> List[dict]:
    versions = station_cfg.get("versions", [])
    if not versions:
        raise ValueError("No versions configured")
    if all_versions:
        return versions

    if version is None:
        version = str(station_cfg.get("current_version"))
    if beta is None:
        beta = bool(station_cfg.get("beta", False))

    matches = [
        v
        for v in versions
        if str(v.get("version")) == str(version) and bool(v.get("beta", False)) == bool(beta)
    ]
    if not matches:
        raise ValueError(f"Version not found: {version} ({'beta' if beta else 'stable'})")
    return matches


def setup_xml_diff(customizer_path: str, game_dir: str):
    if customizer_path not in sys.path:
        sys.path.append(customizer_path)
    from Framework import File_Manager, Settings  # type: ignore

    temp_output = Path.cwd() / ".tmp_x4_customizer"
    temp_output.mkdir(parents=True, exist_ok=True)
    Settings(
        path_to_x4_folder=game_dir,
        allow_path_error=True,
        path_to_output_folder=str(temp_output),
        output_to_user_extensions=False,
    )
    return File_Manager.XML_Diff


def parse_xml(path: Path, parser: etree.XMLParser) -> etree._ElementTree:
    return etree.parse(str(path), parser)


def element_key(node: etree._Element) -> Optional[str]:
    parts = [node.tag]
    found = False
    for attr in KEY_ATTRS:
        val = node.get(attr)
        if val is not None:
            parts.append(f"{attr}={val}")
            found = True
    return "|".join(parts) if found else None


def top_level_record_map(root: etree._Element) -> Dict[str, etree._Element]:
    records: Dict[str, etree._Element] = {}
    for child in root:
        if not isinstance(child.tag, str):
            continue
        key = element_key(child)
        if not key:
            continue
        records[key] = child
    return records


def compare_attrs(before: etree._Element, after: etree._Element, path_prefix: str) -> List[str]:
    changed = []
    keys = set(before.attrib.keys()) | set(after.attrib.keys())
    for key in sorted(keys):
        if before.get(key) != after.get(key):
            changed.append(f"{path_prefix}.@{key}")
    before_text = (before.text or "").strip()
    after_text = (after.text or "").strip()
    if before_text != after_text:
        changed.append(f"{path_prefix}.#text")
    return changed


def keyed_children(parent: etree._Element, tag: str) -> Dict[str, etree._Element]:
    out: Dict[str, etree._Element] = {}
    same_tag_children = [child for child in parent.findall(f"./{tag}") if isinstance(child.tag, str)]
    for idx, child in enumerate(same_tag_children):
        key = element_key(child)
        if not key:
            # Fallback to positional key for unkeyed children.
            key = f"{tag}#{idx}"
        if key in out:
            suffix = 2
            while f"{key}#{suffix}" in out:
                suffix += 1
            key = f"{key}#{suffix}"
        out[key] = child
    return out


def compare_nodes(before: etree._Element, after: etree._Element, path_prefix: str = "") -> List[str]:
    current = path_prefix or before.tag
    changed = compare_attrs(before, after, current)

    tags = {child.tag for child in before if isinstance(child.tag, str)} | {
        child.tag for child in after if isinstance(child.tag, str)
    }
    for tag in sorted(tags):
        b_map = keyed_children(before, tag)
        a_map = keyed_children(after, tag)
        all_keys = set(b_map.keys()) | set(a_map.keys())
        for key in sorted(all_keys):
            b_child = b_map.get(key)
            a_child = a_map.get(key)
            child_path = f"{current}.{key}"
            if b_child is None or a_child is None:
                changed.append(f"{child_path}.<node-changed>")
                continue
            changed.extend(compare_nodes(b_child, a_child, child_path))

    # de-dup
    out = []
    seen = set()
    for item in changed:
        if item not in seen:
            out.append(item)
            seen.add(item)
    return out


def analyze_patch(base_tree: etree._ElementTree, patch_path: Path, xml_diff, parser: etree.XMLParser) -> Dict[str, List[str]]:
    patch_tree = parse_xml(patch_path, parser)
    patch_root = patch_tree.getroot()

    merged_tree = etree.ElementTree(deepcopy(base_tree.getroot()))
    xml_diff.Apply_Patch(merged_tree.getroot(), patch_root)

    base_records = top_level_record_map(base_tree.getroot())
    merged_records = top_level_record_map(merged_tree.getroot())

    changed_records: Dict[str, List[str]] = {}
    for key in sorted(set(base_records.keys()) & set(merged_records.keys())):
        diffs = compare_nodes(base_records[key], merged_records[key])
        if diffs:
            changed_records[key] = diffs
    return changed_records


def run_for_version(version_item: dict, game_cfg: dict, station_cfg: dict, xml_diff):
    src_root = Path(game_cfg["X4_PATHS"]["SOURCE"]) / version_item["folder_name"]
    base_lib = src_root / "libraries"
    if not base_lib.exists():
        raise FileNotFoundError(f"Missing libraries directory: {base_lib}")

    dlc_ids = station_cfg.get("dlc_order", [])
    parser = etree.XMLParser(remove_blank_text=True)

    out_root = Path(station_cfg.get("raw_assets_dir", "./x4raw_assets")) / version_item["folder_name"] / "dlc_changes"
    if out_root.exists():
        shutil.rmtree(out_root)
    out_root.mkdir(parents=True, exist_ok=True)

    written_files = 0
    written_types = 0
    for file_name in DISTILLED_LIBRARY_FILES:
        base_xml = base_lib / file_name
        if not base_xml.exists():
            continue
        try:
            base_tree = parse_xml(base_xml, parser)
        except Exception:
            continue

        type_name = base_xml.stem
        type_summaries = []

        for dlc_id in dlc_ids:
            patch_path = src_root / "extensions" / dlc_id / "libraries" / base_xml.name
            if not patch_path.exists():
                continue
            try:
                changed = analyze_patch(base_tree, patch_path, xml_diff, parser)
            except Exception as e:
                changed = {"__error__": [str(e)]}

            # No modifications => skip writing.
            if not changed:
                continue

            def normalize_change_key(field_path: str) -> str:
                # Match ware.production|...|method=split... -> productionsplit
                prod_match = re.search(r"\.production\|[^\n]*?\bmethod=([^|.]+)", field_path)
                if prod_match:
                    return f"production.{prod_match.group(1)}"
                if ".owner|" in field_path:
                    return "owner"
                if ".owner." in field_path:
                    return "owner"
                if ".illegal|" in field_path:
                    return "illegal"
                if ".illegal." in field_path:
                    return "illegal"
                if ".illegal#" in field_path:
                    return "illegal"
                generic = re.search(r"\.([A-Za-z_]+)(?:\||\.)", field_path)
                if generic:
                    return generic.group(1)
                return "unknown"

            field_counter = Counter()
            for fields in changed.values():
                for field in fields:
                    field_counter[normalize_change_key(field)] += 1

            major_changes = [
                {"type": change_type, "count": count}
                for change_type, count in field_counter.most_common(3)
            ]

            payload = {
                "dlc": normalize_dlc_name(dlc_id),
                "modified_records": len(changed) if "__error__" not in changed else 0,
                "modified_fields_total": sum(len(v) for v in changed.values()) if "__error__" not in changed else 0,
                "major_changes": major_changes if "__error__" not in changed else [],
            }
            type_summaries.append(payload)

        if type_summaries:
            out_path = out_root / f"{type_name}.json"
            out_payload = {
                "version": version_item["version"],
                "beta": bool(version_item.get("beta", False)),
                "folder_name": version_item["folder_name"],
                "type": type_name,
                "base_file": str(base_xml),
                "dlc_summaries": type_summaries,
            }
            out_path.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2), encoding="utf-8")
            written_types += 1
            written_files += 1

    print(
        f"[{version_item['folder_name']}] written types={written_types}, "
        f"written files={written_files}, output={out_root}"
    )


def main():
    argp = argparse.ArgumentParser(description="Audit DLC modifications for all libraries XML files")
    argp.add_argument("--all-versions", action="store_true")
    argp.add_argument("--version", type=str, default=None)
    flavor = argp.add_mutually_exclusive_group()
    flavor.add_argument("--beta", action="store_true")
    flavor.add_argument("--stable", action="store_true")
    args = argp.parse_args()

    beta = True if args.beta else False if args.stable else None
    game_cfg, station_cfg = load_configs()
    versions = select_versions(station_cfg, args.version, beta, args.all_versions)
    xml_diff = setup_xml_diff(game_cfg["X4_PATHS"]["CUSTOMIZER_PATH"], game_cfg["X4_PATHS"]["GAME_DIR"])

    for version_item in versions:
        run_for_version(version_item, game_cfg, station_cfg, xml_diff)


if __name__ == "__main__":
    main()
