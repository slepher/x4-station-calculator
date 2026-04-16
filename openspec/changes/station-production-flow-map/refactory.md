# Station Production Flow Map / Live-Blueprint Store Refactory

## Purpose

本文件定义 `useLiveProductionStore.ts`、`useBlueprintProductionStore.ts` 与 `productionSourceAdapter.ts` 的详细分拆方案。

目标不是引入新的抽象层，而是做减法，收敛为更稳定的主语和更清晰的职责边界：

- `activeStation` 继续作为唯一主站点概念
- live 模式保留 `mode` 切换，但 `mode` 只控制展示，不再决定“当前站点是谁”
- `bindingStation` / `archiveStation` 退出对外主接口，退回内部实现或聚合为只读上下文
- `productionSourceAdapter` 被拆散回归归属地，不保留“杂糅入口”
- `useLiveProductionStore` 与 `useBlueprintProductionStore` 对 presenter / workbench contract 保持兼容

本文件必须作为接手 agent 的直接施工依据。所有分拆边界和执行顺序均为强制要求。

---

## Refactor Goal

重构完成后，production workbench 相关结构必须满足以下形态：

```text
BlueprintProductionWorkbenchView -> useBlueprintProductionStore
LiveProductionWorkbenchView      -> useLiveProductionStore

共享计算层：
- StationProductionFlowMap
- station flow / ware / module shared helpers
- workbench contract / presenter

source-specific 层：
- blueprint: empire stations / sectors / links / persistence
- live: binding stations + archive records + binding persistence
```

禁止出现以下结构：

- 新建一个比 `activeStation` 更高一层的 station wrapper / session wrapper / source-aware facade
- 继续让 view 同时直接消费 `activeStation`、`bindingStation`、`archiveStation`
- 保留一个总入口 `productionSourceAdapter.ts` 同时承担 station 解析、source 归一化、flow 输入构建

---

## Non-Goals

以下内容不属于本次分拆目标：

- 改写 `ProductionWorkbenchStoreContract` 的整体交互模型
- 改写 presenter 层调用方式
- 改写 `StationProductionFlowMap` 的缓存语义
- 改写 transit / overview 页的产品行为
- 引入新的“通用 production store 基类”

---

## Core Decisions

### RD-1. `activeStation` 继续作为唯一主站点

`activeStation` 必须继续保留，且作为 UI 读写的唯一站点主入口。

所有以下能力必须围绕 `activeStation` 工作：

- `plannedModules`
- `settings`
- `lockedWares`
- `warePriority`
- `activeStationState`
- `productionFlows`
- `stationAnalysis`
- `currentEfficiency`
- `actualWorkforce`

禁止再新增一个对外主语义与 `activeStation` 平级的 `currentStation` / `editingStation` / `sessionStation`。

### RD-2. live 的 `mode` 只控制展示，不控制站点身份

live 模式下：

- `planning` 表示展示可编辑规划视图
- `live` 表示展示 save archive 的只读实况视图

但无论当前是 `planning` 还是 `live`，`activeStation` 的语义都必须保持稳定：  
它始终是“当前 workbench 所指向的站点”。

禁止出现以下行为：

- 切换 `mode` 后，`activeStation` 的来源从 binding 站切到 archive 站
- 页面因为 `mode` 不同而改读另一套站点实体

### RD-3. `bindingStation` / `archiveStation` 不是主站点概念

`bindingStation` 与 `archiveStation` 已经是转换过的数据，因此不得再在其上额外包一层 station wrapper。

正确做法是：

- 将它们保留为 store 内部辅助数据源
- 对 view 层只暴露一个轻量只读上下文 `stationContext`

`stationContext` 只允许承载附加展示数据，不得冒充第二个站点实体。

### RD-4. 不保留 `productionSourceAdapter.ts`

`productionSourceAdapter.ts` 当前承担了至少三类职责：

- binding plan -> production station 映射
- binding + archive records -> derived live stations 列表
- flow facade 前置 source 组织

这些职责必须拆散，不得继续保留在同一文件中。

### RD-5. blueprint/live 保持 contract 兼容，但内部不强制同构

兼容要求体现在对外接口，而不是强迫两个 store 内部共用一层更大的 source facade。

必须满足：

- 两个 store 都继续实现现有 workbench contract 所需能力
- presenter 层可以继续把两个 store 当作同类 workbench source 使用

不要求：

- 两个 store 的内部数据来源结构完全一致
- 把 live 独有的 archive 语义硬塞进 blueprint

