# user-save-binding-station Empire Store Remove

## Purpose

本文件定义 `useEmpireStore` 的**全应用移除方案**。

当前代码已经完成了 production 主路径的第一轮入口拆分：

- `blueprint-production` 主路径使用 `useBlueprintProductionStore`
- `live-production` 主路径使用 `useLiveProductionStore`

但 `useEmpireStore` 仍残留在以下几类场景中：

- app 初始化与测试导出
- toolbar / load / version 等旧入口
- map 页面与 binding 面板
- storage import / export
- 若干兼容测试与过渡 API

因此本轮目标不再是“继续降低 `useEmpireStore` 复杂度”，而是明确规划一条可执行路线，让整个应用最终**不再需要 `useEmpireStore`**。

---

## Current Status

### 已完成的前提

production 主路径已经具备以下条件：

- `BlueprintProductionWorkbenchView` 直接接入 `useBlueprintProductionStore`
- `LiveProductionWorkbenchView` 直接接入 `useLiveProductionStore`
- `MainWorkbench` 已经按 active view 直接切换到两个入口组件
- production 子树的大部分 UI 组件已经改为 props / emits / 上层注入

这意味着：

- `useEmpireStore` 已不再是 production workbench 主路径的唯一入口
- 但它仍是应用外围场景的“过渡总协调层”

### 当前仍由 `useEmpireStore` 承担的职责

根据现有代码，`useEmpireStore` 仍同时承担以下职责：

1. **Empire domain**
   - `savedEmpires`
   - `activeEmpire`
   - `loadEmpire / saveEmpire / saveEmpireAs / deleteEmpire`
   - empire station / sector / sectorLink mutation

2. **Binding 过渡编排**
   - `productionSource`
   - `switchToBinding / confirmSwitchToBinding / switchToEmpire`
   - source-aware dirty / save / selection 分支

3. **Map 组合上下文**
   - 地图侧 empire 列表、active empire、sector 列表、save->binding 切换确认

4. **Import / Export 汇聚**
   - storage import / export 中的 empire 模块读写入口

5. **App 初始化兼容层**
   - `App.vue` 中统一初始化与 `window.empireStore` 暴露

这说明：`useEmpireStore` 现在不是纯 empire 数据 store，而是一个混合了 empire domain、binding 过渡编排、map 上下文与导入导出协调的过渡层。

---

## Goal

目标不是把 `useEmpireStore` 改名保留，而是：

1. 让所有源码直接引用迁移到真实 owning stores
2. 让 `useEmpireStore` 从主路径中完全退出
3. 在所有主路径接线清零后删除 `useEmpireStore.ts`

最终 owning stores 定义为：

- blueprint domain: `useBlueprintProductionStore`
- live domain: `useLiveProductionStore`
- logic flow domain: `useLogicFlowStore`
- ship domain: `useShipBuildStore`
- save archive / binding 原始数据: `useSaveStore` / `useSaveBindingStore`

**不再新增新的全局总协调 facade** 来替代 `useEmpireStore`。

---

## Chosen Approach

采用 **方案 A'：按真实 domain store 收口，分阶段抽空 `useEmpireStore`**。

### 核心原则

#### P1. production 入口继续由两个 production store 接管

- `blueprint-production` 的 empire 主路径全部收口到 `useBlueprintProductionStore`
- `live-production` 的 binding 主路径全部收口到 `useLiveProductionStore`

#### P2. map 不单独建立新 facade

本方案**不新增 map 专用 empire facade**。

改为：

- map 中涉及 empire 的读取与 mutation，尽量直接由 `useBlueprintProductionStore` 接管
- map 中涉及 binding draft / group / station plan 的部分，继续使用 `useLiveProductionStore` 与 `useSaveBindingStore`
- map 中原本依赖 `sector` 列表的 loader 语义，不再保留“按 sector 加载 station”模式，而是改为“按 empire 加载该 empire 的全部 stations”

这意味着 map 也必须回到真实 domain store，而不是继续依赖“跨 source 总 store”。

#### P3. import / export 直接依赖真实 domain store

storage import / export 不再依赖 `useEmpireStore`，改为直接使用：

