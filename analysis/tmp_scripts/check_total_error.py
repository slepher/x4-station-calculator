#!/usr/bin/env python3
"""计算当前算法与 save_sample_data 的总量误差"""
import json
import math

# 加载 save_sample_data
with open('save_sample_data/cluster_703_sector001_macro.json') as f:
    sample = json.load(f)

helium = sample.get('ware', {}).get('helium', {}).get('medium', {}).get('resources', [])

# save_sample_data 总量
sample_total_max = sum(r.get('max', 0) for r in helium)
sample_count = len(helium)

print("=== save_sample_data 总量 ===")
print(f"点数：{sample_count}")
print(f"total_max: {sample_total_max:,.0f}")

# 计算每个点的平均 max
avg_max = sample_total_max / sample_count
print(f"平均每点 max: {avg_max:,.2f}")

# 当前算法生成的总量
print("\n=== 当前算法生成的总量 ===")

# 使用当前逻辑生成的 block 数量
total_blocks = 89  # 匹配的 89 个点
effective_blocks = 77  # 在截断范围内的

# 假设使用相同的 falloff 和 density
# save_sample_data 中所有点的 falloff 和 density 相同
falloff = helium[0].get('falloff', 0)
density = helium[0].get('resourcedensity', 0)

print(f"falloff: {falloff}")
print(f"resourcedensity: {density}")

# 产量公式：yield = blocks × falloff × density
generated_yield = total_blocks * falloff * density
sample_yield = sample_count * falloff * density

print(f"\n当前算法 (89 blocks): yield = {generated_yield:,.0f}")
print(f"save_sample_data (97 points): yield = {sample_yield:,.0f}")

# 误差
error = (generated_yield - sample_yield) / sample_yield * 100
print(f"\n=== 误差 ===")
print(f"相对误差：{error:.1f}%")

# 如果用 total_blocks=178（所有命中的方块，不要求坐标匹配）
total_blocks_all = 178
generated_yield_all = total_blocks_all * falloff * density
error_all = (generated_yield_all - sample_yield) / sample_yield * 100

print(f"\n如果使用 total_blocks=178 (所有命中方块):")
print(f"yield = {generated_yield_all:,.0f}")
print(f"相对误差：{error_all:.1f}%")

# 分析 save_sample_data 的 max 分布
print(f"\n=== save_sample_data 的 max 分布 ===")
max_vals = [r.get('max', 0) for r in helium]
print(f"min: {min(max_vals):,.0f}")
print(f"max: {max(max_vals):,.0f}")
print(f"avg: {sum(max_vals)/len(max_vals):,.2f}")

# 检查是否所有点的 max 相同
unique_max = set(max_vals)
print(f"唯一 max 值数量：{len(unique_max)}")
if len(unique_max) == 1:
    print(f"所有点的 max 都相同：{unique_max.pop():,.0f}")
