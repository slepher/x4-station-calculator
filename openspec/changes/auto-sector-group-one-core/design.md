# auto-sector-group-one-core Design

## 总览

本 change 把自动星区分组的领域规则收敛在核心算法和 binding 写入层。UI 可以来自 Live 或 Map，但核心层不关心具体面板布局。Trade station 是 group 确认写入的一部分，因此跟随核心 group 生命周期，而不是单独成为 change。

## 关键数据

### GroupDraftInfo

核心 draft group 至少承载：

- `id`
- `sectorMacro`
- `jumpRange`
- `coverageSectorMacros`
- `connectedGroupIds`
- `excludedDefaultAssignmentSectorMacros`
- `isPinned`
- `baseline`
- `isNew`
- `source: 'auto' | 'manual' | 'bridge'`
- `tradeStationRetainEnabled`
- `savedTradeStationCode`
- `selectedTradeStation`

废弃字段不得重新引入：

- `recalcState`
- per-group `exclude`
- `disabledCoverageSectorMacros`
- `excludedDefaultConnectedGroupIds`
- bridge marker 持久化字段

### BindingSectorGroup

确认后写入普通 `BindingSectorGroup`。Bridge 和 standalone 都不使用特殊持久化结构。Trade station 写入：

- 玩家站：`tradeStation.saveStationCode = stationCode`
- 虚拟站：`tradeStation.saveStationCode = undefined`，位置为 anchor sector 中心

## 计算流程

### Clean slate

Clean slate 从 archive player stations 建立初始草案：

1. 统计每个 station 的 container 容量与生产线数。
2. 按 sector 汇总 hub 候选、最高 hub score、pure hub 标记和玩家站列表。
3. 当 `generateHubs=true` 时为 pure hub 创建 group；当 `generateHubs=false` 时只使用 pinned/手动输入 hub。
4. 构建双向星区图，排除单向 superhighway。
5. 按覆盖跳数为玩家 sector 计算当前命中 groups。
6. 当前命中且未 excluded 的 group 可作为默认归属；多命中时按距离、hub score、稳定 key 决胜。
7. 对等距且 score 差距小于 30% 或所有命中均被 excluded 的 sector 生成 unresolved assignment。
7. 计算 MST connection。
8. 如图不连通，生成 bridge plan。
9. 为每个 hub group 初始化 trade station 候选与默认值。

### Incremental

Incremental 从已保存 groups 生成下一版草案：

1. 保存的 groups 作为 baseline groups。
2. 每个 baseline group 保留自己的 `jumpRange`。
3. 扫描当前存档中不属于 baseline anchor 的玩家 sector，先识别新/回归 pure hub，并为这些 hub 创建 draft group。
4. 在 baseline groups 与新/回归 hub groups 都确定之后，再决定普通玩家 sector 的 coverage / assignment 归属。
5. 普通玩家 sector 若同时位于新/回归 hub 与 baseline group 覆盖范围内，按统一 assignment 默认规则决胜，而不是由 baseline 保留 coverage 预先占用。
6. 手动保留的 connection 作为 fixed edges。
7. 必要时生成 bridge groups。
8. 按 retain 规则重算 trade station 默认值。

## Link / MST

Link 候选由 group anchor pair 生成：

1. 用排除单向 superhighway 的双向星区图计算 anchor 间距离。
2. 距离大于 `bridgeSearchJumpRange` 的 pair 不进入 MST。
3. 用户保留的连接按 link 独立进入 fixed edges：A 或 B 任一端 `connectionRetainEnabled=true` 即固定该 A-B link。
4. 两端都关闭 retain 时，该旧 link 不进入 fixed edges。
5. Kruskal 先接纳 fixed edges，再只补充缺失边。
6. 输出必须双向写入 `connectedGroupIds`。

## 编辑态

编辑态不是最终结果编辑，而是下一次计算输入编辑：

- 进入编辑态时不复制恢复 snapshot。
- Baseline groups 默认 pinned。
- Unpin baseline group 只是不参与计算，仍保留展示。
- 手动新增 hub 默认 pinned，可删除。
- 修改 coverage 只影响当前 draft。
- 修改 connection 必须保持双向同步。
- 退出编辑只切回 result 模式，不恢复 draft。
- 恢复到最近一次计算结果由 binding 层 [重置] 使用 `calculationBaseline` 完成。
- 点击计算时，将 pinned groups、保留 coverage、保留 connection、trade station retain 作为下一次算法输入。

## Assignment

Assignment card 只针对非 anchor 玩家 sector。

Option 生成顺序：

1. 当前 coverage 命中 groups。
2. 无当前命中时，最近扩展距离层 groups；扩展距离必须 `<= MAX_UNCERTAIN_JUMP`，当前值为 5。
3. Standalone。

默认规则：

- 当前命中且未被 excluded default 的 group 可以默认。
- 扩展 option 不默认。
- Standalone 不自动 fallback 默认。
- 若没有当前命中，也没有 5 跳内扩展命中，则只生成 standalone option，并保持 `selectedOptionIndex=null`。
- 距离大于 5 的 group 不得作为 absorb option，也不得被显示为“扩展跳数至 6/7/... ”。
- 已选中的 Standalone option 不再是可点击 action；presenter 收到与当前 `selectedOptionIndex` 相同的选择时直接忽略。
- 领域层仍将显式选择 Standalone 实现为 upsert 行为：已有同 `sectorMacro` hub group 时更新/复用它；没有时才创建新 group。
- Standalone upsert 后仍需从其他 groups coverage 中移除该 sector，并重算 affected assignment options。

