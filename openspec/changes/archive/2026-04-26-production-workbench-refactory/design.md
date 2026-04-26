# Production Workbench Refactory - 设计文档

## 设计目标

本次重构必须同时满足两个目标：

1. production workbench 稳定为 `store -> presenter -> view` 三层结构
2. 固定实体职责边界：`activeStation = bindingStation | archiveStation`，`editableStationPlan` 独立
3. 系统减少抽象层次，不通过新增中间层掩盖混乱

## 已完成前提

### ✅ BlueprintProduction 星区剥离（remove-blueprint-production-sector）

- `StationTabBar.vue` → `SectorStationTabBar.vue`（带星区版）
- 新建简化版 `StationTabBar.vue`（无星区版）
- BlueprintProductionStore 移除所有星区属性与方法
- BlueprintProductionWorkbenchView 移除 Transit/Overview 视图
- LiveProductionWorkbenchView 继续使用 SectorStationTabBar

### ✅ 旧 workbench 兼容层移除（remove-workbench）

- 所有旧 `getTabs` / `getToolbarXxx` / `getWareflowXxx` / `getDashboardXxx` 等 panel getter 已删除
- Presenter 不再依赖旧 getter，改为从 `session` / `context` / `stationState` 与正式动作接口读取
- View 已收缩，不再手工组装 panel 主数据
- `ProductionStationState` 与 `ProductionSessionState` 已补全替代旧 getter 所需的字段

## 目标架构

### 1. Store 层

两个 store 继续保留：

- `useBlueprintProductionStore`
- `useLiveProductionStore`

对 presenter 的正式主接口：

```
session          — 工作台会话状态（workbenchMode、mode、activeStationId 等）
context          — 当前实体附加上下文（sector、position、hasBinding、hasArchive）
stationState     — 当前实体统一主展示状态
actions          — 正式业务动作（moduleActions、wareRuleActions、settingActions、selectionActions）
```

store 内部保留的真实领域对象来源（同时通过正式接口公开）：

```
archiveStation           — 当前实体 archive 侧来源（live store）
bindingStation           — 当前实体 binding 侧来源
planningStationDraft     — planning 草稿
editableStationPlan      — 当前可编辑 planning 实体
```

### 2. Presenter 层

五个 production presenter 承担全部 UI 组装职责，直接从 store 领域对象映射：

```
useProductionTabbarPresenter     — tabbar props/emits
useProductionToolbarPresenter    — toolbar props/emits
useProductionPlanningPresenter   — planning panel props/emits
useProductionWareflowPresenter   — wareflow panel props/emits
useProductionDashboardPresenter  — dashboard panel props/emits
```

Presenter 职责：
- 从 `session`、`context`、`stationState`、`archiveStation`、`editableStationPlan` 等领域对象读取
- 组装子组件 props
- 绑定 UI emits 到 store actions
- 处理 station / transit / overview 显示分支
- 处理 plan/live 可视化切换映射

Presenter 不得：
- 重新计算业务算法结果
- 定义新的领域模型
- 依赖 panel-specific getter 主路径

### 3. View 层

两个 workbench view 只保留：

```
BlueprintProductionWorkbenchView:
  - loadEmpire
  - 创建 presenter
  - 渲染子组件

LiveProductionWorkbenchView:
  - openBinding
  - 创建 presenter
  - 基于 session.workbenchMode 区块切换
  - overview 渲染
  - 渲染子组件
```

### 4. 实体模型

```
bindingStation / archiveStation = 当前实体来源
activeStation = bindingStation | archiveStation（当前页面实体）
editableStationPlan = 当前可编辑 planning 实体
workbenchMode = 当前页面模式
context / stationState = 页面正式消费出口
```

```
activeStation ─── 统一实体抽象
  ├─ bindingStation 优先（覆盖 station + transit）
  └─ archiveStation fallback（覆盖 station + transit）
```

编辑链路：
```
station plan 编辑入口 ─── edibleStationPlan（仅 station 模式）
transit 模式 ─── 不消费 station plan 编辑入口
```

### 5. Transit 实体来源

transit 继续使用 `stationState`（entityType = 'transit'），不恢复独立主状态对象。

计算位置：
```
activeStationState ─── station 模式的 plan/live 切换
activeTransitState ─── transit 模式的 plan/live 切换
stationState ─── 纯组装层（不做切换、不做计算）
```

### 6. `stationState` 补齐字段

```
stationState.modules:
  - plan: resolvedModules（planned + auto）
  - live: archiveStation.modules

stationState.buildingModules:
  - plan: []（无 build storage）
  - live: archiveStation.building.modules
```

plan/live 切换在 `activeStationState` 内完成，presenter/Dashboard 只消费 `stationState` 统一结构。

## 实施设计

### Phase A: 领域边界固定

1. 公开导出 `archiveStation`，固定 live 领域对象边界
2. 从 `context` 移除 `archiveModules` / `buildingModules`
3. 消除 `stationContext` 内部中间层
4. 在 `ProductionStationState` 中新增 `modules` / `buildingModules`
5. 在 `activeStationState` 中按 plan/live 切换填充
6. 冻结 `context` 职责

### Phase B: 实体来源收口

1. 明确 `bindingStation` / `archiveStation` 覆盖 station+transit
2. 移除来源层中 `mode === 'station'` / `mode === 'transit'` 的实体选源分支
3. 将 `activeStation` 改为统一实体归一化层

### Phase C: 编辑入口迁移

1. 定义 `editableStationPlan`（live store）
2. `plannedModules` / `lockedWares` / `warePriority` 改为读写 `editableStationPlan`
3. module/settings/wareRule actions 改为以 `editableStationPlan` 为 mutation target
4. Blueprint store 同步对齐

### Phase D: Presenter 改造

1. Tabbar presenter
2. Toolbar presenter
3. Planning presenter
4. Wareflow presenter
5. Dashboard presenter

### Phase E: View 收缩

1. `BlueprintProductionWorkbenchView.vue`
2. `LiveProductionWorkbenchView.vue`

### Phase F: 构建验证

1. `npm run build`

## 失败判定

出现下列任一情况，本次设计视为失败：

1. 新增了页面级 facade / presenter / view model
2. `archiveStation` 被错误下沉到 presenter
3. `archiveStation` 未公开导出
4. `context` 继续扩张为 archive 事实容器
5. `context` 中仍保留 `archiveModules` / `buildingModules`
6. `stationState` 缺少 `modules` / `buildingModules`
7. `activeStation` 未收敛为 `bindingStation | archiveStation`
8. `bindingStation` / `archiveStation` 内部仍通过 mode 分支决定实体来源
9. `editableStationPlan` 未定义或编辑入口未迁移
10. `useProductionDashboardPresenter` 仍自行判断 `visualMode` 切换数据源
11. view 仍直接拼装 UI 数据
12. `mode === 'transit'` 仍承担实体选源主路径
13. blueprint 与 live 的 station 编辑主路径不一致
