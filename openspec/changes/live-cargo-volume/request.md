# Live Cargo Volume

## 目标

在实况产能页面的空间站视图中，为 `live` 模式下的 `volume` 面板增加当前仓库存量与仓储目标分配对比能力。该面板不再沿用现有按推荐占用量单值展示的体积视图，而是整体替换为面向仓储分配的三值对比视图，帮助玩家按 ware 判断当前库存、目标分配和推荐分配之间的关系。

## 已确认方案

### 入口与替换范围

1. 入口位置：实况产能页面 `station` workbench 的中间资源面板。
2. 触发条件：仅 `visualMode === 'live' && viewMode === 'volume'` 时启用新视图。
3. 替换方式：整体替换 `live + volume` 的中间面板内容，不修改 planning 模式和 live 下其他 tab 的现有组件。
4. 不复用现有行组件：不在现有 `StationWareFlow` 上叠加三值逻辑，而是使用独立的 live volume 组件。

### 展示语义

5. 新视图以仓储分配（allocation）为中心，而不是继续强调每小时流量。
6. 每个 ware 展示三个 count 维度：
   - `currentCount`：当前库存，来源于 save 中的 `cargo`
   - `targetCount`：玩家目标分配值，直接来源于 save 中 `playerStation.overrides.max`
   - `recommendedCount`：系统基于现有 volume 推荐逻辑得到的推荐占用 count
7. `reservation` 表示在途 ware，不计入当前存储量，也不用于 `currentCount`。
8. `targetCount` 已进入最终数据链路，不再允许使用 `recommendedCount` 或 `currentCount` 作为替代来源。

### 列表与排序

9. 分组保持现有 volume 视图结构：`container / solid / liquid`。
10. 排序保持不变：组顺序和组内 ware 顺序均沿用当前 volume 视图已有顺序。
11. 不新增按差值、告警、缺口等优先级重新排序。

### 行内展示

12. 每个 ware 行使用进度条形式合并显示三值，不在面板顶部新增总览块。
13. 行结构为：
   - 左侧：ware 名称
   - 中间：allocation progress bar
   - 右侧：`current / target / recommended` 数字
14. 进度条使用统一比例尺，基于 `max(currentCount, targetCount, recommendedCount)` 计算。
15. 对于不在当前生产和消耗列表中的 ware，在面板最下方单独列出，不混入前面的 allocation 分组。
16. 该底部单列按 `tier` 降序、`ware.name` 升序排序。
17. 该底部单列中的 ware 仅显示 `currentCount` 和 `targetCount`，不显示 `recommendedCount`。
18. cargo-only ware 的 `targetCount` 仍直接来源于 save 中 `playerStation.overrides.max`；如果该 ware 没有 override，则其 `targetCount = 0`。

### 分层职责

19. Rust parser：负责解析 `playerStation.trade.overrides.max/buy/sell`。
20. Save post-process / type layer：负责把 `overrides` 透传为 `playerStations` 可消费字段。
21. Store：负责基于 `archiveStation.cargo`、`archiveStation.overrides.max`、`derivedProductionFlows` 组装 live allocation 数据。
22. Presenter：负责将 store 输出转换为新组件直接消费的 allocation view model，不在 Vue 中临时拼装。
23. Vue：只负责按固定 contract 渲染新视图，不处理数据源回退逻辑。

## 边界

### In Scope

- `playerStation.overrides.max/buy/sell` 的 Rust 解析与 TS 透传
- `live + volume` 使用独立新组件替换现有中间面板内容
- store 层新增 live allocation view data
- presenter 透传 live allocation view data
- 三值进度条与 count 数字展示
- 保持现有分组和排序
- 底部单列的 `current + target` ware 展示
- 必要 i18n 文案

### Out of Scope

- planning 模式 volume 视图改造
- `quantity / economy / transport` 视图改造
- 顶部总览块或新的全局 summary 区
- 根据差值重新排序
- 以 `buy/sell` 规则进一步推导额外 UI 语义
- 测试编写与执行之外的保存格式迁移

## 验收标准

1. 在 live 模式的 station 资源面板中，切换到 `volume` 时，显示新的 allocation 视图而非现有 volume 列表。
2. 在 planning 模式下切换到 `volume` 时，仍显示现有旧视图，不受影响。
3. 新视图继续按 `container / solid / liquid` 三组展示，组顺序不变。
4. 每组内 ware 的展示顺序与当前 volume 视图保持一致，不因差值或库存状态重排。
5. 每个 ware 行显示 `currentCount / targetCount / recommendedCount` 三个值。
6. `currentCount` 仅基于 `cargo` 计算，`reservation` 不计入当前库存。
7. `targetCount` 直接来源于 save 中 `playerStation.overrides.max`，不再使用替代方案。
8. 不在当前生产和消耗列表中的 ware 出现在面板最下方单独区域，不混入主 allocation 分组。
9. 该底部单列中的 ware 仅显示 `currentCount` 与 `targetCount`，不显示 `recommendedCount`。
10. Rust parser 输出的 `playerStations` 包含 `overrides.max/buy/sell`。
11. `npm run build` 无编译错误。

## 未决项

无
