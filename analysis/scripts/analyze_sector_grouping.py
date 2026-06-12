#!/usr/bin/env python3
"""
Auto sector grouping for save_009.json (revised hub detection).

Hub detection:
  1. Only count CONTAINER storage capacity (exclude solid/liquid)
  2. Include in-construction (constructions[]) modules alongside built (modules[])
  3. Tiered ranking:
     Tier 1 (container_cap >= THRESHOLD): scored by cap / (1 + prod_lines)
     Tier 2 (container_cap < THRESHOLD): scored by cap only (no prod penalty)
     Tier 1 always ranks above Tier 2
  4. Grouping: greedy assign each player-sector to nearest Tier 1 hub
     within jumpRange, breaking ties by hub score.

Config:
  JUMP_RANGE = 2
  CONTAINER_THRESHOLD = 5_000_000  # m³, configurable
"""

import json
from collections import defaultdict, deque
from math import log

JUMP_RANGE = 2
CONTAINER_THRESHOLD = 5_000_000  # m³

# ─── Load data ────────────────────────────────────────────────

with open("src/assets/x4_game_data/8.0-Diplomacy/data/modules.json") as f:
    modules_list = json.load(f)
with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
    maps = json.load(f)
with open("save_009.json") as f:
    save = json.load(f)

# ─── Build module cargo info ──────────────────────────────────

module_cargo = {}  # macroId -> { capacity, type }
for m in modules_list:
    cargo = m.get("cargo", {})
    if cargo and cargo.get("capacity", 0) > 0:
        module_cargo[m["macroId"]] = {
            "capacity": cargo["capacity"],
            "type": cargo.get("type", "unknown"),
        }

# ─── Build cluster adjacency (same as buildSectorGraphFromMaps) ─

clusters_dict = maps["clusters"]
sectors_dict = maps["sectors"]

cluster_adj = defaultdict(set)
for sector_data in sectors_dict.values():
    src = sector_data["cluster_id"]
    for gate in sector_data.get("cluster_gates", {}).values():
        cluster_adj[src].add(gate["target_cluster_id"])

sector_to_cluster = {s: sectors_dict[s]["cluster_id"] for s in sectors_dict}
cluster_names = {c["id"]: c.get("name", c["id"]) for c in clusters_dict.values()}
sector_names = {s["id"]: s.get("name", s["id"]) for s in sectors_dict.values()}


def jump_distance(a: str, b: str) -> int | None:
    """Cluster-gate BFS distance between two sectors."""
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


# ─── Hub detection (revised) ──────────────────────────────────

def compute_station_stats(station):
    """Count modules (built + construction) by macroId."""
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
    """Return {container_cap, liquid_cap, solid_cap, prod_lines, qualified, score}."""
    container_cap = 0
    liquid_cap = 0
    solid_cap = 0
    prod_lines = 0
    for macro_id, amount in macro_counts.items():
        cargo_info = module_cargo.get(macro_id)
        if cargo_info:
            cap = cargo_info["capacity"] * amount
            t = cargo_info["type"]
            if t == "container":
                container_cap += cap
            elif t == "liquid":
                liquid_cap += cap
            elif t == "solid":
                solid_cap += cap
        elif "prod_" in macro_id:
            prod_lines += amount

    qualified = container_cap >= CONTAINER_THRESHOLD
    if qualified:
        score = container_cap / (1 + log(1 + prod_lines))
    else:
        score = container_cap
    return {
        "container_cap": container_cap,
        "liquid_cap": liquid_cap,
        "solid_cap": solid_cap,
        "prod_lines": prod_lines,
        "qualified": qualified,
        "score": score,
    }


# ─── Analyze all stations ─────────────────────────────────────

all_stations = []  # (sector_macro, code, hub_info)

for sm, sd in save["sectors"].items():
    ps = sd.get("player_stations", {})
    for code, st in ps.items():
        macro_counts = compute_station_stats(st)
        info = compute_hub_info(macro_counts)
        all_stations.append((sm, code, info))

# Sort: Tier 1 (qualified) first by score desc, then Tier 2 by capacity desc
all_stations.sort(
    key=lambda s: (0 if s[2]["qualified"] else 1, -s[2]["score"])
)

