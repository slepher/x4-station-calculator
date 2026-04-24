# Production Store Presenter View - 设计文档

## 设计目标

本次重构必须同时满足两个目标：

1. production workbench 必须稳定为 `store -> presenter -> view`
2. 系统必须减少抽象层次，而不是通过新增中间层掩盖现有混乱

本次设计不得引入新的页面级 presenter、workbench facade、view model、adapter 或兼容胶水层。所有收口必须直接发生在现有 store、现有 5 个 presenter、现有 view 之间。

## 核心设计结论

### 1. `archiveStation` 是 store 领域模型

`archiveStation` 必须被定义为 live production 的核心领域对象，而不是 presenter 的输入碎片。

`archiveStation` 必须承担下列职责：

- 表达当前选中存档站点的真实领域快照
- 聚合 player station record、build storage record、sector 信息与模块聚合结果
- 承载后续新增的 live 专属字段

`archiveStation` 不得被压平成 `context` 的字段集合后再作为主来源使用。

### 2. `stationContext` 不是稳定领域对象

当前 `stationContext` 本质上是“为 toolbar/view 凑 props 的扁平结构”，不是领域模型。

因此本次设计必须执行以下收敛：

- 保留 `archiveStation`
- 禁止继续扩张 `stationContext`
- 禁止继续把 archive 领域字段先写进 `stationContext` 再转写到 presenter

若某字段表达 live 领域事实，字段必须进入 `archiveStation` 或同级 store 领域对象；若某字段只服务 UI 展示，字段必须由 presenter 从 store 领域对象映射得出。

### 3. `context` 只保留附加上下文，不再承担 archive 事实

`context` 允许保留“当前实体附加上下文”这一职责，但必须收窄语义。

`context` 只允许表达：

- 当前实体所处 sector 与位置上下文
- 当前实体是否有 binding / archive 的判定结果
- presenter 在多个 UI 片段中重复读取的轻量附加信息

`context` 不得继续承担：

- archive 站点详情主模型
- build storage 明细主模型
- 未来 live 专属领域字段的主归属

### 4. `stationState` 继续作为唯一主展示状态

`stationState` 必须继续承担当前实体的统一主展示状态职责，但自身不做任何计算——它是纯组装层。

设计要求如下：

- station 与 transit 必须共用 `stationState`
- transit 不得恢复独立主状态对象
- **所有主计算结果（包括 transit 的）必须进入各自的状态 computed（`activeStationState` / `activeTransitState`）**
- `stationState` 只做：择取正确的内部状态、附加实体元信息、拼合 settings/empireGaps 等公共字段
- presenter 必须只从 `stationState` 读取主结果

#### 4.1. plan | live 双态切换的收敛结构

live store 内部的切换结构如下：

```
activeStationState ─── station 模式的 plan/live 切换
  ├─ plan: planningDerivedMap
  └─ live: liveFlowMap

activeTransitState ─── transit 模式的 plan/live 切换（新增）
  ├─ plan: planningFlowFacade
  └─ live: liveFlowFacade

stationState ─── 纯组装层（不做切换、不做计算）
  ├─ wm === 'transit'  → 从 activeTransitState 取值 + 拼合元信息
  ├─ wm === 'station'  → 从 activeStationState 取值 + 拼合元信息
  └─ wm === 'overview' → null
```

`stationState` 的 transit 分支当前（未重构前）内嵌了完整的 `mode.value === 'live'`、`buildDerivedTransitState()` 等计算逻辑。重构后这些逻辑移至 `activeTransitState`，`stationState` 退化为：

```typescript
if (wm === 'transit') {
  const state = activeTransitState.value  // 已包含正确切换后的结果
  return { entityType: 'transit', ...state, ...元信息, ...公共字段 }
}
```

`activeStationState` 的字段：

#### 4.2. plan/live 切换的两种模式

plan/live 双态切换在实际 UI 中呈现为两种本质不同的情况，必须分开处理：

##### 模式 A: 同组件、不同数据 → `stationState` 归一化

当前实体的某个属性在 plan 和 live 下由相同的子组件渲染，只是数据来源不同。例如：

- `productionFlows`：`WareflowDashboard` 在 plan/live 下渲染方式相同
- `modules` / `buildingModules`：Dashboard 在 plan/live 下都用同一个模块列表组件展示

**处理方式**：在 `activeStationState` 中完成切换，`stationState` 输出统一形状的字段。presenter 和 Vue 只消费 `stationState`，不需要知道底层是 plan 还是 live。

##### 模式 B: 不同组件、二元切换 → presenter 提供选择，wrapper 做组件分支

