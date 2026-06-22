# auto-sector-group-one-binding Tasks

## 1. Store 共享 draft

- [ ] 在 `useLiveProductionStore` 中维护 `autoGroupResult`
- [ ] 在 `useLiveProductionStore` 中维护 `calculationMode`
- [ ] 在 `useLiveProductionStore` 中维护 `prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`
- [ ] 在 `useLiveProductionStore` 中维护 `calcBaselinePillState`
- [ ] 实现 `needsAutoGroupRecalc`

## 2. 初始化路径

- [ ] 实现 `initAutoGroupDraft()`
- [ ] 有变化时调用 clean slate 或 incremental
- [ ] 无变化时调用 `buildAssignmentsFromBinding()`
- [ ] active binding 切换时重新初始化唯一 draft
- [ ] selected archive 切换且 guid 匹配时重新初始化唯一 draft
- [ ] 无有效 binding/archive 时清空 draft

## 3. SaveBindingPlan 持久化

- [ ] 新增 `appliedAutoGroupArchiveTime`
- [ ] 新增 `bridgeSearchJumpRange`
- [ ] 新增 `prefJumpRange`
- [ ] 新增 `prefThreshold`
- [ ] 更新 `normalizeState()` 保留新增字段

## 4. Presenter 改造

- [ ] Presenter 通过 `storeToRefs(liveStore)` 读取共享 draft
- [ ] 删除 presenter 内跨面板共享 draft 本地 ref
- [ ] Handler 统一读写 live store 共享 draft
- [ ] 明确并实现 `calculationBaseline` 作为 [重置] 数据源
- [ ] 明确并实现 `calcBaselinePillState` 作为 pill UI diff 基线
- [ ] 移除旧的 edit restore snapshot 语义；[退出] 只退出编辑态
- [ ] `handleColorChange` 不直接写持久化 binding
- [ ] `handleConfirm` 成功后写入 `appliedAutoGroupArchiveTime`
- [ ] `handleConfirm` 返回成功/失败，供 Live 切换模式

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
- [ ] 确认成功后返回展示模式

## 6. 按钮与 tab 行为

- [ ] 展示模式 [详情] 只进入计算模式，不触发计算
- [x] Sidebar [星区编辑详情] 持久化当前菜单选择，只进入详情模式，不触发计算
- [ ] 展示模式 [地图] 进入 Map binding，不修改 draft
- [ ] 计算模式 [返回] 返回展示模式，不提交、不计算、不重置
- [ ] [计算] / [快速计算] 更新 shared draft 和 `calculationBaseline`
- [ ] [重置] 从 `calculationBaseline` 恢复 shared draft
- [ ] [提交] 按 edit、无 result、trade station、uncertain assignment gate 返回成功/失败
- [ ] [编辑] 进入 edit 模式，不创建恢复 snapshot
- [ ] [退出] 返回 result 模式，不恢复 draft
- [ ] [添加枢纽] 只切换 hub add menu
- [ ] Trade Station card 列表随 group 增删同步
- [ ] 三个 retain 主开关同步到各 group retain 字段
- [ ] 计算后按 bridge/assignment、trade station、hub 顺序切换到首个待处理 tab

## 7. 构建验证

- [ ] 实现完成后运行 `npm run build`