# ─── Pick hub per sector ──────────────────────────────────────

# One hub per sector: pick the highest-ranked qualified station in each sector
# If no qualified station, sector has no hub
sector_best_hub = {}  # sector_macro -> (code, hub_info)
for sm, code, info in all_stations:
    if not info["qualified"]:
        continue
    if sm not in sector_best_hub:
        sector_best_hub[sm] = (code, info)

# ─── Print hub rankings ───────────────────────────────────────

print("=" * 80)
print("REVISED HUB RANKING (container-only, threshold=5M m³, construction included)")
print("=" * 80)
print()
print(f"{'Rank':<5} {'Tier':<4} {'Sector':<35} {'Station':<10} {'Container':>12} {'Score':>16} {'Prod':>5}")
print("-" * 80)

for i, (sm, code, info) in enumerate(all_stations):
    tier = "T1" if info["qualified"] else "T2"
    rank = ""
    if info["qualified"]:
        # Find rank among T1 stations
        t1_idx = sum(1 for _, _, s in all_stations if s["qualified"] and s["score"] > info["score"])
        rank = str(t1_idx + 1)
    cluster = sector_to_cluster.get(sm, "?")
    cname = cluster_names.get(cluster, cluster)
    sname = sector_names.get(sm, sm)
    score_str = f"{info['score']:>14,.0f}" if info["qualified"] else f"{info['container_cap']:>10,} m³"
    print(
        f"  {rank:<4} [{tier}] {cname + ' / ' + sname:<30s} {code:<10} {info['container_cap']:>10,} m³  {score_str:>14}  "
        f"{info['prod_lines']:>4}"
    )

SCORE_CLOSE_RATIO = 0.30  # scores within 30% of each other → uncertain

# ─── Stage 1: Pure hubs only (prod_lines == 0) ─────────────────

# Pure hubs: qualified AND prod_lines == 0
pure_hubs = [
    (sm, code, info)
    for sm, (code, info) in sector_best_hub.items()
    if info["prod_lines"] == 0
]
pure_hubs.sort(key=lambda h: -h[2]["score"])

# Impure stations: qualified but prod_lines > 0
impure_stations = [
    (sm, code, info)
    for sm, code, info in all_stations
    if info["qualified"] and info["prod_lines"] > 0
]

print()
print("=" * 80)
print(f"AUTO-GROUPING (jumpRange={JUMP_RANGE})")
print(f"  Pure hubs (prod_lines=0): {len(pure_hubs)} from {len(set(sm for sm,_,_ in pure_hubs))} sectors")
print(f"  Impure candidates (prod_lines>0): {len(impure_stations)}")
print("=" * 80)

player_sectors = set(sm for sm, _, _ in all_stations)

# Phase A: assign all player sectors to nearest pure hub within jumpRange
#   If tied (same distance, scores within 30%) → flag uncertain
pure_groups = defaultdict(list)  # pure_hub_sector -> [(sector, distance)]
assigned = set()
flagged_score_close = []  # (sector, candidates_list)

for sm in sorted(player_sectors):
    candidates = []
    for hub_sm, hub_code, hub_info in pure_hubs:
        d = jump_distance(sm, hub_sm)
        if d is not None and d <= JUMP_RANGE:
            candidates.append((d, hub_info["score"], hub_sm, hub_code))
    if not candidates:
        continue

    candidates.sort(key=lambda c: (c[0], -c[1]))
    best = candidates[0]
    best_dist, best_score, best_sm, best_code = best

    # Check for score-close ties at the same distance
    tied = [
        c for c in candidates
        if c[0] == best_dist
        and c[2] != best_sm
        and best_score > 0
        and abs(c[1] - best_score) / best_score <= SCORE_CLOSE_RATIO
    ]
    if tied:
        flagged_score_close.append((sm, best, tied))
        continue  # Don't auto-assign

    pure_groups[best_sm].append((sm, best_dist))
    assigned.add(sm)

