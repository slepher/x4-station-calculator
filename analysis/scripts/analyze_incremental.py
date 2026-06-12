#!/usr/bin/env python3
"""
Incremental sector assignment: handles existing groups + new player sectors.

Existing groups have各自的 jumpRange. New sectors assigned greedily.
Auto-extends jumpRange when sector is beyond range but within 5.
Standalone new groups get default jumpRange and auto-connect to nearest.

Config:
  DEFAULT_JUMP_RANGE = 2
  CONTAINER_THRESHOLD = 5_000_000 m³
  SCORE_CLOSE_RATIO = 0.30
"""

import json
from collections import defaultdict, deque
from math import log

DEFAULT_JUMP_RANGE = 2
CONTAINER_THRESHOLD = 5_000_000
SCORE_CLOSE_RATIO = 0.30
MAX_UNCERTAIN_RANGE = 5

# ─── Load data ────────────────────────────────────────────────

with open("src/assets/x4_game_data/8.0-Diplomacy/data/modules.json") as f:
    modules_list = json.load(f)
with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
    maps = json.load(f)
with open("save_009.json") as f:
    save = json.load(f)

# ─── Module cargo ─────────────────────────────────────────────

module_cargo = {}
for m in modules_list:
    cargo = m.get("cargo", {})
    if cargo and cargo.get("capacity", 0) > 0:
        module_cargo[m["macroId"]] = {"capacity": cargo["capacity"], "type": cargo.get("type", "unknown")}

# ─── Cluster adjacency ────────────────────────────────────────

clusters_dict = maps["clusters"]
sectors_dict = maps["sectors"]

cluster_adj = defaultdict(set)
for sd in sectors_dict.values():
    src = sd["cluster_id"]
    for gate in sd.get("cluster_gates", {}).values():
        cluster_adj[src].add(gate["target_cluster_id"])

sector_to_cluster = {s: sectors_dict[s]["cluster_id"] for s in sectors_dict}
cluster_names = {c["id"]: c.get("name", c["id"]) for c in clusters_dict.values()}
sector_names = {s["id"]: s.get("name", s["id"]) for s in sectors_dict.values()}


def jump_distance(a: str, b: str) -> int | None:
    if a == b:
        return 0
    ca, cb = sector_to_cluster.get(a), sector_to_cluster.get(b)
    if ca is None or cb is None:
        return None
    if ca == cb:
        return 0
    visited = {ca}
    queue = deque([(ca, 0)])
    while queue:
        curr, dist = queue.popleft()
        if curr == cb:
            return dist
        if dist >= 10:
            continue
        for nb in cluster_adj.get(curr, set()):
            if nb not in visited:
                visited.add(nb)
                queue.append((nb, dist + 1))
    return None


def get_coverage_sectors(anchor: str, jump_range: int):
    """BFS: all sectors within jump_range of anchor."""
    result = []
    for sm in sectors_dict:
        d = jump_distance(anchor, sm)
        if d is not None and d <= jump_range and sm != anchor:
            result.append((sm, d))
    return result


# ─── Hub detection ────────────────────────────────────────────

def compute_station_stats(station):
    counts = defaultdict(int)
    for m in station.get("modules", []):
        ref = m.get("ref", "")
        if ref:
            counts[ref] += m.get("amount", 0)
    for c in station.get("constructions", []):
        ref = c.get("ref", "")
        if ref:
            counts[ref] += 1
    return dict(counts)


def compute_hub_info(macro_counts):
    container_cap = 0
    prod_lines = 0
    for macro_id, amount in macro_counts.items():
        ci = module_cargo.get(macro_id)
        if ci and ci["type"] == "container":
            container_cap += ci["capacity"] * amount
        elif "prod_" in macro_id:
            prod_lines += amount
    qualified = container_cap >= CONTAINER_THRESHOLD
    if qualified:
        score = container_cap / (1 + log(1 + prod_lines))
    else:
        score = container_cap
    return {"container_cap": container_cap, "prod_lines": prod_lines,
            "qualified": qualified, "score": score}


# ─── Build all player station data ────────────────────────────

all_stations = []
for sm, sd in save["sectors"].items():
    ps = sd.get("player_stations", {})
    for code, st in ps.items():
        info = compute_hub_info(compute_station_stats(st))
        all_stations.append((sm, code, info))

# Sector → stations
sector_stations_map = defaultdict(list)
for sm, code, info in all_stations:
    sector_stations_map[sm].append((code, info))

