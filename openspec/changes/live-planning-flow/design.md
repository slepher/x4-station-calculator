# live-planning-flow 设计文档

## 架构概览

本次变更继续遵循 `store → presenter → vue` 三层结构。

- store 负责 `planning + archive` 条件下的新模块口径、主 flow 替换与后续聚合
- presenter 负责把新的 canonical planning flow 及其聚合结果透传给中间面板
- vue 负责按既有 UI 结构切换数据源，不在组件内拼装 `max` 逻辑

```
planning station state + archiveStation (store)
     │
     ├─ 读取 plannedModules
     ├─ 读取 autoIndustry/autoHabitation/autoInfrastructure
     ├─ 读取 archive.modules + archive.building.modules
     │
     ├─ 按 moduleId 逐项 max
     ▼
effectiveModules
     │
     ├─ 重算 workforce
     ├─ 重算 efficiency
     ├─ 重算 productionFlows
     ▼
canonical planning productionFlows
     │
     ├─ 继续派生 derivedProductionFlows
     ├─ 继续派生 volume aggregation
     └─ 继续派生 detail aggregation
     │
     ▼
useProductionWareflowPresenter
     │
     ├─ planning wareflow 视图
     └─ planning volume 视图及展开明细
```

## 设计原则

1. 仅在 `visualMode === 'planning' && archiveStation != null` 时启用新口径。
2. archive 侧全部模块参与逐项 `max`，因为规划不负责“拆除已有建筑”。
3. 不新增显式 `productionOnlyModules` 分类层，继续依赖现有隐式职责分离。
4. `recommendedModules` 是左侧 panel 的视图因素，不进入 flow 计算链。
5. `warePriorityLevels` 保持现状逻辑，避免把本次 change 扩散为优先级语义重写。
6. 新的 planning `productionFlows` 是 canonical flow，所有 flow-based aggregation 都必须基于它继续计算。
7. planning volume 主视图与展开明细必须共用同一口径，避免 UI 口径撕裂。
8. `planning + archive` 下，凡是由 archive 生产模块产出的 ware，禁止执行 lock 操作。

## 数据模型

### 1. effectiveModules

在 store 中新增 planning 口径下的有效模块集合：

```ts
effectiveModules = mergeMaxByModuleId(
  [...plannedModules, ...autoIndustryModules, ...autoHabitationModules, ...autoInfrastructureModules],
  [...archive.modules, ...archive.building.modules]
)
```

规则：

- `moduleId` 相同则比较 `count`，保留较大值
- 任一侧缺失则保留另一侧
- 不按模块类型做预过滤

### 2. 隐式职责分离保持不变

虽然 `effectiveModules` 包含全部模块，但后续链路继续按现有职责自然分流：

- `productionFlows`：仍只由模块自身的 `outputs / inputs` 决定是否产生流
- `workforce`：仍由 habitation / workforce 相关逻辑影响
- `storage / dock / pier`：仍由 infrastructure 逻辑从 flow 结果反推

这意味着：

- 本次 change 不把“哪些模块算生产模块”显式化
- 只是把“各类职责链看到的模块数量底座”换成新的 `effectiveModules`

## 计算链设计

### 1. 启用前

当前 planning 路径的大致语义是：

1. `plannedModules`
2. 基于 `plannedModules` 计算 `autoIndustryModules`
3. 基于 `plannedModules + autoIndustryModules` 计算 `autoHabitationModules`
4. 再由对应链路得出 `productionFlows`、`workforce`、`efficiency`
5. infrastructure 继续基于 flow 派生

### 2. 启用后

启用条件成立时改为：

1. 先取旧链路已经产出的：
   - `plannedModules`
   - `autoIndustryModules`
   - `autoHabitationModules`
   - `autoInfrastructureModules`
2. 与 archive 全量模块做逐项 `max`
3. 得到 `effectiveModules`
4. 用 `effectiveModules` 重算：
   - `workforce`
   - `efficiency`
   - `productionFlows`
5. 这套 `productionFlows` 直接替代旧 planning flow，成为 canonical flow
6. 所有后续 flow-based aggregation 都基于这套 canonical flow 继续计算
7. presenter 将 canonical flow 及其聚合结果提供给 planning wareflow / planning volume

### 3. 为什么允许全部模块参与 max

核心语义不是“按生产模块抽象一个纯净集合”，而是“规划不能把 archive 里已经存在的建筑视为不存在”。

因此：

- habitation 若 archive 中更多，新口径下它仍应存在
- storage 若 archive 中更多，新口径下它仍应存在
- dock / pier 若 archive 中更多，新口径下它仍应存在

这些模块是否进入某条职责链，继续由现有隐式逻辑控制，而不是由 merge 阶段提前筛掉。

## Store 设计

### 1. 数据落点

变更落点在 `useLiveProductionStore` 的 planning station state 组装路径。

需要新增一组 planning+archive 专用派生结果，例如：

