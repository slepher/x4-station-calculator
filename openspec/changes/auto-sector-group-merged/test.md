# 自动星区划分合并版 — E2E 测试规划

本文档只规划 E2E case 的测试目的和业务覆盖点，不采用 `test_tasks.md` 的四章详细步骤格式。测试实现时仍应遵守仓库 E2E 规则：通过 helper/fixture 注入数据，reload 初始化 store，并通过 UI 设置语言。

## 数据与入口

优先复用现有数据：
- `tests/fixtures/auto-group/save_009_minimal.json`
- `tests/fixtures/db.json`
- `tests/fixtures/save.json`
- `tests/e2e/helpers/loadLiveBindingFixture.ts`

若需要覆盖 clean slate 的自动分组，应准备一个包含以下结构的 fixture：
- 多个 pure hub sector，用于验证 hub 自动生成。
- 等距 score 相近 sector，用于验证未决 assignment。
- 超出覆盖跳数但 5 跳内 sector，用于验证扩展 option。
- 至少一个只通过 bridge 才能减少断裂分量的玩家 sector component。
- 至少一个无玩家空间站 sector，用于验证新 hub / transit 继承。

## E2E Case 规划

### Case 1: 新 guid 自动分组初始化

测试目的：
- 覆盖 SaveList 或上传入口触发自动分组的主路径。
- 确认无绑定时创建 guid 级 binding，并进入 Live Production overview 的 Col 2/Col 3 草案状态。

应观察：
- Col 2 显示自动生成的 sector groups。
- Col 3 显示 bridge gate 或 assignment cards，而不是直接进入空白资源视图。
- 默认覆盖跳数、桥接搜索跳数、节点状态符合最终规则。

### Case 2: 已有 binding 的增量分配

测试目的：
- 覆盖 guid 已绑定后载入新存档，只对新增未归组玩家星区运行增量分析。
- 确认已有 group 作为 baseline/pinned 输入参与计算。

应观察：
- 已有 group 不被重建为重复项。
- 新玩家 sector 生成 assignment card。
- 已有 group 的 jumpRange 被用作吸收范围。

### Case 3: 编辑态节点 checkbox

测试目的：
- 覆盖全局“节点” checkbox 的 clean slate 禁用规则和 incremental 可关闭规则。
- 确认关闭节点后不生成新的 pure hub。

应观察：
- clean slate 且没有 baseline/pinned 输入时，“节点” disabled 且勾选。
- 有 baseline group 时可以取消“节点”。
- 取消后阈值和覆盖控件 disabled。
- 点击 [计算] 后只使用 pinned/手动 hub，不新增 pure hub。

### Case 4: 添加非玩家星区 hub

测试目的：
- 覆盖 `SectorHubAddMenu` 的 popup 行为、搜索全地图 sector、非玩家 hub 创建与确认写入。
- 验证非玩家 hub 不创建虚拟 stationPlan，但通过 transit hub 逻辑继承。

应观察：
- 点击 [添加] 后菜单以 overlay 弹出，可通过 Esc 或背景关闭。
- 无搜索只列玩家星区；搜索时可找到无玩家空间站 sector。
- 已是 anchor 的 sector 不可重复添加。
- 添加后 Col 2 出现新 hub draft。
- 确认后对应 group 作为普通 BindingSectorGroup 保存，并能在 transit 相关视图继承显示。

### Case 5: Unified pill 行基础操作

测试目的：
- 覆盖编辑态同一 jump row 中 coverage/candidate/connected 混排。
- 验证 `+`、`×`、`→` 三种操作语义。

应观察：
- 编辑态不再出现“覆盖星区 / 候选星区 / 连接星区”三 tab。
- coverage pill 为金色，candidate 为半金色，connected 为绿色。
- coverage 点击 `×` 后变为 candidate。
- candidate 点击 `+` 后加入当前 group coverage。
- 已被其他 group active coverage 占用的 candidate 显示 `→`，点击后转入当前 group，原 group 中该 sector 不再是 active coverage。

### Case 6: JumpRange 联动

测试目的：
- 覆盖修改 group jumpRange 时的 MapBinding 语义。
- 确认 baseline 只影响视觉，不提供恢复逻辑。

应观察：
- jumpRange 增大时，新跳数层内符合条件的玩家 sector 自动加入 coverage。
- jumpRange 缩小时，超出范围 coverage 被移出。
- 改回原 jumpRange 后，移出的 sector 以 candidate 方式重新加入，而不是凭 baseline 自动恢复。
- 连接 pill 不因 coverage jumpRange 修改而消失。

### Case 7: 连接 pill 与固定 MST 边

测试目的：
- 覆盖 5 跳内手动连接、断开，以及 [计算] 时固定连接边不被 MST 删除。

应观察：
- 5 跳内未连接 hub 显示绿色 `+`。
- 点击 `+` 后双方 `connectedGroupIds` 同步。
- 点击 `×` 后双方断开。
- 保留连接并点击 [计算] 后，该连接仍存在，MST 只补充必要新边。