# Phase B: handle impure stations (those with prod_lines > 0)
#   - If sector already assigned to a pure hub group -> skip (absorbed)
#   - Else check distance to nearest pure hub:
#       ≤ jumpRange          -> absorbed by pure hub (add sector to its group)
#       jumpRange < d ≤ 5    -> 存疑 (flag for user review)
#       > 5                  -> standalone impure group
absorbed_by_pure = []       # (sector, station, nearest_hub, distance)
standalone_impure = []      # (sector, station, info)
flagged_uncertain = []      # (sector, station, info, nearest_hub_sm, nearest_hub_code, distance)

for sm, code, info in impure_stations:
    if sm in assigned:
        continue
    # Don't reassign sectors already flagged as score-tie
    if any(f[0] == sm for f in flagged_score_close):
        continue

    # Find nearest pure hub
    nearest = None
    nearest_dist = 999
    for hub_sm, hub_code, hub_info in pure_hubs:
        d = jump_distance(sm, hub_sm)
        if d is not None and d < nearest_dist:
            nearest_dist = d
            nearest = (hub_sm, hub_code)

    if nearest is None:
        standalone_impure.append((sm, code, info))
    elif nearest_dist <= JUMP_RANGE:
        pure_groups[nearest[0]].append((sm, nearest_dist))
        assigned.add(sm)
        absorbed_by_pure.append((sm, code, nearest[0], nearest[1], nearest_dist))
    elif nearest_dist <= 5:
        flagged_uncertain.append((sm, code, info, nearest[0], nearest[1], nearest_dist))
    else:
        standalone_impure.append((sm, code, info))

# Phase C: remaining unassigned sectors (Tier 2)
#   Tier 2 can't be standalone hubs → within 5 jumps: auto-absorb
#   Beyond 5 jumps: true exception
true_exceptions = []
t2_absorbed = []  # Tier 2 sectors auto-absorbed beyond jumpRange

for sm in sorted(player_sectors):
    if sm in assigned:
        continue
    if any(f[0] == sm for f in flagged_score_close):
        continue
    if any(f[0] == sm for f in flagged_uncertain):
        continue
    if any(f[0] == sm for f in standalone_impure):
        continue

    nearest = None
    nearest_dist = 999
    for hub_sm, hub_code, hub_info in pure_hubs:
        d = jump_distance(sm, hub_sm)
        if d is not None and d < nearest_dist:
            nearest_dist = d
            nearest = (hub_sm, hub_code)

    if nearest is None:
        true_exceptions.append((sm, None, None, None))
    elif nearest_dist <= 5:
        # Tier 2 can't be standalone → auto-absorb (even beyond jumpRange)
        pure_groups[nearest[0]].append((sm, nearest_dist))
        assigned.add(sm)
        t2_absorbed.append((sm, nearest[0], nearest[1], nearest_dist))
    else:
        true_exceptions.append((sm, nearest[0], nearest[1], nearest_dist))
        # Beyond 5 jumps -> standalone
        standalone_impure.append((sm, code, info))

# ─── Print pure hub groups ────────────────────────────────────

grp_idx = 0
for hub_sm, hub_code, hub_info in pure_hubs:
    members = pure_groups.get(hub_sm, [])
    if not members:
        continue
    grp_idx += 1
    hc = sector_to_cluster[hub_sm]
    print()
    print(
        f"Group {grp_idx}: {cluster_names.get(hc, hc)} / {sector_names.get(hub_sm, hub_sm)}"
    )
    print(
        f"  Pure hub: {hub_code}  "
        f"(container={hub_info['container_cap']:,.0f} m³)"
    )
    print(f"  Coverage ({len(members)} sectors):")
    for sm, dist in sorted(members, key=lambda x: x[1]):
        c = sector_to_cluster[sm]
        marker = "★" if sm == hub_sm else " "
        sector_stations = [
            (scode, sinfo)
            for s, scode, sinfo in all_stations
            if s == sm
        ]
        stations_str = ", ".join(
            f"{scode}"
            + (f"({sinfo['prod_lines']}prod)" if sinfo["prod_lines"] > 0 else "")
            for scode, sinfo in sector_stations
        )
        print(
            f"    {marker} jump={dist}  "
            f"{cluster_names.get(c, c)} / {sector_names.get(sm, sm)}"
        )
        print(f"       stations: {stations_str}")
    print()