# Sector → best pure hub
sector_pure_hub = {}
for sm, stations in sector_stations_map.items():
    best = max(
        ((code, info) for code, info in stations if info["qualified"] and info["prod_lines"] == 0),
        key=lambda x: x[1]["score"],
        default=None,
    )
    if best:
        sector_pure_hub[sm] = best

player_sectors = set(sm for sm in sector_stations_map)


# ─── Simulate existing groups ─────────────────────────────────
# For demo: take 4 of the 7 groups from the clean-slate result as "existing"
# and leave the remaining sectors as "new" / "updated save"

existing_groups = [
    {"name": "Hatikvah's Choice", "anchor": "cluster_29_sector001_macro",
     "jump_range": 2, "hub_code": "HDJ-767"},
    {"name": "Tharka's Cascade", "anchor": "cluster_32_sector001_macro",
     "jump_range": 2, "hub_code": "YMY-537"},
    {"name": "Eighteen Billion", "anchor": "cluster_02_sector001_macro",
     "jump_range": 1, "hub_code": "AQJ-601"},  # different jumpRange
    {"name": "Nopileos' Fortune", "anchor": "cluster_04_sector002_macro",
     "jump_range": 2, "hub_code": "ECX-552"},
]

# Manually mark which sectors are "already assigned" (from previous binding)
assigned_sectors = {
    # Hatikvah group
    "cluster_29_sector001_macro",
    "cluster_31_sector001_macro",   # Heretic's End
    "cluster_706_sector001_macro",  # Hatikvah's Faith
    # Tharka group
    "cluster_32_sector001_macro",
    "cluster_32_sector002_macro",
    "cluster_33_sector001_macro",   # Matrix #79B
    "cluster_708_sector001_macro",  # Matrix #101
    # Eighteen Billion group
    "cluster_02_sector001_macro",
    "cluster_01_sector001_macro",   # Grand Exchange I
    # Nopileos group
    "cluster_04_sector001_macro",
    "cluster_04_sector002_macro",
    "cluster_37_sector001_macro",   # Pious Mists IV
}

# "New" sectors = player sectors NOT in assigned_sectors
new_sectors = player_sectors - assigned_sectors

# ─── Incremental assignment algorithm ─────────────────────────

print("=" * 80)
print("INCREMENTAL ASSIGNMENT (existing groups + new sectors)")
print(f"  Existing groups: {len(existing_groups)}")
print(f"  Already assigned sectors: {len(assigned_sectors)}")
print(f"  New sectors to assign: {len(new_sectors)}")
print("=" * 80)

# Build existing group data
groups = []
for g in existing_groups:
    groups.append({
        "anchor": g["anchor"],
        "jump_range": g["jump_range"],
        "effective_range": g["jump_range"],  # may be auto-extended
        "hub_code": g["hub_code"],
        "name": g["name"],
        "is_existing": True,
        "coverage": set(),
    })

# Pre-compute: which sectors are within each group's range
for g in groups:
    coverage = get_coverage_sectors(g["anchor"], g["jump_range"])
    g["coverage"] = {sm for sm, _ in coverage}

# Assignment results
assignments = {}    # sector → (group_index, distance, auto_extended, default_selected)
standalone_new = []  # new standalone groups
uncertain = []      # sectors needing user choice

