#!/usr/bin/env python3
"""Extract resource areas from X4 save file and output to JSON format."""

import sys
import os
import json
import xml.etree.ElementTree as ET
from pathlib import Path

# Gas wares list for falloff calculation
GAS_WARES = {'helium', 'hydrogen', 'methane'}

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MAPS_JSON = PROJECT_ROOT / 'src' / 'assets' / 'x4_game_data' / '8.0-Diplomacy' / 'data' / 'maps.json'
REGION_YIELDS_JSON = PROJECT_ROOT / 'src' / 'assets' / 'x4_game_data' / '8.0-Diplomacy' / 'data' / 'regionyields.json'
SAVE_DATA_DIR = PROJECT_ROOT / 'save_data'


def load_maps_sectors():
    """Load all sector names from maps.json."""
    with open(MAPS_JSON, 'r', encoding='utf-8') as f:
        maps_data = json.load(f)

    return [sector_id.lower() for sector_id in maps_data.get('sectors', {}).keys()]


def load_region_yields():
    """Load region yields data for resourcedensity lookup (density only)."""
    with open(REGION_YIELDS_JSON, 'r', encoding='utf-8') as f:
        yields_data = json.load(f)

    # Build lookup: ware -> yield_name -> resourcedensity
    lookup = {}
    for ware_entry in yields_data:
        ware = ware_entry['ware']
        lookup[ware] = {}
        for yield_entry in ware_entry['yields']:
            lookup[ware][yield_entry['name']] = yield_entry['resourcedensity']

    return lookup


def load_region_yields_full():
    """Load region yields data with full info (resourcedensity, replenishtime)."""
    with open(REGION_YIELDS_JSON, 'r', encoding='utf-8') as f:
        yields_data = json.load(f)

    # Build lookup: ware -> yield_name -> {resourcedensity, replenishtime}
    lookup = {}
    for ware_entry in yields_data:
        ware = ware_entry['ware']
        lookup[ware] = {}
        for yield_entry in ware_entry['yields']:
            lookup[ware][yield_entry['name']] = {
                'resourcedensity': yield_entry['resourcedensity'],
                'replenishtime': yield_entry['replenishtime']
            }

    return lookup


def find_yield_by_time(region_yields_full, ware, time_val):
    """
    Find yield_name by matching time with replenishtime * 60.
    Returns (yield_name, resourcedensity) or (None, 0) if not found.
    """
    if ware not in region_yields_full:
        return None, 0

    expected_replenishtime = time_val / 60

    for yield_name, data in region_yields_full[ware].items():
        if abs(data['replenishtime'] - expected_replenishtime) < 0.001:  # Float comparison tolerance
            return yield_name, data['resourcedensity']

    return None, 0


def calculate_falloff(ware, max_val, resourcedensity):
    """Calculate falloff based on ware type."""
    if ware.lower() in GAS_WARES:
        # Gas: max / resourcedensity
        return max_val / resourcedensity
    else:
        # Solid: max / (resourcedensity * 64^3)
        return max_val / (resourcedensity * 262144)


def extract_sector_resources(save_file, sector_macro, region_yields_full=None):
    """
    Extract resource areas for a single sector.
    Uses XML <yield> elements as primary source, with time-based matching as fallback.
    Handles multiple yields per ware by emitting one record per yield.
    """
    sector_macro_lower = sector_macro.lower()
    results = []

    in_target_sector = False

    for event, elem in ET.iterparse(save_file, events=("start", "end")):
        if event == "start":
            if (elem.tag == "component" and
                elem.get("class") == "sector" and
                elem.get("macro", "").lower() == sector_macro_lower):
                in_target_sector = True

        elif event == "end":
            if in_target_sector and elem.tag == "component":
                in_target_sector = False
                break

            if in_target_sector and elem.tag == "area":
                # Extract coordinates (default to 0 if not present)
                x = int(elem.get("x", 0))
                y = int(elem.get("y", 0))
                z = int(elem.get("z", 0))

                # Extract wares and yields
                wares_elem = elem.find("wares")
                yields_elem = elem.find("yields")

                if wares_elem is not None and yields_elem is not None:
                    # Build yields list for each ware (a ware may have multiple yields)
                    ware_yields = {}
                    for ware_elem in yields_elem.findall("ware"):
                        ware_name = ware_elem.get("ware", "")
                        yield_names = [y.get("name", "") for y in ware_elem.findall("yield")]
                        ware_yields[ware_name] = yield_names

                    # Extract ware data and emit one record per yield
                    for ware_elem in wares_elem.findall("ware"):
                        ware_name = ware_elem.get("ware", "")
                        recharge_elem = ware_elem.find("recharge")

                        if recharge_elem is not None:
                            max_val = int(recharge_elem.get("max", 0))
                            time_val = int(recharge_elem.get("time", 0))

                            # Get yields for this ware from XML (primary source)
                            xml_yields = ware_yields.get(ware_name, [])

                            # Fallback: use time-based matching only if XML has no yields for this ware
                            if not xml_yields and region_yields_full:
                                for yield_name, data in region_yields_full.get(ware_name, {}).items():
                                    if abs(data['replenishtime'] * 60 - time_val) < 0.001:
                                        xml_yields.append(yield_name)

                            if not xml_yields:
                                # Final fallback: emit empty yield_name
                                xml_yields = [""]

                            for yield_name in xml_yields:
                                results.append({
                                    "x": x,
                                    "y": y,
                                    "z": z,
                                    "ware": ware_name,
                                    "max": max_val,
                                    "time": time_val,
                                    "yield_name": yield_name
                                })

    return results


