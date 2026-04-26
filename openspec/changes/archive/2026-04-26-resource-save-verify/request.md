# 星区存档资源验证需求

## 背景

在 `save_sample_data/` 目录下有 8.0 版本的游戏实际存档内容，包含 110+ 个星区的资源分布数据。需要验证这些存档数据与理论计算的符合程度。

## 验证目标

### 1. 第一级验证 - 星区总量（与 total.json 对比）

比较存档数据中每个资源类型的总量（所有密度级别之和）与 `total.json` 中对应资源的总量。

**理论值来源**: `save_sample_data/total.json` 中 `sectors[].ware.<ware>.<density>.max` 的所有密度之和

**验证标准**:
- **合格 (✓)**: 误差 < 10%
- **存疑 (?)**: 误差 = 理论总量的整数倍 + 10% 以内
- **不合格 (✗)**: 其他情况

### 2. 第二级验证 - 密度分级（与 resourceareas 对比）

直接从 `resourceareas.json` 的 `areas[].resources[]` 中获取密度分级的理论值，与 `total.json` 对应密度级别对比。

**数据链**:
- `resourceareas.areas[].resources[].yield_name` → 密度级别名称（如 medplus, medium, verylow）
- `resourceareas.areas[].resources[].total_yield` → 该密度级别的理论产量

**验证标准**:
- **合格 (✓)**: 误差 < 10%
- **存疑 (?)**: 误差 = 理论值的整数倍 + 10% 以内
- **不合格 (✗)**: 其他情况

### 3. 气体 Block 分布验证

比较星区气体的理论 block 分布与实际存档的 block 分布：
- 理论计算：基于 nebula 中心位置和半径，按 64km 网格划分
- 判断条件：方块中心到圆柱中心的距离 <= (radius + 方块半宽×1.5)
- **双向完整匹配**: 理论 Block 集合 = 实际 Block 集合
- 输出：匹配 Block 数量、理论独有、实际独有统计、匹配率

### 4. 尺寸特征分析

从 Region 的 boundary 字段获取星区尺寸特征，用于分类：
- **大圆形**: 超过 64x64x64 截断范围（如 512x512x192）
- **小圆形**: 近似 64x64x64 基础尺寸
- **圆柱形**: XZ 半径大，Y 高度小
- **星带**: 长条形分布

## 典型星区分类

需要挑选并验证以下典型星区：

| 类型 | 尺寸标准 | 说明 |
|------|----------|------|
| 大圆形 | 512x512x192 | 超过 64x64x64 截断范围 |
| 小圆形 | 64x64x64 | 近似基础尺寸 |
| 圆柱形 | XZ 半径大，Y 高度小 | 典型圆柱星云 |
| 星带 | 长条形分布 | 线性资源分布 |

## 验收标准

1. 所有典型星区第一级验证合格率 100%（或存疑项有明确解释）
2. 第二级验证密度分级逻辑正确（通过 regions 关联 yield_name）
3. 气体 Block 分布分析完成，输出双向匹配报告（匹配率）
4. 验证脚本支持命令行参数化执行
5. 验证报告以 Markdown 格式输出到 `analysis/doc/resource/<sector_id>.md`

## 相关工作

- 存档数据位置：`save_sample_data/`
- 理论总量来源（第一级）: `save_sample_data/total.json` 中的 `sectors[].ware.<ware>.<density>.max`
- 理论密度分级来源（第二级）: `src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json` + `regions.json`
- 分析脚本位置：`analysis/scripts/verify_sector.py`
