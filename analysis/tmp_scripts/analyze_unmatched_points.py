#!/usr/bin/env python3
"""分析为什么有 28 个 sample 点不匹配"""
import sys
import json
import math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))
from x4_data_map_processor import generate_gas_block_coordinates

GAS_BLOCK_SIZE = 64_000

GAS_BLOCK_SIZE = 64_000
GAS_XZ_LIMIT = 256_000

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

# 生成 block 坐标（不应用高度限制）
total_coords, effective_coords = generate_gas_block_coordinates(
    nebula_position, nebula_boundary, apply_height_limit=False
)
block_coords_set = set(total_coords)

# 加载 save_sample_data
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

# 找出未匹配的 sample 点
unmatched = []
matched = []
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    coord = (int(x), int(y), int(z))
    dist = math.sqrt((x - nebula_position["x"])**2 + (y - nebula_position["y"])**2 + (z - nebula_position["z"])**2)

    if coord in block_coords_set:
        matched.append((coord, dist))
    else:
        unmatched.append((coord, dist))

print(f"=== 未匹配的 {len(unmatched)} 个点分析 ===")
print(f"nebula boundary r=300km")
print(f"nebula 中心：{nebula_position}")

# 按距离排序
unmatched.sort(key=lambda x: x[1])

print(f"\n未匹配点按距离排序（前 28 个）:")
for coord, dist in unmatched:
    print(f"  {coord}, dist={dist/1000:.1f}km")

print(f"\n未匹配点的统计:")
unmatched_dists = [d for _, d in unmatched]
print(f"  最小距离：{min(unmatched_dists)/1000:.1f}km")
print(f"  最大距离：{max(unmatched_dists)/1000:.1f}km")
print(f"  平均距离：{sum(unmatched_dists)/len(unmatched_dists)/1000:.1f}km")

# 检查这些点是否在 64km 网格上
print(f"\n未匹配点是否在 64km 网格上:")
for coord, dist in unmatched[:10]:
    x, y, z = coord
    on_grid = (x % GAS_BLOCK_SIZE == 0) and (y % GAS_BLOCK_SIZE == 0) and (z % GAS_BLOCK_SIZE == 0)
    print(f"  {coord}: {'是' if on_grid else '否'}")

# 分析：这些点的坐标特征
print(f"\n未匹配点坐标特征:")
x_vals = sorted(set(abs(c[0]) for c, _ in unmatched))
z_vals = sorted(set(abs(c[2]) for c, _ in unmatched))
print(f"  |x| 值：{x_vals}")
print(f"  |z| 值：{z_vals}")

# 检查是否超出了遍历范围
print(f"\n遍历范围检查:")
print(f"  xz_max_blocks = {GAS_XZ_LIMIT // GAS_BLOCK_SIZE} (±4 个块)")
print(f"  遍历范围：x,z ∈ [{-((GAS_XZ_LIMIT // GAS_BLOCK_SIZE) + 1) * GAS_BLOCK_SIZE / 1000}, {((GAS_XZ_LIMIT // GAS_BLOCK_SIZE) + 1) * GAS_BLOCK_SIZE / 1000}] km")
print(f"  即 x,z ∈ [-320km, +320km]")

# 检查未匹配点是否超出范围
out_of_range = [(c, d) for c, d in unmatched if abs(c[0]) > 320000 or abs(c[2]) > 320000]
print(f"\n超出遍历范围的点：{len(out_of_range)} 个")
for c, d in out_of_range:
    print(f"  {c}, dist={d/1000:.1f}km")