for sm in sorted(new_sectors):
    # Find groups whose effective coverage includes this sector
    candidates = []
    for gi, g in enumerate(groups):
        d = jump_distance(sm, g["anchor"])
        if d is None:
            continue
        if d <= g["jump_range"]:
            candidates.append((d, gi, False))  # within range, no extension needed
        elif d <= MAX_UNCERTAIN_RANGE:
            candidates.append((d, gi, True))   # needs extension

    if not candidates:
        # No group within 5 jumps → suggest standalone
        standalone_new.append(sm)
        continue

    # Sort by (extension_needed, distance)
    candidates.sort(key=lambda c: (1 if c[2] else 0, c[0]))

    # Check if the best candidate is a clear choice (no close alternatives)
    best = candidates[0]
    best_ext = best[2]
    best_dist = best[0]
    best_gi = best[1]

    # Find competing candidates at same or closer distance
    close = []
    for d, gi, ext in candidates:
        if gi == best_gi:
            continue
        # Same distance and not extension-only → compare scores
        if d == best_dist and not ext:
            best_score = sector_pure_hub.get(groups[best_gi]["anchor"], (None, {}))[1].get("score", 0)
            other_score = sector_pure_hub.get(groups[gi]["anchor"], (None, {}))[1].get("score", 0)
            if best_score > 0 and abs(other_score - best_score) / best_score <= SCORE_CLOSE_RATIO:
                close.append(gi)

    if close:
        # Score tie → uncertain
        uncertain.append({
            "sector": sm,
            "type": "score_tie",
            "options": [{"group_idx": best_gi, "distance": best_dist, "extend": best_ext}] +
                       [{"group_idx": gi, "distance": best_dist, "extend": False} for gi in close],
            "default": None,  # user must choose
        })
    elif best_ext:
        # Needs extension → uncertain (user decides: extend or standalone)
        uncertain.append({
            "sector": sm,
            "type": "range_extend",
            "options": [
                {"group_idx": best_gi, "distance": best_dist, "extend": True},
                {"standalone": True},
            ],
            "default": None,
        })
    else:
        # Clear assignment → auto-assigned, default selected
        assignments[sm] = {
            "group_idx": best_gi,
            "distance": best_dist,
            "extended": False,
            "default_selected": True,
        }

# ─── Print results ────────────────────────────────────────────

print()
print("── Existing Groups ──")
for gi, g in enumerate(groups):
    print(f"  [{gi}] {g['name']}  anchor={g['anchor']}  jump={g['jump_range']}  hub={g['hub_code']}")

print()
print("── Auto-Assigned (default selected ●) ──")
for sm, a in sorted(assignments.items(), key=lambda x: x[1]["distance"]):
    g = groups[a["group_idx"]]
    cn = cluster_names.get(sector_to_cluster.get(sm, ""), "")
    sn = sector_names.get(sm, sm)
    print(f"  {cn} / {sn}  →  {g['name']}  jump={a['distance']}  "
          f"{'(extends range!)' if a['extended'] else ''}")

if standalone_new:
    print()
    print("── Suggested Standalone ──")
    for sm in sorted(standalone_new):
        cn = cluster_names.get(sector_to_cluster.get(sm, ""), "")
        sn = sector_names.get(sm, sm)
        # Find nearest group
        nearest = min(
            ((jump_distance(sm, g["anchor"]), gi) for gi, g in enumerate(groups)
             if jump_distance(sm, g["anchor"]) is not None),
            key=lambda x: x[0],
            default=None,
        )
        dist_str = f"nearest: {groups[nearest[1]]['name']} ({nearest[0]} jumps)" if nearest else "no group reachable"
        print(f"  {cn} / {sn}  →  new standalone group  ({dist_str})")

if uncertain:
    print()
    print("── Uncertain (user chooses) ──")
    for u in uncertain:
        sm = u["sector"]
        cn = cluster_names.get(sector_to_cluster.get(sm, ""), "")
        sn = sector_names.get(sm, sm)
        sts = sector_stations_map.get(sm, [])
        st_str = ", ".join(f"{c}" for c, _ in sts)
        print(f"  {cn} / {sn}  [{u['type']}]  stations: {st_str}")
        for oi, opt in enumerate(u["options"]):
            if opt.get("standalone"):
                print(f"    [{chr(65+oi)}] 独立成组")
            else:
                g = groups[opt["group_idx"]]
                ext = " (扩展跳数)" if opt["extend"] else ""
                print(f"    [{chr(65+oi)}] 吸收 → {g['name']}  jump={opt['distance']}{ext}")
        print(f"    > user must select")

# ─── Statistics ───────────────────────────────────────────────

print()
print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"  Existing groups: {len(groups)}")
print(f"  New sectors: {len(new_sectors)}")
print(f"  Auto-assigned: {len(assignments)}")
print(f"  Standalone: {len(standalone_new)}")
print(f"  Uncertain: {len(uncertain)}")

# Show what "Eighteen Billion with jump=1" changes
print()
print("── Note: Eighteen Billion jump=1 (not default 2) ──")
eighteen = next(g for g in groups if g["name"] == "Eighteen Billion")
coverage = get_coverage_sectors(eighteen["anchor"], eighteen["jump_range"])
print(f"  Coverage sectors within jump=1: {len(coverage)}")
print(f"  Sectors: {', '.join(sector_names.get(sm, sm) for sm, _ in coverage[:5])}")
