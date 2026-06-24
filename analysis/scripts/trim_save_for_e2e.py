"""
Trim save_009.json to only keep sectors with player stations,
suitable for E2E test fixtures.

Usage:
    python3 analysis/scripts/trim_save_for_e2e.py [input] [output]
    python3 analysis/scripts/trim_save_for_e2e.py  # defaults to save_009.json -> tests/fixtures/save/save.json
"""

import json
import sys
from pathlib import Path

def trim_save(input_path: str, output_path: str) -> None:
    with open(input_path) as f:
        data = json.load(f)

    sectors = data.get('sectors', {})
    player_sectors = {}
    for macro, sector in sectors.items():
        has_stations = (
            (sector.get('player_stations') and len(sector['player_stations']) > 0)
            or (sector.get('player_buildstorages') and len(sector['player_buildstorages']) > 0)
        )
        if has_stations:
            trimmed = {}
            for key in sector:
                if key in ('player_stations', 'player_buildstorages', 'npc_stations', 'name', 'owner', 'is_known', 'datavaults'):
                    trimmed[key] = sector[key]
            player_sectors[macro] = trimmed

    output = {
        'meta': data.get('meta', {}),
        'sectors': player_sectors,
    }

    meta = output['meta']
    meta['parser_version'] = 'v9'
    output['isCompatible'] = True
    output['isValid'] = True

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    size = out_path.stat().st_size
    print(f'Trimmed {len(sectors)} → {len(player_sectors)} sectors, output: {size/1024:.1f} KB → {output_path}')

if __name__ == '__main__':
    inp = sys.argv[1] if len(sys.argv) > 1 else 'save_009.json'
    out = sys.argv[2] if len(sys.argv) > 2 else 'tests/fixtures/save/save.json'
    trim_save(inp, out)
