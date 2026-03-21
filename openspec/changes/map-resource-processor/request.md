# map-resource-processor 需求说明

## 目标

基于当前 `scripts/processor` 中处理 resource 代码的实现为准，整理出完整的 resource 处理文档，包括两个版本的逻辑分叉。

## 已确认方案（审核重点）

### `total_volume_km3` / `volume_km3`

- `total_volume_km3` 表示几何体在应用有效空间裁剪前的原始总体积。
- `volume_km3` 表示应用裁剪、封顶、离散化后参与实际产量计算的有效体积。
- 本次变更重点是把 8.0 `resourceareas.json` 中与实例级几何相关的 `total_volume_km3`、`volume_km3`、`total_yield`、`yield` 口径更新为新规则。

### 固体资源规则

- 固体总量公式统一为：`total_yield = total_volume_km3 × falloff × resourcedensity`，`yield = volume_km3 × falloff × resourcedensity`。
- `cylinder`
  - `size.r` 是半径，`size.linear` 是半高。
  - 实际高度为 `2 × linear`，围绕中心点向两侧展开。
  - 若圆面积超过 `2000km × 2000km`，按该正方形面积封顶。
  - 若总高度超过 `2000km`，按 `2000km` 封顶。
- `sphere`
  - 按球体体积计算。
  - 若体积超过 `2000km × 2000km × 2000km` 的正方体体积，则按该上限封顶。
- `splinetube`
  - 截断中心曲线超出 `x/y/z ∈ [-960km, +1024km]` 的部分。
  - 基于剩余有效曲线长度和半径计算有效体积。
- `box`
  - `x/y/z` 长度属性均为半长，实际空间向中心点两侧展开。
  - 截断超出 `x/y/z ∈ [-960km, +1024km]` 的部分后计算有效体积。
  - `falloff` 采用“轴向一元积分 + 径向二元积分”的口径。

### 气体资源规则

- 气体总量公式统一为：`total_yield = total_volume_km3 × falloff × resourcedensity / 64^3`，`yield = volume_km3 × falloff × resourcedensity / 64^3`。
- `cylinder`
  - 几何空间仍按中心点向两侧展开，`linear` 为半高。
  - 高度按坐标 0 点切分为整数个 `64km` 层后参与体积计算。
- `sphere`
  - 半径不超过 `2000km`。
  - 半径按 `32km` 向上取整后参与计算。
- `splinetube`
  - 点按 `x/y/z ∈ [-960km, +1024km]` 截断。
  - 半径按 `32km` 向上取整。
  - 横截面按 `64km × 64km` 的正方形矩阵离散近似。
- `box`
  - 直接按 `64k area` 碰撞/占格结果计算有效体积。

## 边界

### In Scope

- 更新 `map-resource-processor` 文档中与 `total_volume_km3` / `volume_km3` / `total_yield` / `yield` 相关的计算规则
- 明确固体与气体在 `cylinder` / `sphere` / `splinetube` / `box` 下的几何裁剪与离散化口径

### Out of Scope

- 当前回合不修改处理器源码实现
- 不扩展 UI、测试策略或非资源处理相关文档

## 背景

当前 resource 处理代码已经完成了模块化重构，形成了清晰的版本分叉架构：

- **8.0 版本（regions 模型）**: 使用 legacy_processor.py 处理传统 region 定义
- **9.0+ 版本（resourceareas 模型）**: 使用 modern_processor.py 处理新版 resourcearea 定义

需要将这些实现逻辑整理成文档，便于后续维护和开发。

## 范围

本文档涵盖以下数据处理链路：

1. **Region 处理** (8.0 版本)
   - regionyields.json 生成
   - regions.json 生成
   - resourceareas.json 生成

2. **ResourceArea 处理** (9.0+ 版本)
   - regionyield_definitions.json 生成
   - resourceareas.json 生成
   - regionyields.json (空数组占位)

3. **Map 中 Resources 处理**
   - maps.json 中的 sector.resources 聚合
   - 跨版本统一的资源聚合计算

4. **Region Yield 定义**
   - 8.0: regionyields.json (yield 定义)
   - 9.0+: regionyield_definitions.json (definition 定义)

## 交付物

1. 完整的 resource 处理流程文档
2. 两个版本的数据流对比
3. 核心算法说明
4. 输出数据结构定义
5. **文档对比分析报告**（新增）

## 验收标准

1. [ ] 文档准确反映当前代码实现
2. [ ] 清晰区分 8.0 和 9.0+ 的处理逻辑
3. [ ] 包含所有关键数据结构的字段说明
4. [ ] 包含核心算法的公式说明
5. [ ] 完成文档对比分析并生成报表
6. [ ] 固体资源总量算法以宏观收束式 `solid_yield ≈ volume_km3 × falloff × resourcedensity` 为最终保留口径，并明确 `AvgNoise` 不再单独计入
7. [ ] 文档中 `total_volume_km3` / `volume_km3` / `total_yield` / `yield` 的定义与新确认的几何封顶、裁剪、离散化规则一致

## 未决项

- 无

---

## 新增任务：文档对比分析

### 任务目标

对最终文档与原始文档、代码实现进行对比分析，识别差异和缺失内容。

### 对比范围

| 对比类型 | 对比双方 | 分析内容 |
|---------|---------|---------|
| **文档间对比** | 最终文档 vs 原始 change 文档 | 最终文档**缺少**了哪些原始文档中有的内容 |
| **文档 - 代码对比** | 最终文档 vs processor 代码实现 | 两者的**差异**（双向：文档缺失的代码实现 + 代码未实现的文档描述） |

### 对比范围限定

- 仅关注**生成 JSON 输出**相关的部分
- 不包括：测试策略、UI/前端、纯重构优化等内容

### 相关文档目录

- **最终文档**: `openspec/changes/map-resource-processor/design.md`
- **原始 change 文档**: `openspec/changes/` 目录下与 resource 相关的 change 文档
- **代码实现**: `scripts/processor/resource/`、`scripts/processor/map/` 等

### 交付物

1. **文档间对比报告**: 列出最终文档相比原始 change 文档缺少的内容
2. **文档 - 代码对比报告**: 列出最终文档与代码实现的双向差异
3. **汇总报表**: 整合两份报告的发现，提出补充建议