# ─── Print standalone impure groups ─────────────────────────────

if standalone_impure:
    print("=" * 80)
    print("STANDALONE GROUPS (impure hub, no pure hub within 5 jumps)")
    print("=" * 80)
    for sm, code, info in standalone_impure:
        grp_idx += 1
        c = sector_to_cluster[sm]
        print()
        print(
            f"Group {grp_idx}: {cluster_names.get(c, c)} / {sector_names.get(sm, sm)}"
        )
        print(
            f"  Impure hub: {code}  "
            f"(container={info['container_cap']:,.0f} m³, prod_lines={info['prod_lines']})"
        )
        print(f"  Coverage (1 sector, standalone):")
        sector_stations = [
            (scode, sinfo)
            for s, scode, sinfo in all_stations
            if s == sm
        ]
        stations_str = ", ".join(
            f"{scode}"
            + (f"({sinfo['prod_lines']}prod)" if sinfo["prod_lines"] > 0 else "")
            for scode, sinfo in sector_stations
        )
        print(f"    ★ jump=0  {cluster_names.get(c, c)} / {sector_names.get(sm, sm)}")
        print(f"       stations: {stations_str}")

# ─── Print score-close uncertain ───────────────────────────────

def describe_group(hub_sm, extra_sectors=None):
    """Return a list of (sector, distance, is_hub) for a hub's group + optional extra sectors."""
    members = [(sm, dist, sm == hub_sm) for sm, dist in pure_groups.get(hub_sm, [])]
    if extra_sectors:
        for sm, dist in extra_sectors:
            if not any(m[0] == sm for m in members):
                members.append((sm, dist, False))
    members.sort(key=lambda x: x[1])
    return members

def format_group_members(members):
    lines = []
    for sm, dist, is_hub in members:
        c = sector_to_cluster[sm]
        marker = "★" if is_hub else " "
        lines.append(f"       {marker} jump={dist}  {cluster_names.get(c, c)} / {sector_names.get(sm, sm)}")
    return "\n".join(lines)

if flagged_score_close:
    print()
    print("=" * 80)
    print(f"UNCERTAIN — score tie (same jump, scores within {SCORE_CLOSE_RATIO*100:.0f}% — user choose)")
    print("=" * 80)
    for sm, best, tied in flagged_score_close:
        best_dist, best_score, best_sm, best_code = best
        c = sector_to_cluster[sm]
        option_letters = []
        
        # Option A: absorb into best hub
        opt_a_members = describe_group(best_sm, [(sm, best_dist)])
        option_letters.append("A")
        
        print()
        print(f"  Sector: {cluster_names.get(c, c)} / {sector_names.get(sm, sm)}")
        print(f"    [A] Absorb into {best_code} ({cluster_names.get(sector_to_cluster.get(best_sm, ''), best_sm)}, score={best_score:,.0f})")
        print(f"        Group would have {len(opt_a_members)} sectors:")
        print(format_group_members(opt_a_members))
        
        for ti, (t_dist, t_score, t_sm, t_code) in enumerate(tied):
            letter = chr(ord('B') + ti)
            option_letters.append(letter)
            diff_pct = abs(t_score - best_score) / best_score * 100
            opt_members = describe_group(t_sm, [(sm, t_dist)])
            print(f"    [{letter}] Absorb into {t_code} ({cluster_names.get(sector_to_cluster.get(t_sm, ''), t_sm)}, score={t_score:,.0f}, {diff_pct:.0f}% diff)")
            print(f"        Group would have {len(opt_members)} sectors:")
            print(format_group_members(opt_members))

# ─── Print impure uncertain ─────────────────────────────────────

