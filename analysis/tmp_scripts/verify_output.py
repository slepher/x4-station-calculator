#!/usr/bin/env python3
"""
验证 8.0 资源计算输出结果

用法:
    python3 analysis/tmp_scripts/verify_output.py
"""

import json
from pathlib import Path

def main():
    # 验证 regions.json
    regions_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json")
    with open(regions_path) as f:
        regions = json.load(f)

    print("=" * 60)
    print("regions.json 验证")
    print("=" * 60)
    print(f"总 region 数量：{len(regions)}")

    # 检查是否所有 region 都有 resources
    with_resources = [r for r in regions if r.get("resources") and len(r.get("resources", [])) > 0]
    print(f"有 resources 的 region: {len(with_resources)}")

    # 检查 position 字段
    with_position = [r for r in regions if "position" in r]
    print(f"有 position 字段的 region: {len(with_position)} ({len(with_position)/len(regions)*100:.1f}%)")

    # 检查 regions.json 字段是否符合新架构（只包含模板数据）
    expected_template_fields = {"id", "resources"}
    template_fields_only = all(set(r.keys()).issubset(expected_template_fields) for r in regions)
    print(f"regions.json 只包含模板字段 (id, resources): {template_fields_only}")

    # 打印示例
    print("\n前 3 个 region 示例:")
    for r in regions[:3]:
        res_count = len(r.get("resources", []))
        print(f"  {r['id']}: resources={res_count}个")
        if r.get("resources"):
            print(f"    第一个 resource: {r['resources'][0]}")

    # 验证 resourceareas.json
    resourceareas_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json")
    with open(resourceareas_path) as f:
        resourceareas = json.load(f)

    print("\n" + "=" * 60)
    print("resourceareas.json 验证")
    print("=" * 60)
    print(f"总 cluster 数量：{len(resourceareas)}")

    total_areas = 0
    with_position_count = 0
    without_position_count = 0

    for cluster in resourceareas:
        for area in cluster.get("areas", []):
            total_areas += 1
            if "position" in area:
                with_position_count += 1
            else:
                without_position_count += 1

    print(f"总 area 数量：{total_areas}")
    print(f"有 position 的 area: {with_position_count}")
    print(f"无 position 的 area (stacked): {without_position_count}")

    # 检查 resourceareas 的字段是否符合新架构
    print("\n检查 resourceareas 字段结构:")
    required_fields = {"ref", "amount", "position", "lateral_factor", "radial_factor",
                       "falloff_factor", "total_volume_km3", "volume_km3", "resources"}
    sample_area = None
    for cluster in resourceareas:
        for area in cluster.get("areas", []):
            if area.get("position"):  # 找一个有 position 的
                sample_area = area
                break
        if sample_area:
            break

    if sample_area:
        area_fields = set(sample_area.keys())
        missing = required_fields - area_fields
        extra = area_fields - required_fields
        print(f"  必需字段存在情况：{'✓' if not missing else '✗ 缺少: ' + str(missing)}")
        if extra:
            print(f"  额外字段：{extra}")

        # 检查 resource 字段
        if sample_area.get("resources"):
            res_sample = sample_area["resources"][0]
            print(f"\n  resource 字段：{list(res_sample.keys())}")
            required_res_fields = {"ware", "resourcedensity", "total_yield", "total_respawn",
                                   "yield", "respawn", "delay", "gatherfactor",
                                   "density", "respawn_density"}
            res_fields = set(res_sample.keys())
            missing_res = required_res_fields - res_fields
            extra_res = res_fields - required_res_fields
            print(f"  resource 必需字段：{'✓' if not missing_res else '✗ 缺少：' + str(missing_res)}")
            if extra_res:
                print(f"  resource 额外字段：{extra_res}")

    # 打印示例
    print("\n前 3 个 area 示例:")
    count = 0
    for cluster in resourceareas:
        for area in cluster.get("areas", [])[:3]:
            if count >= 3:
                break
            res_list = [r["ware"] for r in area.get("resources", [])]
            pos = area.get("position", "无")
            print(f"  {area['ref']}: amount={area['amount']}, position={pos}, resources={res_list}")
            count += 1
        if count >= 3:
            break

    # 找一个气体资源例子
    print("\n" + "=" * 60)
    print("气体资源示例")
    print("=" * 60)
    for cluster in resourceareas:
        for area in cluster.get("areas", []):
            for res in area.get("resources", []):
                if res["ware"] in ["helium", "hydrogen", "methane", "bogas"]:
                    print(f"ref: {area['ref']}, ware: {res['ware']}")
                    print(f"  position: {area.get('position')}")
                    print(f"  lateral_factor: {area.get('lateral_factor')}")
                    print(f"  radial_factor: {area.get('radial_factor')}")
                    print(f"  falloff_factor: {area.get('falloff_factor')}")
                    print(f"  total_volume_km3: {area.get('total_volume_km3')}")
                    print(f"  volume_km3: {area.get('volume_km3')}")
                    print(f"  total_yield: {res.get('total_yield')}")
                    print(f"  yield: {res.get('yield')}")
                    print(f"  respawn: {res.get('respawn')}")
                    print(f"  density: {res.get('density')}")
                    print(f"  respawn_density: {res.get('respawn_density')}")
                    break
            else:
                continue
            break
        else:
            continue
        break

    # 找一个固体资源例子
    print("\n" + "=" * 60)
    print("固体资源示例")
    print("=" * 60)
    for cluster in resourceareas:
        for area in cluster.get("areas", []):
            for res in area.get("resources", []):
                if res["ware"] not in ["helium", "hydrogen", "methane", "bogas"]:
                    print(f"ref: {area['ref']}, ware: {res['ware']}")
                    print(f"  position: {area.get('position')}")
                    print(f"  lateral_factor: {area.get('lateral_factor')}")
                    print(f"  radial_factor: {area.get('radial_factor')}")
                    print(f"  falloff_factor: {area.get('falloff_factor')}")
                    print(f"  total_volume_km3: {area.get('total_volume_km3')}")
                    print(f"  volume_km3: {area.get('volume_km3')}")
                    print(f"  total_yield: {res.get('total_yield')}")
                    print(f"  yield: {res.get('yield')}")
                    print(f"  respawn: {res.get('respawn')}")
                    print(f"  density: {res.get('density')}")
                    print(f"  respawn_density: {res.get('respawn_density')}")
                    break
            else:
                continue
            break
        else:
            continue
        break

    print("\n" + "=" * 60)
    print("验证完成")
    print("=" * 60)

if __name__ == "__main__":
    main()