- `useBlueprintProductionStore`
- `useLiveProductionStore`
- `useLogicFlowStore`
- `useShipBuildStore`
- `useSaveStore`
- `useSaveBindingStore`

其本质是：

- empire 模块由 blueprint store / empire data 提供
- binding 模块由 live store / saveBindingStore 提供
- 其他模块由各自 domain store 提供

#### P4. 初始化显式化，不再通过 `useEmpireStore.initialize()` 串联

`App.vue` 中不再把 `useEmpireStore` 作为总初始化器。

最终应改为显式初始化：

- `useGameDataStore`
- `useSaveStore`
- `useSaveBindingStore`
- `useBlueprintProductionStore`
- `useLiveProductionStore`
- `useLogicFlowStore`
- `useMapStore`
- `useShipBuildStore`

---

## Why This Approach

### 方案优点

1. **符合当前代码演进方向**

production 主路径已经拆成两个入口；继续让 `useEmpireStore` 在外围承担总装配，只会把旧边界继续拖住。

2. **不引入新的“伪替代 facade”**

如果再创建一个 map facade 或新的 app-level empire facade，本质上只是把 `useEmpireStore` 换个名字继续保留。

3. **迁移边界清晰**

本方案按现有真实 domain 拆分：

- blueprint
- live
- logic-flow
- ship
- save / binding 原始数据

不会继续围绕 `productionSource` 建新的抽象层。

### 不选择的方案

#### 不选择“保留极薄 `useEmpireStore`”

原因：

- 不能满足 remove 目标
- 仍会保留旧概念中心
- 后续代码继续容易向它回流

#### 不选择“一次性总替换”

原因：

- map、import/export、初始化链路耦合面较大
- 一次性替换风险过高
- 当前代码已经具备分阶段抽空的天然边界，没有必要强行一刀切

---

## Target Ownership

### A. `useBlueprintProductionStore` 应接管的职责

最终由 `useBlueprintProductionStore` 持有：

- `savedEmpires`
- `activeEmpire`
- `activeStation`
- `activeStationId`
- `sectors`
- `orderedStations`
- empire grouped flows / transit 数据
- empire save / saveAs / load / delete / snapshot / dirty
- 与 blueprint 视图一致的 load / toolbar / version 相关 empire 语义
- map 页面中需要的 empire 读取与 mutation
- map 资源筛选 loader 所需的 empire 列表与 empire station 聚合读取

需要新增或补齐的能力可能包括：

- 面向 map 的只读查询接口
- 面向 import/export 的序列化入口
- 兼容 version switch 的 save / saveAs 判断接口
- map 所需的 station/sector 查询与拖拽落点 mutation
- map 资源筛选所需的“按 empire 加载全部 stations”查询接口

### B. `useLiveProductionStore` 应接管的职责

最终由 `useLiveProductionStore` 持有：

- `activeBinding`
- `activeBindingName`
- binding groups / derived stations
- binding station selection / mutation
- binding save / discard / dirty / openBinding
- live grouped flows / transit 数据
- live toolbar / load 语义
- map 页面中涉及 binding 视图的数据与行为

需要新增或补齐的能力可能包括：

- map 绑定面板需要的 group / station / sector 读取接口
- save -> binding 打开 / 切换时的确认策略
- import/export 需要的 binding 模块读写入口

### C. `useSaveBindingStore` / `useSaveStore` 保留原始数据 ownership

它们继续持有：

- save archive 原始状态
- save binding draft / saved state

但不再需要通过 `useEmpireStore` 暴露给其他模块。

### D. `useLogicFlowStore` / `useShipBuildStore`

保持各自现有 ownership，不经 `useEmpireStore` 代理。

---

## Migration Plan

### Phase 1. 先移除 toolbar / load / version 对 `useEmpireStore` 的依赖

目标：

- `StationToolbar` 只面向 `blueprint-production` / `live-production` / `logicFlow` / `ship-build`
- `LoadPlanModal` 拆成 `LoadBlueprintPlanModal` / `LoadLivePlanModal`
- `VersionSettingsModal` 的 empire 模块改为读取 `useBlueprintProductionStore`

完成条件：