def extract_sector_xml(save_file, sector_macro, output_dir):
    """
    Extract raw XML resource areas for a single sector.
    Output includes: area coordinates, wares with recharge, and yields elements.
    Returns the XML string or None if sector not found.
    """
    sector_macro_lower = sector_macro.lower()
    save_name = Path(save_file).stem

    output_path = Path(output_dir) / save_name
    output_path.mkdir(parents=True, exist_ok=True)

    output_file = output_path / f"{sector_macro_lower}_resources.xml"

    print(f"Extracting XML resources for {sector_macro}...")

    for event, elem in ET.iterparse(save_file, events=("start", "end")):
        if event == "start":
            if (elem.tag == "component" and
                elem.get("class") == "sector" and
                elem.get("macro", "").lower() == sector_macro_lower):
                # Find resourceareas element
                resourceareas = elem.find("resourceareas")
                if resourceareas is None:
                    print(f"  No resourceareas found in {sector_macro}")
                    return None

                # Build XML structure with only resource-related data
                root = ET.Element("sector_resources", {
                    "sector": sector_macro_lower,
                    "class": "sector"
                })

                # Copy resourceareas with all area children
                ra_copy = ET.SubElement(root, "resourceareas")
                for area in resourceareas.findall("area"):
                    area_copy = ET.SubElement(ra_copy, "area")
                    # Copy coordinates
                    for attr in ['x', 'y', 'z']:
                        if attr in area.attrib:
                            area_copy.set(attr, area.get(attr))

                    # Copy wares
                    wares_elem = area.find("wares")
                    if wares_elem is not None:
                        wares_copy = ET.SubElement(area_copy, "wares")
                        for ware in wares_elem.findall("ware"):
                            ware_copy = ET.SubElement(wares_copy, "ware", {"ware": ware.get("ware")})
                            recharge = ware.find("recharge")
                            if recharge is not None:
                                recharge_copy = ET.SubElement(ware_copy, "recharge")
                                for attr in ['max', 'current', 'time']:
                                    if attr in recharge.attrib:
                                        recharge_copy.set(attr, recharge.get(attr))

                    # Copy yields
                    yields_elem = area.find("yields")
                    if yields_elem is not None:
                        yields_copy = ET.SubElement(area_copy, "yields")
                        for ware in yields_elem.findall("ware"):
                            ware_copy = ET.SubElement(yields_copy, "ware", {"ware": ware.get("ware")})
                            for yield_elem in ware.findall("yield"):
                                ET.SubElement(ware_copy, "yield", {"name": yield_elem.get("name")})

                # Write to file with pretty print
                xml_content = ET.tostring(root, encoding='unicode', method='xml')

                # Pretty print with indentation
                import xml.dom.minidom as minidom
                dom = minidom.parseString(xml_content)
                pretty_xml = dom.toprettyxml(indent="  ", encoding=None)
                # Remove extra blank lines and XML declaration (we add our own)
                lines = [line for line in pretty_xml.split('\n') if line.strip()]

                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
                    f.write('\n'.join(lines[1:]))  # Skip minidom's declaration

                # Count areas
                area_count = len(resourceareas.findall("area"))
                print(f"  Found {area_count} areas, saved to {output_file}")
                return output_file

    print(f"  Sector {sector_macro} not found!")
    return None


