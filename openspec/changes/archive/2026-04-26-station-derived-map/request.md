# Station Derived Map

## 目标

将现有 `StationProductionFlowMap` 的抽象名调整为 `StationDerivedMap`，使名称与当前真实职责以及后续扩展方向一致。

在不改变“双实例结构”的前提下，将 station 级派生语义（如 `tag`、`factoryGroup`、`productionProfile`）收口到该对象中，供 `useBlueprintProductionStore` 与 `useLiveProductionStore` 统一读取，不再允许继续在 `getTabs()` 中分别现算作为主路径。

## 已确认方案（审核重点）

### 1. 两步实施

1. **第一步仅改名**：
   - `StationProductionFlowMap` 类改名为 `StationDerivedMap`
   - `stationProductionFlowMap` 单例改名为表达 blueprint/planning 含义的新名称
   - `useLiveProductionStore` 内部 `liveFlowMap` 改为基于 `StationDerivedMap` 的 archive/live 实例
   - 本步必须一次性完成全仓替换，不保留兼容别名，不允许新旧名称并存
   - 本步必须不修改缓存结构、不增加字段、不改变计算/聚合语义

2. **第二步增加职责**：
   - 在现有两个实例上增加 station semantic derived cache
   - blueprint/planning 实例维护 `BindingStationPlan` / `StationPlan` 侧派生语义
   - archive/live 实例维护 archive station 侧派生语义
   - `useBlueprintProductionStore.getTabs()` 与 `useLiveProductionStore.getTabs()` 必须改为优先读取 derived cache，不再在 tab 组装阶段直接分类

### 2. 保持双实例，不合并为单实例

当前系统已经存在两套实例：

1. **blueprint/planning 实例**：
   - 由 `useBlueprintProductionStore` 维护
   - 在 `useLiveProductionStore` 的 planning/binding 路径中也被读取
   - 输入来源是 `StationPlan` / `BindingStationPlan`

2. **archive/live 实例**：
   - 由 `useLiveProductionStore` 内部维护
   - 输入来源是 `playerStationRecords` / archive station record

本 change 不得把两套来源硬塞进一个实例，不得新增“单实例双源分支判断”。

### 3. `StationDerivedMap` 的职责边界

`StationDerivedMap` 是 station 级派生快照缓存，不再被限定为仅缓存 production flow。它必须同时承载：

- production 相关派生：
  - `autoIndustryModules`
  - `autoHabitationModules`
  - `productionFlows`
  - `warePriorityLevels`
  - `actualWorkforce`
  - `currentEfficiency`
- semantic 相关派生：
  - `tag`
  - `factoryGroup`
  - `productionProfile`
  - `profileName`

但本 change 不把不同来源的数据混进同一个实例。

### 4. `tag` / `factoryGroup` 的来源规则

1. **blueprint/planning 路径**：
   - 基于 `StationPlan.modules` 或 `BindingStationPlan.modules` 聚合结果计算
   - 计算逻辑继续复用 `classifyPlayerStationPoi(...)`

2. **archive/live 路径**：
   - 必须优先复用 archive record 已有语义字段（如 `archiveStation.tag` / `archiveStation.factoryGroup`）
   - 当 archive 记录缺失必要字段时，必须执行 fallback 规则补齐 derived cache

3. **禁止** 在 `getTabs()` 中继续分散维护“双路 tag 现算 + fallback”逻辑作为长期方案

### 5. `useBlueprintProductionStore` 也在范围内

第二步必须同时覆盖 `useLiveProductionStore` 与 `useBlueprintProductionStore`。

原因：
- blueprint store 当前也直接调用 `classifyPlayerStationPoi(...)` 生成 tab 的 `tag/factoryGroup`
- 如果只改 live，不改 blueprint，会保留两套入口的派生读取方式不一致

### 6. 与现有 change 的关系

1. `station-production-flow-map`
   - 该 change 已完成 production flow 独立缓存架构
   - 本 change 必须在其基础上完成“命名修正 + 职责扩展”

2. `user-save-binding-station`
   - 该 change 已定义 tab 显示规则与 `ProductionTabItem.tag`
   - 本 change 不得改变 tab 的外部显示语义
   - 本 change 只改变 `tag/factoryGroup` 的维护位置与读取路径

## 边界

### In Scope

- 新建 `station-derived-map` change 文档
- 第一步纯改名方案
- 第二步 semantic derived cache 扩展方案
- `useBlueprintProductionStore` / `useLiveProductionStore` 的读取迁移方案
- 明确 blueprint/planning 与 archive/live 双实例边界

### Out of Scope

- 改写 `classifyPlayerStationPoi(...)` 分类规则本身
- 修改 tab 图标视觉规则、icon URL 映射或染色策略
- 新增第三套 store 或第三个 map 实例
- 编写测试代码或执行测试

## 验收标准（DoD）

1. 第一阶段完成后，代码库中不得再使用 `StationProductionFlowMap` 作为主名词，必须统一改为 `StationDerivedMap`
2. 第一阶段完成后，blueprint/planning 与 archive/live 的双实例结构保持不变
3. 第二阶段完成后，`StationDerivedMap` 缓存显式包含 semantic derived 数据区
4. 第二阶段完成后，`useBlueprintProductionStore.getTabs()` 不再直接调用 `classifyPlayerStationPoi(...)` 组装 `tag/factoryGroup`
5. 第二阶段完成后，`useLiveProductionStore.getTabs()` 不再直接维护 binding plan 与 archive record 的双路 `tag/factoryGroup` 分支逻辑
6. 第二阶段完成后，blueprint/planning 实例与 archive/live 实例都能独立提供 station semantic derived 数据
7. `ProductionTabItem.tag` / `factoryGroup` 的对外行为保持与现有 UI 规则一致
8. build 验证要求保持：实现阶段完成后必须至少运行 `npm run build`

## 未决项

无