- production 相关 UI 不再需要 `useEmpireStore` 作为统一 facade

#### 本阶段必须修改的文件

- `src/components/StationToolbar.vue`
- `src/composables/useToolbarWorkflowController.ts`
- `src/components/VersionSettingsModal.vue`
- `src/components/empire/LoadPlanModal.vue`
- `src/components/empire/LoadBlueprintPlanModal.vue`
- `src/components/empire/LoadLivePlanModal.vue`
- `src/components/common/SmartSaveDialog.vue`

#### 本阶段的明确落地要求

1. `StationToolbar` 不再向 controller 传 `station`
2. `VersionSettingsModal` 中 empire 模块改读 `useBlueprintProductionStore`
3. 删除 `LoadPlanModal` 的主路径使用；主路径改为两个单责 modal
4. `SmartSaveDialog` 内部不再把 production 语义绑定到 `useEmpireStore`

#### 本阶段禁止事项

- 不允许新增新的 `useEmpireStore` 调用
- 不允许为了兼容继续保留 `station -> empireStore` 的隐藏转发
- 不允许在新 modal 中再次混入 empire/binding 双 tab

### Phase 2. 迁移 import / export 到真实 domain store

目标：

- `StorageImportWizard` 不再读取 `useEmpireStore`
- `StorageExportWizard` 不再读取 `useEmpireStore`
- import/export 的 empire 模块由 `useBlueprintProductionStore` 提供
- binding 模块由 `useLiveProductionStore` / `useSaveBindingStore` 提供

关键要求：

- import/export 内部模块表仍保持统一 UI，但数据来源不再依赖统一 empire facade

#### 本阶段必须修改的文件

- `src/components/StorageImportWizard.vue`
- `src/components/StorageExportWizard.vue`
- `src/store/logic/importExport.ts`

#### 本阶段的明确落地要求

1. import/export 读取 empire 数据时，只允许读 `useBlueprintProductionStore` 或更底层 empire data
2. import/export 读取 binding 数据时，只允许读 `useLiveProductionStore` / `useSaveBindingStore`
3. `buildExportPayload` / `applyImportPayload` 的参数层必须显式接收真实 domain stores
4. import/export 不得再接收 `empireStore` 作为聚合输入

#### 本阶段禁止事项

- 不允许为了少改代码，把多个新 store 再包成新的总 facade
- 不允许把 `useEmpireStore` 藏进 `importExport.ts` 内部

### Phase 3. 迁移 map 到 blueprint/live store

目标：

- `MapWorkbenchView`
- `MapSavePanel`
- `MapBindingStation`
- `MapResourceFilterAdvancedPanel`
- `useMapBindingViewModel`

这些模块不再读取 `useEmpireStore`，改为：

- empire 相关能力 -> `useBlueprintProductionStore`
- binding 相关能力 -> `useLiveProductionStore` + `useSaveBindingStore`

其中 `MapResourceFilterAdvancedPanel` 的替代策略明确如下：

- 当前基于 sector 的 loader 列表改为 empire 列表
- 选择某个 empire 后，不再只读取该 sector 下的 stations
- 改为读取该 empire 的**全部 stations**
- 再从这些 stations 的 flow / grouped resources 中构建资源筛选条件

这样 map 侧不再需要“empire sectors 列表”作为 loader 来源，只需要：

- empire 列表
- empire 下全部 stations
- stations 对应的 grouped flow / resources

其中最关键的是 `MapSavePanel` 当前的这类职责：

- save -> binding 切换时的 dirty 确认
- 保存当前 empire 后再进入 binding

这些职责必须改写为：

- blueprint dirty 由 `useBlueprintProductionStore` 提供
- binding 打开由 `useLiveProductionStore.openBinding()` + `saveBindingStore` 提供
- 不再通过 `switchToBinding / confirmSwitchToBinding` 这种旧过渡接口实现

#### 本阶段必须修改的文件

- `src/components/map/MapWorkbenchView.vue`
- `src/components/map/MapSavePanel.vue`
- `src/components/map/MapBindingStation.vue`
- `src/components/map/MapResourceFilterAdvancedPanel.vue`
- `src/composables/useMapBindingViewModel.ts`