def save_sector_json(data, save_name, sector_name):
    """
    Save extracted data to sector JSON file, aggregated by ware -> yield_name.
    Does NOT include resourcedensity/falloff (those are added during aggregate).
    """
    output_dir = SAVE_DATA_DIR / save_name
    output_dir.mkdir(parents=True, exist_ok=True)

    # Aggregate by ware -> yield_name -> resources
    ware_dict = {}
    for entry in data:
        ware = entry["ware"]
        yield_name = entry["yield_name"]

        if ware not in ware_dict:
            ware_dict[ware] = {}

        if yield_name not in ware_dict[ware]:
            ware_dict[ware][yield_name] = {"resources": []}

        resource_obj = {
            "x": entry["x"],
            "y": entry["y"],
            "z": entry["z"],
            "max": entry["max"],
            "time": entry["time"]
        }
        ware_dict[ware][yield_name]["resources"].append(resource_obj)

    # Build final structure
    sector_data = {
        "sector_id": sector_name.lower(),
        "ware": ware_dict
    }

    output_file = output_dir / f"{sector_name.lower()}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sector_data, f, indent=2, ensure_ascii=False)

    # Count total resources for logging
    total_resources = sum(
        len(y_data["resources"])
        for w_data in ware_dict.values()
        for y_data in w_data.values()
    )
    print(f"Saved {len(ware_dict)} wares, {total_resources} resources to {output_file}")


def aggregate_to_total(save_name, region_yields):
    """
    Aggregate all sector JSON files into total.json, then write back
    resourcedensity and falloff to each sector JSON file.

    total.json: Each sector contains aggregated data per ware+yield_name:
    - max (sum of all resources)
    - time (from first resource)
    - resourcedensity
    - respawn = max * 3600 / time
    - falloff

    Sector JSON files: Each resource gets resourcedensity and falloff added.
    """
    save_dir = SAVE_DATA_DIR / save_name

    if not save_dir.exists():
        print(f"Error: Save directory {save_dir} does not exist.")
        return

    # Collect all sector JSON files (exclude total.json)
    sector_files = [f for f in save_dir.glob("*.json") if f.name != "total.json"]

    sectors_data = []

    for sector_file in sorted(sector_files):
        with open(sector_file, 'r', encoding='utf-8') as f:
            sector_data = json.load(f)

        if not sector_data:
            continue

        sector_id = sector_data.get("sector_id", sector_file.stem.lower())
        ware_dict = sector_data.get("ware", {})

        # Aggregate: ware -> yield_name -> {max_sum, time, resourcedensity, respawn, falloff}
        aggregated_ware_dict = {}

        for ware, yields_data in ware_dict.items():
            aggregated_ware_dict[ware] = {}

            for yield_name, yield_data in yields_data.items():
                resources = yield_data.get("resources", [])

                if not resources:
                    continue

                # Get resourcedensity from region_yields
                resourcedensity = region_yields.get(ware, {}).get(yield_name, 0)

                # Sum max values
                max_sum = sum(r["max"] for r in resources)

                # Use time from first resource (all should have same time for same ware+yield)
                time_val = resources[0]["time"]

                # Calculate respawn = max * 3600 / time
                respawn = max_sum * 3600 / time_val if time_val > 0 else 0

                # Calculate falloff
                if resourcedensity > 0:
                    falloff = calculate_falloff(ware, max_sum, resourcedensity)
                else:
                    falloff = 0

                aggregated_ware_dict[ware][yield_name] = {
                    "max": max_sum,
                    "time": time_val,
                    "resourcedensity": resourcedensity,
                    "respawn": round(respawn, 6),
                    "falloff": round(falloff, 6)
                }

                # Write back resourcedensity and falloff to each resource
                for res in resources:
                    res["resourcedensity"] = resourcedensity
                    if resourcedensity > 0:
                        res["falloff"] = round(calculate_falloff(ware, res["max"], resourcedensity), 6)
                    else:
                        res["falloff"] = 0

        # Write back enhanced sector data
        enhanced_sector_data = {
            "sector_id": sector_id,
            "ware": ware_dict
        }
        with open(sector_file, 'w', encoding='utf-8') as f:
            json.dump(enhanced_sector_data, f, indent=2, ensure_ascii=False)

        sector_obj = {
            "sector_id": sector_id,
            "ware": aggregated_ware_dict
        }

        sectors_data.append(sector_obj)
        total_entries = sum(
            len(y_data)
            for w_data in aggregated_ware_dict.values()
            for y_data in w_data.values()
        )
        print(f"Processed {sector_id}: {total_entries} ware+yield entries")

    # Build final structure
    total_data = {"sectors": sectors_data}

    output_file = save_dir / "total.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(total_data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {len(sectors_data)} sectors to {output_file}")


