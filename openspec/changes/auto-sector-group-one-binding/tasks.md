# auto-sector-group-one-binding Tasks

## 1. Store 共享 draft

- [ ] 在 `useLiveProductionStore` 中维护 `autoGroupResult`
- [ ] 在 `useLiveProductionStore` 中维护 `calculationMode`
- [ ] 在 `useLiveProductionStore` 中维护 `prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`
- [ ] 在 `useLiveProductionStore` 中维护从 saved binding groups 构造的 `calcBaselinePillState`
- [ ] 在 `useLiveProductionStore` 中维护 `virtualStationDrafts`
- [ ] 在 `useLiveProductionStore` 中维护 virtual station draft context 初始化 key
- [ ] 实现 `needsAutoGroupRecalc`

## 2. 初始化路径

- [ ] 实现 `initAutoGroupDraft()`
- [ ] 有变化时调用 clean slate 或 incremental
- [ ] 无变化时调用 `buildAssignmentsFromBinding()`
- [ ] active binding 切换时重新初始化唯一 draft
- [ ] selected archive 切换且 guid 匹配时重新初始化唯一 draft
- [ ] 无有效 binding/archive 时清空 draft
- [ ] 生成 `autoGroupResult.groups` 后初始化 virtual station draft
- [ ] 从当前 binding 中无 `saveStationCode` 的 station plans 初始化 virtual station draft
- [ ] 同一 context 下组件挂载、tab 切换、Live/Map 切换不得覆盖 virtual station draft
- [ ] [计算] / [快速计算] 后保留 virtual station draft 并重算 group 归属
- [ ] 支持未分组 virtual station draft 状态

## 3. SaveBindingPlan 持久化

- [ ] 新增 `appliedAutoGroupArchiveTime`
- [ ] 新增 `bridgeSearchJumpRange`
- [ ] 新增 `prefJumpRange`
- [ ] 新增 `prefThreshold`
- [ ] 更新 `normalizeState()` 保留新增字段
- [x] 将 save binding state 版本升至 2
- [x] 迁移旧 group `id` 引用为定位星区 `sectorMacro`
- [x] 持久化 `BindingSectorGroup` 移除独立 `id` 字段
- [x] `connectedGroupIds` 与 `stationPlans.groupId` 改为保存 hub `sectorMacro`

## 4. Presenter 改造

- [ ] Presenter 通过 `storeToRefs(liveStore)` 读取共享 draft
- [ ] 删除 presenter 内跨面板共享 draft 本地 ref
- [ ] Handler 统一读写 live store 共享 draft
- [x] 移除 `calculationBaseline` 作为 [重置] 数据源
- [x] 实现 [重置] 基于 saved binding groups + 当前参数重算 shared draft
- [x] 明确并实现 `calcBaselinePillState` 作为 saved binding UI diff 基线，覆盖 group 新增高亮和 pill diff
- [ ] 移除旧的 edit restore snapshot 语义；[退出] 只退出编辑态
- [ ] `handleColorChange` 不直接写持久化 binding
- [x] shared draft 保留 one-map 对独立成组 / bridge 新 hub 分配的 `group.color`
- [ ] `handleConfirm` 成功后写入 `appliedAutoGroupArchiveTime`
- [ ] `handleConfirm` 成功时先应用 auto groups，再同步 virtual station drafts
- [ ] virtual station apply 只同步无 `saveStationCode` 的 station plans
- [ ] virtual station apply 不修改带 `saveStationCode` 的 save station plans
- [ ] `handleConfirm` 返回成功/失败，供 Live 切换模式
- [x] 二次确认 popup 使用当前组件可生效的弹窗与主次按钮样式
- [x] 确认成功后清理 result groups 的 `isNew` 等未保存 transient 高亮标记
- [x] 确认成功后将 `hasChanges` 与 uncertain assignment 提示解耦，draft 与 binding 一致时按钮置灰
- [x] 实现 pin / unpin 只修改当前 shared draft；[重置] 会丢弃临时 pin / unpin 并按 saved binding 重算
- [x] pin / unpin 按钮只出现在 hub/group card，assignment card 不显示该按钮
- [x] result/edit 模式的 hub/group card 都显示 pin / unpin 按钮
- [x] 实现 unpin 保留 hub/group card，仅切换 `isPinned=false`
- [x] 实现 unpin 将 hub 定位星区加入 assignment，默认 standalone
- [x] 实现 pin 将 hub 定位星区从 assignment 移除
- [x] 确保 `isPinned=false` group 不作为下一次显式计算的 pinned base input
- [x] 确保单纯 pin / unpin 不产生可持久化 dirty，`hasChanges` 保持 false
- [x] 确保 unpin 不调用 `applyStandaloneToResult()`，不抢占其他 coverage
- [ ] 确保 assignment 显式「独立成组」仍保留既有 standalone coverage / derived candidates 行为
- [ ] `applyStandaloneToResult()` 追加扩展跳数 derived absorb candidates（`> prefJumpRange` 且 `≤ MAX_UNCERTAIN_JUMP`，`extendsRange=true`）
- [ ] `applyStandaloneToResult()` 追加候选后：新 hub range 内且比当前选中更优 → 切换；不更优/平局 → 保持；当前为显式 standalone 选择 → 只追加 option 不切换；新 hub 扩展且无 range 内命中 → `selectedOptionIndex=null`、`status='uncertain_extend'`；不强制切换到全局 best
- [x] `SectorAssignment` 真实选择状态改用 `selectedSectorMacro`，standalone 选自身 sector，absorb 选 hub sector
- [x] 暂时保留 `selectedOptionIndex` 作为 presenter/UI 兼容派生字段
- [x] Allocation UI `select-option` 事件改为传递 `selectedSectorMacro`，presenter 再映射到当前 option
- [x] option 插入、删除、重排时按 `selectedSectorMacro` 保留选择，覆盖显式 standalone 不被 derived extension 清空的回归
- [ ] absorb 到其他 group 时按 `sectorMacro` 删除自身 hub，并清理 connections / assignment options / trade station
- [ ] `displayBucket` 扩展为三态 `'resolved' | 'unresolved' | 'unpin'`
- [ ] unpin 生成 assignment 时设 `displayBucket='unpin'` + `unpinOrder`
- [ ] `sortAssignmentsForDisplay` 按 `displayBucket` 分组排序，unpin 组内按 `unpinOrder` 排列
- [ ] `resolveUncertainAssignment` 不清除 `displayBucket` 和 `unpinOrder`，absorb 后 unpin assignment 留在顶部
- [ ] `AutoGroupResult` 新增 `sectorStationCandidates: Record<string, TradeStationCandidate[]>`
- [ ] `groupCleanSlate` / `groupIncremental` / `buildAssignmentsFromBinding` 生成 result 时预计算所有 player sector 的 station 候选
- [ ] Vue Trade Station 栏从预计算数据按 hub group `sectorMacro` 过滤显示
- [ ] Standalone option 显示该 sector 排序最靠前且 `containerCap > 0` 的候选（station code + containerCap）
- [ ] 不存在 `containerCap > 0` 候选时 standalone option 只显示「独立成组」

