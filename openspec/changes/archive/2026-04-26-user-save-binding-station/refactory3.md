# user-save-binding-station Refactory 3

## Purpose

基于最新代码状态，重新对齐重构目标：后续阶段的首要目标不再是继续泛化 `useStationStore`，而是**实质性降低 `useEmpireStore` 的复杂度**。

本文件用于回答三个问题：

1. 目前复杂度主要集中在哪里
2. 为什么前一轮重构没有显著降低 `useEmpireStore` 的复杂度
3. 下一阶段应该如何按职责拆分 `useEmpireStore`

---

## 最新判断

### R3-1. `useStationStore` 已经有重构进展，但这不是当前主问题

最新代码中，`useStationStore` 已经开始接入：

- `stationCommands`
- `stationComputeService`
- `stationImporter`

这说明“站点层抽象基础设施”已经开始落到主路径，`useStationStore` 的问题不再是最主要阻塞点。

### R3-2. `useEmpireStore` 仍然是当前系统中的总编排器

当前 `useEmpireStore` 仍然集中承担以下职责：

- production source 路由
- active empire / active station / active transit sector 选择
- binding 站点派生与绑定 plan 路由
- station / sector / sector link 的增删改
- empire grouped flows 聚合
- sector 内部汇总与 supply storage 计算
- sector link solver 输入构造与结果缓存
- transit hub 视图模型构造
- load / save / saveAs / dirty / snapshot 会话逻辑
- imported station payload 应用

这说明它依然是“领域路由 + 计算聚合 + 数据变更 + 会话状态”的总入口。

### R3-3. 之前的任务没有击中 `useEmpireStore` 复杂度的核心来源

前一轮任务主要完成的是：

- station cache 计算逻辑抽取
- station command 基础设施抽取
- importer / plan library 基础设施抽取

这些工作能减少**底层重复逻辑**，但不能显著减少 `useEmpireStore` 的**领域编排复杂度**。  
因此，结果会表现为：

- `useStationStore` 看起来更整洁
- `useEmpireStore` 仍然很大、很重、很杂

所以问题不是“做不到”，而是“任务主轴没有直接瞄准 `useEmpireStore` 的职责拆分”。

---

## 复杂度来源分解

### C1. Source-aware 读取职责

这部分负责：

- `productionSource`
- `activeStation`
- `sectors`
- `sectorLinks`
- `orderedStationsBySector`
- `productionStations` / `productionSectors` / `productionSectorLinks`

问题：

- empire / save-binding 两套读取规则都写在 `useEmpireStore`
- binding 派生逻辑与普通 empire 逻辑在多个 computed 中重复分叉

### C2. Empire flow 聚合职责

这部分负责：

- `stationFlowCache`
- `empireGroupedFlows`
- `sectorInternalDataMap`
- `sectorLinkCalcMap`
- `getSupplyPlanningInput`
- `getSectorInternalData`
- `getSectorLinkCalc`
- `getStationComponentGapFlows`
- `getTransitHubViewModel`

问题：

- 这已经形成一个独立的“empire flow / sector planning”子域
- 但目前它完全寄生在 `useEmpireStore` 内部

### C3. Mutation 路由职责

这部分负责：

- `createStation`
- `deleteStation`
- `duplicateStation`
- `renameStation`
- `updateStationSettings`
- `updateStationModules`
- `updateStationSector`
- `applyImportedStationPayload`
- `createSector`
- `renameSector`
- `reorderSectors`
- `deleteSector`
- `createSectorLink`
- `removeSectorLink`

问题：

- 每个动作都混合了 empire / save-binding 分支路由
- 一部分调 `empireDataStore`
- 一部分调 `saveBindingStore`
- 一部分还要附带 cache refresh / active selection 处理

### C4. Session / lifecycle 职责

这部分负责：

- `loadData`
- `loadEmpire`
- `saveEmpire`
- `saveEmpireAs`
- `saveCurrentSource`
- `deleteEmpire`
- `isDirty`
- `takeSnapshot`
- `shouldConfirmBeforeEmpireReset`