def extract_all_sectors(save_file):
    """Extract resources for all sectors from maps.json."""
    save_name = Path(save_file).stem
    sectors = load_maps_sectors()
    region_yields = load_region_yields()
    region_yields_full = load_region_yields_full()

    print(f"Extracting from {save_file}")
    print(f"Found {len(sectors)} sectors in maps.json")

    for i, sector in enumerate(sectors):
        print(f"\n[{i+1}/{len(sectors)}] Processing {sector}...")
        entries = extract_sector_resources(save_file, sector, region_yields_full)
        if entries:
            save_sector_json(entries, save_name, sector)
        else:
            print(f"  No resources found in {sector}")

    print("\n--- Aggregating to total.json ---")
    aggregate_to_total(save_name, region_yields)


def extract_all_sectors_xml(save_file):
    """Extract XML resources for all sectors from maps.json."""
    save_name = Path(save_file).stem
    sectors = load_maps_sectors()

    print(f"Extracting XML from {save_file}")
    print(f"Found {len(sectors)} sectors in maps.json")

    output_dir = SAVE_DATA_DIR / save_name
    output_dir.mkdir(parents=True, exist_ok=True)

    for i, sector in enumerate(sectors):
        print(f"\n[{i+1}/{len(sectors)}] Processing {sector}...")
        extract_sector_xml(save_file, sector, output_dir)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 extract_resources.py <save_file> --sector <sector_macro>")
        print("  python3 extract_resources.py <save_file> --xml <sector_macro>")
        print("  python3 extract_resources.py <save_file> --xml-all")
        print("  python3 extract_resources.py <save_file> --all")
        print("  python3 extract_resources.py <save_file> --aggregate")
        print()
        print("Examples:")
        print("  python3 extract_resources.py save_005.xml --sector cluster_01_sector001_macro  (JSON)")
        print("  python3 extract_resources.py save_005.xml --xml cluster_01_sector001_macro    (XML)")
        print("  python3 extract_resources.py save_005.xml --xml-all                           (All XML)")
        print("  python3 extract_resources.py save_005.xml --all                               (All JSON)")
        print("  python3 extract_resources.py save_005.xml --aggregate")
        sys.exit(1)

    save_file = sys.argv[1]

    if not os.path.exists(save_file):
        print(f"Error: Save file '{save_file}' not found.")
        sys.exit(1)

    if len(sys.argv) < 3:
        print("Error: Missing mode argument (--sector, --xml, --xml-all, --all, or --aggregate)")
        sys.exit(1)

    mode = sys.argv[2]

    if mode == "--sector":
        if len(sys.argv) < 4:
            print("Error: Missing sector macro name")
            sys.exit(1)

        sector_macro = sys.argv[3]
        save_name = Path(save_file).stem

        # Load region_yields_full for time-based yield matching
        region_yields_full = load_region_yields_full()

        print(f"Extracting {sector_macro} to JSON...")
        entries = extract_sector_resources(save_file, sector_macro, region_yields_full)
        print(f"Found {len(entries)} resource entries")

        save_sector_json(entries, save_name, sector_macro)

    elif mode == "--xml":
        if len(sys.argv) < 4:
            print("Error: Missing sector macro name")
            sys.exit(1)

        sector_macro = sys.argv[3]

        print(f"Extracting {sector_macro} to XML...")
        extract_sector_xml(save_file, sector_macro, SAVE_DATA_DIR)

    elif mode == "--xml-all":
        extract_all_sectors_xml(save_file)

    elif mode == "--all":
        extract_all_sectors(save_file)

    elif mode == "--aggregate":
        save_name = Path(save_file).stem
        region_yields = load_region_yields()
        aggregate_to_total(save_name, region_yields)

    else:
        print(f"Error: Unknown mode '{mode}'")
        sys.exit(1)


if __name__ == "__main__":
    main()
