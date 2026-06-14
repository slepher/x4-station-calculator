# 自动星区划分增强 — 任务列表

## 1. 已完成基础改造

- [x] `GroupDraftInfo.recalcState` → `isPinned: boolean`
- [x] `disabledCoverageSectorMacros` → `excludedDefaultAssignmentSectorMacros`
- [x] `groupCleanSlate` 和 `groupIncremental` 支持 `generateHubs: boolean`
- [x] `SectorConfirmBar` 增加节点 checkbox 与 [添加] 入口
- [x] 初版 `SectorHubAddMenu.vue`
- [x] 初版 baseline 快照
- [x] 初版 Col 3 all-hit option 生成
- [x] `npm run build` 通过
- [x] `npm run test:unit -- tests/unit/auto-sector-group/autoGroup.spec.ts` 通过

## 2. 当前实现修正：Hub 添加菜单

- [x] 将 `SectorHubAddMenu` 改为 popup / popover / modal，不得作为普通页面流元素显示
- [x] 增加关闭行为：选择后关闭、点击外部关闭、Esc 关闭
- [x] 无搜索时只列玩家星区
- [x] 搜索时遍历全地图 sectors，包含无玩家空间站 sector
- [x] 已是任意 group anchor 的 sector 不显示 `+`
- [x] 新建 hub draft 支持删除

## 3. 当前实现修正：统一 pill 行

- [x] 移除 `覆盖星区 | 候选星区 | 连接星区` 三 tab UI 和 `activeTabByGroup`
- [x] 合并 coverage / candidate / connected 为同一个 jump row 渲染
- [x] 同一 jump row 内混排金色范围、半金候选、绿色连接 pill
- [x] baseline 只用粗边框区分，不改变按钮行为
- [x] 移除 inactive/default-off 的 dashed / 低透明视觉
- [x] 连接星区只用绿色区分，不显示额外 link 图标

## 4. 当前实现修正：范围/候选操作

- [x] 当前 group active coverage 点击 `×` 后变为 candidate
- [x] 当前 group candidate 点击 `+` 后加入 active coverage
- [x] candidate 若已是其他 group active coverage，按钮显示 `→`
- [x] 点击 `→` 时将该 sector 转入当前 group active coverage，并从原 group active coverage 移出
- [x] 原 group 中该 sector 变为常规候选（若仍在 jumpRange 内）
- [x] candidate 只是其他 group candidate 时保持普通 `+`，不从其他 group 移除

## 5. 当前实现修正：JumpRange 联动

- [x] 修改 group jumpRange 时复用 MapBinding 的覆盖半径语义
- [x] jumpRange 增大时，新范围内符合条件的玩家星区自动加入 active coverage
- [x] jumpRange 缩小时，超出范围的 coverage 从 active coverage 移出
- [x] jumpRange 改回覆盖时，候选可重新加入 active coverage
- [x] 修改 coverage jumpRange 不增删连接、不影响绿色连接 pill 可见性

## 6. 当前实现修正：连接行为

- [x] 移除 `excludedDefaultConnectedGroupIds` 类型字段与所有读写逻辑
- [x] 连接由 `connectedGroupIds` 直接表达
- [x] 5 跳内未连接 hub 显示绿色连接候选 pill，按钮 `+`
- [x] 已连接 hub 显示绿色 connected pill，按钮 `×`
- [x] 点击 `+` 加入 `connectedGroupIds`（双向同步）
- [x] 点击 `×` 从 `connectedGroupIds` 移除（双向同步）
- [x] UI 立即反映 `+` / `×` 状态变化，不等待 MST
- [x] connection 不按 baseline 区分行为
- [x] 自动连接仍使用桥接搜索跳数

## 7. 当前实现修正：excludedDefaultAssignmentSectorMacros

- [x] 写入 `excludedDefaultAssignmentSectorMacros` 前必须判断 sector 有玩家空间站
- [x] 新增 hub draft、coverage 转移、重新计算输入构建中，非玩家 sector 不进入 `excludedDefaultAssignmentSectorMacros`
- [x] 非玩家 coverage 参与计算时全部保留
- [x] Col 3 默认选项生成时，excluded 玩家 sector 不可默认选中对应 group，但仍可手动选择
- [x] 修复重新计算时 excluded default 信息丢失的问题

## 8. 当前实现修正：unpinned baseline hub

- [x] unpinned baseline hub 保留展示数据但不作为 hub 输入参与计算
- [x] unpinned baseline hub 可作为其他 pinned hub 的 coverage/candidate 对象
- [x] unpinned baseline hub 被其他 hub 吸收后标记 `enteredOtherGroupCoverage`
- [x] `enteredOtherGroupCoverage=true` 时禁止重新 pin

## 9. 当前实现修正：Col 3 option

- [x] hub anchor sector 不生成普通 assignment card
- [x] 当前范围命中的所有 group 均成为该 sector option
- [x] 无当前范围命中时，仅最小扩展距离层的 group 成为 option
- [x] 扩展命中 option 不默认选中
- [x] standalone 始终作为最后 option，但不作为自动兜底默认值
- [x] 基线星区在无命中/无扩展时可按基线 group 重新吸收

## 10. 非玩家星区 hub 与 transit 继承

- [x] 新 hub 可使用无玩家空间站的 sector 作为 anchor
- [x] 确认写入继续调用现有 `bindSectorGroup`
- [x] 不新增虚拟 stationPlan，不修改 save archive 原始记录
- [x] Live transit 页面通过现有 `BindingSectorGroup.tradeStation` 路径继承该 hub

## 11. i18n 与文案

- [x] 删除不再使用的 tab 文案 key 或停止引用
- [x] 添加 popup、转入按钮、连接/断开、玩家/非玩家星区 tooltip 文案
- [x] 确认英文与中文 locale JSON 格式正确

## 12. Build 验证

- [x] `npm run build` 通过
- [x] 确认无 TypeScript 编译错误
- [x] 确认 locales JSON 格式正确

## 13. 保留 Checkbox 实现

- [x] SectorConfirmBar: 在桥接下拉和覆盖下拉字段框内各自嵌入「保留」checkbox
- [x] 保留 checkbox 默认勾选，取消时提交标志为全自动生成
- [x] 保留 checkbox 三态总控（全选/部分选/全不选），支持 indeterminate
- [x] 结果态不显示节点与保留 checkbox，仅显示 [编辑] 按钮
- [x] 每个 group pin 按钮左边添加 `[覆盖☑] [连接☑]` checkbox，标签为「覆盖」「连接」
- [x] group 未 pin 时 per-group 保留 checkbox disabled
- [x] 保留 toggle 纯 UI 状态（v-show），不触发数据重算
- [x] 覆盖☑ 关闭：coverage/candidate pill 只读（无 ×/+/→ 按钮），视觉同 unpin
- [x] 连接☑ 关闭：connected pill 只读（无 +/× 按钮），视觉同 unpin
- [x] connected pill 始终可见，不受保留状态影响隐藏
- [x] 候选 pill 仅在编辑态显示，计算结果态不显示
- [x] 计算时 connectedGroupIds 视为固定 MST 边，Kruskal 仅添加新边
- [x] SectorHubAddMenu 新增 hub 默认 `isPinned: true`
