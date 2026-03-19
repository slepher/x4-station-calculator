# 星区存档资源验证 - 当前状态

**更新时间**: 2026-03-19
**验证脚本**: `analysis/scripts/verify_sector.py`

---

## 验证架构（两级验证）

### 第一级：星区总量验证

比较 `maps.json` 的 `sector.resources[].total_yield` 与 `total.json` 中该资源所有密度的总量之和。

**数据流**:
```
存档数据 (save_sample_data/<sector_id>.json)
  └─> ware.<ware>.<density>.resources[].max  → 按密度分组求和

total.json
  └─> sectors[].ware.<ware>.<density>.max  → 按密度分组求和

maps.json
  └─> clusters[].sectors[].resources[].total_yield  → 不分密度的总量
```

**验证公式**:
```python
actual_by_ware = sum(d['total_max'] for d in actual_totals[ware].values())
theory_by_ware = sum(d['max'] for d in theory_by_density[ware].values())

error_rate = abs(actual - theory) / theory * 100
if error_rate < 10: status = 'pass'
elif multiple = round(actual / theory) > 0 and abs(actual - theory * multiple) / (theory * multiple) < 10:
    status = 'suspect'
else: status = 'fail'
```

### 第二级：密度分级验证

直接从 `resourceareas.json` 的 `areas[].resources[]` 中获取密度级别信息，与 `total.json` 对应密度的总量对比。

**数据流**:
```
存档数据 (save_sample_data/<sector_id>.json)
  └─> ware.<ware>.<density>.resources[].max  → 按密度分组求和

total.json
  └─> sectors[].ware.<ware>.<density>.max  → 按密度分组求和

resourceareas.json
  └─> areas[].resources[].yield_name  → 密度级别名称（如 medplus, medium, verylow）
  └─> areas[].resources[].total_yield  → 该密度级别的理论产量
```

**验证公式**:
```python
# 从 resourceareas 直接获取密度分级理论值
for area in resourceareas.areas:
    for res in area.resources:
        ware = res.get('ware')
        yield_name = res.get('yield_name')  # 直接从 resourceareas 获取密度级别
        theory[ware][yield_name] += res.get('total_yield', 0)
```

### 气体 Block 分布验证

**推断 Nebula 参数**:
```python
center = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2)
radius = max(sqrt((x-center_x)² + (z-center_z)²)) + 64km
height = (max(ys) - min(ys)) + 64km (如果 y_range > 0)
```

**理论 Block 计算（圆柱体相交）**:
```python
for bx, by, bz in range:
    block_center = (bx * 64km, by * 64km, bz * 64km)
    horizontal_dist = sqrt((block_x - center_x)² + (block_z - center_z)²)

    if horizontal_dist <= (radius + 32km * 1.5):
        if height:
            dy = abs(block_y - center_y)
            if dy <= (height/2 + 32km * 1.5):
                theory_blocks.append((bx, by, bz))
```

**双向完整匹配**:
```python
theory_set = set(theory_blocks)
actual_set = set(actual_blocks)

matched = theory_set ∩ actual_set
theory_only = theory_set - actual_set  # 理论有但实际无
actual_only = actual_set - theory_set  # 实际有但理论无

match_rate = len(matched) / max(len(theory_blocks), len(actual_blocks)) * 100
```

---

## 当前验证结果

### cluster_04_sector001_macro（大圆形星云）

**第一级验证（星区总量）**: ✓ 全部合格

| 资源类型 | 实际总量 | 理论总量 | 误差% | 状态 |
|----------|----------|----------|-------|------|
| hydrogen | 11,515,781 | 11,515,781 | 0.00% | ✓ |
| ice | 4,614,885 | 4,614,885 | 0.00% | ✓ |
| nividium | 18,480 | 18,480 | 0.00% | ✓ |
| ore | 85,839,413 | 85,839,413 | 0.00% | ✓ |
| silicon | 36,388,496 | 36,388,496 | 0.00% | ✓ |

**第二级验证（密度分级）**: ? 存在存疑/不合格项

