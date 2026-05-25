# terraforming-view Request

## 目标

将 `terraforming-shell` 的 3 列占位布局替换为可交互的地球化内容面板：左列实现星区列表（accordion + 任务目标进度）、中列实现任务列表（分组树 + 交互式完成 toggle）、右列实现按用户实际执行顺序记录的项目执行序列面板。同时使用游戏中的彩色方块语义展示 stat 当前状态与任务需求。本次仅改动 `presenter → vue` 两层和必要的 store 状态扩展；领域语义依赖 `terraforming-data` 提供，不在 view 层重新猜测 state/value 规则。

## 已确认方案（审核重点）

### 星区面板（左列）

- 星区名称通过 `cluster.macro` → `maps.json` clusters 查 `nameId` → 走现有 i18n 管线翻译，由 Presenter 层组装 `clusterDisplayNames`。
- accordion 展开逻辑复用现有 `selectedClusterId`，同时仅一个展开。
- 展开后渲染 `cluster.objectives[]`，每项分列显示：
  - **step** 编号 + **action** 类型
  - **描述文本**: textId 经 i18n 翻译（如 `{1004,1091}` → 中文文本，textReplaces 替换 `$STATION$`/`$LOCATION$`/`$AMOUNT$` 为已解析值）
  - **完成进度**: 按 objective.action 分别判定：
    - `objective.relocate`: HQ archive station 的 `sector.id` → `maps.sectors[].cluster_id` 是否等于 terraforming cluster 的 `macro` 去掉 `macro.` 前缀
    - `objective.neutralize`: 对应 stat 的 `terraformingCurrentStats[stat]` 是否达到 `stats[].ranges` 中 `state >= 2` 的最小 end 值
    - `objective.build_project`: 对应 projectId 在 `completedProjects` 中且计数 > 0
    - `objective.build_housing`: `terraformingHousingBuilt` (新增) >= 目标值 (从 `cluster.values` 或 objective textReplaces 中提取)
  - 进度状态图标: `✅` 已完成 / `⬜` 未完成（objective 无中间态，判定是/否）
- 当前星区标记：
  - HQ archive 的 sector.cluster_id 与 terraforming cluster macro 匹配时，行首显示 `🏷️ 当前星区` 药丸 tag
- cluster 的 partName (如 `'planet001b'`、`'planet'`) 显示在星区名称下方作为类型标签

### 任务列表（中列）

- 调用 `resolveAvailableTasks(cluster, state, data)` 获取 `TaskTree`。
- 按 `projectGroups` 原始顺序分组，每组有标题（group 名称 i18n）。
- 每个任务节点显示：
  - **状态图标**: `⬜` 可用未完成 / `❌` 阻塞 / `✅` 已完成（completedProjects 计数 > 0）
  - **名称** (i18n)
  - **效果摘要**: `(+2 temp, humidity=4)`
  - **状态/需求方块**: 对 stat 条件按游戏内彩色方块形式展示，明确“当前 state”与“要求区间/阈值”
  - **重复性标签**: `[一次性]` (repeatCooldown === null) / `[可重复]` (repeatCooldown === 0) / `[冷却:Ns]` (repeatCooldown > 0)
  - **依赖标注**: `⟸ 项目名` / `⟸ 任一: 项目A, 项目B`
  - **阻塞原因**: `需要: XXX`
  - 依赖树子节点通过缩进表示父子关系
- `terraformingCompletedProjects` 类型改为 `Map<string, number>`（projectId → 完成次数）：
  - 一次性任务: 计数只能为 0 或 1
  - 可重复任务: 计数 ≥ 0
- 交互：
  - 一次性任务: 点击 toggle（0 ↔ 1）
  - 可重复任务: 行内嵌 `x-number-input` 控件设置完成次数，可为 0
  - 用户可自由操作，UI 不做前置限制。计数变更后自动 re-resolve，刷新可用/阻塞/完成状态
  - 从 completedProjects 移除 → 若不再满足条件则自动变为阻塞

### 执行序列面板（右列）

- 右列不再使用 `资源汇总 / 交付清单 / 项目明细` 三个 tab。
- 右列改为单一执行序列视图，按用户真实点击执行顺序逐条记录 terraforming 项目。
- 一次执行对应一条独立记录：
  - 一次性项目执行一次，产生一条记录
  - 可重复项目每增加 1 次，必须新增一条记录，不能只保留聚合 count
- 每条记录支持展开，展开后显示该次执行自己的：
  - wares 消耗
  - price
  - deliveries
  - 执行前状态
  - 执行后状态
- 每条记录都有单独取消入口。
- 相邻且同组的记录，仅做视觉上的组名标记：
  - 不折叠
  - 不合并
  - 不跨越不相邻记录强行聚合
  - 标记内容只显示组名
- 取消某条记录时，必须从该记录之后开始逐条重放并校验后续记录是否合法。

## 边界

### In Scope

- 左列: accordion + i18n 星区名 + objectives 进度 + 当前星区 tag
- 中列: 分组任务树 + 交互式完成 toggle + x-number-input 计数 + re-resolve + stats 卡片
- 统一的 stat 方块组件：用游戏方块展示当前 state、条件需求区间、通过/未通过
- 项目条件、objective neutralize、stat 卡片三处共享同一套方块语义，不各自解释颜色/状态
- 右列: 执行序列视图、单条记录展开明细、相邻同组组名标记、单条取消与后续合法性校验
- Store: `terraformingCompletedProjects` 改为 per-cluster (`Record<string, Map<string, number>>`)，切换星区数据自动隔离
- Presenter: clusterDisplayNames、objectivesProgress、clusterMatchesHq、statDisplayNames、projectMaxCounts、projectDisplayNames、级联撤销等 computed
- Vue 组件: 左/中/右三列具体实现（3:5:4 grid 不变），全量 i18n（`terraforming.*` namespace）
- 阻塞原因多行显示 + 项目名/stat 名/标签 i18n
- `npm run build` 无编译错误

### Out of Scope

- 任务操作同步到 game binding state 或保存到存档（UI 状态仅存内存，刷新丢失）
- 测试编写
- 测试编写

## 验收标准 (DoD)

1. 左列 accordion 列表中每个星区显示 i18n 翻译后的名称
2. 点击星区展开 → 显示 objectives 列表，每项含编号、描述、完成标记（✅/⬜）
3. 展开新星区时前一个自动折叠
4. 与 HQ 同星区的 cluster 显示「当前星区」药丸 tag
5. 中列按分组显示任务树，含名称、效果、重复性标签、依赖/阻塞标注
6. 所有 stat 条件以游戏方块形式显示，`condition.min/max` 被正确解释为 state 区间而非真实 value 区间
7. x-number-input 控件用于可重复任务的完成次数设置
8. 一次性任务点击 toggle 完成状态，修改后自动 re-resolve
9. 右列按真实执行顺序逐条显示执行记录，不再使用三 tab 聚合视图
10. 相邻且同组的记录只显示组名标记，不折叠、不合并、不跨段聚合
11. 取消中间某条记录时，系统会重新校验其后的所有记录
12. `npm run build` 无编译错误

## 未决项

- housing built 数据来源：目前无 X4 save 数据支撑，暂用 store ref 手动输入。后续需从 HQ station plan 的人口 housing 模块推导。
- `terraformingCurrentStats` 是否需要合并 completed projects 的 effects（当前保持 initialStats baseline）。