if flagged_uncertain:
    print()
    print("=" * 80)
    print(f"UNCERTAIN — impure, beyond jumpRange={JUMP_RANGE} but within 5 — user choose")
    print("=" * 80)
    for sm, code, info, nearest_hub_sm, nearest_hub_code, dist in flagged_uncertain:
        c = sector_to_cluster[sm]
        hc = sector_to_cluster[nearest_hub_sm]
        print()
        print(f"  Sector: {cluster_names.get(c, c)} / {sector_names.get(sm, sm)}")
        print(f"    Station: {code} (container={info['container_cap']:,.0f} m³, prod_lines={info['prod_lines']})")
        
        # Option A: absorb
        opt_a_members = describe_group(nearest_hub_sm, [(sm, dist)])
        print(f"    [A] Absorb into {nearest_hub_code} ({cluster_names.get(hc, hc)}, {dist} jumps)")
        print(f"        Group would have {len(opt_a_members)} sectors:")
        print(format_group_members(opt_a_members))
        
        # Option B: standalone (this sector as its own hub)
        standalone_members = [(sm, 0, True)]
        # Find unassigned sectors within jumpRange of this impure station
        for other_sm in sorted(player_sectors):
            if other_sm == sm:
                continue
            if other_sm in assigned:
                continue
            if any(f[0] == other_sm for f in flagged_score_close):
                continue
            if any(f[0] == other_sm for f in flagged_uncertain):
                continue
            d = jump_distance(sm, other_sm)
            if d is not None and d <= JUMP_RANGE:
                standalone_members.append((other_sm, d, False))
        print(f"    [B] Create standalone group (hub: {code}, score={info['score']:,.0f})")
        print(f"        Group would have {len(standalone_members)} sectors:")
        print(format_group_members(standalone_members))

# ─── Print Tier 2 auto-absorbed ──────────────────────────────────

if t2_absorbed:
    print()
    print("=" * 80)
    print(f"TIER 2 AUTO-ABSORBED (beyond jumpRange={JUMP_RANGE} but within 5, can't be standalone)")
    print("=" * 80)
    for sm, hub_sm, hub_code, dist in t2_absorbed:
        c = sector_to_cluster[sm]
        hc = sector_to_cluster[hub_sm]
        sector_stations = [(scode, sinfo) for s, scode, sinfo in all_stations if s == sm]
        stations_str = ", ".join(
            f"{scode}({sinfo['container_cap']/1e6:.0f}M)" if sinfo["container_cap"] > 0 else scode
            for scode, sinfo in sector_stations
        )
        print(f"  {cluster_names.get(c, c)} / {sector_names.get(sm, sm)} → absorbed by {hub_code} ({cluster_names.get(hc, hc)}, {dist} jumps)")
        print(f"    stations: {stations_str}")

# ─── Print true exceptions ──────────────────────────────────────

if true_exceptions:
    print()
    print("=" * 80)
    print("EXCEPTIONS (no connection to any pure hub within 5 jumps)")
    print("=" * 80)
    for sm, _, _, nearest_dist in true_exceptions:
        c = sector_to_cluster[sm]
        cn = cluster_names.get(c, c)
        sn = sector_names.get(sm, sm)
        sector_stations = [(scode, sinfo) for s, scode, sinfo in all_stations if s == sm]
        stations_str = ", ".join(f"{scode}" for scode, _ in sector_stations)
        nearest = min(
            (
                (jump_distance(sm, hs), hs)
                for hs, _, _ in pure_hubs
                if jump_distance(sm, hs) is not None
            ),
            key=lambda x: x[0],
            default=None,
        )
        print(f"  {cn} / {sn}")
        print(f"    stations: {stations_str}")
        if nearest:
            ncn = cluster_names.get(sector_to_cluster.get(nearest[1], ""), nearest[1])
            print(f"    nearest hub: {ncn} ({nearest[0]} jumps)")
        print()

print()
print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"  Total stations: {len(all_stations)}")
print(f"  Pure hubs (prod_lines=0): {len(pure_hubs)} ({len(set(sm for sm,_,_ in pure_hubs))} sectors)")
print(f"  Impure candidates (prod_lines>0): {len(impure_stations)}")
print(f"  Pure hub groups: {grp_idx}")
print(f"  Sectors assigned to pure hubs: {len(assigned)}")
print(f"  Uncertain — score tie: {len(flagged_score_close)}")
print(f"  Uncertain — impure range: {len(flagged_uncertain)}")
print(f"  Tier 2 auto-absorbed: {len(t2_absorbed)}")
print(f"  Standalone impure: {len(standalone_impure)}")
print(f"  True exceptions: {len(true_exceptions)}")
