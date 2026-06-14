# 自动星区划分合并版 — 任务列表

## 1. 合并旧状态模型

- [ ] 将 `GroupDraftInfo.recalcState` 完全替换为 `isPinned: boolean`
- [ ] 移除 per-group `exclude` 入口和算法分支
- [ ] 将 `disabledCoverageSectorMacros` 替换为 `excludedDefaultAssignmentSectorMacros`
- [ ] 删除 `excludedDefaultConnectedGroupIds` 方案和所有读写逻辑
- [ ] 确认非玩家 sector 不进入 `excludedDefaultAssignmentSectorMacros`

## 2. Hub Detection 与基础自动分组

- [ ] 保持 container-only 容量统计，合并 `modules[]` 与 `constructions[]`
- [ ] 保持 Tier 1 / Tier 2 / pure hub 判定
- [ ] `groupCleanSlate()` 支持 `generateHubs`
- [ ] `groupIncremental()` 使用每个已有 group 自己的 jumpRange
- [ ] 保持等距 score 差距小于 30% 的存疑规则
- [ ] 保持 Tier 2 超出覆盖跳数但 5 跳内自动吸收规则

## 3. MST 与 Bridge

- [ ] `computeGroupGraph()` 支持固定连接边输入
- [ ] Kruskal 只补充新边，不删除用户保留的 `connectedGroupIds`
- [ ] `buildSectorPath()` 保持 cluster-aware 0/1 跳语义
- [ ] `buildBridgePlanOptions()` 按玩家 sector component 生成 bridge unit
- [ ] 单向 superhighway 导致不可往返时拆分 bridge unit
- [ ] bridge 方案保留最大连通覆盖，最多展示前 5 个
- [ ] 单 bridge 方案自动采用，多 bridge 方案进入 Col 3 gate
- [ ] bridge draft group 确认后作为普通 group 持久化

## 4. SectorConfirmBar

- [ ] 编辑态按 `桥接 | 节点 | 阈值 | 覆盖` 排列控件
- [ ] 节点 checkbox 默认勾选
- [ ] clean slate 且无 baseline/pinned 输入时禁用节点 checkbox
- [ ] 节点关闭后禁用阈值与覆盖控件，并传入 `generateHubs=false`
- [ ] 桥接和覆盖下拉内嵌三态“保留” checkbox
- [ ] 结果态只读展示参数并只显示 [编辑]
- [ ] 编辑态显示 [添加] [取消] [计算]

## 5. SectorHubAddMenu

- [ ] 从 `MapBindSectorMenu` 复制并改造为 fixed overlay popup
- [ ] 支持点击背景和 Esc 关闭
- [ ] 支持隐藏“定位地图”按钮
- [ ] 无搜索时只列玩家星区
- [ ] 搜索时列全地图 sector，包含无玩家空间站 sector
- [ ] 已是任意 group anchor 的 sector 不允许重复添加
- [ ] 新增 hub draft 默认 `isPinned=true`、`baseline=false`、`isNew=true`
- [ ] 新增 hub draft 可删除

## 6. SectorGroupList Unified Pill Rows

- [ ] 移除 coverage/candidate/connected 三 tab
- [ ] 同一 jump row 混排 coverage、candidate、connected pill
- [ ] coverage 金色、candidate 半金色、connected 绿色
- [ ] baseline coverage pill 仅用粗边框标记
- [ ] 有玩家空间站显示实心点，无玩家空间站显示空心点
- [ ] candidate 只在编辑态显示
- [ ] 非 pinned group 的 pill 只读
- [ ] per-group 覆盖/连接保留关闭时对应 pill 只读但仍显示

## 7. Coverage / Candidate 操作

- [ ] coverage `×` 后从 active coverage 移出并成为 candidate
- [ ] candidate `+` 后加入当前 group active coverage
- [ ] candidate 已是其他 group active coverage 时显示 `→`
- [ ] 点击 `→` 后转入当前 group，并从原 group active coverage 移出
- [ ] jumpRange 增大只自动加入新增跳数层内可归属玩家 sector
- [ ] jumpRange 缩小移出超出范围的 coverage
- [ ] 已成为 hub anchor 的 sector 不显示为 coverage/candidate

## 8. Connection 操作

- [ ] hub anchor 显示为绿色 connected pill
- [ ] 5 跳内未连接 hub 显示 `+`
- [ ] 已连接 hub 显示 `×`
- [ ] `+` / `×` 双向同步 `connectedGroupIds`
- [ ] 连接修改即时反映 UI
- [ ] 自动连接仍使用桥接搜索跳数

## 9. Edit Baseline 与 Unpinned 行为

- [ ] 进入编辑态时保存完整 baseline snapshot
- [ ] [取消] 恢复 baseline snapshot
- [ ] baseline group 不可真正删除
- [ ] unpinned baseline group 保留展示但不参与计算
- [ ] unpinned baseline hub 可进入其他 pinned hub coverage
- [ ] unpinned baseline hub 被其他 group 吸收后设置 `enteredOtherGroupCoverage`
- [ ] `enteredOtherGroupCoverage=true` 时禁止重新 pin

## 10. Col 3 Bridge 与 Assignment

- [ ] 多 bridge 方案时 Col 3 只显示 bridge plan cards
- [ ] bridge plan unit 显示 locale sector 名与连接节点 jump pill
- [ ] 采用 bridge 后重新生成 ordinary assignment cards
- [ ] hub anchor sector 不生成 ordinary assignment card
- [ ] 当前覆盖范围命中的所有 group 均成为 option
- [ ] 无当前命中时仅最小扩展距离层 group 成为 option
- [ ] 扩展 option 不默认选中
- [ ] excluded group 可手动选但不可默认
- [ ] standalone 始终为最后 option 且不自动兜底
- [ ] 用户选择普通 option 不改变 Col 3 card 身份和顺序

## 11. 确认写入

- [ ] [确定] 只在所有未决 assignment 已选择后启用
- [ ] `createAutoGroups` UUID 优先、`sectorMacro` 兜底匹配已有 group
- [ ] 移除不在 draft 中的废弃 group
- [ ] 按最终 coverage 重建 `sector -> groupId`
- [ ] 重分配 `stationPlans`
- [ ] bridge/standalone/hub draft 都作为普通 `BindingSectorGroup` 写入
- [ ] 非玩家 hub 沿用 `bindSectorGroup` tradeStation transit 逻辑
- [ ] 确认后隐藏 confirm bars 并切换 Col 3 资源视图

## 12. i18n 与样式

- [ ] 添加节点、保留、添加 hub、转入、连接、断开相关中文 key
- [ ] 添加对应英文 key
- [ ] 删除或停止引用旧三 tab 文案
- [ ] 确认 popup、pill、checkbox 在窄屏下不重叠

## 13. 测试与验证

- [ ] 更新 unit 测试覆盖 `isPinned`、excluded default、all-hit option
- [ ] 更新 unit 测试覆盖 MST 固定边与 bridge unit component
- [ ] 更新 unit 测试覆盖 standalone ID 复用和非玩家 hub transit
- [ ] 增加 E2E 覆盖 `test.md` 中规划的关键 case
- [ ] `npm run test:unit -- tests/unit/auto-sector-group/autoGroup.spec.ts` 通过
- [ ] `npm run build` 通过