---

## Mandatory Public Shape

### MPS-1. `useBlueprintProductionStore` 对外必须稳定提供

- `activeStation`
- `activeStationId`
- `activeStationState`
- `plannedModules`
- `settings`
- `lockedWares`
- `warePriority`
- `productionFlows`
- `warePriorityLevels`
- `actualWorkforce`
- `currentEfficiency`
- `updatePlannedModules`
- `updateStationSettings`
- `updateStationModules`
- `updateStationType`
- `updateStationCount`
- `updateStationMinerals`
- `toggleWareLock`
- `toggleWarePriority`
- `getResolvedLevel`
- `isWareLocked`
- `isWareOperable`
- `isPlannedWare`

### MPS-2. `useLiveProductionStore` 对外必须稳定提供

- 与 blueprint 对等的一套主站点能力
- `mode`
- `initialMode`
- `canToggle`
- `toggleMode`
- `stationContext`

`stationContext` 必须是 live 专属的只读补充数据，不得替代 `activeStation`。

### MPS-3. `stationContext` 允许的字段

`stationContext` 只允许聚合 view 确实需要的补充信息，例如：

```ts
interface LiveStationContext {
  hasBinding: boolean
  hasArchive: boolean
  stationCode: string
  sectorName: string
  sectorNameId?: string
  sectorResources: string[]
  sectorSunlight: number
  position?: { x: number; y: number; z: number }
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
}
```

允许字段扩展，但禁止加入以下内容：

- 第二份可编辑 `modules/settings/lockedWares/warePriority`
- 第二个“当前站点 id”
- 任何会与 `activeStation` 竞争主语义的字段

---

## Mandatory Internal Placement

### MIP-1. 必须留在 `useLiveProductionStore` 的职责

- active binding 与 player station records 的组装
- active live station 的解析
- live `mode` 判定与切换
- archive 对照数据提取
- binding 持久化写回
- transit / overview 的 live 入口组织

### MIP-2. 必须留在 `useBlueprintProductionStore` 的职责

- active empire / station / sector 的解析
- empire 持久化写回
- blueprint source 的 station / sector / links 组织

### MIP-3. 必须抽成共享 helper 的职责

以下逻辑不得再复制两份：

- 从当前 `activeStation` 读取 `plannedModules/settings/lockedWares/warePriority`
- 基于 `StationProductionFlowMap` 读取缓存并拼装 `activeStationState`
- `getComputeDeps`
- `toggleWareLock`
- `toggleWarePriority`
- `getResolvedLevel`
- `isWareOperable`
- `isPlannedWare`
- `isAutoWare`
- 基于 modulesMap / waresMap 的 module info fallback

共享 helper 可以是函数集，不得演变成新的 source-aware 大 store。

### MIP-4. 必须从 `productionSourceAdapter.ts` 拆出的职责

必须拆分为以下两类归属：

1. live station 解析 helper
2. flow source / sector source 组织 helper

禁止保留一个名为 adapter 的集中入口文件。

---

## File-Level Refactor Map

### FRM-1. `src/store/useLiveProductionStore.ts`

本文件必须完成以下收敛：

1. `activeStation` 保持为唯一主站点
2. `bindingStation` / `archiveStation` 退为内部 computed，不再作为主要对外接口
3. 新增对外 `stationContext`
4. 所有 view 相关读取改为从 `activeStation + stationContext + mode` 获取
5. 所有编辑逻辑继续只写 `activeStation` 对应 binding plan

本文件禁止继续承担：

- 对外暴露两套平级站点概念
- 兼任“通用 source adapter”角色

### FRM-2. `src/store/useBlueprintProductionStore.ts`

本文件必须完成以下兼容收敛：

1. 继续维持与 live 对等的主站点接口
2. 如果 presenter / view 需要对齐 live 的读法，可补最小兼容字段：
   - `stationContext: null`
3. 不为了兼容 live 而引入 archive / binding 语义

### FRM-3. `src/components/empire/LiveProductionWorkbenchView.vue`

本文件必须停止直接读取以下字段作为页面主语义：

- `bindingStation`
- `archiveStation`

必须改为：

- 站点本体读取 `activeStation`
- 辅助展示读取 `stationContext`
- 面板切换读取 `mode`

### FRM-4. `src/components/empire/StationPlanningPanelWrapper.vue`

本文件不得再自行导入 `useLiveProductionStore` 读取 `archiveStation`。

必须改为通过 props 接收：

