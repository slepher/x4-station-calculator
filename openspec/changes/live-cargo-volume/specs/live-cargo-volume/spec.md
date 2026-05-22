# Live Cargo Volume Specification

## Purpose

定义实况产能页面中 `live + volume` 视图的仓储分配展示行为：该视图必须以 ware 为单位同时展示当前库存、目标分配和推荐分配，并在保持现有分组与排序的前提下整体替换旧的 live volume 组件。

## ADDED Requirements

### Requirement: Live Volume Must Use A Dedicated Allocation View

`live` 模式下的 `volume` 视图 MUST 使用独立 allocation 组件整体替换现有 volume 内容，而不是在旧的 planning/live 共用 row 组件上追加三值逻辑。

#### Scenario: Live volume uses dedicated component

**前提** 用户位于 station workbench  
**并且** 当前 `visualMode = live`  
**并且** 当前 `viewMode = volume`  
**当** 中间资源面板渲染  
**那么** 系统渲染独立的 live allocation 视图  
**并且** MUST NOT 渲染现有的 planning volume row 组件集合

### Requirement: Allocation Row Must Keep Existing Volume Style And Add Storage Progress

每个 ware 行 MUST 保持接近现有 volume 行的视觉风格，并新增仓储进度条。

#### Scenario: Allocation row reuses existing row style

**前提** 用户位于 `live + volume` 视图  
**当** 系统渲染某个 ware 行  
**那么** 该行的视觉风格与现有 volume 行保持接近  
**并且** 行中新增仓储进度条

### Requirement: Allocation View Must Display Current And Target On Bar With Recommended Separately

每个 ware 行 MUST 同时展示：

- 进度条上的 `currentCount`
- 进度条上的 `targetCount`
- 单独展示的 `recommendedCount`

#### Scenario: Allocation row shows all three values

**前提** 某个 ware 已进入 live allocation 列表  
**当** 系统渲染该 ware 行  
**那么** 用户可同时看到当前库存、目标分配和推荐分配三个 count 值  
**并且** `currentCount / targetCount` 显示在进度条主体内  
**并且** `recommendedCount` 以独立数值显示

### Requirement: Current Count Uses Cargo Only

`currentCount` MUST 仅基于 save 中该站点的 `cargo` 计算。`reservation` MUST NOT 计入当前库存。

#### Scenario: Reservation is excluded from current count

**前提** 某个 ware 在站点中同时存在 `cargo=120` 和 `reservation=80`  
**当** 系统计算该 ware 的 `currentCount`  
**那么** `currentCount = 120`

### Requirement: Target Count Uses Player Station Override Max Directly

`targetCount` MUST 直接来源于 save 中 `playerStation.overrides.max`。系统 MUST NOT 使用 `recommendedCount` 或 `currentCount` 作为替代 target 来源。

#### Scenario: Target count comes from override max

**前提** 某个 player station 的 `overrides.max` 中存在 `ware=energycells amount=800000`  
**当** Store 组装 live allocation 数据  
**那么** `targetCount = 800000`

#### Scenario: Missing override max yields zero target

**前提** 某个 ware 不存在于 `playerStation.overrides.max`  
**当** Store 组装 live allocation 数据  
**那么** `targetCount = 0`

### Requirement: Live Production And Allocation Recommendation Must Use Actual Sector Sunlight

live 模式下的产量计算，尤其是 `energycells` 的生产量，以及基于该产量继续推导出的 `recommendedCount` 和库存时间明细，MUST 使用 save station 真实所在 sector 的 sunlight。

#### Scenario: Live energy cell production uses actual sector sunlight instead of stale plan setting

**前提** 某个 save station 绑定到了一个已有 binding plan 的站点  
**并且** binding plan 中保存的 `settings.sunlight = 100`  
**并且** 该 save station 当前真实所在 sector 的 sunlight 为 `137`
**当** 系统构建该站点的 live `productionFlows`
**那么** `energycells` 的 live 产量按 `137` sunlight 计算  
**并且** MUST NOT 继续按 `100` sunlight 计算

#### Scenario: Allocation recommendation and detail timings inherit actual sector sunlight

**前提** 某个 ware 的 `recommendedCount` 或填满/耗尽时间依赖 live `energycells` 产量
**当** 系统渲染 live allocation 行与展开明细
**那么** 这些结果继承真实 sector sunlight 修正后的 live 产量

### Requirement: Rust Parser Must Extract Player Station Trade Overrides

Rust parser MUST 解析 player station 的 `overrides.max/buy/sell`，并将三组 ware amount 数据写入 `playerStations` 解析对象。

