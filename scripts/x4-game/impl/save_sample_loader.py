"""Unified save sample loader for gas and solid fields.

Consolidates the loading logic from replay_context.py and solid_replay.py.
"""

from __future__ import annotations

import json
from pathlib import Path


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"


def load_save_sample(
    sector_id: str,
    ware: str,
    yield_name: str = "",
    region_filter: str = "",
) -> dict[tuple[int, int, int], dict]:
    """Load save sample data for a ware in a sector.

    Unified loader that works for both gas and solid fields.
    Loads from {sector_id_lower}.json in save_sample_data/.

    Args:
        sector_id: Sector identifier (e.g., "Cluster_713_Sector001_macro")
        ware: Ware type (e.g., "hydrogen", "ore")
        yield_name: Optional yield name filter (for solid fields)
        region_filter: Optional region name filter

    Returns:
        Dict mapping (x, y, z) coordinate to save entry dict with "max" field
    """
    save_path = SAVE_SAMPLE_ROOT / f"{sector_id.lower()}.json"
    if not save_path.exists():
        return {}

    with save_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    # Get ware data
    ware_data = data.get("ware", {}).get(ware)
    if not ware_data:
        return {}

    # Parse ware data - handles multiple formats
    rows = _parse_ware_data(ware_data, yield_name, region_filter)

    return {(int(row["x"]), int(row["y"]), int(row["z"])): row for row in rows}


def _parse_ware_data(
    ware_data: dict | list,
    yield_name: str = "",
    region_filter: str = "",
) -> list[dict]:
    """Parse ware data from various formats.

    Handles:
    - List format: ware_data is a direct list of resource entries
    - Nested resources: ware_data.resources contains the list
    - Yield-grouped: ware_data[yield_name].resources contains entries
    - Region-filtered: entries with regions matching region_filter

    Args:
        ware_data: The ware data from save file
        yield_name: Optional yield name to filter by
        region_filter: Optional region name to filter by

    Returns:
        List of resource entry dicts
    """
    rows = []

    # Format 1: Direct list
    if isinstance(ware_data, list):
        rows = ware_data
    # Format 2: Nested resources
    elif "resources" in ware_data:
        rows = ware_data.get("resources", [])
    # Format 3: Yield-grouped
    elif isinstance(ware_data, dict):
        if yield_name and yield_name in ware_data:
            yield_data = ware_data[yield_name]
            if isinstance(yield_data, dict) and "resources" in yield_data:
                rows = yield_data["resources"]
        else:
            # Try to get resources from any yield
            for yn, yd in ware_data.items():
                if isinstance(yd, dict) and "resources" in yd:
                    rows.extend(yd["resources"])

    # Apply region filter if specified
    if region_filter:
        filtered_rows = []
        for row in rows:
            regions = row.get("regions", [])
            # Handle regions as list of strings or list of dicts
            region_refs = []
            for r in regions:
                if isinstance(r, dict):
                    region_refs.append(r.get("ref", ""))
                else:
                    region_refs.append(str(r))
            if any(region_filter in ref for ref in region_refs):
                filtered_rows.append(row)
        rows = filtered_rows

    return rows


def load_total_save_sample(
    sector_id: str,
    ware: str,
    region_filter: str = "",
) -> dict:
    """Load total save sample from total.json.

    Args:
        sector_id: Sector identifier
        ware: Ware type
        region_filter: Optional region name filter

    Returns:
        Dict with "max", "cutted" totals
    """
    total_path = SAVE_SAMPLE_ROOT / "total.json"
    if not total_path.exists():
        return {}

    with total_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    for sector in data.get("sectors", []):
        if sector.get("sector_id") == sector_id.lower():
            ware_data = sector.get("ware", {}).get(ware)
            if not ware_data:
                return {}

            # Handle list format
            if isinstance(ware_data, list):
                total = {"max": 0, "cutted": 0}
                for entry in ware_data:
                    if region_filter:
                        regions = entry.get("regions", [])
                        if not any(region_filter in r.get("ref", "") for r in regions):
                            continue
                    total["max"] += entry.get("max", 0)
                    total["cutted"] += entry.get("cutted", 0)
                return total if total["max"] > 0 else {}

            # Handle dict format (old)
            if region_filter and region_filter in ware_data:
                return ware_data[region_filter]
            return ware_data

    return {}
