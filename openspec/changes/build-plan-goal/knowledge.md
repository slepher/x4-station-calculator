# Build Plan Goal - Test Knowledge

## UI 锚点定位

### 建造目标面板

| UI 元素 | Locator | 说明 |
|---|---|---|
| 面板容器 | `.panel-card` | 整个建造目标面板容器 |
| 面板标题 | `.panel-header` 内可编辑标题文本 | 显示当前方案名称 |
| 方案菜单触发按钮 | `[data-testid="build-plan-plan-menu-trigger"]` | 点击展开方案菜单 |
| 方案菜单 | `[data-testid="build-plan-plan-menu"]` | 方案列表下拉菜单 |
| 方案菜单项 | `.plan-menu-item` | 单个方案切换按钮 |
| 当前方案标记 | `.plan-menu-item-active` | active 方案高亮样式 |
| 新方案按钮 | `.plan-menu-item-new` | "New Plan" 创建新方案 |
| 删除方案按钮 | `.plan-delete-btn` | 方案项右侧 ✕ 按钮 |
| 空方案提示 | `.plan-menu-empty` | 方案列表为空时显示 |
| 目标搜索输入框 | `[data-testid="goal-search-input"]` | 输入产品/模块/蓝图名称 |
| 目标类别选择 | `[data-testid="goal-category-select"]` | 下拉选择目标类别（product/module/fleet） |
| 搜索弹窗 | `[data-testid="goal-search-popover"]` | 搜索结果弹窗 |
| 搜索结果项 | `[data-testid^="goal-result-"]` | 单个搜索结果项 |

### Fleet 目标

| UI 元素 | Locator | 说明 |
|---|---|---|
| Fleet 卡片 | `[data-testid="fleet-goal-card"]` | Fleet goal 整体卡片 |
| 建造时间模式选择器 | `.fleet-mode-select` | 原生 `<select>`，选项含 actual / planned |
| 建造时间输入框 | `X4NumberInput` | planned 模式下可见的输入框 |
| 船厂分组 | `.fleet-group` | 按 ship.class 分组（ship_l / ship_xl / ship_m+ship_s） |
| 船厂数量输入 | `[data-testid^="fleet-shipyard-count-"]` | 每个分组左上角数量输入 |
| 清空分组按钮 | `[data-testid^="fleet-group-clear-"]` | 分组标题栏 ✕ 按钮 |
| 条目行 | `.fleet-entry` | 单个蓝图条目行 |
| 条目数量输入 | `[data-testid^="fleet-entry-qty-"]` | 条目右侧数量输入框 |
| 删除条目按钮 | `[data-testid^="fleet-entry-remove-"]` | 条目右侧 ✕ 按钮 |
| 条目详情区 | `.fleet-entry-detail` | 点击展开后的物料明细区域 |
| 物料速率汇总 | `[data-testid="fleet-rates"]` | 底部汇总所有合并物料需求及小时速率 |

### Fleet 搜索

| UI 元素 | Locator | 说明 |
|---|---|---|
| Fleet 搜索输入 | `[data-testid="fleet-search-input"]` | 选择 fleet 类别后出现的搜索输入框 |
| Fleet 搜索弹窗 | `[data-testid="fleet-search-popover"]` | 搜索结果弹窗 |
| Fleet 搜索结果 | `[data-testid^="fleet-result-"]` | 单个蓝图搜索结果 |

### 新增 data-testid 定位

以下 data-testid 已在实现阶段添加到源组件：

| UI 元素 | data-testid | 源组件 | 说明 |
|---|---|---|---|
| 产线分配区容器 | `[data-testid="allocation-section"]` | ProductionLineAllocationSection.vue | 存放产线自动分配结果 |
| 无规划菜单项 | `[data-testid="flow-plan-menu-item-unplanned"]` | BuildPlanConstraintsPanel.vue | 产线方案菜单中的"无规划"项 |
| 产线方案触发器标签 | `[data-testid="build-plan-flow-menu-label"]` | BuildPlanConstraintsPanel.vue | 触发器按钮上的文本 span |
| Fleet 建造时间输入框 | `[data-testid="fleet-build-time-input"]` | FleetGoalCard.vue | planned 模式下可见的输入框 |
| Fleet 条目警告标记 | `[data-testid="fleet-entry-warning"]` | FleetGoalCard.vue | 蓝图缺失时的警告图标 |
| 目标列表项 | `[data-testid="goal-item-{wareId}"]` | WarePlanningItem.vue | 单个生产目标条目卡片 |
| 产线方案菜单项 | `[data-testid="flow-plan-menu-item-{id}"]` | BuildPlanConstraintsPanel.vue | id=unplanned 为无规划项 |

### 逻辑产线绑定

| UI 元素 | Locator | 说明 |
|---|---|---|
| 产线方案触发按钮 | `[data-testid="build-plan-flow-menu-trigger"]` | 逻辑产线方案选择器 |
| 产线方案菜单 | `[data-testid="build-plan-flow-menu"]` | 产线方案列表 |
| 产线方案项 | `.flow-plan-menu-item` | 单个产线方案（含"Unplanned"项） |
| 当前方案高亮 | `.flow-plan-menu-item-active` | 选中方案高亮样式 |
| 建筑产线 checkbox | `input[type=checkbox]` | 开启建筑产线模式 |

### 预览与计算结果

| UI 元素 | Locator | 说明 |
|---|---|---|
| 产线分配区 | `ProductionLineAllocationSection` | 目标分配结果展示区 |
| 计算按钮 | `.w-full .bg-amber-600` | "Compute" / "计算" 按钮 |
| 警告列表 | `.bg-red-900/30` | 系统警告/错误信息区 |
| 空状态提示 | 文本 "No goals" / "无目标" | 无目标时的占位文本 |

