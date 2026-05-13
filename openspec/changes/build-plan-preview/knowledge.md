# Build Plan Preview - Test Knowledge

## UI 锚点定位

### 建造目标面板

| UI 元素 | Locator | 说明 |
|---|---|---|
| 目标搜索输入框 | `[data-testid="goal-search-input"]` | 输入产品名称搜索目标 |
| 目标搜索弹窗 | `[data-testid="goal-search-popover"]` | 搜索候选结果显示 |
| 搜索结果项 | `[data-testid^="goal-result-"]` | 单个搜索结果 |
| 方案菜单触发器 | `[data-testid="build-plan-plan-menu-trigger"]` | 方案选择下拉 |
| 建材产线 checkbox | `input[type=checkbox]` | 切换建材产线规划 |

### Preview 展示区

| UI 元素 | Locator | 说明 |
|---|---|---|
| 预览区主容器 | `[data-testid="preview-section"]` | 整个预览分配区（PreviewLinePlanSection） |
| 分配分组卡片 | `.allocation-group` | 单条产线分组 |
| 未分配分组（无规划） | `.allocation-group--unmatched` | 带虚线边框的待规划分组 |
| 分组 header | `.allocation-group-header` | 名称 + 计数区域 |
| 分组名称 | `.allocation-group-name` | 产线组显示名称 |
| Module 去重计数 | `.allocation-group-count` | 右上角模块种类数 |
| 预览条目行 | `.goal-row` | 单个 preview 项 |
| Derived 条目行 | `.goal-row--derived` | derived 项的专属行样式 |
| 色条 | `.color-bar` | 左侧颜色指示条 |
| 条目名称 | `.goal-name` | 显示 module/ware 名称 |
| 条目标签区 | `.goal-controls` | 标签 / 锁图标区域 |
| 锁定图标 | `.derived-badge` | 锁形 SVG 图标 |
| DLC 标签 | `.dlc-tag` | DLC 标识 |
| 建材产线区 | `.allocation-section` 内过滤出的 build-material lines | 通过 presenter 过滤的 PreviewLinePlanSection |

### Preview 标签

| UI 元素 | Locator | 说明 |
|---|---|---|
| Derived 标签（绿色） | `.preview-tag--derived` | bg-emerald-900/40 text-emerald-300 |
| Required 标签（红色） | `.preview-tag--required` | bg-rose-900/40 text-rose-300 |
| 标签文本 target | `.preview-tag` 含文本 "Target" / "目标" | derived 专属 |
| 标签文本 production | `.preview-tag` 含文本 "Production" / "材料" | derived 和 required 共有 |
| 标签文本 build-material | `.preview-tag` 含文本 "Material" / "建材" | derived 和 required 共有 |

### 交互元素

| UI 元素 | Locator | 说明 |
|---|---|---|
| 建材产线 checkbox | `input[type=checkbox]` | 切换建材产线规划 |
| 逻辑产线方案菜单 | `[data-testid="build-plan-flow-menu"]` | 选择产线方案绑定 |

### i18n 文本锚点

| i18n Key | EN | CN | 用途 |
|---|---|---|---|
| `build_plan.target_short` | Target | 目标 | derived target 标签 |
| `build_plan.production_short` | Production | 材料 | production 标签 |
| `build_plan.build_material_short` | Material | 建材 | build-material 标签 |
| `build_plan.required_short` | Req | 需求 | required 标签 |
| `build_plan.derived_locked` | Auto-generated | 自动生成 | 锁定图标 tooltip |
| `build_plan.unmatched` | Unplanned Line | 待规划产线 | 未分配分组名称 |
| `build_plan.build_material_allocation` | Build Material Allocation | 建材产线分配 | 建材区标题 |
| `build_plan.group_production` | Production Lines | 生产产线 | 生产区标题 |

## Fixture 数据映射

### Ware Fixtures (tests/fixtures/ware_fixtures.yaml)

