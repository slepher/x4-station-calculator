#!/usr/bin/env python3
"""
验证星区资源总量和气体 Block 分布

用法：
    python3 analysis/scripts/verify_sector.py <sector_id>

示例：
    python3 analysis/scripts/verify_sector.py cluster_04_sector001_macro
    python3 analysis/scripts/verify_sector.py cluster_15_sector001_macro

输出：
    - 控制台输出详细分析
    - Markdown 报告保存到 analysis/doc/resource/<sector_id>.md

验证逻辑（两级验证）：
    第一级（星区总量）：
        maps.json 的 sector.resources[].total_yield vs total.json 中该资源所有密度的总量

    第二级（密度分级）：
        resourceareas[].areas[].resources[].total_yield + yield_name vs total.json 对应密度的 max
"""
import json
import math
import sys
from pathlib import Path
from datetime import datetime

GAS_BLOCK_SIZE = 64_000  # 64 km

def load_json(filepath):
    with open(filepath) as f:
        return json.load(f)

def calc_sector_total(sector_data):
    """计算存档中某个 ware 的总量"""
    ware_data = sector_data.get('ware', {})
    totals = {}

    for ware_name, density_data in ware_data.items():
        if isinstance(density_data, dict):
            totals[ware_name] = {}
            for density, data in density_data.items():
                resources = data.get('resources', [])
                total_max = sum(r.get('max', 0) for r in resources)
                totals[ware_name][density] = {
                    'total_max': total_max,
                    'resource_count': len(resources),
                    'positions': [(r.get('x', 0), r.get('y', 0), r.get('z', 0)) for r in resources]
                }
    return totals

def get_theory_from_total(total_data, sector_id):
    """
    从 total.json 获取理论总量（按密度分级）

    返回：{ware: {density: {'max': value, 'resource_count': count}}}
    """
    sector_id_lower = sector_id.lower()

    for sector in total_data.get('sectors', []):
        if sector.get('sector_id', '').lower() == sector_id_lower:
            ware_data = sector.get('ware', {})
            theory = {}
            for ware_name, density_data in ware_data.items():
                if isinstance(density_data, dict):
                    theory[ware_name] = {}
                    for density, data in density_data.items():
                        theory[ware_name][density] = {
                            'max': data.get('max', 0),
                            'resource_count': len(data.get('resources', []))
                        }
            return theory
    return None


def get_theory_from_resourceareas(resourceareas_data, sector_id):
    """
    从 resourceareas.json 获取理论值（按密度分级）

    直接从 resourceareas[].areas[].resources[].yield_name 获取密度级别名称

    返回：{ware: {yield_name: total_yield}}
    """
    sector_id_lower = sector_id.lower()

    theory = {}

    for ra in resourceareas_data:
        if ra.get('sector_id', '').lower() == sector_id_lower:
            areas = ra.get('areas', [])
            for area in areas:
                resources = area.get('resources', [])

                for res in resources:
                    ware = res.get('ware', '')
                    if not ware:
                        continue

                    # 直接从 resourceareas 获取密度级别名称
                    yield_name = res.get('yield_name')
                    if not yield_name:
                        continue

                    # 获取 total_yield
                    total_yield = res.get('total_yield', 0)

                    if ware not in theory:
                        theory[ware] = {}
                    if yield_name not in theory[ware]:
                        theory[ware][yield_name] = 0
                    theory[ware][yield_name] += total_yield

            break

    return theory


def get_theory_from_maps(maps_data, sector_id):
    """
    从 maps.json 获取理论总量（不分密度等级）

    返回：{ware: total_yield}
    """
    sector_id_lower = sector_id.lower()

    for cluster_id, cluster_data in maps_data.get('clusters', {}).items():
        sectors = cluster_data.get('sectors', {})
        for key, sector in sectors.items():
            if key.lower() == sector_id_lower:
                resources = sector.get('resources', [])

                theory = {}
                for res in resources:
                    ware = res.get('ware', '')
                    total_yield = res.get('total_yield')

                    if total_yield is not None:
                        theory[ware] = total_yield

                return theory

    return None

