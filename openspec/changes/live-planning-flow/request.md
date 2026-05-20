# Live Planning Flow

## 目标

在实况产能页面的 `planning` 模式下，当站点存在 archive 数据时，为 planning station state 的主 flow 计算链引入新的有效模块口径，使规划结果始终以“现有建筑不会被拆除、只会在其基础上新增”的语义进行重算。新口径需要直接替代现有 planning `productionFlows`，并作为后续所有 flow 聚合、planning volume 主视图与展开明细的统一基准。

## 已确认方案（审核重点）

### 1. 启用条件

1. 仅当 `visualMode === 'planning'` 且当前 station 存在 `archiveStation` 时启用本 change。
2. 不满足上述条件时，沿用当前旧的 planning 计算口径。
3. `live` 模式、`overview` workbench、`transit` workbench 不受本次变更影响。

### 2. 有效模块口径

4. 新口径为：
   - `effectiveModules = max(plannedModules + autoIndustryModules + autoHabitationModules + autoInfrastructureModules, archive.modules + archive.building.modules)`
5. `max` 表示按 `moduleId` 逐项比较 `count`，取更大的值，而不是数组整体二选一。
6. archive 侧参与逐项 `max` 的是**全部模块**，不是仅生产模块。
7. 这样定义的原因是：规划不会把 archive 中已经存在的建筑拆掉，而是根据新的计算结果判断还需要新增哪些建筑。

### 3. 隐式职责分离保持不变

8. `plannedModules` 继续允许包含所有模块类型。
9. 本次 change 不新增显式的 `productionOnlyModules` / `effectiveProductionModules` 分类层。
10. 系统继续依赖现有隐式职责分离：
    - flow 继续通过模块自身 `outputs / inputs` 决定哪些模块进入生产流
    - habitation 继续通过 workforce 链路生效
    - storage / dock / pier 继续通过 infrastructure 派生链路生效
11. 本次 change 改的是 planning+archive 场景下的模块数量口径，不改这三条职责边界本身。

### 4. flow / workforce / efficiency 重算语义

12. 在启用条件成立时，系统使用 `effectiveModules` 驱动新的 planning 主计算链。
13. `workforce` 与 `efficiency` 需要按 `effectiveModules` 重算，而不是继续沿用旧口径。
14. `productionFlows` 需要按新口径重算，并直接替代当前 planning 主 flow 数据源。
15. `warePriorityLevels` 的判定逻辑保持现状，不因本次 change 修改分支规则。
16. `recommendedModules` 只是左侧 planning 面板的视图因素，不参与 flow 计算，也不参与 `effectiveModules` 构建。
17. 所有依赖 flow 的后续聚合结果都必须基于这套新 `productionFlows` 继续计算。
18. 不允许出现“wareflow 展示用一套新 flow、volume / detail / aggregation 继续使用另一套旧 flow”的双轨状态。
19. 新增一个 flow 操作约束：若某个 ware 由 archive 中存在的生产模块产出，则在 `planning + archive` 场景下禁止对该 ware 执行 lock 操作。
20. 该约束作用于 lock 交互本身，不改写 `warePriorityLevels` 的既有分支语义。

### 5. auto 模块与新增建筑语义

21. `effectiveModules` 由 `planned + auto + archive` 逐项 `max` 合成后，继续通过现有职责链自然生效。
22. 若某类 habitation / storage / dock / pier 已存在于 archive 中，则新口径不会把它们“抹掉”。
23. 若新计算结果需要更多 habitation / storage / dock / pier，则系统仍按现有派生逻辑继续新增。
24. 换句话说，本次 change 不改变“如何生成附属建筑”，只改变它们所依据的 planning 模块口径。

### 6. planning 聚合基准 flow 与消费方切换

25. `StationWareFlowsDashboard` 在 planning 模式下应改为消费新的 canonical planning flow 数据。
26. `planning` 的普通 wareflow 视图需要切到这套 canonical flow。
27. `planning` 的 `volume` 视图也需要切到基于该 canonical flow 继续聚合得到的数据。
28. `planning volume` 的展开明细必须与主视图使用相同的 canonical flow 基准，不允许主视图与明细采用不同数据源。

### 7. 与其他模块的边界

29. `StationDashboard` 另有独立安排，不在本次 change 规划内。
30. `live-planning-modules` 中左侧 planning 面板的 `recommendedModules`、archive 参考区、红色阈值与 `+N` 展示逻辑不在本次 change 中重新设计。
31. 本次 change 不修改 `live` 模式 volume allocation 视图语义。

## 边界

### In Scope

- `planning + archive` 条件下的 `effectiveModules` 新口径
- 基于新口径重算并替代 planning 主 `productionFlows`
- 基于新口径重算 `workforce` / `efficiency`
- 基于新 flow 继续完成 planning 侧 flow-based aggregation
- `planning + archive` 下 archive 产出 ware 的 lock 禁止约束
- planning wareflow 视图切换到 canonical planning flow
- planning volume 视图切换到基于 canonical planning flow 的聚合结果
- planning volume 展开明细切换到同一套 canonical planning flow 基准
- 保持隐式职责分离不变的前提下，让 archive 全部模块参与逐项 `max`
- OpenSpec 文档同步

### Out of Scope

- `live` 模式 flow / volume 语义改造
- `StationDashboard` 的任何行为、口径或 prop 设计
- `recommendedModules` 视图规则重设计
- `overview` / `transit` workbench 改造
- 测试编写与执行

## 验收标准（DoD）

1. 当 `visualMode === 'planning'` 且当前 station 存在 `archiveStation` 时，系统使用 `effectiveModules = max(planned+auto, archive)` 的逐项口径进行 planning flow 相关计算。
2. `max` 合并以 `moduleId` 为键逐项比较 `count`，archive 侧的全部模块都参与比较。
3. `plannedModules` 仍允许包含所有模块类型，本次 change 不新增显式 production-only 分类层。
4. 系统继续通过隐式职责分离工作：flow 看 `outputs/inputs`，habitation 走 workforce，storage/dock/pier 走 infrastructure。
5. 在启用条件成立时，`workforce` 与 `efficiency` 基于新口径重算。
6. 在启用条件成立时，planning `productionFlows` 基于新口径重算，并直接替代旧 planning flow 数据源。
7. `warePriorityLevels` 保持现有判定逻辑，不因本次 change 改规则。
8. `recommendedModules` 不参与 `effectiveModules` 构建，也不参与 flow 计算。
9. 当某个 ware 由 archive 中存在的生产模块产出时，在 `planning + archive` 场景下禁止对该 ware 执行 lock。
10. 该 lock 禁止约束不改写 `warePriorityLevels` 的既有分支语义。
11. 所有后续 flow 聚合结果都基于这套新的 planning `productionFlows` 继续计算。
12. 不允许出现“展示 flow”和“聚合 flow”并行的双轨状态。
13. planning 的普通 wareflow 视图切换到新的 canonical planning flow。
14. planning 的 volume 主视图切换到基于该 canonical flow 的聚合结果。
15. planning 的 volume 展开明细与主视图使用同一套 canonical flow 基准。
16. `live` 模式、`overview`、`transit` 与 `StationDashboard` 不受本次 change 影响。

## 未决项

无
