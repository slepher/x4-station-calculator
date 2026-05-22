# 星区存档资源验证规格说明

## 概述

本规格定义星区资源存档数据与理论计算的验证流程。

## 验证流程

### 步骤 1: 数据加载

```
输入：
- sector_id: 星区 ID（如 cluster_04_sector001_macro）
- 存档文件：save_sample_data/<sector_id>.json
- 理论文件:
  - total.json: 存档汇总数据（按密度分级）
  - maps.json: Map 处理结果（sector.resources[].total_yield）
  - resourceareas.json: 资源区定义（areas[].ref 关联 regions）
  - regions.json: Region 定义（resources[].yield_name 密度级别）

输出：
- actual_totals: 存档实际总量（按密度分级）
- theory_totals: 理论总量（来自 maps.json 的 sector.resources[].total_yield）
- theory_by_density: 理论密度分级值（来自 resourceareas + regions）
```

### 步骤 2: 第一级验证 - 星区总量

对每个 ware（资源类型），比较存档总量与 total.json 的总量（所有密度之和）：

```python
# 从存档中计算实际总量（按密度分组求和）
actual_by_ware = sum(
    d['total_max'] for d in actual_totals[ware].values()
)

# 从 total.json 获取理论总量（按密度分组求和）
theory_by_ware = sum(
    d['max'] for d in theory_by_density[ware].values()
)

error_rate = abs(actual - theory) / theory * 100

if error_rate < 10:
    status = 'pass'  # 合格
elif multiple = round(actual / theory) > 0 and \
     abs(actual - theory * multiple) / (theory * multiple) < 10:
    status = 'suspect'  # 存疑（理论值整数倍）
else:
    status = 'fail'  # 不合格
```

**理论值来源**: `total.json` 中 `sectors[].ware.<ware>.<density>.max` 的所有密度之和

### 步骤 3: 第二级验证 - 密度分级

直接从 `resourceareas.json` 的 `areas[].resources[]` 获取密度分级的理论值，与 total.json 对应密度对比。

**数据链**:
```
resourceareas.areas[].resources[].yield_name  →  密度级别名称（如 medplus, medium, verylow）
resourceareas.areas[].resources[].total_yield  →  该密度级别的理论产量
```

**理论值聚合逻辑**:
```python
# 遍历 resourceareas 中该星区的所有 areas
for area in resourceareas.areas:
    for res in area.get('resources', []):
        ware = res.get('ware')
        yield_name = res.get('yield_name')  # 直接从 resourceareas 获取密度级别
        if yield_name:
            theory[ware][yield_name] += res.get('total_yield', 0)
```

**验证公式**:
```python
for ware in actual_totals:
    for density in actual_totals[ware]:
        actual = actual_totals[ware][density]['total_max']
        theory = theory_from_areas.get(ware, {}).get(density, 0)

        error_rate = abs(actual - theory) / theory * 100

        if error_rate < 10:
            status = 'pass'
        elif multiple = round(actual / theory) > 0 and \
             abs(actual - theory * multiple) / (theory * multiple) < 10:
            status = 'suspect'
        else:
            status = 'fail'
```

**密度级别说明**:
- 密度级别名称来自 `resourceareas[].areas[].resources[].yield_name`
- 有效级别包括：lowest, verylow, lowminus, low, lowplus, lowextra, medlow, medium, medplus, medhigh, highlow, high, highplus, veryhigh, highest
- 存档数据的密度分级必须与 resourceareas 的 yield_name 完全匹配才能通过验证

### 步骤 4: 气体 Block 分布分析

#### 4.1 推断 Nebula 参数

```python
# 从所有气体资源点推断中心
center = (
    (max(xs) + min(xs)) / 2,
    (max(ys) + min(ys)) / 2,
    (max(zs) + min(zs)) / 2
)

# 推断半径（最大水平距离 + 一个 block）
radius = max(sqrt((x-center_x)² + (z-center_z)²)) + 64km

# 推断高度
height = (max(ys) - min(ys)) + 64km  # 如果 y_range > 0
```

#### 4.2 理论 Block 计算

```python
# 遍历所有可能的 block
for bx, by, bz in range:
    block_center = (bx * 64km, by * 64km, bz * 64km)

    # 水平距离
    horizontal_dist = sqrt((block_x - center_x)² + (block_z - center_z)²)

    # 圆柱体相交判断
    if horizontal_dist <= (radius + 32km * 1.5):
        if height:
            dy = abs(block_y - center_y)
            if dy <= (height/2 + 32km * 1.5):
                blocks.append((bx, by, bz))
```

#### 4.3 实际 Block 统计

```python
# 将资源点位置转换为 block 坐标
actual_blocks = set()
for pos in positions:
    bx = round(pos.x / 64km)
    by = round(pos.y / 64km)
    bz = round(pos.z / 64km)
    actual_blocks.add((bx, by, bz))
```

#### 4.4 对比统计（双向完整匹配）

```python
theory_set = set(theory_blocks)
actual_blocks_set = set(actual_blocks)

matched = theory_set ∩ actual_blocks_set
theory_only = theory_set - actual_blocks_set  # 理论有但实际无
actual_only = actual_blocks_set - theory_set  # 实际有但理论无

# 匹配率计算
max_blocks = max(len(theory_blocks), len(actual_blocks))
match_rate = len(matched) / max_blocks * 100
```

## 输出格式

### 控制台输出

```
======================================================================
星区：cluster_04_sector001_macro
======================================================================

==================================================
一、第一级验证：星区总量（与 total.json 对比）
==================================================

  hydrogen: 实际=  11,515,781, 理论=  11,515,781, 误差= 0.00%, 倍数=1 ✓
  ice: 实际=   4,614,885, 理论=   4,614,885, 误差= 0.00%, 倍数=1 ✓
  ...
  第一级状态：✓ 全部合格

==================================================
二、第二级验证：密度分级（与 resourceareas + regions 对比）
==================================================

  hydrogen:
    medium: 实际=   2,228,242, 理论=   3,420,490, 误差=34.86%, 倍数=1 ✗
    medplus: 实际=   9,287,539, 理论=     102,083, 误差= 0.02%, 倍数=91 (x91) ?
  ...
  第二级状态：? 存在存疑/不合格项

==================================================
三、气体 Block 分布分析
==================================================
  ...
```

### Markdown 报告

保存到 `analysis/doc/resource/<sector_id>.md`

包含：
- 验证结论
- 总量验证表格
- 气体 Block 分布详细分析
- Nebula 参数推断结果
- Block 对比统计（匹配率）
- Region Boundary 尺寸特征（如果可获取）

## 使用方式

```bash
python3 analysis/scripts/verify_sector.py <sector_id>
```

## 验收检查清单

- [x] 脚本支持命令行参数输入星区 ID
- [x] 第一级验证：星区总量（total.json 所有密度之和）正确计算
- [x] 第二级验证：密度分级（resourceareas + regions 关联）正确计算
- [x] 密度级别映射：通过 `regions[].resources[].yield_name` 获取密度级别名称
- [x] 总量验证结果正确分类（pass/suspect/fail）
- [x] 气体 Block 分布分析使用双向完整匹配
- [x] 输出匹配率（匹配 Block 数 / max(理论，实际)）
- [x] Markdown 报告输出到正确位置