def verify_total(actual, theory):
    """
    验证总量
    返回：(状态，误差百分比，倍数)
    状态：'pass' / 'suspect' / 'fail'
    """
    if theory == 0:
        return 'fail' if actual > 0 else 'pass', 0, 0

    error_rate = abs(actual - theory) / theory * 100

    # 误差 < 10% → 合格
    if error_rate < 10:
        return 'pass', error_rate, 1

    # 检查是否是理论值的整数倍 + 10% 以内
    multiple = round(actual / theory)
    if multiple > 0:
        expected = theory * multiple
        error_from_multiple = abs(actual - expected) / expected * 100
        if error_from_multiple < 10:
            return 'suspect', error_from_multiple, multiple

    return 'fail', error_rate, 1

def analyze_block_distribution(positions, block_size=GAS_BLOCK_SIZE):
    """分析资源点在 64km 网格中的分布"""
    blocks = {}
    for pos in positions:
        bx = round(pos[0] / block_size)
        by = round(pos[1] / block_size)
        bz = round(pos[2] / block_size)
        block_key = (bx, by, bz)
        blocks[block_key] = blocks.get(block_key, 0) + 1
    return blocks

def verify_gas_blocks(actual_positions):
    """
    验证气体 block 分布
    返回实际 block 数量、分布统计
    """
    blocks = analyze_block_distribution(actual_positions)

    block_distances = []
    for (bx, by, bz), count in blocks.items():
        dist = math.sqrt(bx**2 + by**2 + bz**2)
        block_distances.append({'block': (bx, by, bz), 'count': count, 'distance': dist})

    block_distances.sort(key=lambda x: x['distance'])

    return {
        'block_count': len(blocks),
        'total_points': len(actual_positions),
        'blocks_by_distance': block_distances[:20],
    }