#### Scenario: Parser extracts max buy sell lists

**前提** save 中某个 player station 含有 `overrides.max/buy/sell`  
**当** Rust parser 完成解析  
**那么** `playerStations[stationCode].overrides.max` 包含对应 ware 列表  
**并且** `playerStations[stationCode].overrides.buy` 包含对应 ware 列表  
**并且** `playerStations[stationCode].overrides.sell` 包含对应 ware 列表

### Requirement: Allocation Rows Must Keep Existing Volume Grouping And Order

live allocation 视图 MUST 复用当前 volume 视图已有的分组和顺序。

#### Scenario: Grouping stays container solid liquid

**前提** 当前 volume 视图存在 `container / solid / liquid` 三组  
**当** live allocation 视图渲染  
**那么** 系统继续按这三组展示

#### Scenario: Item order remains unchanged

**前提** 当前 volume 视图中某组内 ware 已有稳定顺序  
**当** 切换到 live allocation 视图  
**那么** 组内 ware 顺序保持一致

### Requirement: Wares Outside Current Production And Consumption Lists Must Be Rendered In A Bottom Cargo-Only Section

对于存在当前库存、但不在当前生产和消耗列表中的 ware，系统 MUST 在面板最下方单独渲染一个 cargo-only section，而不是混入主 allocation 分组。

#### Scenario: Cargo-only rows show current and target only

**前提** 某个 ware 位于 cargo-only section  
**当** 系统渲染该 ware 行  
**那么** 行内仅显示当前存量与 target  
**并且** MUST NOT 显示 `recommendedCount`

#### Scenario: Cargo-only target uses override max or zero

**前提** 某个 ware 位于 cargo-only section  
**当** Store 组装该 ware 的数据  
**那么** `targetCount` 取自 `playerStation.overrides.max`  
**并且** 若不存在该 override，则 `targetCount = 0`

### Requirement: Allocation Rows Must Use A Unified Progress Scale

每个 ware 行 MUST 以统一比例尺展示 `currentCount / targetCount / recommendedCount` 三者关系。比例尺 MUST 基于该行三值中的最大值确定。

#### Scenario: Scale is derived from max count

**前提** 某行 `currentCount=120`，`targetCount=300`，`recommendedCount=240`  
**当** 系统计算该行进度条比例尺  
**那么** 比例尺上限为 `300`

### Requirement: Expanded Allocation Detail Must Be Split Into Fill And Drain Cards

展开区 MUST 拆成两张填满卡片、一张消耗卡片和一张下游卡片，而不是继续平铺成一张持续扩宽的表。

#### Scenario: Expanded detail uses four cards

**前提** 某个 ware 行存在可计算的库存时间项  
**当** 用户展开该行  
**那么** 系统按 `Fill From Current / Fill From Empty / Drain / Downstream` 四张卡片显示明细

### Requirement: Expanded Allocation Detail Must Show Target And Recommended Time Columns

填满卡片 MUST 显示 `每小时量 / 设定 / 推荐`；消耗与下游卡片 MUST 显示 `每小时量 / 当前 / 设定 / 推荐`，时间精度到分。

#### Scenario: Expanded detail shows target and recommended columns

**前提** 某个 ware 行存在可计算的库存时间项  
**当** 用户展开该行  
**那么** 系统显示时间明细表  
**并且** 填满卡片中不显示 `Current` 列  
**并且** 消耗与下游卡片中显示 `Current / Target / Recommended` 列  
**并且** 时间精度到分

#### Scenario: Fill and drain cards include the correct starting states

**前提** 某个 ware 行存在可计算的边界时间  
**当** 用户展开该行  
**那么** `Fill From Empty` 卡片中包含“从空库存开始填充”时间项  
**并且** `Drain` 卡片中包含从 `Current / Target / Recommended` 开始的消耗时间项

#### Scenario: Missing time items are omitted

**前提** 某个时间项在 `targetCount` 与 `recommendedCount` 两列下都不可计算  
**当** 系统渲染展开明细  
**那么** 该时间项不显示

## MODIFIED Requirements

### Requirement: Live Volume Meaning Changes From Recommended Occupancy Count To Allocation Comparison

`live + volume` 视图的核心语义从单一推荐占用量展示修改为 allocation 三值对比展示。

#### Scenario: Live volume no longer uses single recommended count as primary meaning

**前提** 用户位于 live 模式 volume 视图  
**当** 系统渲染 ware 行  
**那么** 主信息不再只是单一推荐占用 count  
**而是** 当前库存、目标分配和推荐分配之间的对比关系