## 5. Live 双模式

- [ ] 实现 `liveMode: 'display' | 'calculate'`
- [ ] 展示模式渲染 `[存档 3fr] | [星区 4fr] | [资源 5fr]`
- [ ] 展示模式星区列显示桥接跳数、覆盖跳数和 Hub 阈值
- [ ] 详情按钮只切换到计算模式，不触发计算
- [x] Live sidebar 分隔线区域新增星区编辑详情入口
- [x] `ActiveViewState.activeBindingWorkbench` 增加星区编辑详情专用值
- [x] Sidebar 详情入口设置并持久化星区编辑详情 workbench 选择
- [x] `workbenchMode` 支持星区编辑详情模式并渲染 `AutoSectorGroupPanel layout="columns"`
- [x] 将星区编辑详情加入 `activeBindingStation` 的固定模式保护列表，避免被 station/overview fallback 覆盖
- [x] Sidebar 详情入口复用详情按钮计算语义：不触发计算、不初始化 draft、不修改 shared draft
- [x] Sidebar 详情入口在 `autoGroupResult=null` 时置灰禁用
- [x] Sidebar 详情入口在 `needsAutoGroupRecalc=true` 时显示红点提示
- [x] 新增与蓝图配方、研究风格一致的星区编辑 SVG 图标
- [ ] 计算模式渲染 `AutoSectorGroupPanel layout="columns"`
- [x] 确认成功后确认按钮置灰，不跳转

## 6. 按钮与 tab 行为

- [ ] 展示模式 [详情] 只进入计算模式，不触发计算
- [x] Sidebar [星区编辑详情] 持久化当前菜单选择，只进入详情模式，不触发计算
- [ ] 展示模式 [地图] 进入 Map binding，不修改 draft
- [ ] 计算模式 [返回] 返回展示模式，不提交、不计算、不重置
- [x] [计算] / [快速计算] 更新 shared draft，不再捕获计算完成 baseline
- [x] [重置] 从 saved binding groups + 当前参数重算 shared draft
- [x] [重置] 重建 virtual station drafts 并按重算后 groups 归属
- [x] [重置] 后若存在 pending bridge plans，切换到 allocation/bridge 页面
- [ ] [提交] 按 edit、无 result、trade station、uncertain assignment gate 返回成功/失败
- [ ] [编辑] 进入 edit 模式，不创建恢复 snapshot
- [ ] [退出] 返回 result 模式，不恢复 draft
- [ ] [添加枢纽] 只切换 hub add menu
- [ ] Trade Station card 列表随 group 增删同步
- [x] 三个 retain 主开关同步到各 group retain 字段
- [x] 三个 retain 主开关由 groups 聚合派生，mixed 时新增 hub 默认 off
- [ ] 计算后按 bridge/assignment、trade station、hub 顺序切换到首个待处理 tab
- [x] unpin 生成的 assignment 排在 assignment 列表顶部，并按 unpin 先后顺序排列
- [x] 显式计算后此前 unpin 的 sector 若重新成为 hub，则归一为 pinned hub 并清除对应 unpin assignment
- [ ] Group card jumpRange 增大时增量重算受影响 sector 的 options（`extendsRange` 从 true 变 false）
- [ ] Group card jumpRange 增大时按选择规则更新受影响 sector 的 `selectedOptionIndex`（新 range 内更优才切换）
- [ ] Group card jumpRange 减小时增量重算受影响 sector 的 options（`extendsRange` 从 false 变 true）
- [ ] Group card jumpRange 减小时按选择规则更新受影响 sector 的 `selectedOptionIndex`（无 range 内命中时 `null` + `uncertain_extend`）

## 7. 构建验证

- [ ] 实现完成后运行 `npm run build`
