# 自动星区划分增强 (auto-sector-group-enchanted)

## 目标

增强 Col 2 编辑输入态，让用户能更精细地编辑下一次自动分组的输入：固定或取消固定 hub、手动添加 hub、编辑同一跳数行中的范围/候选/连接 pill，并在 Col 3 中基于所有命中范围的 group 选项确认最终吸收或独立成组方案。

本次变更不把 Col 2 编辑态视为最终归属编辑。Col 2 编辑态只影响下一次计算的默认输入；最终吸收到哪个 group 或独立成组仍由 Col 3 card 的选择和 [确定] 写入决定。

## 已确认方案（审核重点）

### 1. 重新计算状态简化

- `recalcState: 'normal' | 'pin' | 'exclude'` 改为 `isPinned: boolean`
- 不再提供 per-group `exclude`
- 已持久化 / 进入编辑前已存在的 baseline group 默认 `isPinned=true`
- 新建 hub group 和 bridge draft group 默认 `isPinned=false`
- 新建 hub draft 可删除
- baseline group 不可真正删除；用户取消固定时只变为 unpinned，并保留原有 link、coverage、jumpRange 展示数据以便重新 pin

### 2. 全局「节点」checkbox

位置：SectorConfirmBar，顺序为 `桥接 | 节点 | 阈值 | 覆盖`。

- 默认启用（勾选）
- 不勾选 → 算法不生成新的 pure hub
- 不勾选 → 阈值和覆盖下拉菜单联动 disabled
- clean slate 场景不允许取消 checkbox：当没有可作为初始输入的 baseline/pinned group 时，「节点」checkbox 直接 disabled 并保持勾选
- incremental / 已有 baseline group 场景允许取消 checkbox；此时仅使用已有 pinned hub、手动新增 hub 和用户保留的默认输入重算

### 3. 全局「添加」按钮与 hub 选择菜单

- SectorConfirmBar 编辑态在 [计算] 右边增加 [添加] 按钮
- 点击后弹出星区选择菜单，功能类似 Map 中“添加星区”：Map 中添加的是 sector group；这里添加的是 hub draft group
- 菜单复制自 `MapBindSectorMenu`，但通过 prop 隐藏「定位地图」按钮
- 菜单弹出显示，不得作为普通页面流元素渲染
- 无搜索时列出玩家星区
- 搜索时遍历全地图 sectors，包含无玩家空间站的 sector
- 已是任意 group hub anchor 的星区不可再次添加为 hub
- 新增 hub draft group 默认 `isPinned=false`，可从列表删除
- 若新增 hub 的 anchor 原本是某个 group 的范围星区，该 sector 在原 group 中按“已成为 hub/连接对象”显示，不再作为覆盖候选处理

### 4. 基线定义与作用

基线是“点击 [编辑] 之前的当前显示状态”，不局限于已持久化 store 数据。

- 若当前页面显示已确认 binding group，则该 store-derived 结果是基线
- 若当前页面显示刚计算出的 draft 结果，则该 draft 结果是基线
- 进入编辑态时快照 group anchor、coverage、connected、isPinned、jumpRange 等
- baseline 在 UI 上仅用边框宽度区分
- baseline 不再决定 x/+ 行为
- baseline 的核心作用是 coverage 可恢复：
  - baseline coverage 被其他 group 获取后，不从当前 group 的历史集合中丢失
  - 其他 group 后续移除该 sector 时，若当前 group jumpRange 仍覆盖它，应可恢复为当前 group 范围星区
  - baseline coverage 因当前 group jumpRange 缩小而超出范围时，仍留在界面中
  - jumpRange 改回覆盖它时，可重新进入当前 group 范围
- connection 不需要 baseline 恢复语义；连接对象始终存在，且可操作范围固定 5 跳

### 5. `excludedDefaultAssignmentSectorMacros`

原 `disabledCoverageSectorMacros` 改为：

```ts
excludedDefaultAssignmentSectorMacros: string[]
```

语义：
- 仅用于有玩家空间站的 sector
- 对某个 group 来说，列表中的玩家 sector 不能在下一次计算中默认选中该 group
- 它不是“不可选择”
- Col 3 中该 group 仍可作为该 sector 的手动 option
- 如果一个玩家 sector 只有 excluded group 命中，则该 sector 没有默认选项，必须由用户在 Col 3 手动选择吸收或独立
- 非玩家星区不进入该字段；参与计算时非玩家 coverage 全部保留，因为无玩家站就不存在重新设置玩家星区归属的问题

