"""
Extract player station data from save JSON for auto-group tests.

Only extracts save-specific data: station modules[] and constructions[] refs.
Irrelevant module types (connection, habitation, defence, etc.) are dropped.
Type/cargo/graph data comes from game data, not the fixture.

Fixture format:
  sectors: { macro: { n: name, s: { code: { m: [[ref, n], ...], c: [[ref, n], ...] } } } }

Usage:
  python3 analysis/scripts/auto-sector-group/extract_save_for_tests.py \\
    --save save_009.json \\
    --game-data src/assets/x4_game_data/8.0-Diplomacy/data/modules.json \\
    --output tests/fixtures/auto-group/save_009_minimal.json
"""

import json
import argparse
from collections import Counter


def extract(save_path, modules_path, output_path):
    # Load game modules once to know which types are relevant
    with open(modules_path) as f:
        game_modules = json.load(f)
    keep_refs = set()
    for m in game_modules:
        if m.get('type') in {'production', 'storage', 'buildmodule', 'dockarea', 'pier'}:
            keep_refs.add(m.get('macroId', ''))

    with open(save_path) as f:
        data = json.load(f)

    result_sectors = {}

    for sector_macro, sector in data['sectors'].items():
        ps = sector.get('player_stations', {})
        if not ps:
            continue

        stations = {}
        for code, st in ps.items():
            mod_counter = Counter()
            for m in st.get('modules', []):
                ref = m['ref']
                if ref in keep_refs:
                    mod_counter[ref] += m['amount']

            const_counter = Counter()
            for c in st.get('constructions', []):
                ref = c['ref']
                if ref in keep_refs:
                    const_counter[ref] += 1

            mods_list = [[r, a] for r, a in sorted(mod_counter.items())]
            consts_list = [[r, a] for r, a in sorted(const_counter.items())]

            if mod_counter or const_counter:
                stations[code] = {'m': mods_list, 'c': consts_list}

        result_sectors[sector_macro] = {
            'n': sector.get('name', sector_macro),
            's': stations
        }

    result = {'sectors': result_sectors}

    with open(output_path, 'w') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    station_count = sum(len(sd['s']) for sd in result['sectors'].values())
    print(f'Extracted: {len(result["sectors"])} sectors, {station_count} stations')
    print(f'Written to: {output_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--save', required=True)
    parser.add_argument('--game-data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    extract(args.save, args.game_data, args.output)