| 资源/密度 | 实际总量 | 理论总量 | 误差% | 状态 |
|-----------|----------|----------|-------|------|
| hydrogen/medium | 2,228,242 | 3,420,490 | 34.86% | ✗ |
| hydrogen/medplus | 9,287,539 | 102,083 | 0.02% (x91) | ? |
| ice/verylow | 4,614,885 | 51,782,349 | 91.09% | ✗ |
| nividium/medlow | 18,480 | 207,129 | 91.08% | ✗ |
| ore/lowminus | 4,776,594 | 67,931,008 | 92.97% | ✗ |
| ore/medplus | 81,062,819 | 88,969,904 | 8.89% | ✓ |
| silicon/low | 14,332,830 | 203,793,023 | 92.97% | ✗ |
| silicon/medlow | 22,055,666 | 22,242,476 | 0.84% | ✓ |

**Block 分布分析**:
- 推断 Nebula: 中心 (320000, 32000, 320000), 半径~788km, 高度~256km
- 理论 Block: 3270, 实际 Block: 236
- 匹配：236, 理论独有：3034, 实际独有：0
- **匹配率：7.2%** (单向完整匹配，实际 Block 全部在理论范围内)

---

## 待解决问题

### 问题 1: 第二级验证大量不匹配

**现象**: 第二级验证中多个资源/密度组合显示高误差（>90%）或整数倍关系。

**已确认数据**:
```
resourceareas 理论值（直接从 yield_name 字段）:
  Area 0:
    ore/lowminus: 67,931,008
    silicon/low: 203,793,023
    ice/verylow: 50,948,256
    nividium/medlow: 203,793
    hydrogen/medplus: 102,083

  Area 1:
    ore/medplus: 88,969,904
    silicon/medlow: 22,242,476
    ice/verylow: 834,093
    nividium/medlow: 3,336
    hydrogen/medium: 3,420,490

  Area 2:
    nividium/veryhigh: 17.247

存档实际数据:
  hydrogen/medplus: 9,287,539 (196 点)  → 理论 Area 0 的 medplus 仅 102,083 (差异 91 倍)
  hydrogen/medium: 2,228,242 (59 点)   → 理论 Area 1 的 medium 为 3,420,490 (误差 34%)
  ore/medplus: 81,062,819 (59 点)     → 理论 Area 1 的 medplus 为 88,969,904 (误差 8.89%) ✓
  silicon/medlow: 22,055,666 (59 点)  → 理论 Area 1 的 medlow 为 22,242,476 (误差 0.84%) ✓
```

**分析**:
- ore/medplus 和 silicon/medlow 匹配良好
- hydrogen 的 medplus 和 medium 存在显著差异，可能是密度分级逻辑不一致
- ice/verylow、nividium/medlow、ore/lowminus、silicon/low 差异 >90%，需要调查

**待调查**:
1. 存档数据的密度分级是如何确定的？（可能基于 `resourcedensity` 值范围映射到 yield_name）
2. `yield_name` 与 `resourcedensity` 的映射关系是什么？
3. 为什么 ore/medplus 和 silicon/medlow 匹配良好，但 hydrogen 差异巨大？

**注意**: 第二级验证现在简化为直接读取 `resourceareas[].areas[].resources[].yield_name` 字段，不再需要关联 `regions.json`。

---

## 下一步行动

1. **调查密度分级生成逻辑**: 检查 `generator.py` 或相关脚本中，资源点被分配到密度级别的逻辑
2. **确认 yield_name 映射**: 检查 `regionyields.json` 中 `yield_name` 与 `resourcedensity` 的对应关系
3. **修正或解释差异**:
   - 如果是代码问题 → 修正生成逻辑
   - 如果是设计差异 → 更新文档说明

---

## 参考文件

- 验证脚本：`analysis/scripts/verify_sector.py`
- 规格说明：`openspec/changes/resource-save-verify/spec.md`
- 需求文档：`openspec/changes/resource-save-verify/request.md`
- 任务清单：`openspec/changes/resource-save-verify/tasks.md`
- 生成器代码：`scripts/processor/resource/legacy_processor.py` (migrate_region_definitions, calculate_resourcearea_resources)