用户选择后，只更新 card 内部选择和 draft group 数据，不改变 card 所属 bucket 或排序。

## Draft 变更后的 assignment 同步

Card 或 hub 操作改变 sector 归属后，必须重建 ordinary assignments：

- coverage `×`：sector 从 active coverage 移出，若仍符合候选条件则显示为 candidate，并重新计算该 sector 的 options/default。
- candidate `+`：sector 加入当前 group coverage；若此前在其他 group active coverage，需要从原 group 移出。
- transfer `→`：一次完成“从原 group 移出 + 加入目标 group”，不得留下双重 active coverage。
- jumpRange 增大/缩小：只影响 coverage/candidate，不增删 connections；随后重建受影响 sector 的 assignments。
- hub add：新增 anchor sector 不再生成 ordinary assignment card，并从其他 groups coverage 中移除。
- hub remove：移除该 group 和相关 connections 后，原 anchor/coverage 涉及的玩家 sector 重新进入 assignment 生成流程。
- 对仍存在的 assignment card，保持 card identity 和排序，只更新内部 option、default 和 selected。

## Bridge

Bridge 处理发生在普通 assignment 之前：

- 多个 bridge plan：只展示 bridge cards，阻塞 ordinary assignments。
- 单个 bridge plan：自动采用。
- 采用后创建普通 bridge draft groups，再重新生成 ordinary assignment cards。
- Bridge group 确认后与其他 groups 一样写入 binding。

## Trade station

Trade station 选择与 group 生命周期同步：

- 新增 group 时创建候选列表并按默认值规则设置 `selectedTradeStation`。
- 删除 group 时删除对应 card 和 draft 中的 trade station 选择。
- 玩家 sector hub 使用统一候选规则：候选原始数据来自 anchor sector 内玩家站，不按 auto/manual/bridge 来源分叉。
- 非玩家 sector hub 无玩家站时使用虚拟交易站，不生成虚拟 `stationPlan`。
- 重置入口由 binding 层的共用顶部栏统一处理，使用 `calculationBaseline` 恢复整份 shared draft；core 不定义区域级 reset 按钮语义。
- Confirm gate 同时检查 bridge、assignment 和 trade station。

候选来源：

- 原始候选池：anchor sector 内玩家站，计算并保留 `containerCap`、`prodLines`、`score`、`isPureHub`、`qualified`、`iconTag`，按 score 排序，不做 `requireQualified` 过滤，也不在 store 层做 top 5 截断。`score` 统一使用 `containerCap / (1 + ln(1 + prodLines))`，不得按 `qualified` 分支切换公式。`iconTag` 复用现有玩家空间站 POI 图标语义：优先使用存档已有 `tag/factoryGroup`，缺失时基于空间站模块分类推导。
- 零货舱规则：若存在任意 `containerCap > 0` 的空间站，则从原始候选池剔除 `containerCap = 0`；若所有空间站均为 `containerCap = 0`，则保留这些空间站。
- 展示候选：presenter 基于原始候选池和当前 `containerThreshold` 做展示筛选，并在展示层执行 top 5 原则；若展示候选池中存在 pure qualified 候选（`isPureHub=true`），top 5 SHALL 尽量保留最多 2 个 pure qualified 候选，可替换 top 5 末尾的非 pure qualified 候选；`containerThreshold` 是生成新 hub 的依据，不是原始候选池过滤条件。
- 候选图标：Trade Station 栏使用现有 save station icon 映射渲染候选 `iconTag`；当前选中的候选图标使用光晕高亮。虚拟交易站候选使用 trade station 图标并遵循相同选中高亮。
- 无玩家站：虚拟交易站。

## 持久化

`createAutoGroups()` 或等效确认流程必须：

1. UUID 优先匹配 group。
2. `sectorMacro` 兜底匹配 standalone/group。
3. 移除不在 draft 中的废弃 group。
4. 写入 coverage、connections、jumpRange。
5. 重建 station plan group assignment。
6. 显式写入 trade station。
7. 按最终 groups 重算无 `saveStationCode` virtual station plans 的归属。
8. 仍未分组的 virtual station plans 不写回 binding；若 binding 中存在对应旧 plan，则删除。
9. 带 `saveStationCode` 的 save station plans 不参与 virtual station 同步。
10. 不让旧自动站点绑定逻辑覆盖用户选择。

## Virtual trade station 不变量

Virtual trade station 属于 `BindingSectorGroup.tradeStation`，不是 `BindingStationPlan`。

- UI/计算层可以用 `__virtual__` 表达候选项，但持久化时不得写入 `saveStationCode`。
- `tradeStation.sectorMacro` 始终等于所属 group 的 `sectorMacro`。
- 地图拖动 virtual trade station 只能改变 position。
- 拖动不得修改 group `sectorMacro`、coverage、station plan 或 trade station `sectorMacro`。
