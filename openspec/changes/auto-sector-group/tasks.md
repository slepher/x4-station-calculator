# 自动星区划分 — 实现任务

## 1. Hub Detection Module

- [x] 创建 `src/store/logic/autoGroupHub.ts`：`detectStationHub()`、`getSectorPureHub()`
- [x] 实现 container-only 容量统计（排除 solid/liquid，仅 `cargo.type === 'container'`）
- [x] 实现 `constructions[]` 与 `modules[]` 合并计数
- [x] 实现 Tier 1 / Tier 2 分段评分：`score = cap / (1 + ln(1 + prod_lines))`
- [x] 纯 hub 判定：`qualified AND prod_lines == 0`
- [x] 导出 `HubDetectionConfig`（默认 threshold=5M）

## 2. Auto Grouping Algorithm

- [x] 创建 `src/store/logic/autoGroup.ts`：`groupCleanSlate()`、`groupIncremental()`
- [x] 实现 `groupCleanSlate()`：Phase A 纯 hub 建组 + 贪婪分配 + Phase B impure 处理 + Phase C Tier 2
- [x] 实现 `groupIncremental()`：每个已有 group 用自己的 jumpRange 吸收新 sector
- [x] 实现 `detectScoreTies()`：等距且 score 差距 < 30% → 存疑
- [x] 实现 `buildAssignmentResult()`：返回 `SectorAssignment[]`，含算法默认选中
- [x] 导出自分配/存疑/standalone 分类接口

## 3. Auto Grouping Store Integration

- [x] 在 `useSaveBindingStore.ts` 新增 `createAutoGroups(draft: GroupDraft[])` — 批量写入
- [x] 批量写入逻辑：`createGroup()` + `bindSectorGroup()` + `updateGroup()` + `setGroupConnection()`
- [x] jumpRange 扩展/回退逻辑：写入前计算实际 jumpRange

## 4. LiveProductionWorkbenchView Layout

- [x] 修改 `LiveProductionWorkbenchView.vue` overview 模式模板：替换 `EmpireWareFlowsDashboard` 位置
- [x] Col 1 (col-span-3)：保持 `SaveUploadPanel` + 新增分组覆盖跳数 input + 预制容量 input + `SaveList`
- [x] Col 2 (col-span-5)：新增 `SectorConfirmBar` + `SectorGroupList`
- [x] Col 3 (col-span-4)：新增 `AllocationConfirmBar` + `SectorAllocationList`（有未决时），或 `EmpireWareFlowsDashboard`（无未决时）
- [x] 预制值 binding：`DEFAULT_JUMP_RANGE = 2`、`CONTAINER_THRESHOLD` 默认值

## 5. Col 2 Components

- [x] 创建 `src/components/empire/sector-overview/SectorConfirmBar.vue`
- [x] 分组覆盖跳数输入（默认 2，仅影响新 group）；默认容量输入（hub 阈值）
- [x] [重新计算] 按钮：重跑算法 → 更新 Col 3
- [x] 创建 `src/components/empire/sector-overview/SectorGroupList.vue`
- [x] 星区 group 列表形态与 `MapBindingSectorGroup` 一致
- [x] 将 Pin/Unpin 改为 `normal / pin / exclude` 三态重新计算状态
- [x] 已持久化 group 默认 `pin`；新建 group 和 bridge draft group 默认 `normal`
- [x] `exclude` 在 [重新计算] 时排除该 anchor 作为 hub 和 bridge 候选
- [x] `pin` group 支持跳数编辑，且只作为 [重新计算] 输入
- [x] `pin` group 的 coverage/link pill 支持 `x/+` 暂停/恢复参与下次 [重新计算]，pill 保留显示
- [x] pinned coverage 只影响正常生成的 Col 3 card 默认选项，不额外生成 card，不锁定归属
- [x] Col 2 状态栏实现计算结果态/编辑输入态：[编辑]、[取消]、[计算]
- [x] 编辑输入态中 Col 3 主界面保留但加遮罩，并禁用所有 Col 3 操作
- [x] 编辑输入态中 Col 3 标题/status 文案切换为编辑输入提示
- [x] 新建 group 自动连接跳数最近的已有 group

## 6. Col 3 Components

- [x] 创建 `src/components/empire/sector-overview/SectorAllocationList.vue`
- [x] sector 卡片：上下列表候选选项，高亮选中（含「独立成组」作为最后选项）
- [x] 算法自动分配 → 对应选项默认选中（●）；存疑 → 全部 ○
- [x] 点击候选 → 切换选中 → Col 2 即时更新
- [x] 不区分「已分配」和「存疑」区，统一列表
- [x] 创建 `src/components/empire/sector-overview/AllocationConfirmBar.vue`
- [x] [确定] 按钮：全部存疑解决后可用 → 一次性写入 store

## 7. Jump Range Auto-Extend / Rollback

- [x] 分配 sector 距离 > group.jumpRange → 扩展 jumpRange + BFS 扩展覆盖
- [x] 撤销分配 → 检查该 group 是否仍需当前 jumpRange → 回退到最小值
- [x] UI 草稿状态追踪 `original_range` 和 `effective_range`

## 8. SaveList Bind Button

- [x] 修改 `SaveList.vue` 的 `bindArchive()` 函数
- [x] guid 无绑定 → 创建绑定 + 载入最新 + 运行分组 + 不跳转地图
- [x] guid 有绑定 → 载入存档 + 判定未分配 sector + 有则增量分配

