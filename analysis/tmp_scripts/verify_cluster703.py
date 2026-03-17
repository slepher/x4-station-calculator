#!/usr/bin/env python3
"""
详细对比 cluster_703_sector001_macro 的资源计算数据
"""
import json
from pathlib import Path

def main():
    # 读取 save_sample_data
    sample_path = Path("save_sample_data/cluster_703_sector001_macro.json")
    with open(sample_path) as f:
        sample_data = json.load(f)

    # 读取生成的 resourceareas
    resourceareas_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json")
    with open(resourceareas_path) as f:
        resourceareas = json.load(f)

    # 找到 cluster_703 的数据
    cluster703 = None
    for cluster in resourceareas:
        cid = cluster.get('cluster_id', '').lower()
        sid = cluster.get('sector_id', '').lower()
        if '703' in cid or '703' in sid:
            cluster703 = cluster
            break

    if not cluster703:
        print("未找到 Cluster 703 数据")
        return

    areas = cluster703.get('areas', [])

    # 计算 save_sample_data 中每个 ware 的总 max 值
    print("=" * 70)
    print("save_sample_data 汇总（按 ware）")
    print("=" * 70)

    ware_data = sample_data.get('ware', {})
    sample_totals = {}

    for ware_name, density_data in ware_data.items():
        total_max = 0
        total_count = 0
        for density, data in density_data.items():
            resources = data.get('resources', [])
            for r in resources:
                total_max += r.get('max', 0)
                total_count += 1

        sample_totals[ware_name] = {'max': total_max, 'count': total_count}
        print(f"{ware_name}: total_max={total_max:,} ({total_count} resources)")

    # 计算生成的 resourceareas 中每个 ware 的总 yield 值
    print("\n" + "=" * 70)
    print("生成的 resourceareas 汇总（按 ware）")
    print("=" * 70)

    gen_totals = {}
    for area in areas:
        for res in area.get('resources', []):
            ware = res.get('ware', '')
            total_yield = res.get('total_yield', 0)
            yield_val = res.get('yield', 0)

            if ware not in gen_totals:
                gen_totals[ware] = {'total_yield': 0, 'yield': 0}
            gen_totals[ware]['total_yield'] += total_yield
            gen_totals[ware]['yield'] += yield_val

    for ware, totals in gen_totals.items():
        print(f"{ware}: total_yield={totals['total_yield']:,}, yield={totals['yield']:,}")

    # 对比
    print("\n" + "=" * 70)
    print("对比（save_sample_data.max vs generated.total_yield）")
    print("=" * 70)

    for ware in sorted(sample_totals.keys()):
        sample_max = sample_totals[ware]['max']
        gen_yield = gen_totals.get(ware, {}).get('total_yield', 0)

        if sample_max > 0:
            diff = gen_yield - sample_max
            pct = (diff / sample_max) * 100
            status = "✓" if abs(pct) <= 20 else "✗"
            print(f"{status} {ware}: sample={sample_max:,} vs gen={gen_yield:,}, diff={diff:+,} ({pct:+.1f}%)")
        else:
            print(f"? {ware}: sample={sample_max:,} vs gen={gen_yield:,}")

    # 详细分析气体资源
    print("\n" + "=" * 70)
    print("气体资源详细分析")
    print("=" * 70)

    gas_wares = {'helium', 'hydrogen', 'methane', 'bogas'}

    for area in areas:
        ref = area.get('ref', '')
        resources = area.get('resources', [])
        has_gas = any(r.get('ware') in gas_wares for r in resources)

        if has_gas:
            print(f"\nArea: {ref}")
            print(f"  position: ({area.get('position', {}).get('x')}, {area.get('position', {}).get('y')}, {area.get('position', {}).get('z')})")
            print(f"  total_volume_km3 (blocks): {area.get('total_volume_km3')}")
            print(f"  volume_km3 (effective blocks): {area.get('volume_km3')}")

            for res in resources:
                if res.get('ware') in gas_wares:
                    ware = res.get('ware')
                    total_yield = res.get('total_yield', 0)
                    sample_max = sample_totals.get(ware, {}).get('max', 0)

                    if sample_max > 0:
                        diff = total_yield - sample_max
                        pct = (diff / sample_max) * 100
                        status = "✓" if abs(pct) <= 20 else "✗"
                        print(f"\n  {ware}:")
                        print(f"    sample max={sample_max:,}")
                        print(f"    gen total_yield={total_yield:,}")
                        print(f"    diff={diff:+,} ({pct:+.1f}%) {status}")

if __name__ == "__main__":
    main()
