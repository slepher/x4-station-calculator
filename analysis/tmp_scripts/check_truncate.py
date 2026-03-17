#!/usr/bin/env python3
"""检查 save_sample_data 的截断逻辑"""
import json

GAS_XZ_LIMIT = 256_000   # 256 km
GAS_Y_LIMIT = 64_000     # 64 km

with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

print("=== 截断分析 ===")
print(f"资源点总数：{len(helium)}")

# 检查每个资源点是否在截断范围内
in_truncate = 0
out_truncate = 0
for r in helium:
    x, y, z = r.get('x', 0), r.get('y', 0), r.get('z', 0)

    if abs(x) <= GAS_XZ_LIMIT and abs(z) <= GAS_XZ_LIMIT and abs(y) <= GAS_Y_LIMIT:
        in_truncate += 1
    else:
        out_truncate += 1

print(f"在截断范围内：{in_truncate}")
print(f"在截断范围外：{out_truncate}")

# 检查 x, z 范围
x_vals = [r.get('x', 0) for r in helium]
z_vals = [r.get('z', 0) for r in helium]
y_vals = [r.get('y', 0) for r in helium]

print(f"\nx 范围：[{min(x_vals)}, {max(x_vals)}]")
print(f"z 范围：[{min(z_vals)}, {max(z_vals)}]")
print(f"y 范围：[{min(y_vals)}, {max(y_vals)}]")

# 检查哪些点在 |x|>256km 或 |z|>256km
out_xz = [r for r in helium if abs(r.get('x', 0)) > GAS_XZ_LIMIT or abs(r.get('z', 0)) > GAS_XZ_LIMIT]
print(f"\n|x|>256km 或 |z|>256km 的点：{len(out_xz)}")

# 检查哪些点在 |y|>64km
out_y = [r for r in helium if abs(r.get('y', 0)) > GAS_Y_LIMIT]
print(f"|y|>64km 的点：{len(out_y)}")