- `mode`
- `archiveModules`
- `buildingModules`

必要时也可直接接收完整 `stationContext`，但不得再反向读取 live store 内部字段。

### FRM-5. `src/store/logic/productionSourceAdapter.ts`

本文件必须被删除。

其职责拆分建议如下：

- `src/store/logic/liveStationResolver.ts`
  - `toProductionStation(...)`
  - live binding / archive station 派生
- `src/store/logic/liveSourceView.ts` 或并入 `empireSourceView.ts`
  - live sectors / stations / links 的组织

是否最终新建这两个文件，可以按实现便利调整；  
但最终不得保留一个承担所有职责的 adapter 文件。

---

## Execution Phases

### Phase R1. 收敛对外语义，不改行为

目标：先稳定接口主语义，再处理内部拆分。

必须执行：

1. 在 `useLiveProductionStore` 中新增 `stationContext`
2. `stationContext` 内容先基于现有 `bindingStation` / `archiveStation` 组装
3. 暂时保留 `bindingStation` / `archiveStation` 作为内部实现与兼容导出
4. 在 `useBlueprintProductionStore` 中视需要补充 `stationContext: null`

完成标志：

- 不改变现有行为
- view 已经有能力只依赖 `activeStation + stationContext`

禁止事项：

- 在本阶段删除旧 computed 后再去补 view
- 在本阶段引入新的 wrapper station 类型

### Phase R2. 切换 view 到单主语义

目标：页面停止直接理解 `bindingStation/archiveStation`。

必须执行：

1. `LiveProductionWorkbenchView.vue` 改读 `stationContext`
2. toolbar 所需的：
   - station code
   - sector name / nameId
   - sector resources
   - sector sunlight
   - position
   - hasBinding / hasArchive
   全部从 `stationContext` 获取
3. `StationPlanningPanelWrapper.vue` 改为 props 驱动
4. 父层将 archive/building modules 从 `stationContext` 传入

完成标志：

- 页面不再直接依赖 `bindingStation` / `archiveStation`
- `mode` 只控制展示面板，不影响站点读取入口

### Phase R3. 抽共享 active-station helper

目标：消除 blueprint/live 重复的 active station 读写逻辑。

必须抽出的共享函数至少包括：

1. `buildComputeDeps(...)`
2. `buildActiveStationState(...)`
3. `toggleWareLockForActiveStation(...)`
4. `toggleWarePriorityForActiveStation(...)`
5. `getResolvedLevelForActiveStation(...)`
6. `isWareOperable(...)`
7. `isPlannedWare(...)`
8. `isAutoWare(...)`
9. `getFallbackModuleInfo(...)`

建议位置：

- `src/store/logic/productionStationShared.ts`
- 或按职能拆为 `productionStationState.ts` / `productionStationCommands.ts`

完成标志：

- blueprint/live 不再各自复制一整套 active-station 编辑逻辑
- 但两个 store 仍各自持有 source-specific 持久化逻辑

### Phase R4. 拆散 `productionSourceAdapter.ts`

目标：删除杂糅入口，不新增更大的替代物。

必须执行：

1. 识别 adapter 中仍被 live/flow facade 使用的函数
2. 按职责拆走：
   - station 解析函数 -> live resolver helper
   - source view 组织函数 -> `empireSourceView.ts` 邻近 helper
   - save-binding flow 输入构建 -> `empireFlowFacade.ts` 邻近 helper 或 `liveFlowSource.ts`
3. 修改引用方，确保不再 import `productionSourceAdapter.ts`
4. 删除该文件

完成标志：

- adapter 不存在
- 调用方依赖的是职责明确的小函数文件

### Phase R5. 清理旧导出与兼容壳

目标：完成最终收口。

必须执行：

1. 从 `useLiveProductionStore` 移除对外的 `bindingStation` / `archiveStation`
2. 若 blueprint 曾增加临时兼容字段，保留最小必要集，删除无用别名
3. 清理组件中残留旧字段引用
4. 运行 build 验证

完成标志：

- 对外主语义稳定为 `activeStation (+ stationContext for live)`
- 无旧 adapter / 旧 view 读法残留

---

## Allowed Intermediate States

以下中间态允许短暂存在：

1. `useLiveProductionStore` 同时对外暴露：
   - `bindingStation`
   - `archiveStation`
   - `stationContext`
   但仅限于 R1-R2 过渡阶段

2. `useBlueprintProductionStore` 暂时提供 `stationContext: null`