不再引入 `excludedDefaultConnectedGroupIds`。连接只由 `connectedGroupIds` 表达。

### 6. 统一 pill 行，不再使用三 tab

取消 `覆盖星区 | 候选星区 | 连接星区` 三栏切换。每个 group 在同一个 jump row 中混排所有 pill，只用颜色和按钮区分类型：

- 范围星区 coverage：金色
- 候选星区 candidate：半金色
- 连接星区 connected / hub anchor：绿色
- baseline：粗边框
- 有玩家空间站：实心点
- 无玩家空间站：空心点
- 普通加入 / 恢复 / 连接：`+`
- 移出 / 断开：`×`
- 从其他 group 的 active coverage 转入当前 group：`→`

同一个 jump row 内不拆行；范围、候选、连接 pill 混排显示。

### 7. 范围与候选星区行为

#### 覆盖跳数来源

- 范围/候选星区使用当前 group 自己的 `jumpRange`
- 连接星区的手动可操作范围固定为 5 跳
- 自动连接范围使用桥接搜索跳数

#### 修改 group jumpRange

修改 group `jumpRange` 时，coverage/candidate 的联动采用当前 `MapBindingSectorGroup` 的 jumpRange 语义：

- jumpRange 增大：新范围内符合条件的玩家星区自动进入当前 group coverage，显示为金色范围 pill
- jumpRange 缩小：超出新范围的非 baseline coverage 从当前 group active coverage 移出；若仍在其它展示来源中则显示为候选，否则不显示
- baseline coverage 超出新范围时仍保留在界面中，显示为可恢复候选；jumpRange 改回覆盖它时可重新进入范围
- 非玩家 coverage 不因为玩家归属规则被加入 `excludedDefaultAssignmentSectorMacros`
- 修改 coverage jumpRange 不增删连接，不影响绿色连接 pill 的可见性

#### 同 group 操作

- 当前 group active coverage：按钮 `×`，点击后变为当前 group candidate
- 当前 group candidate：按钮 `+`，点击后变为当前 group active coverage
- 已成为 hub anchor 的 sector 不作为 coverage/candidate 显示，转为绿色连接 pill

#### 跨 group 操作

- candidate 可以在多个 group 中同时显示
- active coverage 同一时间只能属于一个 group
- 如果 sector S 已是其他 group 的 active coverage，在当前 group 中仍可显示为候选，按钮显示 `→`
- 点击 `→`：S 转入当前 group active coverage；原 group 中：
  - 若 S 是 baseline coverage，则保留为可恢复候选/历史项
  - 若 S 是非 baseline coverage，则从原 group active coverage 移出；若仍在原 group jumpRange 内，显示为候选
- 如果 S 只是其他 group 的 candidate，不显示 `→`，仍显示普通 `+`

### 8. 连接星区行为

- hub anchor 统一作为连接星区显示，不作为 coverage/candidate 显示
- 连接星区只靠绿色区分，不使用额外 link 图标
- 已连接：目标 group id 在 `connectedGroupIds` 中，显示绿色 active pill，按钮 `×`
- 未连接但 5 跳内可连接：显示绿色 candidate pill，按钮 `+`
- 点击 `+`：加入 `connectedGroupIds`
- 点击 `×`：从 `connectedGroupIds` 移除
- connection 不区分 baseline 行为
- connection 不使用 excluded/default-off 字段

### 9. unpinned baseline hub 行为

- unpinned baseline hub 保留 link、coverage、jumpRange 展示数据，方便用户重新 pin
- unpinned baseline hub 的保留数据不参与计算
- 若 unpinned baseline hub link 到 pinned hub，计算中忽略该 link
- unpinned baseline hub 允许进入其他 pinned hub 的范围星区
- 一旦 unpinned baseline hub 进入其他 hub 的 coverage，需要在 unpinned hub 自身标记该状态，并且不允许重新 pin

### 10. Col 3 card option 语义

Col 3 card 已覆盖所有玩家星区；本次修改的是每张 card 的 option 生成规则。