plan 和 live 下使用**完全不同的子组件**，且组件接口、交互模式完全不同。当前唯一切例：

| | plan 模式 | live 模式 |
|---|---|---|
| 组件 | `StationPlanningPanel` | `ArchiveModuleList` |
| 行为 | 可编辑拖拽排序、搜索添加、缩放按钮、auto-tier 展示与转入 | 只读、按模块组分类展示、build storage 虚线区域 |
| 所需数据 | `plannedModules`, `autoIndustryModules`, `autoHabitationModules`, `autoInfrastructureModules`, `enforceDlcActivation` | `archiveModules`, `buildingModules` |

**处理方式**：

1. **presenter** 提供两套数据 + 一个 `showArchive` 布尔（派生自 `visualMode === 'live'`）：
   - plan 侧数据：`plannedModules`, `autoIndustryModules`, `autoHabitationModules`, `autoInfrastructureModules`, `enforceDlcActivation`
   - live 侧数据：`liveModules`, `liveBuildingModules`
   - 选择信号：`showArchive`（或等价布尔）

2. **wrapper** 用 `v-if / v-else` 选择渲染哪个子组件，传递对应的 props

3. **wrapper 不得直接访问 store**。`mode`、`archiveModules`、`buildingModules`、`hasArchive` 必须全部从 presenter 获取。当前 `LiveProductionWorkbenchView.vue` 中下列行破坏了此规则：
   ```vue
   :mode="liveStore.session.mode"                       ← 违规：直接读 store
   :archive-modules="liveStore.context.archiveModules"   ← 违规：直接读 store + context
   :building-modules="liveStore.context.buildingModules" ← 违规：直接读 store + context
   :has-archive="liveStore.context.hasArchive"           ← 违规：直接读 store + context
   ```
   修正后应为：
   ```vue
   :show-archive="planningPresenter.props.visualMode.value === 'live'"
   :archive-modules="planningPresenter.props.liveModules.value"
   :building-modules="planningPresenter.props.liveBuildingModules.value"
   ```

4. **presenter 中 `liveModules` / `liveBuildingModules` 的来源**也必须修正：当前从 `store.context.archiveModules` / `store.context.buildingModules` 读取。`context` 清掉这些字段后，改为从 `store.archiveStation` 读取：
   ```typescript
   liveModules: computed(() => store.archiveStation?.modules ?? []),
   liveBuildingModules: computed(() => store.archiveStation?.building?.modules ?? [])
   ```

##### 判定原则

| 条件 | 处理方式 |
|---|---|
| 同一子组件渲染，数据来源不同 | 模式 A：收敛到 `stationState`，presenter 不分支 |
| 完全不同子组件，接口和行为不同 | 模式 B：presenter 提供 `showArchive` + 两套数据，wrapper 做 `v-if/v-else` 组件选择 |
| archive 独有字段，plan 侧无对应物 | 留在 `archiveStation`，presenter 直接读取 |



### 5. presenter 是唯一 UI 组装层

五个 production presenter 必须承担全部 UI 组装职责：

- `useProductionTabbarPresenter`
- `useProductionToolbarPresenter`
- `useProductionPlanningPresenter`
- `useProductionWareflowPresenter`
- `useProductionDashboardPresenter`

它们必须直接从以下来源读取：

- `session`
- `context`
- `stationState`
- `archiveStation` 或其他 store 领域对象
- 统一业务动作

presenter 必须完成：

- 子组件 props 组装
- station / transit / overview 展示分支
- planning / live 可视化切换映射
- archive 字段到 UI 字段的映射

presenter 不得完成：

- 领域对象定义
- 业务算法重算
- 新建页面级中间抽象

## 最终架构

### 1. Store 层

两个 store 必须继续保留：

- `useBlueprintProductionStore`
- `useLiveProductionStore`

它们对 presenter 的正式主接口必须固定为：

- `session`
- `context`
- `stationState`
- actions

同时，store 内部与必要的正式接口中必须继续保留真实领域对象来源，例如：

- `archiveStation`
- `bindingStation`
- `planningStationDraft`

这些对象必须作为计算与映射的真实来源存在，不得为了接口表面统一而被删除。

### 2. Presenter 层

presenter 必须直接消费 store 领域对象并映射子组件所需结构。

本次设计禁止新增：

- `useProductionWorkbenchPresenter`
- `useLiveWorkbenchPresenter`
- `useBlueprintWorkbenchPresenter`
- `viewModel`
- `facade`

收口必须在现有 5 个 presenter 中完成。

### 3. View 层

两个 workbench view 只允许承担：