#### 本阶段的明确落地要求

1. `MapSavePanel` 中的 dirty 确认与 save-before-bind 逻辑改读 `useBlueprintProductionStore`
2. `MapSavePanel` 中的 binding 打开逻辑改用 `useLiveProductionStore.openBinding()` 与 `useSaveBindingStore`
3. `MapBindingStation` 不再从 `useEmpireStore` 读取 `savedEmpires` / `activeEmpire`
4. `useMapBindingViewModel` 不再从 `useEmpireStore` 读取 `activeEmpire`
5. `MapResourceFilterAdvancedPanel` 的 loader 列表从 `sector` 改为 `empire`
6. 选择某个 empire 后，读取该 empire 的全部 stations 构建资源筛选条件

#### MapResourceFilterAdvancedPanel 的强制实现方式

接手 agent 不需要自行设计，直接按下面规则实现：

1. 删除当前基于 `empireStore.sectors` 的 `loadableSectors`
2. 新增基于已保存 empire 的 `loadableEmpires`
3. loader label 显示 empire 名称，而不是 sector 名称
4. `loadSectorStations()` 改为等价的 `loadEmpireStations(empireId)`
5. `loadEmpireStations(empireId)` 直接遍历该 empire 的全部 stations
6. 从每个 station 的 grouped flows 中提取 `rateGroups.resources`
7. 汇总后生成当前高级资源筛选的 tag group

#### 本阶段禁止事项

- 不允许为了 map 再新建 `useMapEmpireStore` / `useEmpireMapFacade`
- 不允许把 `sectors` 重新塞回 `useBlueprintProductionStore`，只为了兼容旧 loader
- 不允许继续保留 `switchToBinding / confirmSwitchToBinding`

### Phase 4. 显式化 app 初始化与 test 导出

目标：

- `App.vue` 移除 `useEmpireStore.initialize()`
- ready gate 改由 blueprint/live 等真实 store 决定
- `window.empireStore` 测试导出移除

必要时可以保留：

- `window.blueprintStore`
- `window.liveStore`

但不再保留旧统一 empire facade。

#### 本阶段必须修改的文件

- `src/App.vue`
- 相关依赖 `window.empireStore` 的测试文件

#### 本阶段的明确落地要求

1. `App.vue` 不再 import `useEmpireStore`
2. 初始化顺序改为显式初始化 blueprint/live 等真实 store
3. `isReady` 不再依赖 `empireStore.isReady`
4. `window.empireStore` 测试桥移除
5. 测试如果需要 empire 语义，改用 `window.blueprintStore`

### Phase 5. 清理测试与删除 `useEmpireStore.ts`

目标：

- 所有源码直接引用清零
- 测试中的 mock / import 全部迁移
- 删除 `useEmpireStore.ts`

这一步只在源码主路径完全迁移后执行。

#### 本阶段必须修改的文件

- `src/store/useEmpireStore.ts` 删除
- `tests/` 下所有 `useEmpireStore` import / mock / bridge

#### 本阶段的明确落地要求

1. 先执行源码引用清零，再处理测试
2. 删除文件前必须确认 `rg -n "useEmpireStore" src` 无结果
3. 删除文件后，再修复所有测试编译错误

---

## Source Reference Inventory

接手 agent 直接按这份清单排查，不需要重新做全仓搜索判断：

### 当前源码引用清单

- `src/App.vue`
- `src/components/VersionSettingsModal.vue`
- `src/components/StorageImportWizard.vue`
- `src/components/StorageExportWizard.vue`
- `src/components/empire/LoadPlanModal.vue`
- `src/composables/useMapBindingViewModel.ts`
- `src/components/map/MapBindingStation.vue`
- `src/components/map/MapResourceFilterAdvancedPanel.vue`
- `src/components/map/MapWorkbenchView.vue`
- `src/components/map/MapSavePanel.vue`

### 清理顺序

必须按以下顺序执行，不允许打乱：

1. toolbar / load / version
2. import / export
3. map
4. App 初始化与 window 测试桥
5. 删除 `useEmpireStore.ts`
6. 处理测试残留

---

## Execution Checklist