## 9. SaveUploadPanel Upload Flow

- [x] 修改 `SaveUploadPanel.vue`（或 `LiveProductionWorkbenchView` 中的上传处理）
- [x] 无任何绑定 → 创建绑定 + 自动分组
- [x] 有绑定 + 新存档属当前 guid + 是最新时间 → 绑定迁移 + 增量分析
- [x] 有绑定 + 非最新 → 不分析不切换
- [x] 有绑定 + 其他 guid + 该 guid 无绑定 → 创建绑定不分析
- [x] 有绑定 + 其他 guid + 该 guid 有绑定 → 不做任何事

## 10. Build Validation

- [x] `npm run build` 通过
- [x] 如有编译错误，修复后重新 build 直至通过

## 11. 单向超高速处理

- [x] `buildSectorGraph` 通过 `render.lane_count` 检测单向超高速（lane_count=1 → 不建边）
- [x] 验证 `from_zone_id` 不可靠（Grand Exchange 的双向超高速均指向同一方向）
- [x] Savage Spur I/II 各归可达 group，不再存疑

## 12. 覆盖排他与数据过滤

- [x] 覆盖按 group 优先级排他（高分会 hub 先占）
- [x] 纯 hub anchor 互不侵犯
- [x] anchor 从自身 `coverageSectorMacros` 中移除
- [x] 过滤 `playerStations.length === 0` 的 trade-station-only sector

## 13. 确认后展示

- [x] `autoGroupConfirmed` 状态控制
- [x] 确认后隐藏 `SectorConfirmBar` / `AllocationConfirmBar`
- [x] Col 2 从 store 读取 group（只读，无 pin/跳数编辑）
- [x] Col 3 切换为 `EmpireWareFlowsDashboard`
- [x] Standalone 组完整创建（anchor + bind + auto-connect）

## 14. 测试与夹具

- [x] 提取脚本 `analysis/scripts/auto-sector-group/extract_save_for_tests.py`
- [x] 紧凑 fixture 格式：仅存档数据，type/cargo/graph 来自游戏数据
- [x] 21 TDD 测试覆盖：fixture 验证、group/anchor、覆盖排他、assignment 状态、单向超高速、anchor 过滤

## 15. 实时吸收联动

- [x] Col 3 选 absorb → 目标 group 覆盖立即加入该 sector（applyAbsorbToResult）
- [x] Col 3 默认 auto absorb → Col 2 目标 group 覆盖同步显示该 sector
- [x] 从旧 group 覆盖中移除
- [x] 若 extendsRange → 自动扩展 jumpRange
- [x] Col 2 覆盖列表实时刷新
- [x] 从 standalone 切回 absorb → 删除空 standalone group，仅清除该 standalone 派生候选

## 16. 独立成组联动

- [x] applyStandaloneToResult：创建新 group，覆盖仅从未决 sector 取
- [x] Auto-connect 双向连接最近已有 group
- [x] Col 3 其他可覆盖 sector 获得新 group 派生候选
- [x] 派生候选只追加，不移除初始候选
- [x] 若派生候选成为最佳候选，自动切换选中；用户仍可切回初始候选
- [x] standalone 撤销时按来源移除派生候选，并在剩余候选中重选最佳项

## 17. UUID 持久化与连接显示

- [x] createAutoGroups 使用草案 UUID，无需翻译
- [x] auto-connect 在草案中设置双向连接
- [x] 连接星区混入覆盖列表，仅颜色区分（amber/emerald）
- [x] Pill 样式对齐 MapBindingSectorGroup（rounded-full, pill-height）
- [x] 无新未分配 sector 时页面刷新直接进入确认状态

## 18. 测试

- [x] 23 TDD 测试覆盖：fixture、group/anchor、覆盖排他、assignment 状态、单向超高速、standalone/absorb 交互
- [x] 日志：cleanSlate auto-connect、createAutoGroups connecting、SectorGroupList connectedIds

## 19. Col 3 card 身份与顺序稳定

- [x] 为 Col 3 assignment card 增加生成时固定的 `displayBucket` / 等价字段
- [x] `unresolved` card 被用户选择后仍保持 `unresolved` 身份，不移动到 `resolved` 区
- [x] absorb / standalone 选择只更新 card 内部状态和 Col 2 draft，不改变 Col 3 既有 card 顺序
- [x] 只有 [重新计算] 或重新运行自动分组时才重建 Col 3 card 顺序和身份

## 20. Assignment baseline reset

- [x] Col 3 status bar 在 [确定] 左侧增加 [重置]
- [x] 进入普通 assignment 阶段时保存 baseline
- [x] 无 bridge、唯一 bridge 自动采用、多 bridge 用户选择后均进入 post-bridge baseline
- [x] [重置] 恢复 post-bridge baseline，不回到 bridge 选择前
- [x] 重置清除普通 assignment 阶段产生的 absorb、standalone、派生候选和跳数扩展影响

## 21. Pin jump range delayed effect

- [x] Pin/已有 group 修改跳数只更新 jumpRange 数值
- [x] 修改跳数不立即重算 coverage，不改变范围星区药丸
- [x] 修改跳数不立即重算 Col 3 assignments
- [x] 修改后的跳数只作为 [重新计算] 的初始输入数据
