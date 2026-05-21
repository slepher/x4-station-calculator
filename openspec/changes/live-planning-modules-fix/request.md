# Live Planning Modules Fix

## 目标

修正 `live-planning-modules` 现有方案中的语义冲突，明确 `recommendedModules` 并不是“待采纳建议”，而是已经纳入 planning 基线的一部分，并直接显示在 planning 区中，只通过视觉样式区分来源。

本次变更同时收敛 industrial autoFill 的实现边界：通用 autoFill 恢复为 `develop` 版本语义，live planning 需要的 floor 行为由新函数单独处理，不再把 floor / reference 语义混入通用 autoFill。

## 已确认方案（审核重点）

### recommendedModules 的真实语义

- `recommendedModules` 属于 `plannedModules` 语义的一部分。
- 它们不是“点击后才生效”的候选项，而是已经纳入 planning 基线的模块子集。
- 它们参与：
  - live planning 的 industrial autoFill 基线
  - flow 计算
  - planned ware 集合判定
  - `warePriority = 2` 的 planned 级可见性
- UI 中不再单独拆出推荐区，而是直接显示在 planning 区中。
- recommended 项仅通过虚线前置等视觉样式区分“这是 reference-aligned planned subset”。

### UI 文案与展示语义

- 现有“推荐纳入规划”“建议纳入规划”这类文案会误导用户，以为这些模块还未进入 planning。
- 新方案必须把相关说明改成“已纳入规划的 reference-aligned planned subset”语义。
- recommended 模块直接显示在 planned 区中，不再占用一个独立区块。
- recommended 模块使用虚线前置等弱视觉标记，与用户显式添加的 planned 模块区分来源。
- 这些视觉标记只影响展示，不影响任何计算结果。

### orphan 判定与分层

- orphan 判定不再只是 presenter 的 UI 筛选条件。
- orphan 判定现在用于构造 live planning 的 effective planned baseline，因此应下沉到 store / planning 计算路径。
- presenter 的职责改为：
  - 读取 store 输出的 recommended subset
  - 在 planned 列表中为这部分模块组装虚线前置等来源标记
  - 组装 planning 区所需的 UI 差异字段

### effectivePlannedModules 边界

- store 必须正式输出 `effectivePlannedModules`。
- 该字段表示所有需要按 planned 语义处理的模块集合：
  - 显式 planned modules
  - recommended subset
- 顺序语义必须保持：
  - 用户显式 plannedModules
  - recommended subset
- 所有“把模块当作 planned 看待”的地方都应消费这份字段，而不是在各处重复拼接。
- reference production floor 仍然参与 live planning 的 canonical / autoFill 基线，但 MUST NOT 因此自动进入 `effectivePlannedModules`。

### industrial autoFill 的边界修正

- 通用 `calculateAutoIndustryModules` / `calculateAutoFillModules` 必须恢复到 `develop` 版本语义。
- 通用 autoFill 不再理解 `referenceModules`、不再承担 floor 语义。
- live planning 的 floor 行为通过新函数处理，例如：
  - `calculateAutoIndustryModulesWithFloor`
- 新函数职责：
  - 基于 `archive_total` / `referenceModules` 提取 production floor
  - 以 `max(plannedModules, floor)` 作为 autoFill 产能基线（floor 贡献的产能被计入但不视为 planned）
  - 调用旧 industrial autoFill 逻辑补上游缺口
  - 将 floor 中超出显式 planned 的部分合并回 `autoIndustryModules`（floor 模块出现在 auto 区域）
- 不再保留“producer 级 reference quota + 填补缺口”的复杂工业 selector 流程。

### floor 作用范围

- floor 仅对需要纳入 planning 基线的 reference production modules 生效。
- support 区域不受 floor 约束：
  - habitation
  - storage / pier 等 infrastructure
- 非 referenceModules 的工业模块仍按旧 autoFill 逻辑补齐，不额外施加 floor。
- 若 reference 模块在 `modulesMap` 中不存在或不满足 industrial planning 计算条件，应忽略该项，不得制造兜底假数据。

### warePriority 与 flow 列表语义

- 推荐分组模块产出的 ware 视同 planned ware，resolved priority = `2`。
- 这里的 `priority = 2` 只表达 planned 级可见性，不表达 flow 列表内部排序规则。
- flow 列表若需要区分显示顺序，必须单独说明为 UI / presenter 层排序语义：
  - 用户显式 plannedModules 产出优先
  - recommended subset 产出其后
  - 纯 auto 产出其后
- 文档中不得再把 flow 列表顺序描述成 `warePriority` 的“排序”。

### recommended 项交互语义

- 由于 recommended 模块已经属于 planned 基线，点击它不是“再次累加推荐数量”。
- recommended 项与普通 planned 项共享同一规划列表交互能力。
- 用户点击 recommended 项时，应将显式 planned 数量提升到该模块当前目标总量。
- 若 UI 需要保留来源可见性，只通过虚线前置等样式表达，不再通过独立区块表达。

## 边界

### In Scope

- 明确 `recommendedModules` 是 planned 子集而不是待采纳建议
- 调整 live planning 相关文案与 planning 区展示说明
- 将 orphan 判定下沉到 live planning 的 store / planning 计算路径
- 输出统一的 `effectivePlannedModules` 字段，作为 planned 语义计算链入口
- 恢复通用 industrial autoFill 到 `develop` 语义
- 新增 live planning 专用 industrial floor 计算函数
- 修正 `warePriority` 与 flow 列表顺序的文档表述
- 更新 recommended 项展示与交互语义，使其与“已纳入 planning”一致
- 同步 `request/spec/design/tasks`，避免继续依赖已完成的旧 change

### Out of Scope

- 修改 `live-planning-modules` 旧 change 的已归档实现结果
- 重新设计 auxiliary modules 的 reference-aware priority
- 编写测试代码或执行测试
- 修改与 live planning 无关的 build plan / blueprint 产品行为

## 验收标准（DoD）

1. 文档层明确 `recommendedModules` 已经属于 planned 基线，不再被描述为“待采纳建议”。
2. planning 区相关 UI 文案不再暗示“点击后才纳入规划”。
3. recommended 模块直接显示在 planning 区中，并通过虚线前置等视觉样式区分来源。
4. orphan 判定被定义为 live planning baseline 构造规则，而不是纯 presenter 展示规则。
5. `effectivePlannedModules` 被定义为 planned 语义计算链的统一入口。
6. 通用 industrial autoFill 明确恢复为 `develop` 语义，不再依赖 `referenceModules`。
7. live planning 的 industrial floor 通过新函数单独处理，而不是污染通用 autoFill。
8. 文档中不再把 flow 列表顺序误写为 `warePriority` 排序语义。
9. recommended 项交互语义与“已纳入 planning”保持一致，并明确点击是转正到目标总量而不是再次累加。
10. `request/spec/design/tasks` 四份文档对以上语义保持一致。

## 未决项

- 无。