| 关键 Ware | ID | EN 名称 | CN 名称 | Tier | 测试用途 |
|---|---|---|---|---|---|
| Energy Cells | `energycells` | Energy Cells | 能量电池 | 0 | production-rate 目标测试 |
| Hull Parts | `hullparts` | Hull Parts | 船体部件 | 2 | 依赖图 BFS 起点 |
| Graphene | `graphene` | Graphene | 石墨烯 | 1 | isolated 扩展测试 |
| Refined Metals | `refinedmetals` | Refined Metals | 精炼金属 | 1 | 非关联分组隔离测试 |
| Claytronics | `claytronics` | Claytronics | 电子黏土 | 3 | 循环依赖 / SCC 测试 |
| Quantum Tubes | `quantumtubes` | Quantum Tubes | 量子管 | 2 | claytronics 上游 |
| Microchips | `microchips` | Microchips | 微芯片 | 2 | claytronics 上游 |

### Module Fixtures (tests/fixtures/module_fixtures.yaml)

| 关键 Module | ID | Tier | 产出 | 输入 | 测试用途 |
|---|---|---|---|---|---|
| Energy Cell Production | `prod_gen_energycells_macro` | 0 | energycells | 无 | 基础目标 |
| Hull Part Production | `prod_gen_hullparts_macro` | 2 | hullparts | graphene, refinedmetals | 依赖图目标产线 |
| Graphene Production | `prod_gen_graphene_macro` | 1 | graphene | methane | 孤立扩展上游 |
| Claytronics Production | `prod_gen_claytronics_macro` | 3 | claytronics | antimattercells, microchips, quantumtubes | SCC 循环测试 |
| Quantum Tube Production | `prod_gen_quantumtubes_macro` | 2 | quantumtubes | graphene, superfluidcoolant | SCC 上游 |

## 测试策略

### 依赖图 BFS 扩散验证

测试数据设计：
- 目标产线 C 需要 hullparts（buildCost）
- hullparts 的 outputBuildTag 连线到产线 A
- 产线 A 的 buildCost 需要 graphene
- graphene 的 outputBuildTag 连线到产线 B
- 断言图包含 C→A, A→B 边

### Isolated 扩展验证

- 目标产线含 isolated 节点（graphene）
- 存在产线 B 的 manual 节点产出 graphene
- 断言 ROOT→B 的 isolated 边存在
- 无产出产线时，不产生边

### SCC 检测验证

- 产线 A 提供 hullparts 且需 graphene
- 产线 B 提供 graphene 且需 hullparts
- 形成 A↔B 循环
- 断言 sccGroups 包含 [A, B]

### 合并规则验证

- Derived: 同 groupId + wareId + moduleId → 合并为一条，标签去重
- Required: 同 groupId + wareId → 合并为一条
- Derived + Required 同 wareId → 两条独立项

### Preview 区分验证

- 建材产线 checkbox 勾选 → 出现建材产线区（build-material items）
- 建材产线 checkbox 取消 → 建材产线区消失（无 build-material 项）
- 取消勾选后仅保留生产产线区

### 无规划模式验证

- logicFlowPlanId = null 时 preview 仍执行
- 所有目标进入 unmatched line
- PreviewResult.graph = null
- PreviewResult.sccGroups = []

### Card Count 验证

- 分组右上角计数 = 该组 derived 项 moduleId 的去重数量
- required 项不计入计数
- 同一 moduleId 出现在多条 derived 项只计 1

## Store 访问（E2E Dev/Test Mode）

```typescript
// 访问 build-plan store
const store = await page.evaluate(() => window.buildPlanStore)

// 检查 previewResult
const preview = await page.evaluate(() => window.buildPlanStore.previewResult)

// 检查 buildMaterialPlanningEnabled
const bmEnabled = await page.evaluate(() => window.buildPlanStore.buildMaterialPlanningEnabled)

// 检查 resolvedLogicFlowState
const lfState = await page.evaluate(() => window.buildPlanStore.resolvedLogicFlowState)
```