### Case 8: Bridge gate 多方案

测试目的：
- 覆盖断裂分量存在多个 bridge 方案时，Col 3 阻塞 ordinary assignment 的决策流程。

应观察：
- Col 3 只显示 bridge plan cards，不显示普通 assignment cards。
- 多 sector unit 在 unit 级显示名称，子项只用于选择 center sector。
- 连接节点显示本地化 sector 名和 jump pill。
- 选择方案后 Col 2 立即出现 bridge draft group。
- ordinary assignment cards 基于 bridge groups 重新生成，bridge sector 不再作为普通候选 card。

### Case 9: 单 bridge 方案自动采用

测试目的：
- 覆盖只有一个 bridge 方案时无需用户选择并自动创建 bridge draft group。

应观察：
- Col 3 不停留在 bridge gate。
- Col 2 出现自动采用的 bridge draft group。
- ordinary assignment cards 已基于 bridge group 重新生成。

### Case 10: Col 3 all-hit options 与默认选项

测试目的：
- 覆盖每个玩家 sector card 包含所有当前范围命中的 group option。
- 验证 excluded default、扩展 option、standalone 的默认规则。

应观察：
- 同一 sector 被多个 group jumpRange 命中时，所有命中 group 都出现在 option 中。
- 被 `excludedDefaultAssignmentSectorMacros` 标记的 group 仍显示 option，但不默认选中。
- 无当前命中时，只显示最小扩展距离层的 group options，且不默认选中。
- standalone 始终最后显示，但不会被自动默认选中。

### Case 11: Col 3 card 身份和顺序稳定

测试目的：
- 覆盖用户在普通 assignment 阶段选择 absorb / standalone 后，card 不重新分类、不重排。

应观察：
- unresolved card 被用户选择后仍停留在原位置。
- 选择 standalone 后，Col 2 新增 group，但 Col 3 既有 cards 顺序不变。
- 其他可覆盖 sector 可追加 derived option；当前选中项变化不导致 card 移动。
- 点击 [重置] 恢复进入普通 assignment 阶段的 baseline。

### Case 12: 确认写入与资源视图切换

测试目的：
- 覆盖全部未决选择完成后一次性写入 store，并切换到资源视图。

应观察：
- 未决 card 未选择完时 [确定] disabled。
- 全部选择后 [确定] enabled。
- 点击 [确定] 后 Col 2/Col 3 confirm bars 隐藏。
- Col 3 显示 `EmpireWareFlowsDashboard`。
- 页面 reload 后 groups、coverage、connections、stationPlans 分配保持一致。

### Case 13: 取消编辑恢复 snapshot

测试目的：
- 覆盖编辑态中多项输入变更后 [取消] 恢复进入编辑前状态。

应观察：
- 修改节点 checkbox、添加 hub、转移 coverage、修改 connection 后点击 [取消]。
- Col 2 group、pill、jumpRange、connection、Col 3 当前视图恢复到进入编辑前。
- 新增 hub draft 消失。

### Case 14: 保留 checkbox 只读效果

测试目的：
- 覆盖全局/单 group 覆盖与连接保留 checkbox 的 UI 只读语义。

应观察：
- 关闭 group 覆盖保留后，coverage/candidate pill 仍显示但无 `×`、`+`、`→`。
- 关闭 group 连接保留后，connected pill 仍显示但无 `+`、`×`。
- toggle 不触发重新计算、不改变当前数据，只影响 [计算] 输入和 UI 操作可用性。

### Case 15: 保留 checkbox 关闭时 [计算] 空输入

测试目的：
- 覆盖关闭覆盖/连接保留后点击 [计算]，不提交当前编辑数据，完全自动生成。

应观察：
- 关闭覆盖保留后点击 [计算]，coverage 由算法重新生成，不受编辑态 coverage 影响。
- 关闭连接保留后点击 [计算]，连接由 MST 从零重算（不保留固定边），受桥接搜索跳数限制。
- 桥接上限 4 跳时，结果中不应出现 5 跳连接。

### Case 16: Standalone 组 ID 复用与 stationPlan 重分配

测试目的：
- 覆盖多次对同一 sector 独立成组时，不产生重复 group 和 transit hub。
- 覆盖 group 变更后 stationPlans 按最终 coverage 正确重分配。

应观察：
- 第一次确认 standalone group 后再次编辑-计算-独立成组同一 sector。
- 确认后 binding 中只有 1 个该 sector 的 group，tradeStation 不重复。
- 废弃的 standalone group 从 binding 移除。
- 该 sector 的 stationPlans 被正确重分配到当前 group，不被误删。

## 不作为 E2E 主责的内容

以下内容优先由 unit 测试覆盖，E2E 只在主路径中间接观察：
- hub score 精确数值。
- Kruskal 边排序细节。
- bridge plan top 5 排序细节。
- `buildSectorPath()` 的 0 权同 cluster 路径语义。
- standalone ID 复用的内部 ID 断言。
