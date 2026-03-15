#!/usr/bin/env python3
"""统计 maps.json 中各星区 resource_stats 的资源分布"""

import json
from collections import defaultdict
from pathlib import Path

# 读取 maps.json
maps_path = Path(__file__).parent.parent / "src/assets/x4_game_data/9.0-Empire-beta/data/maps.json"
with open(maps_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 收集所有资源的统计数据
resource_data = defaultdict(lambda: {
    'max_densities': [],
    'representative_densities': [],
    'max_amounts': [],
    'representative_amounts': [],
    'sector_count': 0
})

# 遍历所有星区
sector_count = 0
for cluster_id, cluster in data['clusters'].items():
    for sector_id, sector in cluster.get('sectors', {}).items():
        sector_count += 1
        for stat in sector.get('resource_stats', []):
            ware = stat['ware']
            resource_data[ware]['max_densities'].append(stat.get('max_density', 0))
            resource_data[ware]['representative_densities'].append(stat.get('representative_density', 0))
            # max_amount 使用 max_amount_region_amount
            resource_data[ware]['max_amounts'].append(stat.get('max_amount_region_amount', 0))
            resource_data[ware]['representative_amounts'].append(stat.get('representative_amount', 0))
            resource_data[ware]['sector_count'] += 1

def calc_stats(values):
    """计算统计值"""
    if not values:
        return {'min': 0, 'max': 0, 'avg': 0, 'median': 0}
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    return {
        'min': sorted_vals[0],
        'max': sorted_vals[-1],
        'avg': sum(values) / n,
        'median': sorted_vals[n // 2] if n % 2 else (sorted_vals[n//2 - 1] + sorted_vals[n//2]) / 2
    }

# 输出统计结果
print(f"总星区数: {sector_count}")
print("=" * 80)

for ware in sorted(resource_data.keys()):
    info = resource_data[ware]
    print(f"\n资源: {ware}")
    print(f"  出现星区数: {info['sector_count']}")

    print(f"\n  representative_density 分布:")
    stats = calc_stats(info['representative_densities'])
    print(f"    min: {stats['min']:.3f}")
    print(f"    max: {stats['max']:.3f}")
    print(f"    avg: {stats['avg']:.3f}")
    print(f"    median: {stats['median']:.3f}")

    print(f"\n  max_amount 分布:")
    stats = calc_stats(info['max_amounts'])
    print(f"    min: {stats['min']:.0f}")
    print(f"    max: {stats['max']:.0f}")
    print(f"    avg: {stats['avg']:.0f}")
    print(f"    median: {stats['median']:.0f}")
    print("-" * 80)

# 输出 max_amount 分布直方图（对数分桶）
print("\n\n=== max_amount 分布直方图（对数分桶） ===\n")

def log_histogram(values, ware, bucket_count=10):
    """对数分桶直方图"""
    if not values:
        return

    # 过滤掉 0 值
    positive_vals = [v for v in values if v > 0]
    if not positive_vals:
        print(f"{ware}: 全部为 0")
        return

    import math
    min_val = min(positive_vals)
    max_val = max(positive_vals)

    if min_val == max_val:
        print(f"{ware}: 所有值相同 = {min_val:.0f}")
        return

    # 对数分桶
    log_min = math.log10(min_val)
    log_max = math.log10(max_val)
    log_step = (log_max - log_min) / bucket_count

    buckets = defaultdict(int)
    zero_count = len(values) - len(positive_vals)

    for v in positive_vals:
        log_v = math.log10(v)
        bucket_idx = min(int((log_v - log_min) / log_step), bucket_count - 1)
        buckets[bucket_idx] += 1

    print(f"{ware}:")
    if zero_count > 0:
        print(f"  [         0]: {zero_count:3d} {'█' * (zero_count // 2)}")
    for i in range(bucket_count):
        low = 10 ** (log_min + i * log_step)
        high = 10 ** (log_min + (i + 1) * log_step)
        count = buckets[i]
        bar = '█' * (count // 2) if count > 0 else ''
        # 格式化数字
        def fmt_num(n):
            if n >= 1e12: return f"{n/1e12:.1f}T"
            elif n >= 1e9: return f"{n/1e9:.1f}B"
            elif n >= 1e6: return f"{n/1e6:.1f}M"
            elif n >= 1e3: return f"{n/1e3:.1f}K"
            else: return f"{n:.0f}"
        print(f"  [{fmt_num(low):>8} - {fmt_num(high):>8}]: {count:3d} {bar}")
    print()

for ware in sorted(resource_data.keys()):
    info = resource_data[ware]
    log_histogram(info['max_amounts'], ware)

# 输出 representative_density 分布直方图
print("\n\n=== representative_density 分布直方图 ===\n")

def density_histogram(values, ware, bucket_count=10):
    """密度分布直方图"""
    if not values:
        return

    # 过滤掉 0 值
    positive_vals = [v for v in values if v > 0]
    if not positive_vals:
        print(f"{ware}: 全部为 0")
        return

    min_val = min(positive_vals)
    max_val = max(positive_vals)

    if min_val == max_val:
        print(f"{ware}: 所有值相同 = {min_val:.3f}")
        return

    # 对数分桶
    import math
    log_min = math.log10(min_val)
    log_max = math.log10(max_val)

    # 如果范围太小，使用线性分桶
    if log_max - log_min < 1:
        # 线性分桶
        step = (max_val - min_val) / bucket_count
        buckets = defaultdict(int)
        zero_count = len(values) - len(positive_vals)

        for v in positive_vals:
            bucket_idx = min(int((v - min_val) / step), bucket_count - 1)
            buckets[bucket_idx] += 1

        print(f"{ware}:")
        if zero_count > 0:
            print(f"  [         0]: {zero_count:3d} {'█' * (zero_count // 2)}")
        for i in range(bucket_count):
            low = min_val + i * step
            high = low + step
            count = buckets[i]
            bar = '█' * (count // 2) if count > 0 else ''
            print(f"  [{low:10.2f} - {high:10.2f}]: {count:3d} {bar}")
    else:
        # 对数分桶
        log_step = (log_max - log_min) / bucket_count
        buckets = defaultdict(int)
        zero_count = len(values) - len(positive_vals)

        for v in positive_vals:
            log_v = math.log10(v)
            bucket_idx = min(int((log_v - log_min) / log_step), bucket_count - 1)
            buckets[bucket_idx] += 1

        print(f"{ware}:")
        if zero_count > 0:
            print(f"  [         0]: {zero_count:3d} {'█' * (zero_count // 2)}")
        for i in range(bucket_count):
            low = 10 ** (log_min + i * log_step)
            high = 10 ** (log_min + (i + 1) * log_step)
            count = buckets[i]
            bar = '█' * (count // 2) if count > 0 else ''
            print(f"  [{low:10.2f} - {high:10.2f}]: {count:3d} {bar}")
    print()

for ware in sorted(resource_data.keys()):
    info = resource_data[ware]
    density_histogram(info['representative_densities'], ware)