### i18n 文本锚点

| 功能 | i18n Key | EN | CN |
|---|---|---|---|
| 默认方案名 | `build_plan.default_plan_name` | Build Plan | 建造方案 |
| 无规划 | `build_plan.unplanned` | Unplanned | 无规划 |
| 无方案 | `build_plan.no_plans` | No plans | 无方案 |
| 建造产线模式 | `build_plan.build_flow_mode` | Build Flow | 建筑产线 |
| 新方案 | `build_plan.new_plan` | New Plan | 新方案 |
| Fleet | `build_plan.fleet` | Fleet | 舰队 |
| 实际时间 | `build_plan.fleet_actual_time` | Actual (Xh) | 实际 (X小时) |
| 规划时间 | `build_plan.fleet_planned_time` | Planned (Xh) | 规划 (X小时) |

## Fixture 数据映射

### Ware Fixtures (tests/fixtures/ware_fixtures.yaml)

| 关键 Ware | ID | EN 名称 | CN 名称 | Tier | 测试用途 |
|---|---|---|---|---|---|
| Energy Cells | `energycells` | Energy Cells | 能量电池 | 0 | production-rate 基础测试 |
| Hull Parts | `hullparts` | Hull Parts | 船体部件 | 2 | 产线分配测试对象 |
| Graphene | `graphene` | Graphene | 石墨烯 | 1 | 上游推导测试对象 |
| Refined Metals | `refinedmetals` | Refined Metals | 精炼金属 | 1 | 非关联分组测试对象 |
| Claytronics | `claytronics` | Claytronics | 电子黏土 | 3 | 高 tier 产线测试 |

### Module Fixtures (tests/fixtures/module_fixtures.yaml)

| 关键 Module | ID | Tier | 产出 | 测试用途 |
|---|---|---|---|---|
| Energy Cell Production | `prod_gen_energycells_macro` | 0 | energycells | 基础添加目标测试 |
| Hull Part Production | `prod_gen_hullparts_macro` | 2 | hullparts | 产线分配测试 |
| Claytronics Production | `prod_gen_claytronics_macro` | 3 | claytronics | 上游推导测试 |

### Ship 参考数据 (game data 8.0-Diplomacy)

| Ship ID | Class | 名称 | 建造时间 | 测试用途 |
|---|---|---|---|---|
| `ship_arg_l_destroyer_01_a` | ship_l | Behemoth Vanguard | 182s | fleet 船厂分组测试 |
| `ship_arg_s_fighter_01` | ship_s | - | - | fleet wharf 分组测试 |

## 测试策略

### 方案持久化验证

build_plan_goals 存储在 localStorage，需验证：
1. `ensureActivePlan()` 在无 activeId 时自动创建默认方案
2. `savePlansToStorage()` 在每次 buildGoals 变更后自动调用
3. `loadPlansFromStorage()` 在页面初始化时恢复方案列表
4. 版本迁移：旧版（version<2）读取时自动添加 buildTimeMode 字段

Fixture 注入方案：
```typescript
const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
// build_plan_goals key 已包含在 db.json 中会自动恢复
```

### Fleet 测试数据构建

Fleet E2E 需要 shipBuildStore 包含蓝图数据。测试数据准备：
1. 使用 shipBuildStore.addBlueprint() 注入测试蓝图
2. 船厂分组规则：ship_l → shipyard_l, ship_xl → shipyard_xl, ship_s/ship_m → wharf
3. 默认 shipyardCount = 1，最小值 = 1

### 逻辑产线绑定测试

测试需覆盖三种解析来源：
1. `active-store`：logicFlowPlanId === activeId，直接引用 store 数据，响应实时修改
2. `rebuilt-plan`：logicFlowPlanId 指向其他方案，重建快照，隔离实时修改
3. `none`：logicFlowPlanId = null，snapshot = null，预览继续走待规划产线

验证隔离性：
- active-store 模式下，在 logicFlowStore.groups 添加节点后 build-plan 预览应更新
- rebuilt-plan 模式下，logicFlowStore.groups 变更不影响 build-plan 预览

### 产线分配三级匹配

1. build-flow outputMaterialTag 匹配（最高优先级）
2. logic-flow 节点匹配（manual > auto，排除 isolated）
3. 待规划产线（isUnmatched=true）

验证分配结果样式：
- isUnmatched=false 的组显示正常分配样式
- isUnmatched=true 的组显示待规划样式

### 刷新持久化恢复验证

测试流程：
1. 通过 UI 创建方案并添加目标
2. 通过 `page.evaluate()` 获取当前 `savedPlans` 快照
3. 执行 `page.reload()`
4. 等待页面初始化完成并设置语言
5. 断言方案列表和 activeId 恢复

## 测试数据准备

### 语言设置

在 E2E beforeEach 中通过 UI 设置语言：
```typescript
const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
await langSelect.selectOption('zh-CN')
```

### localStorage 数据注入

通过 page.evaluate 直接设置 build_plan_goals key：
```typescript
await page.evaluate((data) => {
  localStorage.setItem(key, JSON.stringify(data))
}, buildPlanGoalsData)
```

## Store 访问（E2E Dev/Test Mode）

```typescript
// 访问 build-plan store
const buildPlanStore = await page.evaluate(() => window.buildPlanStore)

// 检查 savedPlans
const savedPlans = await page.evaluate(() => window.buildPlanStore.savedPlans)

// 检查 activeId
const activeId = await page.evaluate(() => window.buildPlanStore.savedPlans.activeId)

// 检查 logicFlow 绑定状态
const resolvedState = await page.evaluate(() => window.buildPlanStore.resolvedLogicFlowState)
```