接手 agent 应按以下步骤施工：

1. 完成 Phase 1 后运行 `rg -n "useEmpireStore" src/components src/composables src/App.vue`
   预期只剩 import/export、map、或 `useEmpireStore.ts` 本身
2. 完成 Phase 2 后再次执行同样检查
   预期不再出现 `StorageImportWizard.vue` / `StorageExportWizard.vue`
3. 完成 Phase 3 后再次执行同样检查
   预期不再出现 map 相关文件
4. 完成 Phase 4 后再次执行同样检查
   预期只剩 `src/store/useEmpireStore.ts`
5. 删除 `useEmpireStore.ts` 前执行：
   `rg -n "useEmpireStore" src`
   预期只有 store 文件自身
6. 删除文件后运行：
   `rg -n "useEmpireStore" src tests`
   处理所有测试残留

---

## Acceptance Criteria For Handoff

接手 agent 完成任务时，必须在回报中明确给出以下证据：

1. 哪些源码文件移除了 `useEmpireStore`
2. `rg -n "useEmpireStore" src` 的最终结果
3. `useEmpireStore.ts` 是否已删除
4. 运行了哪些测试 / build 验证
5. 若还有测试残留，列出具体文件与原因

---

## Required API Adjustments

为完成移除，以下 API 需要补齐或替换。

### `useBlueprintProductionStore`

建议补齐：

- `savedEmpires`
- `deleteEmpire(empireId)`
- 供 map 读取的 `activeEmpire` / `sectors` / `orderedStationsBySector` 等一致接口
- save switch / dirty confirm 需要的最小能力

### `useLiveProductionStore`

建议补齐：

- map 所需的 binding 读取接口
- binding 进入/打开的稳定入口
- binding 相关 load / open 的最小统一接口

### `VersionSettingsModal` 相关

建议不再依赖“empire = `useEmpireStore`”这一旧假设，改为：

- empire module = `useBlueprintProductionStore`
- logic flow module = `useLogicFlowStore`
- ship module = `useShipBuildStore`

### import / export 相关

建议把“模块数据源”从 facade 改成显式参数：

```ts
buildExportPayload({
  blueprintStore,
  liveStore,
  logicFlowStore,
  shipBuildStore,
  saveStore,
  saveBindingStore
})
```

这样能彻底切断 `useEmpireStore` 在 import/export 中的存在必要性。

---

## Risks

### R1. map 侧会成为最后的阻塞点

原因：

- map 当前同时使用 empire、binding、save archive 三套语义
- 旧代码默认把这三套语义聚合在 `useEmpireStore` 周围

控制策略：

- map 迁移时坚持“empire 走 blueprint，binding 走 live/saveBinding”
- 不新增新的 map 总 facade
- 如需临时过渡，只允许在 map 组件内部做小范围适配，不新增全局协调层

### R2. import / export 可能再次引入“统一总入口”冲动

控制策略：

- import/export 可以统一 UI
- 但不能统一到新的 store facade
- 只能统一在函数参数层 / payload builder 层

### R3. App 初始化改造容易影响测试

控制策略：

- 先保留 `window.blueprintStore` / `window.liveStore`
- 再逐步迁移测试
- 等测试稳定后再删除 `window.empireStore`

---

## Definition of Done

只有满足以下条件，才算真正完成 `useEmpireStore` 移除：

1. `src/` 下不再有 `useEmpireStore` 直接引用
2. `App.vue` 不再初始化或暴露 `useEmpireStore`
3. toolbar / load / version 不再依赖 `useEmpireStore`
4. map 不再依赖 `useEmpireStore`
5. storage import / export 不再依赖 `useEmpireStore`
6. 相关测试迁移完成
7. `useEmpireStore.ts` 文件被删除

---

## Non-goals

本方案不要求在移除 `useEmpireStore` 的同时：

- 重构 `useSaveBindingStore` 的存储模型
- 重写 map 的全部交互模型
- 改变 logic-flow 或 ship-build 的既有 domain 边界
- 一次性重做 import/export UI

本方案只要求：

- 让真实 domain store 成为唯一 owning stores
- 让 `useEmpireStore` 退出所有源码主路径
