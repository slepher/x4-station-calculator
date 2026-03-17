#!/usr/bin/env python3
"""验证移除 GAS_MIN_HEIGHT 后的 block 坐标与 save_sample_data 的对比"""
import sys
import json
import math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))
from x4_data_map_processor import generate_gas_block_coordinates

# nebula 数据
nebula_position = {"x": 0.0, "y": -20000.0, "z": 0.0}
nebula_boundary = {'class': 'cylinder', 'size': {'r': 300000, 'linear': 30000}}

print("=== 生成 block 坐标（已移除 GAS_MIN_HEIGHT 限制）===")

total_coords, effective_coords = generate_gas_block_coordinates(
    nebula_position, nebula_boundary
)
print(f"total_coords: {len(total_coords)} 个")
print(f"effective_coords: {len(effective_coords)} 个")

# 加载 save_sample_data
print("\n=== save_sample_data 资源点 ===")
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])
print(f"helium 资源点：{len(helium)} 个")

# 提取 save_sample_data 的坐标
sample_coords_set = set()
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)
    sample_coords_set.add((int(x), int(y), int(z)))

# 对比
total_coords_set = set(total_coords)
effective_coords_set = set(effective_coords)

matched_total = sample_coords_set & total_coords_set
matched_effective = sample_coords_set & effective_coords_set

print(f"\n=== 坐标对比 ===")
print(f"sample 坐标数：{len(sample_coords_set)}")
print(f"生成的 total 坐标数：{len(total_coords_set)}")
print(f"生成的 effective 坐标数：{len(effective_coords_set)}")
print(f"匹配 total 的坐标：{len(matched_total)}")
print(f"匹配 effective 的坐标：{len(matched_effective)}")
print(f"未匹配的 sample 坐标：{len(sample_coords_set - total_coords_set)}")

# 分析未匹配的点
if sample_coords_set - total_coords_set:
    print(f"\n=== 未匹配的 {len(sample_coords_set - total_coords_set)} 个点 ===")
    unmatched = list(sample_coords_set - total_coords_set)
    for coord in sorted(unmatched, key=lambda c: abs(c[0]) + abs(c[2]))[:15]:
        # 计算到 nebula 中心的距离
        dist = math.sqrt(coord[0]**2 + (coord[1] - nebula_position["y"])**2 + coord[2]**2)
        print(f"  {coord}, dist={dist/1000:.1f}km")
