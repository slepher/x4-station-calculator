"""DLC tag 解析工具。"""

from pathlib import Path
from typing import Callable, Dict, Iterable, Optional
import xml.etree.ElementTree as ET


def normalize_dlc_name(dlc_id: str) -> str:
    return dlc_id[4:] if dlc_id.startswith("ego_") else dlc_id


def detect_xml_shape(xml_path: Path, base_root_tag: Optional[str] = None) -> str:
    root = ET.parse(xml_path).getroot()
    if root.tag == "diff":
        return "patch"
    if base_root_tag is None or root.tag == base_root_tag:
        return "direct"
    return "unknown"


def build_ware_dlc_tag_map(wares_dir: Path, dlc_order: Iterable[str]) -> Dict[str, str]:
    tags: Dict[str, str] = {}
    base_path = wares_dir / "base.xml"
    if not base_path.exists():
        return tags

    base_root = ET.parse(base_path).getroot()
    base_root_tag = base_root.tag
    for ware in base_root.findall("./ware[@id]"):
        ware_id = ware.get("id")
        if ware_id:
            tags[ware_id] = "base"

    for dlc_id in dlc_order:
        dlc_name = normalize_dlc_name(dlc_id)
        dlc_path = wares_dir / f"{dlc_name}.xml"
        if not dlc_path.exists():
            continue

        shape = detect_xml_shape(dlc_path, base_root_tag)
        root = ET.parse(dlc_path).getroot()

        if shape == "direct":
            for ware in root.findall("./ware[@id]"):
                ware_id = ware.get("id")
                if ware_id and ware_id not in tags:
                    tags[ware_id] = dlc_name
            continue

        if shape != "patch":
            continue

        for add_node in root.findall("./add[@sel='/wares']"):
            for ware in add_node.findall("./ware[@id]"):
                ware_id = ware.get("id")
                if ware_id and ware_id not in tags:
                    tags[ware_id] = dlc_name

    return tags


def build_direct_entity_dlc_tag_map(
    entity_dir: Path,
    dlc_order: Iterable[str],
    extractor: Callable[[ET.Element], Optional[str]],
) -> Dict[str, str]:
    tags: Dict[str, str] = {}
    base_path = entity_dir / "base.xml"
    if not base_path.exists():
        return tags

    base_root = ET.parse(base_path).getroot()
    base_root_tag = base_root.tag
    for entity_id in filter(None, (extractor(node) for node in list(base_root))):
        if entity_id not in tags:
            tags[entity_id] = "base"

    for dlc_id in dlc_order:
        dlc_name = normalize_dlc_name(dlc_id)
        dlc_path = entity_dir / f"{dlc_name}.xml"
        if not dlc_path.exists():
            continue
        if detect_xml_shape(dlc_path, base_root_tag) != "direct":
            continue
        root = ET.parse(dlc_path).getroot()
        for entity_id in filter(None, (extractor(node) for node in list(root))):
            if entity_id not in tags:
                tags[entity_id] = dlc_name

    return tags
