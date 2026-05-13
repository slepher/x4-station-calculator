# build-plan-goal 需求

## 目标

定义 build-plan 中用户设置的目标体系：BuildGoal 类型、方案持久化与 CRUD、Fleet goal、logic-flow 绑定与 active 隔离、产线自动分配。

## 当前实现提醒

- 当前仓库中的 build-plan 目标系统经多次迭代，部分旧模型已被后续 change 替换
- 本文档以最新实现为准，旧模型（如 `derived-rate` 作为持久化类型、旧 fleet `{ type: 'fleet'; shipId: string; quantity: number }`）已替换
- 若代码与文档冲突，按文档修正代码

## 已确认方案（审核重点）

### BuildGoal 类型体系

```typescript
export type BuildGoal =
  | { type: 'production-rate'; wareId: string; ratePerHour: number }
  | { type: 'build-module'; moduleId: string; count: number }
  | { type: 'fleet'; buildTime: number; entries: FleetEntry[]; shipyardLCount: number; shipyardXLCount: number; wharfCount: number }
```

- `production-rate` — 用户设定的目标产物速率
- `build-module` — 用户设定的目标模块数量
- `fleet` — 用户基于已保存飞船蓝图设定的持续造船目标（替换旧 fleet 类型）

### Fleet Goal

- 始终只有一个 Fleet goal（单卡片），在 Goals 区顶部
- `buildTime` 默认 3600s，最小 600s
- `shipyardLCount` / `shipyardXLCount` / `wharfCount` 各默认 1，最小 1
- entries 按 ship.class 分为三组：大型船厂(ship_l)、超大型船厂(ship_xl)、船坞(ship_m+ship_s)
- Fleet 派生 rate 基于 effectiveBuildTime 计算后作为 `target-production` 进入 preview/compute 管线
- 蓝图被删除时 entry 显示 warning，材料和建造时间按 0 计算

### 方案持久化

```typescript
interface SavedBuildPlanGoalsState {
  version: number
  activeId: string | null
  list: BuildPlanGoalSnapshot[]
}

interface BuildPlanGoalSnapshot {
  id: string
  name: string
  buildGoals: BuildGoal[]
  logicFlowPlanId: string | null
  lastUpdated: number
}
```

- 独立 localStorage key，通过 `gameData.getStorageKey('build_plan_goals')` 区分游戏版本
- 持久化对象仅包含 `buildGoals`，不含 `buildMaterialPlanningEnabled` / `previewResult` / `computeResult` 等计算结果
- 自动保存时机：buildGoals 变更、方案名编辑确认、切换逻辑产线方案

### 方案管理

- 新建：菜单列表顶部"新建"项，默认命名"建造规划 N"
- 切换：直接加载方案的 `buildGoals` + 尝试还原 `logicFlowPlanId`，无确认弹窗
- 删除：列表中每项有 x 按钮，删除当前激活方案则切换到下一个
- 首次添加目标：无 `activeId` 时自动创建默认方案并激活
- id 生成：`crypto.randomUUID()`

### Logic-Flow 绑定与 Active 隔离

- 每个 build-plan 保存自己的 `logicFlowPlanId`
- logic-flow 菜单必须提供"无规划"选项，并将其保存为 `logicFlowPlanId = null`
- build-plan 触发 preview / compute 前，先通过独立 snapshot 解析层确定本次使用的 logic-flow 数据
- 若 `buildPlan.logicFlowPlanId === logicFlowStore.savedPlans.activeId`，直接复用 active store 已重建数据
- 若不同，按绑定 plan 重建 snapshot 保存到 `useBuildPlanStore` 自身状态
- build-plan 切换读取源时不得改变 logic-flow 的 active plan
- 当绑定 plan 与 active 相同时，active logic-flow 的实时编辑继续驱动 preview 重算
- 当绑定非 active plan 时，active logic-flow 的实时编辑不影响当前 build-plan

### 产线自动分配

对每个 `BuildGoal`，按三级优先级分配产线：

1. **Build-flow outputMaterialTag 匹配** — 最高优先级
2. **Logic-flow 节点匹配** — manual 优先，auto 兜底，排除 isolated
3. **待规划产线** — 虚拟分组，两三层均未命中

派生 goal：检测 logic-flow 中的 isolated 节点是否为上游产品（全链路递归），生成 `derived-rate` 类型目标。派生 goal 不持久化，实时重算。

### UI 布局

#### Panel-header

- 左侧：方案名标题（`useTitleEditor` 可编辑，无方案时显示"建造规划"）
- 右侧：方案菜单按钮（新建/切换/删除/高亮当前项）

#### Panel-content

```
[BuildGoalSearchBox]
[产线分配区域 / FleetGoalCard]
[建材产线 checkbox 靠左] ·········· [logic-flow 菜单按钮靠右]
[              计算 按钮              ]
```

## 边界

### In Scope

- BuildGoal 类型体系（含 Fleet goal）
- FleetGoalCard / FleetGoalSearchBox 组件
- resolveBlueprintMaterialCost 纯函数
- SavedBuildPlanGoalsState 持久化与 CRUD
- Logic-flow 绑定与 active 隔离
- 产线自动分配算法
- UI 布局（Panel-header + Panel-content）

### Out of Scope

- Preview 责任分配与依赖图
- Compute 求解与 steps
- 修改 build-flow 数据模型
- 编写测试代码

## 验收标准（DoD）

1. BuildGoal 类型体系完整，Fleet goal 支持船厂分组与派生 rate
2. `useBuildPlanStore.savedPlans` 正确持久化到 localStorage
3. 首次添加目标时自动创建方案，变更后自动保存
4. build-plan 通过独立 snapshot 解析层读取 logic-flow 数据
5. build-plan 切换读取源不影响 logic-flow active
6. 产线自动分配三级匹配正确
7. Panel-header 标题可编辑 + 方案菜单正常工作
8. Panel-content 布局：checkbox + logic-flow 菜单 + 计算按钮
9. `npm run build` 通过