3. `productionSourceAdapter.ts` 被部分函数转发壳引用
   但仅限于 R4 过渡阶段，最终必须删除

以下中间态禁止出现：

1. 页面一部分读 `stationContext`，另一部分继续直接读 `bindingStation/archiveStation` 且长期共存
2. 新增 `currentStation` 并与 `activeStation` 长期并行
3. 用新的“大 adapter / session / facade” 取代旧 adapter

---

## Detailed Task Checklist

### T1. live store 新增 `stationContext`

- [ ] 新增 `stationContext` computed
- [ ] 聚合 `hasBinding`
- [ ] 聚合 `hasArchive`
- [ ] 聚合 `stationCode`
- [ ] 聚合 `sectorName`
- [ ] 聚合 `sectorNameId`
- [ ] 聚合 `sectorResources`
- [ ] 聚合 `sectorSunlight`
- [ ] 聚合 `position`
- [ ] 聚合 `archiveModules`
- [ ] 聚合 `buildingModules`

### T2. view 改用 `stationContext`

- [ ] `LiveProductionWorkbenchView.vue` 移除直接读取 `bindingStation`
- [ ] `LiveProductionWorkbenchView.vue` 移除直接读取 `archiveStation`
- [ ] toolbar 输入改为来自 `stationContext`
- [ ] import modal 保持读取 `activeStation`

### T3. `StationPlanningPanelWrapper.vue` 去 store 耦合

- [ ] 删除组件内 `useLiveProductionStore`
- [ ] 新增 archive/building module props
- [ ] 父组件负责传值
- [ ] `mode === 'live'` 时仅展示只读 archive 面板

### T4. blueprint/live 共享 active-station helper

- [ ] 识别 blueprint/live 重复逻辑块
- [ ] 抽出 `getComputeDeps`
- [ ] 抽出 `activeStationState` 拼装
- [ ] 抽出 ware lock / priority helper
- [ ] 抽出 module info helper
- [ ] 两个 store 改为调用共享函数

### T5. 拆散 `productionSourceAdapter.ts`

- [ ] 列出 adapter 当前被引用的导出
- [ ] 为每个导出确定新归属文件
- [ ] 修改 `empireSourceView.ts` / `empireFlowFacade.ts` / `useLiveProductionStore.ts` 的 import
- [ ] 删除 adapter 文件

### T6. 删除 live store 对外旧字段

- [ ] 移除 `bindingStation` 对外导出
- [ ] 移除 `archiveStation` 对外导出
- [ ] 确保无组件残留引用

### T7. 验证

- [ ] `npm run build`
- [ ] 若 build 失败，修复直到通过

---

## Validation Criteria

重构完成后，必须同时满足以下条件：

1. `activeStation` 仍是 blueprint/live 两边唯一的主站点概念
2. live 页面切换 `mode` 不会改变 `activeStation` 身份
3. live 页面不再直接读取 `bindingStation` / `archiveStation`
4. `stationContext` 只包含只读展示信息，不包含第二份可编辑站点状态
5. `StationPlanningPanelWrapper.vue` 不再主动读取 live store
6. blueprint/live 共享重复的 active-station helper，而不是复制逻辑
7. `productionSourceAdapter.ts` 被删除
8. workbench contract / presenter 主路径保持兼容
9. `npm run build` 通过

---

## Implementation Notes

### Note-1. 关于首次编辑只有 archive 的站点

本方案不要求在本次 refactor 中改写“首次编辑时 materialize binding plan”的产品行为。  
若现有行为已经依赖 `updateBindingStationPlan(...)` 在首次写入时补建 plan，则保持现状即可。

本次重构重点是：

- 收敛主语义
- 消除 view 对内部实现的直接依赖
- 删除杂糅 adapter

### Note-2. 关于 blueprint 兼容

兼容 blueprint 的正确方式是保持对外接口主语义一致，而不是让 blueprint 也长出 live 的 binding/archive 分支。

因此 blueprint 只需要：

- 维持 `activeStation` 主语义
- 必要时返回 `stationContext: null`

禁止为了“统一”而把 live 的 save/archive 语义迁入 blueprint。

### Note-3. 关于共享 helper 的边界

共享 helper 必须是围绕“active station 的通用读写与派生计算”，而不是把 source 解析也硬塞进去。

禁止把以下内容抽进共享 helper：

- save binding plan 的 persistence
- archive records 的解析
- empire sectors / links 的 source 组织

这些必须继续留在各自 store / source 邻近层。