1. 选择 store
2. 创建 presenter
3. 传递 presenter 输出给子组件
4. 基于 `session.workbenchMode` 执行布局切换

view 不得继续定义“解释 archive/binding 组合规则”的 computed，也不得直接拉取多个 store 字段拼接成子组件 props。

## 字段归属规则

### 1. 必须进入 store 领域对象的字段

满足任一条件的字段必须进入 `archiveStation` 或其他 store 领域对象：

- 字段表达存档真实事实
- 字段在 presenter 之间可复用
- 字段会随着 live 功能扩展持续增长
- 字段与 blueprint 明显不同，且不是单纯展示态

典型示例：

- sector 原始信息
- station/build storage cargo
- reservation
- workforces
- tag / factoryGroup / productionProfile / profileName
- 未来新增的 archive station 细节

### 2. 必须进入 presenter 的字段

满足任一条件的字段必须在 presenter 中组装：

- 字段是某个 Vue 组件专用 props
- 字段只是对领域对象的重命名或扁平展开
- 字段服务于 UI 开关、显示文案或展示组合
- 字段是 station / transit / overview 的显示分支结果

典型示例：

- toolbar 需要的标题模型
- dashboard 需要的 `modules + buildingModules` 拼接结果
- 资源 pill / sector pill 展示值
- planning/live 模式下的面板显示差异

### 3. 必须移出 store 的字段

下列类型字段不得保留在 store 中作为正式职责：

- `importModalOpen` 这类纯 UI 打开状态
- `titlePlaceholder` 这类纯展示文案
- 任何“专为某个子组件准备的扁平 props 对象”

## 实施设计

### Phase 1: 固定领域边界

必须先完成以下动作：

1. 公开导出 `archiveStation`，加入 `useLiveProductionStore` 的 public return
2. 明确 `archiveStation` 的类型边界（当前 `ArchiveStationData` 中 `modules`、`building.modules`、`cargo`、`reservation`、`workforces`、`tag`、`factoryGroup` 等字段的职责）
3. 从 `context` 的 `ProductionContextState` 中移除 `archiveModules` / `buildingModules`
4. 消除内部 `stationContext` computed，将其剩余的附属字段合并到 `context` computed 中
5. 在 `ProductionStationState` 中新增 `modules` / `buildingModules` 字段
6. 在 `activeStationState` 中按 plan/live 切换填充这两个新字段
7. 冻结 `context` 的职责，禁止继续塞入 archive 主事实

### Phase 2: presenter 回收 UI 组装

必须依次改造五个 presenter：

1. `Tabbar`
2. `Toolbar`
3. `Planning`
4. `Wareflow`
5. `Dashboard`

每个 presenter 都必须停止依赖 panel-specific getter 主路径，并直接从领域对象映射 UI。

其中 `useProductionDashboardPresenter` 的改动力度最大：
- 移除以 `context.archiveModules` / `context.buildingModules` 为来源的编排逻辑
- 统一从 `stationState.modules` / `stationState.buildingModules` 读取
- 不再自行判断 `visualMode === 'live'` 来切换数据源
- archive 独有的 live 专属展示字段（如 cargo、reservation、tag 等）直接从 `archiveStation` 映射

### Phase 3: view 收缩

在 presenter 改造完成后，必须收缩两个 workbench view。

view 必须移除：

- 直接引用 store 零散字段的 computed
- 直接处理 archive / binding / transit 组合规则的逻辑
- 直接拼装 Import、Toolbar、Planning、Dashboard props 的逻辑

### Phase 4: 旧入口清理

最后必须清理：

- 旧 panel-specific getter
- 旧兼容层
- 旧 contract 中延续旧模式的字段

若同一提交内短暂保留旧入口，必须加 `@deprecated` 与静态告警门禁，并在本 change 完成前彻底移除。

## 失败判定

出现下列任一情况，本次设计视为失败：

1. 新增了页面级 facade / presenter / view model。
2. `archiveStation` 被错误下沉到 presenter。
3. `archiveStation` 未公开导出，presenter 仍通过 `context` 间接读取 archive 数据。
4. `context` 继续扩张为 archive 事实容器。
5. `context` 中仍保留 `archiveModules` / `buildingModules` 字段。
6. `stationContext` 内部中间层未被消除。
7. `stationState` 缺少 `modules` / `buildingModules` 字段。
8. `stationState` transit 分支内嵌计算逻辑（应移至 `activeTransitState`）。
9. `useProductionDashboardPresenter` 仍自行判断 `visualMode` 来切换数据源。
10. view 仍直接拼装大量 UI 数据。
11. store 继续新增 panel-specific getter 主路径。
12. transit 恢复为独立主状态对象。
