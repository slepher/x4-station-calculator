# Volume Flow Max

## 目标

统一 wareflow / volume / infrastructure 相关链路中的 buffer 占用算法，取消 `sum/max` 双模式与切换能力，明确系统只使用 `max(consumptionBuffer, productionBuffer)` 作为存储占用口径。

本次变更要解决的问题是：当前展示链与基础设施计算链各自维护一套 buffer 占用逻辑，且其中一条链路还保留 `sum/max` 切换，导致 transit-hub volume 视图、station wareflow volume 视图与 auto infrastructure modules 之间存在口径漂移风险。

## 已确认方案（审核重点）

### 1. 单一算法口径

1. 系统统一使用 `max(consumptionBufferCount, productionBufferCount)` 计算单个 ware 的 `totalOccupiedCount`。
2. `consumptionBufferCount = consumption * resourceBufferHours`。
3. `productionBufferCount` 仅在 `netRate > 0` 且 ware priority 允许产物缓冲时生效；其小时数规则继续沿用现有 `primaryProductBufferHours / secondaryProductBufferHours` 语义。
4. `totalOccupiedVolume = totalOccupiedCount * unitVolume`。

### 2. 取消切换能力

5. 不再保留 `sum` 与 `max` 两种模式。
6. 不再保留 `volumeContributionMethod` 之类的运行时切换入口、透传参数或兼容分支。
7. 所有调用方默认且只能使用 `max` 口径。

### 3. 去重方式

8. buffer 占用算法只允许定义在一处共享计算逻辑中。
9. `deriveProductionFlows` 与 `calculateInfrastructureModules` 都必须复用这处共享逻辑。
10. 不允许让 infrastructure 计算直接依赖面向展示的 `DerivedProductionFlow` 结构来完成去重。
11. 共享逻辑应保持在 store/logic 层，输入仍以基础 flow 数据与 settings/priority 为主，而不是 UI 派生 DTO。

### 4. 影响范围

12. station wareflow 的 volume 相关展示改为统一使用 `max` 口径。
13. transit-hub 的 volume 视图改为统一使用 `max` 口径。
14. auto infrastructure modules 的 storage 需求计算改为统一使用 `max` 口径。
15. transport demand 计算逻辑不在本次变更中改规则。
16. economy / quantity 视图不因本次变更改动其业务公式。

### 5. 边界与兼容

17. 本次变更只统一 buffer 占用与 volume 相关口径，不改 ware priority 的业务含义。
18. 本次变更不引入新的 presenter/view-model 层，继续遵循 `store -> presenter -> vue`。
19. 本次变更不重写 transit-hub 与 station 的 UI 结构，只改其底层 volume 数据真相。

## 边界

### In Scope

- 统一 `totalOccupiedCount / totalOccupiedVolume` 的算法为 `max`
- 删除 `sum/max` 切换能力与相关兼容参数
- 提取一处共享 buffer 占用计算逻辑
- 让 wareflow derived 计算与 infrastructure 计算复用同一逻辑
- 同步 station wareflow volume、transit-hub volume、auto infrastructure modules 的口径
- OpenSpec 文档同步

### Out of Scope

- transport demand 公式改造
- economy / quantity 视图公式改造
- ware priority 规则改造
- 新增 UI 样式或交互
- 测试编写与执行

## 验收标准（DoD）

1. 任意 ware 的存储占用都按 `max(consumptionBufferCount, productionBufferCount)` 计算。
2. 系统中不存在可切换回 `sum` 的运行时参数、分支或对外 contract。
3. `deriveProductionFlows` 与 infrastructure storage 需求计算复用同一处共享算法，而不是各自维护重复实现。
4. transit-hub volume 视图与 station wareflow volume 视图的占用口径一致。
5. auto infrastructure modules 的 storage 需求与上述 volume 视图口径一致。
6. transport demand 逻辑保持现状不被连带修改。
7. 不引入新的 store/presenter/vue 中间层。

## 未决项

无