- `effectiveModules`
- `canonicalProductionFlows`
- `effectiveActualWorkforce`
- `effectiveCurrentEfficiency`
- `canonicalDerivedProductionFlows`

命名可以调整，但语义必须独立于 `StationDashboard` 那套 `effectiveModules`，也不要求这些结果必须原样挂接到某个既有 derived map 结构上。

### 2. 计算方式

实现可以复用现有 `calculateProductionFlowsCore`、`StationDerivedMap` 或其他现有 store 级能力，但本设计不强制必须通过某一个具体数据结构或固定调用路径来完成。

要求：

- 不复制另一套 flow 算法
- 不在 presenter 或 vue 中重算
- 新 `productionFlows` 必须成为 planning 聚合主链路的唯一基准
- 不保留“展示 flow”和“聚合 flow”两套并行 flow 基准
- `全域模块逐项 max` 属于需求语义约束，而不是对 `StationDerivedMap` 入参形式的强制规定
- 允许实现方根据现有代码结构，选择最小改动路径把新口径接入 store 计算链

### 3. 启用分支

store 需要明确分支：

- 若 `planning && archive exists`：
  - 输出新的 effective 口径结果
- 否则：
  - 继续输出当前旧 planning 结果

## Presenter 设计

`useProductionWareflowPresenter` 继续只做透传，不引入业务组装层。

在 planning+archive 场景下：

- `productionFlows` / `derivedProductionFlows`
  - 改为读取 canonical planning flow 及其基于同一基准派生出的聚合结果
- 其他 setting / callback
  - 保持现有 contract

`recommendedModules` 不进入该 presenter 的 flow 计算链，仅由 planning panel presenter 负责。

此外，presenter / store 需要为 lock 交互补一层 planning+archive 约束：

- 若某个 ware 由 archive 中存在的生产模块产出
- 则该 ware 在 `planning + archive` 场景下不能被 lock
- 该约束影响的是 lock 可操作性与 toggle 行为，不是 `warePriorityLevels` 计算规则

## Vue 设计

### 1. StationWareFlowsDashboard

中间资源面板在 planning 模式下继续使用现有组件结构，但输入数据改为新的 canonical planning flow 及其聚合结果。

要求：

- 普通 wareflow 行改读新的 canonical planning flow
- volume 视图改读基于同一 canonical flow 派生出的聚合结果
- volume 展开明细与主视图同源

### 2. 不变区域

以下区域保持不变：

- 左侧 `StationPlanningPanel` 的 `recommendedModules`、archive 参考区、auto 显示布局
- `live` 模式 volume allocation 语义
- `StationDashboard`
- `overview` / `transit`

## 兼容性说明

### 1. 为什么不显式筛 production modules

当前系统一直允许 `plannedModules` 持有全部模块类型，真正的职责分离发生在计算链内部：

- flow 看 `outputs / inputs`
- workforce 看 habitation / workforce 计算
- infrastructure 看 flow 与容量/泊位缺口

这套机制已经存在，且符合项目“隐式职责分离不变”的要求，因此本次不额外引入新的分类层。

### 2. 为什么 `recommendedModules` 不参与

`recommendedModules` 本质是左侧 UI 帮助用户识别“archive 中有哪些 orphan 或缺口模块”的提示层。

如果它直接参与 flow 计算，会导致：

- 用户尚未确认加入 planning 的模块提前影响 flow
- 左侧提示区与中间 flow 结果发生隐式耦合

因此该 change 明确保持：

- `recommendedModules` 只影响视图，不改变计算真相

### 3. 为什么 archive 产出 ware 需要禁止 lock

本 change 的 planning flow 语义建立在“archive 中已存在的生产能力不能被视为不存在”之上。

若某个 ware 已由 archive 中存在的生产模块产出，但用户仍可在 planning flow 上对其执行 lock，会产生两类矛盾：

- archive 现实产能继续存在，但 planning 聚合链被人为锁断
- canonical planning flow 与“现有建筑不会被拆除”的前提相冲突

因此该约束必须成立：

- archive 中存在生产模块产出的 ware
- 在 `planning + archive` 场景下禁止 lock
- 但这不改变优先级规则本身

### 4. 为什么这里必须替换主 flow 而不是追加一条视图支路

如果只让 wareflow 面板读取新 flow，而让 volume / detail / 其他聚合继续建立在旧 planning flow 上，会出现两类错误：

- 同一 planning 页面中，不同区域看到的站点状态不一致
- 后续聚合链隐式建立在过时模块口径之上

因此本 change 的目标不是“新增一套 effective flow 给某个视图使用”，而是：

- 用新口径重算 planning `productionFlows`
- 让它直接替代旧 planning 主 flow
- 再让所有依赖 flow 的聚合结果全部从这套 flow 继续推导

## Locale / 文档同步

本次 change 不强制新增 locale key。

但 request / spec / design / tasks 需要保持以下术语一致：

- `effectiveModules`
- `planning + archive`
- `implicit responsibility separation`
- `recommendedModules is view-only`