问题：

- 这是另一个独立的“会话管理”子域
- 但目前与 station/sector mutation、flow 聚合耦合在同一 store 中

---

## 下一阶段目标架构

### A1. `useEmpireStore` 退化为 facade

最终目标：

- `useEmpireStore` 不再直接实现大段 source-aware 读取、flow 聚合、mutation 分支和 session 编排
- 它只负责组合若干 service / composable，并暴露对组件友好的 facade API

### A2. 抽出 `empireSourceView`

建议抽出一个 source-aware 读取模块，专门负责：

- `activeStation`
- `sectors`
- `sectorLinks`
- `orderedStationsBySector`
- `productionStations`
- `productionSectors`
- `productionSectorLinks`
- `getStationById`

作用：

- 将 empire 与 save-binding 的读取分支收敛到一个地方
- 避免多个 computed 重复写 `if (productionSource.value === 'save-binding')`

### A3. 抽出 `empireFlowFacade`

建议抽出 flow 聚合模块，负责：

- `stationFlowCache`
- `empireGroupedFlows`
- `sectorInternalDataMap`
- `sectorLinkCalcMap`
- `getSupplyPlanningInput`
- `getSectorInternalData`
- `getSectorLinkCalc`
- `getStationComponentGapFlows`
- `getTransitHubViewModel`

作用：

- 将“按 sector / station / link 聚合 flow 的逻辑”从 empire store 主体移走
- 让 `useEmpireStore` 不再承担大型计算视图模型工厂

### A4. 抽出 `empireMutationService`

建议抽出 mutation 路由模块，负责：

- station / sector / link 的增删改
- empire / save-binding 的分支路由
- 变更后的 cache refresh 与 active selection 维护

作用：

- 把 currently scattered 的“改数据 + 刷缓存 + 修 activeId”模式统一
- 让组件与上层 store 不需要关心底层数据源细节

### A5. 抽出 `empireSessionService`

建议抽出会话模块，负责：

- load / save / saveAs / delete
- dirty snapshot
- source 切换前后的确认逻辑
- `isEmptyForSave` / `requiresSaveAsOnSave` / `shouldConfirmBeforeEmpireReset`

作用：

- 将“当前会话是否脏、是否能保存、如何切换/恢复”的逻辑从 empire 主 store 中分离

---

## 实施顺序

### Phase 1: 先拆读取层

先做 `empireSourceView`，因为这是其他阶段的公共输入。  
如果 source-aware 读取还在 `useEmpireStore` 主体里，后续 flow / mutation / session 都会继续依赖老结构。

### Phase 2: 再拆 flow 聚合层

`empireFlowFacade` 会显著缩短 `useEmpireStore` 最长、最重的一批 computed。  
这是直接减少文件复杂度的关键一步。

### Phase 3: 再拆 mutation 路由层

等 source view 稳定后，再把 station / sector / link 的 mutation 分支移出。  
这样可以避免 mutation service 又重新自己推导 source-aware 读取。

### Phase 4: 最后拆 session 层

session service 依赖前面几层提供的稳定接口。  
最后拆能减少来回返工。

---

## 成功标准

只有当以下条件满足时，才算真正达成“降低 `useEmpireStore` 复杂度”的目标：

- `useEmpireStore` 文件不再承载大段 source-aware 读取逻辑
- `useEmpireStore` 文件不再承载大段 flow 聚合逻辑
- `useEmpireStore` 文件不再承载 station/sector/link mutation 分支路由
- `useEmpireStore` 文件不再承载主要 session/save/dirty 编排
- `useEmpireStore` 退化为组合 facade，而不是总编排器

---

## 非目标

本阶段不追求：

- 一次性重写所有 store API
- 改变 empire / save-binding 现有行为语义
- 同时重做 UI 层调用方式

本阶段只追求：

- 拆职责
- 降主 store 复杂度
- 保持行为等价