- 若 sector S 是任意 hub anchor，则不显示 card
- 若 S 被一个或多个 group 当前覆盖范围命中，则所有命中 group 都成为 option
- 若 S 未被当前覆盖范围命中，但扩展 group jumpRange 后可命中，则仅取扩展距离最小的一层 group 成为 option
- 扩展命中 option 不默认选中，需要用户手动选择
- 若 S 在 group G 的 `excludedDefaultAssignmentSectorMacros` 中，G 仍显示为 option，但不能作为 default
- 若所有命中 option 都被 excluded，则 S 没有默认选项
- standalone 始终作为最后 option，但不作为自动兜底默认值
- 若 S 没有当前范围命中，也没有扩展命中：
  - S 是基线星区 → 允许按基线 group 重新吸收，基线 group 可作为默认
  - S 不是基线星区 → standalone 作为 option，但不默认选中，由用户确认

### 11. 非玩家星区 hub 与 Live 继承

- 新建 hub 允许选择无玩家空间站的 sector 作为 anchor / 定位星区
- 确认提交不新增新的虚拟 stationPlan，也不改变 save archive 原始记录
- 确认提交沿用现有 `createAutoGroups -> bindSectorGroup` 写入路径
- 现有 `bindSectorGroup` 会确保 `BindingSectorGroup.tradeStation` 存在；当无真实 `saveStationCode` 时，tradeStation 作为 transit hub 定位实体保存到 group
- Live Production / transit 页面继续通过 `BindingSectorGroup.tradeStation` 继承该设定

## 边界

**In Scope**：
- `SectorConfirmBar.vue`：参数重新排序，新增「节点」checkbox 联动逻辑，新增 [添加] hub 按钮
- `SectorGroupList.vue`：统一 jump row 混排范围/候选/连接 pill，去掉三 tab
- `SectorOverviewPanel.vue`：集成 nodeEnabled、hub add popup、baseline 快照和重新计算输入
- 复制 `MapBindSectorMenu` 为 hub 添加菜单组件，prop 控制「定位地图」按钮显隐
- `autoGroup.ts`：`groupCleanSlate` / `groupIncremental` 接受 `generateHubs` 参数
- `GroupDraftInfo`：`recalcState` → `isPinned`
- `disabledCoverageSectorMacros` → `excludedDefaultAssignmentSectorMacros`
- 移除 `excludedDefaultConnectedGroupIds` 方案
- Col 3 option 生成规则改为所有命中范围 group 均可作为 option
- i18n locales 新增/调整 key

**Out of Scope**：
- 地图可视化（本次不改 map canvas）
- `MapBindingSectorGroup` 改动
- 扩展 bridge 算法目标到“自动联通所有玩家星区”
- E2E 测试

## 验收标准（DoD）

1. 「节点」checkbox 默认勾选；clean slate 下 disabled 且不能取消；可取消场景下取消后阈值和覆盖下拉 disabled，算法不生成新 pure hub
2. [添加] 按钮在编辑态可见，点击弹出 hub 选择菜单；无搜索列玩家星区，搜索时遍历全地图 sector；可选择非玩家星区作为新 hub；已是 hub anchor 的星区不可重复添加
3. 新增 hub draft 默认 unpinned 且可删除；baseline group 只能 unpin，不能真正删除
4. 编辑态不再显示三 tab；同一个 jump row 中混排金色范围、半金候选、绿色连接 pill
5. baseline 仅用粗边框区分，并作为 coverage 恢复来源；不再决定按钮行为
6. 范围星区 `×` 后变候选，候选 `+` 后变范围；若候选来自其他 group active coverage，按钮显示 `→` 并执行转入
7. 修改 group jumpRange 时，范围/候选联动采用 MapBinding 的 jumpRange 语义；baseline coverage 超出范围仍保留可恢复，跳数改回后可重新进入范围
8. hub anchor 作为绿色连接 pill；5 跳内未连接显示 `+`，已连接显示 `×`
9. 连接只由 `connectedGroupIds` 表达，不使用 `excludedDefaultConnectedGroupIds`
10. 非玩家星区 coverage 参与计算时保留，不进入 `excludedDefaultAssignmentSectorMacros`
11. Col 3 每张玩家星区 card 的 options 包含所有当前范围命中 group；无当前命中时包含最小扩展层 group；excluded group 可手选但不可默认
12. standalone 始终为最后 option，但不作为自动兜底默认值
13. 非玩家星区 hub 确认后沿用现有 `BindingSectorGroup.tradeStation` transit hub 逻辑，Live transit 页面可继承展示
14. `npm run build` 通过

## 未决项

无
