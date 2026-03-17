#!/usr/bin/env python3
"""
分析 save_sample_data 的结构和含义
"""
import json
from pathlib import Path

def main():
    with open("save_sample_data/cluster_703_sector001_macro.json") as f:
        sample = json.load(f)

    print("=== save_sample_data 结构分析 ===\n")

    # 检查顶层结构
    print(f"顶层 keys: {list(sample.keys())}")
    print(f"sector_id: {sample.get('sector_id')}")

    ware_data = sample.get('ware', {})
    print(f"\nware 数量：{len(ware_data)}")
    print(f"wares: {list(ware_data.keys())}")

    # 分析 helium 的数据
    print("\n=== Helium 详细分析 ===")
    helium = ware_data.get('helium', {})
    print(f"helium density 分类：{list(helium.keys())}")

    for density, data in helium.items():
        resources = data.get('resources', [])
        print(f"\n  {density}: {len(resources)} 个资源点")

        # 分析这些资源点的分布
        total_max = sum(r.get('max', 0) for r in resources)
        avg_max = total_max / len(resources) if resources else 0
        avg_falloff = sum(r.get('falloff', 0) for r in resources) / len(resources) if resources else 0
        avg_density = sum(r.get('resourcedensity', 0) for r in resources) / len(resources) if resources else 0

        print(f"    total_max: {total_max:,.0f}")
        print(f"    avg_max: {avg_max:,.0f}")
        print(f"    avg_falloff: {avg_falloff:.4f}")
        print(f"    avg_resourcedensity: {avg_density:,.0f}")

        # 检查坐标分布
        xs = [r.get('x', 0) for r in resources]
        ys = [r.get('y', 0) for r in resources]
        zs = [r.get('z', 0) for r in resources]

        print(f"    x 范围：[{min(xs)}, {max(xs)}]")
        print(f"    y 范围：[{min(ys)}, {max(ys)}]")
        print(f"    z 范围：[{min(zs)}, {max(zs)}]")

        # 打印前 5 个详细数据
        print(f"\n    前 5 个资源点:")
        for i, r in enumerate(resources[:5]):
            print(f"      [{i}] pos=({r['x']}, {r['y']}, {r['z']}), max={r['max']:,}, falloff={r['falloff']:.4f}, density={r['resourcedensity']:,}")

    # 分析固体资源（例如 ore）
    print("\n=== Ore 详细分析 ===")
    ore = ware_data.get('ore', {})
    print(f"ore density 分类：{list(ore.keys())}")

    for density, data in ore.items():
        resources = data.get('resources', [])
        print(f"\n  {density}: {len(resources)} 个资源点")

        total_max = sum(r.get('max', 0) for r in resources)
        avg_max = total_max / len(resources) if resources else 0

        print(f"    total_max: {total_max:,.0f}")
        print(f"    avg_max: {avg_max:,.0f}")

        # 检查坐标分布
        if resources:
            xs = [r.get('x', 0) for r in resources]
            ys = [r.get('y', 0) for r in resources]
            zs = [r.get('z', 0) for r in resources]

            print(f"    x 范围：[{min(xs):,.0f}, {max(xs):,.0f}]")
            print(f"    y 范围：[{min(ys):,.0f}, {max(ys):,.0f}]")
            print(f"    z 范围：[{min(zs):,.0f}, {max(zs):,.0f}]")

            # 打印前 5 个详细数据
            print(f"\n    前 5 个资源点:")
            for i, r in enumerate(resources[:5]):
                print(f"      [{i}] pos=({r['x']}, {r['y']}, {r['z']}), max={r['max']:,}, falloff={r.get('falloff', 'N/A')}")

if __name__ == "__main__":
    main()
