# Live Planning Station

## 目标

在实况产能页面的 `planning` 模式下，当当前 station 存在 archive 数据时，为右侧 `StationDashboard` 引入 planning 语义下的 `built / building / all` 三态统计口径，使 dashboard 能以“现有已建不会减少、现有在建不会被削减、规划只会在现状基础上继续新增”的方式展示规划后的建材、工期、体积与工人信息。

## 已确认方案（审核重点）

### 1. 启用条件

1. 仅当 `visualMode === 'planning'` 且当前 station 存在 `archiveStation` 时启用本 change。
2. 不满足上述条件时，`StationDashboard` 继续沿用当前既有语义。
3. `live` 模式、`overview` workbench、`transit` workbench 不受本次变更影响。

### 2. planning dashboard 的基础模块集合

4. `builtModules = archive.modules`
5. `finalPlannedModules = plannedModules + autoIndustryModules + autoHabitationModules + autoInfrastructureModules`
6. `currentTotalModules = archive.modules + archive.building.modules`
7. `effectiveTargetModules = max(finalPlannedModules, currentTotalModules)`
8. 其中 `max` 表示按 `moduleId` 逐项比较 `count`，取更大的值。
9. 这样定义的原因是：规划不会拆除 archive 中已存在或已在建的建筑，而是根据规划结果决定是否继续新增。

### 3. StationDashboard 三态语义

10. planning 模式下继续复用现有 `moduleScope` 三态按钮，不新增新的 dashboard 控件。
11. 当 `effectiveTargetModules` 相对 `builtModules` 仍存在待建设模组时，继续显示该按钮，并默认将 `moduleScope` 设为 `building`。
12. 当 `effectiveTargetModules` 相对 `builtModules` 已不存在待建设模组时，隐藏该按钮，并保持 `moduleScope = built`。
13. `built` scope：
    - `builtScopeModules = builtModules`
14. `building` scope：
    - `buildingScopeModules = effectiveTargetModules - builtModules`
15. `all` scope：
    - `allScopeModules = effectiveTargetModules`
16. `building` 的语义是“相对 built 仍待建设的全部模块”。
17. 由于 `all = max(finalPlannedModules, currentTotalModules)`，所以 `building = all - built` 天然满足：
    - 不会削减 archive 中当前在建模块数量
    - 只会在当前在建基础上继续新增
18. auto 生成的 habitation / storage / dock / pier 只要进入 `effectiveTargetModules`，也会进入 planning 的 `building` scope。

### 4. buildingInProgress 的语义