def calculate_theory_blocks(nebula_center, radius, height=None):
    """
    计算理论上的气体 block 分布（圆柱体/球形星云）

    判断方块是否与圆柱体相交：
    方块中心到圆柱中心的水平距离 <= (radius + 方块半宽)
    """
    blocks = []
    half_block = GAS_BLOCK_SIZE / 2

    min_bx = math.floor((nebula_center[0] - radius - GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)
    max_bx = math.ceil((nebula_center[0] + radius + GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)
    min_bz = math.floor((nebula_center[2] - radius - GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)
    max_bz = math.ceil((nebula_center[2] + radius + GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)

    if height:
        min_by = math.floor((nebula_center[1] - height/2 - GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)
        max_by = math.ceil((nebula_center[1] + height/2 + GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)
    else:
        min_by = math.floor((nebula_center[1] - radius - GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)
        max_by = math.ceil((nebula_center[1] + radius + GAS_BLOCK_SIZE) / GAS_BLOCK_SIZE)

    for bx in range(min_bx, max_bx + 1):
        for by in range(min_by, max_by + 1):
            for bz in range(min_bz, max_bz + 1):
                block_center = (bx * GAS_BLOCK_SIZE, by * GAS_BLOCK_SIZE, bz * GAS_BLOCK_SIZE)
                dx = block_center[0] - nebula_center[0]
                dz = block_center[2] - nebula_center[2]
                horizontal_dist = math.sqrt(dx*dx + dz*dz)

                if horizontal_dist <= (radius + half_block * 1.5):
                    if height:
                        dy = abs(block_center[1] - nebula_center[1])
                        if dy <= (height/2 + half_block * 1.5):
                            blocks.append((bx, by, bz))
                    else:
                        blocks.append((bx, by, bz))

    return blocks

def generate_markdown_report(sector_id, level1_results, level2_results, gas_analysis, nebula_info, all_pass, region_boundary=None):
    """生成 Markdown 格式的分析报告"""
    status_str = "✓ 全部合格" if all_pass else "? 存在存疑/不合格项"

    md = f"""# {sector_id} 星区资源验证报告

生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 验证结论

**总体状态**: {status_str}

---

## 一、第一级验证：星区总量（与 total.json 对比）

| 资源类型 | 实际总量 | 理论总量 | 误差% | 倍数 | 状态 |
|----------|----------|----------|-------|------|------|
"""

    for ware_name, data in sorted(level1_results.items()):
        status_icon = {'pass': '✓', 'suspect': '?', 'fail': '✗'}[data['status']]
        multiple_str = f"x{data['multiple']}" if data['multiple'] > 1 else "1"
        md += f"| {ware_name} | {data['actual']:,} | {data['theory']:,} | {data['error_rate']:.2f}% | {multiple_str} | {status_icon} |\n"

    md += f"""
---

## 二、第二级验证：密度分级（与 resourceareas 对比）

"""

    for ware_name in sorted(level2_results.keys()):
        md += f"""### {ware_name}

| 密度等级 | 实际总量 | 理论总量 | 误差% | 倍数 | 状态 |
|----------|----------|----------|-------|------|------|
"""
        for density, data in sorted(level2_results[ware_name].items()):
            status_icon = {'pass': '✓', 'suspect': '?', 'fail': '✗'}[data['status']]
            multiple_str = f"x{data['multiple']}" if data['multiple'] > 1 else "1"
            md += f"| {density} | {data['actual']:,} | {data['theory']:,} | {data['error_rate']:.2f}% | {multiple_str} | {status_icon} |\n"

    md += f"""
---

## 二、气体 Block 分布分析

"""

    for ware_name, densities in gas_analysis.items():
        md += f"""### {ware_name}

"""
        for density, info in densities.items():
            md += f"""#### {density}

- 资源点数量：{info['total_points']:,}
- Block 数量：{info['block_count']:,}

前 5 个 Block（按距离）：

| # | Block 坐标 | 资源点数 | 距离 |
|---|-----------|----------|------|
"""
            for i, b in enumerate(info['blocks_by_distance'][:5]):
                md += f"| {i} | {b['block']} | {b['count']} | {b['distance']:.1f} |\n"

            md += "\n"

    if nebula_info:
        md += f"""---

## 三、推断的 Nebula 参数

- **中心坐标**: ({nebula_info['center'][0]:,.0f}, {nebula_info['center'][1]:,.0f}, {nebula_info['center'][2]:,.0f})
- **推断半径**: ~{nebula_info['radius']/1000:.0f}km
- **推断高度**: {'~' + str(int(nebula_info['height']/1000)) + 'km' if nebula_info['height'] else 'N/A (球形)'}

### Block 对比

| 项目 | 数量 |
|------|------|
| 理论 Block 数量 | {nebula_info['theory_block_count']:,} |
| 实际 Block 数量 | {nebula_info['actual_block_count']:,} |
| **匹配 Block 数量** | {nebula_info['matched_count']:,} |
| **理论独有 (理论有实际无)** | {nebula_info['theory_only_count']:,} |
| **实际独有 (实际有理论无)** | {nebula_info['actual_only_count']:,} |

**匹配率**: {nebula_info['match_rate']:.1f}% (双向完整匹配)

"""

    if region_boundary:
        md += f"""---

## 四、Region Boundary 尺寸特征

| 维度 | 尺寸 |
|------|------|
| X | {region_boundary.get('x', 'N/A')} |
| Y | {region_boundary.get('y', 'N/A')} |
| Z | {region_boundary.get('z', 'N/A')} |

"""

    md += """---

## 验证标准说明

### 总量验证
- **合格 (✓)**: 误差 < 10%
- **存疑 (?)**: 误差 = 理论总量的整数倍 + 10% 以内
- **不合格 (✗)**: 其他情况

### Block 分布验证
- 气体资源按 64×64×64km 方块进行散列
- **双向完整匹配**: 理论 Block 集合 = 实际 Block 集合
- 使用圆柱体相交判断：方块中心到 nebula 中心的距离 <= (radius + 方块半宽×1.5)
- 匹配率 = 匹配 Block 数量 / max(理论 Block 数量，实际 Block 数量) × 100%

---

*本报告由 verify_sector.py 自动生成*
"""

    return md

def main():
    if len(sys.argv) < 2:
        print("用法：python3 analysis/scripts/verify_sector.py <sector_id>")
        print("示例：python3 analysis/scripts/verify_sector.py cluster_04_sector001_macro")
        sys.exit(1)

    sector_id = sys.argv[1]

    # 加载数据文件
    total_data = load_json('save_sample_data/total.json')
    resourceareas_data = load_json('src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json')
    sector_file = f'save_sample_data/{sector_id}.json'

    if not Path(sector_file).exists():
        print(f"错误：找不到文件 {sector_file}")
        sys.exit(1)

    sector_data = load_json(sector_file)

    # 计算存档实际总量（按密度分级）
    actual_totals = calc_sector_total(sector_data)

    # ========== 第一级验证：星区总量 ==========
    # 从 total.json 获取理论总量（按密度分级）
    theory_by_density = get_theory_from_total(total_data, sector_id)

    # 计算每个 ware 的总量（所有密度之和）
    actual_by_ware = {}
    for ware, densities in actual_totals.items():
        actual_by_ware[ware] = sum(d['total_max'] for d in densities.values())

    theory_by_ware = {}
    if theory_by_density:
        for ware, densities in theory_by_density.items():
            theory_by_ware[ware] = sum(d['max'] for d in densities.values())

    # 第一级验证结果
    level1_results = {}
    all_level1_pass = True

    for ware_name in actual_by_ware:
        actual = actual_by_ware[ware_name]
        theory = theory_by_ware.get(ware_name, 0)

        status, error_rate, multiple = verify_total(actual, theory)
        if status != 'pass':
            all_level1_pass = False

        level1_results[ware_name] = {
            'status': status,
            'actual': actual,
            'theory': theory,
            'error_rate': error_rate,
            'multiple': multiple
        }

    # ========== 第二级验证：密度分级 ==========
    # 直接从 resourceareas 获取理论值（按密度分级）
    theory_from_areas = get_theory_from_resourceareas(resourceareas_data, sector_id)

    level2_results = {}
    all_level2_pass = True

    for ware_name in actual_totals:
        level2_results[ware_name] = {}
        for density in actual_totals[ware_name]:
            actual = actual_totals[ware_name][density]['total_max']
            # 从 resourceareas 获取的理论值
            theory = theory_from_areas.get(ware_name, {}).get(density, 0)

            status, error_rate, multiple = verify_total(actual, theory)
            if status != 'pass':
                all_level2_pass = False

            level2_results[ware_name][density] = {
                'status': status,
                'actual': actual,
                'theory': theory,
                'error_rate': error_rate,
                'multiple': multiple
            }

    all_pass = all_level1_pass and all_level2_pass

    # ========== 气体 Block 分布分析 ==========
    gas_wares = ['hydrogen', 'helium', 'neon', 'argon', 'oxygen', 'methane', 'nitrogen']

    gas_analysis = {}
    all_gas_positions = []

    for ware_name in actual_totals:
        if ware_name not in gas_wares:
            continue

        gas_analysis[ware_name] = {}
        for density in actual_totals[ware_name]:
            positions = actual_totals[ware_name][density]['positions']
            all_gas_positions.extend(positions)

            block_info = verify_gas_blocks(positions)
            gas_analysis[ware_name][density] = block_info

    # 推断 nebula 参数
    nebula_info = None
    if all_gas_positions:
        xs = [p[0] for p in all_gas_positions]
        ys = [p[1] for p in all_gas_positions]
        zs = [p[2] for p in all_gas_positions]

        inferred_center = (
            (max(xs) + min(xs)) / 2,
            (max(ys) + min(ys)) / 2,
            (max(zs) + min(zs)) / 2
        )

        max_dist = max(math.sqrt((p[0]-inferred_center[0])**2 + (p[2]-inferred_center[2])**2)
                       for p in all_gas_positions)
        inferred_radius = max_dist + GAS_BLOCK_SIZE

        y_range = max(ys) - min(ys)
        inferred_height = y_range + GAS_BLOCK_SIZE if y_range > 0 else None

        theory_blocks = calculate_theory_blocks(inferred_center, inferred_radius, inferred_height)
        actual_blocks = set()
        for pos in all_gas_positions:
            bx = round(pos[0] / GAS_BLOCK_SIZE)
            by = round(pos[1] / GAS_BLOCK_SIZE)
            bz = round(pos[2] / GAS_BLOCK_SIZE)
            actual_blocks.add((bx, by, bz))

        theory_set = set(theory_blocks)
        actual_blocks_set = set(actual_blocks)
        matched = theory_set & actual_blocks_set
        theory_only = theory_set - actual_blocks_set
        actual_only = actual_blocks_set - theory_set

        # 计算匹配率（双向完整匹配）
        max_blocks = max(len(theory_blocks), len(actual_blocks))
        match_rate = (len(matched) / max_blocks * 100) if max_blocks > 0 else 100.0

        nebula_info = {
            'center': inferred_center,
            'radius': inferred_radius,
            'height': inferred_height,
            'theory_block_count': len(theory_blocks),
            'actual_block_count': len(actual_blocks),
            'matched_count': len(matched),
            'theory_only_count': len(theory_only),
            'actual_only_count': len(actual_only),
            'match_rate': match_rate
        }

    # ========== 输出控制台 ==========
    print(f"{'='*70}")
    print(f"星区：{sector_id}")
    print(f"{'='*70}")

    print(f"\n{'='*50}")
    print("一、第一级验证：星区总量（与 total.json 对比）")
    print('='*50)

    for ware_name, data in sorted(level1_results.items()):
        status_icon = {'pass': '✓', 'suspect': '?', 'fail': '✗'}[data['status']]
        multiple_str = f" (x{data['multiple']})" if data['multiple'] > 1 else ""
        print(f"  {ware_name}: 实际={data['actual']:>12,}, 理论={data['theory']:>12,}, "
              f"误差={data['error_rate']:5.2f}%, 倍数={data['multiple']}{multiple_str} {status_icon}")

    print(f"\n  第一级状态：{'✓ 全部合格' if all_level1_pass else '? 存在存疑/不合格项'}")

    print(f"\n{'='*50}")
    print("二、第二级验证：密度分级（与 resourceareas 对比）")
    print('='*50)

    for ware_name in sorted(level2_results.keys()):
        print(f"\n  {ware_name}:")
        for density, data in sorted(level2_results[ware_name].items()):
            status_icon = {'pass': '✓', 'suspect': '?', 'fail': '✗'}[data['status']]
            multiple_str = f" (x{data['multiple']})" if data['multiple'] > 1 else ""
            print(f"    {density}: 实际={data['actual']:>12,}, 理论={data['theory']:>12,}, "
                  f"误差={data['error_rate']:5.2f}%, 倍数={data['multiple']}{multiple_str} {status_icon}")

    print(f"\n  第二级状态：{'✓ 全部合格' if all_level2_pass else '? 存在存疑/不合格项'}")

    print(f"\n{'='*50}")
    print("三、气体 Block 分布分析")
    print('='*50)

    for ware_name, densities in sorted(gas_analysis.items()):
        for density, info in sorted(densities.items()):
            print(f"\n  {ware_name}/{density}:")
            print(f"    资源点数量：{info['total_points']}")
            print(f"    Block 数量：{info['block_count']}")

    if nebula_info:
        print(f"\n  推断 Nebula 参数:")
        print(f"    中心：({nebula_info['center'][0]:.0f}, {nebula_info['center'][1]:.0f}, {nebula_info['center'][2]:.0f})")
        print(f"    半径：~{nebula_info['radius']/1000:.0f}km")
        if nebula_info['height']:
            print(f"    高度：~{nebula_info['height']/1000:.0f}km")
        print(f"    理论 Block: {nebula_info['theory_block_count']}, 实际 Block: {nebula_info['actual_block_count']}")
        print(f"    匹配：{nebula_info['matched_count']}, 理论独有：{nebula_info['theory_only_count']}, 实际独有：{nebula_info['actual_only_count']}")
        print(f"    匹配率：{nebula_info['match_rate']:.1f}% (双向完整匹配)")

    # ========== 生成 Markdown 报告 ==========
    output_dir = Path('analysis/doc/resource')
    output_dir.mkdir(parents=True, exist_ok=True)

    md_report = generate_markdown_report(
        sector_id, level1_results, level2_results, gas_analysis, nebula_info, all_pass
    )

    output_file = output_dir / f"{sector_id}.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(md_report)

    print(f"\n{'='*70}")
    print(f"报告已保存：{output_file}")
    print('='*70)

    return {
        'sector_id': sector_id,
        'level1': level1_results,
        'level2': level2_results,
        'all_pass': all_pass
    }

if __name__ == "__main__":
    main()
