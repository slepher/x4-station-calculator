# Build Plan Compute - Test Knowledge

## UI 锚点定位

### 计算与方案展示

| UI 元素 | Locator | 说明 |
|---|---|---|
| 计算按钮 | `button` 含文本 "计算建造方案" / "Compute" | 触发 compute 运算 |
| 方案分组区 | `.allocation-section` (compute 结果区) | 方案卡片容器 |
| 方案分组 | `BuildSchemeGroup` 容器 | 含 groupType（build-material / production） |
| 方案卡片 | `BuildScheme` 卡片 | 含名称、耗时、花费 |
| 主要模块区 | `.primary-module-list` / `.module-summary` | 主要模块信息区 |
| 模块行 | `.module-line` | 模块名称 × 数量 |
| 方案详情弹窗 | `.modal` / `.scheme-detail-modal` | 点击卡片后弹出 |
| 模块汇总手风琴 | `.module-accordion` | 默认显示 |
| Steps 列表 | `.steps-list` | steps 模式下显示 |
| Steps 开关 | `.steps-toggle` / `input[type=checkbox]` | 切换模块汇总 / steps 模式 |
| 材料明细 | `.material-list` | 材料行列表 |
| 材料行 | `.material-line` | 材料名称 + 数量 |

### i18n 文本锚点

| i18n Key | EN | CN | 用途 |
|---|---|---|---|
| `build_plan.compute` | Compute | 计算建造方案 | 计算按钮 |
| `build_plan.total_duration` | Total Duration | 总耗时 | 方案卡片 |
| `build_plan.total_cost` | Total Cost | 总花费 | 方案卡片 |
| `build_plan.primary_modules` | Primary Modules | 主要模块 | 模块区标题 |
| `build_plan.derived_modules` | Derived Modules | 辅助模块 | 辅助区标题 |
| `build_plan.show_steps` | Show Build Steps | 显示建造步骤 | steps 开关 |
| `build_plan.loading_steps` | Loading... | 加载中 | steps 加载态 |
| `build_plan.no_modules` | No Modules | 无模块 | 空模块兜底 |
| `build_plan.scheme_joint` | Joint | 联合 | 联合方案类型 |
| `build_plan.scheme_materials` | Materials | 材料厂 | 材料方案类型 |
| `build_plan.scheme_production_line` | Production Line | 生产线 | 生产方案类型 |
| `build_plan.group_build_material` | Build Material Lines | 建材产线 | 建材分组标题 |
| `build_plan.group_production` | Production Lines | 生产产线 | 生产分组标题 |

## Fixture 数据映射

### Ware Fixtures

| Ware | ID | Tier | 测试用途 |
|---|---|---|---|
| Energy Cells | energycells | 0 | 基础目标 / 口径排除测试 |
| Hull Parts | hullparts | 2 | 主要模块计算实例 |
| Graphene | graphene | 1 | SCC 循环依赖边 |
| Refined Metals | refinedmetals | 1 | 上游材料 |

### Module Fixtures

| Module | ID | 产出 | 输入 | 测试用途 |
|---|---|---|---|---|
| Hull Part Production | prod_gen_hullparts_macro | hullparts | graphene, refinedmetals | 主要模块求解 |
| Graphene Production | prod_gen_graphene_macro | graphene | methane | SCC 循环 |
| Refined Metal Production | prod_gen_refinedmetals_macro | refinedmetals | ore | 上游材料 |

## 测试策略

### Compute 与 Preview 边界

- Compute 只读使用 previewResult，不修改
- Compute 不重新调用 computeProductionLineAllocation
- Compute 结果存入 computeResult / schemeGroups

### SCC 收敛验证

- 循环依赖产线组在 compute 阶段迭代求解
- 收敛判据：主要模块数量不再变化（makePrimarySnapshot）
- 辅助模块变化不参与收敛判断
- 迭代上限 60 次

### 方案详情两态

- 默认：moduleSummaries 手风琴 + 材料明细
- Steps 模式：纯 step 列表
- 切换通过局部开关控制，不触发 store 重算
- 空模块场景隐藏 steps 开关

## Store 访问（E2E Dev/Test Mode）

```typescript
const store = await page.evaluate(() => window.buildPlanStore)
const preview = await page.evaluate(() => window.buildPlanStore.previewResult)
const computeResult = await page.evaluate(() => window.buildPlanStore.computeResult)
const schemeGroups = await page.evaluate(() => window.buildPlanStore.schemeGroups)
```