19. `buildingInProgress` 在 planning dashboard 中仍然保留展示意义。
20. planning 下 `building` scope 的主统计输入需要像 live 模式一样排除 `buildingInProgress`，避免主统计与 `in-progress` 单独卡片重复计入。
21. 换句话说，planning 下 `building` scope` 的模块数量、建材、工期、体积主统计，都应与 live 一样先从统计输入里扣除 `in-progress`。
22. `buildingInProgress` 继续作为“当前 archive 确实存在一个正在施工中的模块”的单独展示上下文。

### 5. 四个 tab 的口径

23. `materials / time / volume` 三个 tab 继续跟随当前 `moduleScope` 切换：
    - `built` 看 `builtScopeModules`
    - `building` 看 `buildingScopeModules`
    - `all` 看 `allScopeModules`
24. planning 下建筑仓库材料（`buildingCargo`）与在途材料（`buildingReservation`）的显示规则与 live 模式保持一致。
25. planning 下材料缺口（`materialGap`）的计算规则也与 live 模式保持一致：当处于 `building` scope 时，用已经排除 `in-progress` 后的当前 scope 建材需求扣减建筑仓库材料与在途材料。
26. `workers` tab 不跟随 `moduleScope` 切换。
27. `workers` tab 在 planning + archive 下固定使用 `allScopeModules` 作为统计模块口径。
28. `workers` tab 不使用 archive 中已有的工人数值。
29. `workers` tab 也不沿用 live 模式下“工人视图固定看 built modules”的旧语义。
30. `workers` tab 在 planning + archive 下表示“规划完成后的运营状态模拟”。

### 6. workers tab 的交互行为

31. planning 下 `workers` tab 继续保持当前 planning 模式已有的交互体验。
32. 用户仍可切换 `workforceAuto`。
33. 用户仍可修改当前工人数值。
34. `currentEfficiency` 与 `actualWorkforce` 应基于 `allScopeModules` 和当前 planning workforce 输入重算。
35. planning 下 workers tab 的工人分析结果来自当前 planning 计算输入，而不是 archive 中已有 workforce 状态。

### 7. 与 live-planning-flow 的边界

36. `live-planning-flow` 负责中间 `wareflow / volume` 的 planning 口径。
37. `live-planning-station` 负责右侧 `StationDashboard` 的 planning 口径。
38. 二者都可能依赖 `finalPlannedModules` 或 `effectiveTargetModules`，但输出目标不同，不能互相替代。

## 边界

### In Scope

- `planning + archive` 条件下 `StationDashboard` 的三态 scope 新语义
- `effectiveTargetModules = max(finalPlannedModules, currentTotalModules)` 在 dashboard 侧的应用
- planning 下 `materials / time / volume` 按 scope 切换
- planning 下建筑仓库材料 / 在途材料展示与缺口扣减沿用 live 语义
- planning 下 `workers` 固定使用 `allScopeModules`
- planning 下 `workers` 保持手动 / 自动 workforce 交互
- `buildingInProgress` 在 planning dashboard 中的展示语义
- OpenSpec 文档同步

### Out of Scope

- 中间 `wareflow / volume` 计算链设计（由 `live-planning-flow` 负责）
- 左侧 `live-planning-modules` 面板展示规则
- `live` 模式 `StationDashboard` 语义改造
- `overview` / `transit` workbench 改造
- 测试编写与执行

## 验收标准（DoD）

1. 当 `visualMode === 'planning'` 且当前 station 存在 `archiveStation` 时，`StationDashboard` 启用 planning 口径。
2. planning dashboard 使用：
   - `builtModules = archive.modules`
   - `finalPlannedModules = planned + autoIndustry + autoHabitation + autoInfrastructure`
   - `currentTotalModules = archive.modules + archive.building.modules`
   - `effectiveTargetModules = max(finalPlannedModules, currentTotalModules)`
3. planning 下 `built` scope 使用 `archive.modules`。
4. planning 下 `building` scope 使用 `effectiveTargetModules - builtModules`。
5. planning 下 `all` scope 使用 `effectiveTargetModules`。
6. planning 下 `building` scope 不会削减 archive 中当前在建数量，只会继续新增。
7. planning 下若存在待建设模组，则显示 `moduleScope` 按钮并默认进入 `building`。
8. planning 下若不存在待建设模组，则隐藏 `moduleScope` 按钮并保持 `built`。
9. planning 下 `materials / time / volume` 三个 tab 跟随 `moduleScope` 切换。
10. planning 下建筑仓库材料与在途材料展示规则与 live 模式一致。
11. planning 下 `building` scope 的材料缺口会扣减建筑仓库材料与在途材料，与 live 模式一致。
12. planning 下 `workers` tab 不跟随 `moduleScope` 切换，而是固定使用 `allScopeModules`。
13. planning 下 `workers` tab 不使用 archive 中已有 workforce 数值。
14. planning 下 `workers` tab 仍支持切换 `workforceAuto` 与修改当前工人数值。
15. planning 下 `buildingInProgress` 仍可作为展示信息出现，但 `building` scope 主统计需要像 live 一样先排除它。
16. `live` 模式、`overview`、`transit` 与既有非 planning dashboard 语义不受本次 change 影响。

## 未决项

无
