# terraforming-view Tasks

## 1. Store 层类型与状态变更

- [x] 1.1 `useLiveProductionStore.ts`: `terraformingCompletedProjects` 从 `ref<Set<string>>` 改为 `Record<string, Map<string, number>>` (per-cluster)
- [x] 1.2 `useLiveProductionStore.ts`: 新增 `terraformingHousingBuilt` per-cluster
- [x] 1.3 `useLiveProductionStore.ts`: 新增 `terraformingHqClusterId` computed（HQ sector → cluster_id 映射）
- [x] 1.4 `useLiveProductionStore.ts`: 适配 `selectTerraformingCluster()` 内部引用新类型

## 2. terraformingTaskResolver 适配

- [x] 2.1 `TerraformingState.completedProjects` 类型从 `Set<string>` 改为 `Map<string, number>`
- [x] 2.2 `evaluateProject()` 中 `state.completedProjects.has(ref)` → `(state.completedProjects.get(ref) ?? 0) > 0`
- [x] 2.3 `resolveAvailableTasks()` 签名适配

## 3. Presenter 层扩展 (`useTerraformingPresenter`)

- [x] 3.1 新增 `clusterDisplayNames` computed: cluster.macro → maps.clusters.nameId → i18n
- [x] 3.2 新增 `clusterMatchesHq` computed: HQ archive sector cluster_id 匹配判定
- [x] 3.3 新增 `objectivesProgress` computed: 按 action 判定每项 objective 完成状态
- [x] 3.4 新增 `completedProjectCounts` computed (writable, 绑定 store `terraforminCompletedProjects`)
- [x] 3.5 新增 `housingBuilt` computed (writable, 绑定 store `terraformingHousingBuilt`)
- [x] 3.6 新增 `executionTimeline` computed: 组装右列按顺序的单条执行记录
- [x] 3.7 新增 `objectiveTextResolver` 辅助函数: textId 翻译 + textReplaces 替换
- [x] 3.8 新增 `neutralizeStatThreshold` 辅助函数: 查找 stat 的 neutral (state>=2) 阈值
- [x] 3.9 扩展 `TerraformingPresenterStore` 接口: 添加新的 store 字段/方法签名
- [x] 3.10 扩展 `TerraformingSectorPanelProps`: 添加 displayNames, matchesHq, objectivesProgress
- [x] 3.11 扩展 `TerraformingTaskListProps`: 适配 Map<string, number>, 添加 toggle/setCount emits
- [x] 3.12 更新 `TerraformingPresenterProps` + `UseTerraformingPresenterReturn`

## 4. TerraformingSectorPanel 组件（左列）

- [x] 4.1 创建 `src/components/empire/terraforming/TerraformingSectorPanel.vue`
- [x] 4.2 实现 accordion header: 星区 i18n 名称（从 props.displayNames）+ partName 类型标签
- [x] 4.3 实现「当前星区」药丸 tag（props.clusterMatchesHq 为 true 时显示）
- [x] 4.4 实现 accordion 单展开: 仅 selectedClusterId 匹配项展开，点击新项关闭旧项
- [x] 4.5 展开区渲染 objectives 列表: step 编号 | 描述文本 | ✅/⬜ 状态
- [x] 4.6 无选中 cluster 时显示占位提示

## 5. TerraformingTaskList 组件（中列）

- [x] 5.1 创建 `src/components/empire/terraforming/TerraformingTaskList.vue`
- [x] 5.2 实现按 groupOrder 分组 + 组名标题
- [x] 5.3 实现任务节点渲染: 状态图标 + 名称 + effects + 重复性标签 + 依赖/阻塞标注
- [x] 5.4 实现依赖树子节点缩进
- [x] 5.5 实现一次性任务 toggle: 点击切换 0↔1, emit toggleProject
- [x] 5.6 实现可重复任务 x-number-input: emit setProjectCount(id, count)
- [x] 5.7 实现已完成节点 ✅ 标记, 阻塞节点灰色/半透明
- [x] 5.8 无选中 cluster 时显示占位提示

## 6. TerraformingResourcePanel 组件（右列）

- [x] 6.1 将右列从三 tab 聚合视图改为执行序列视图
- [x] 6.2 每次 terraforming 执行生成一条独立记录，按真实点击顺序渲染
- [x] 6.3 单条记录支持展开，展示该次执行自己的 wares / price / deliveries / beforeStats / afterStats
- [x] 6.4 单条记录支持取消入口
- [x] 6.5 相邻且同组的记录仅显示组名标记，不折叠、不合并、不跨段聚合
- [x] 6.6 无选中 cluster 或无执行记录时显示占位提示

## 7. LiveProductionWorkbenchView 集成

- [x] 7.1 引入 `TerraformingSectorPanel` / `TerraformingTaskList` / `TerraformingResourcePanel`
- [x] 7.2 替换 `workbenchMode === 'terraforming'` 分支中左/中/右列占位为三个新组件
- [x] 7.3 绑定 props/emits: sector panel → selectCluster, task list → toggleProject/setProjectCount
- [x] 7.4 确保 3:5:4 grid 布局不变，切换无抖动

## 8. 构建验证

- [x] 8.1 `npm run build` 无编译错误

## 9. 交互行为完善

- [x] 9.1 条件阻止完成，不阻止撤销: toggle/X4NumberInput disabled 仅当 `!node.available && count === 0`
- [x] 9.2 级联撤销: `pruneBlockedCompletedProjects()` 在每次修改 completedProjects 后 re-resolve，移除 blocked 的已完项目
- [x] 9.3 X4NumberInput `:max` 受 `projectMaxCounts` 限制（基于 initialStats + effect min/max 约束）
- [x] 9.4 `terraformingCurrentStats` 应用已完成项目 effects（change 累加, value 设置, min/max clamp, floor 0）

## 10. 任务树构造修复

- [x] 10.1 `any:true` 前置不作为父子链（信息性依赖，仅标注 `⟸ 任一:`）
- [x] 10.2 仅 group 前置的项目归入 roots/blocked（不丢失）
- [x] 10.3 `blocked` 去重（`blockedSet` guard）
- [x] 10.4 Vue 模板按 `topLevelNodeIds` 过滤 group 列表（子节点仅缩进显示）
- [x] 10.5 predecessor 仅在 cluster projectIds 中存在时有效

## 11. blockedProjects/removedProjects

- [x] 11.1 XSD 校对: `blockedProjects` 语义反转（阻塞直到完成，非完成后阻塞）
- [x] 11.2 被 `removedProjects` 移除的项目其 `blockedProjects` 不再生效

## 12. I18n 全面实现

- [x] 12.1 所有 UI 硬编码中文 → `terraforming.*` namespace keys
- [x] 12.2 `src/locales/{zh-CN,en}.json` 添加 ~30 个 `terraforming.*` key
- [x] 12.3 task node name 翻译: walkNode 用 `project.nameId` → `resolveTerraformingText`
- [x] 12.4 effects 翻译: stat 名用 `stat.nameId` 替换; `(min:/max:)` → i18n
- [x] 12.5 blockedReason 翻译: `depends:` 项目名 + stat 名翻译; `(removed)/(blocking)` 后缀 i18n
- [x] 12.6 `groupNames` 翻译: `vI18nLookup(nameId)`
- [x] 12.7 重复性标签 i18n: `oneTime`/`repeatable`/`cooldown`
- [x] 12.8 stats 卡片 i18n: `statDisplayNames` (Map<statId, i18nName>)
- [x] 12.9 面板标题/按钮/占位/表头全量 i18n
- [x] 12.10 `$PilotTrainingCourseProject` 变量解析为 `trn_pilot`（dependency label 正确显示）

## 13. Objective 进度修正

- [x] 13.1 `objective.neutralize`: 改用 `isStatNeutralized`（range 判定，含动态 stat 的 state=0 无害区间）
- [x] 13.2 `objective.build_housing`: 改用 `currentStats.population`（自动随项目 effects 累加）
- [x] 13.3 `objective.relocate`: 改用 `sectorMacro` 而非不存在的 `sector.id`

## 15. Per-Cluster 状态隔离

- [x] 15.1 `terraformingCompletedProjectsByCluster`: `Record<string, Map<string, number>>` per-cluster 存储
- [x] 15.2 `terraformingHousingBuiltByCluster`: `Record<string, number>` per-cluster 存储
- [x] 15.3 `terraformingCompletedProjects`/`terraformingHousingBuilt` 改为 computed 读取当前 clusterId 对应数据
- [x] 15.4 setter 写入对应 clusterId 条目，切换星区不丢失已完成项目

## 16. Events 分离与交互修正

- [x] 16.1 Events 与普通项目分离渲染：stats → events → 项目任务树
- [x] 16.2 全部 events 显示（含阻塞），阻塞事件显示触发条件
- [x] 16.3 有 effects 的 events 可交互（toggle/X4NumberInput）
- [x] 16.4 无 effects 的 events 仅显示副作用（`sideEffects[].chance + setback`）
- [x] 16.5 完成即永久：移除 `pruneBlockedCompletedProjects` 级联撤销
- [x] 16.6 已完成项目永不变灰（`blocked` CSS 仅对 `count === 0` 生效）

## 17. Known Limitations

- [x] 17.1 文档记录 MD 动态事件未实现（温室气体锁温、动态注热）
- [x] 17.2 文档记录 research 解锁未检查
- [x] 17.3 `projectMaxCounts` 基于 `cluster.initialStats` 计算上限，effect min/max clamp

## 18. 游戏方块式 state/需求展示

- [x] 18.1 新增 `TerraformingStatScale.vue`，复现游戏中的彩色方块展示
- [x] 18.2 `useTerraformingPresenter.ts`: 新增 `statScaleModels`
- [x] 18.3 `useTerraformingPresenter.ts`: 新增 `conditionScaleModels`
- [x] 18.4 Presenter: 按 `ranges.start/end/state/rgb` 计算当前 value 所在 state
- [x] 18.5 Presenter: 将 `condition.min/max` 解释为 state 区间，不再按真实 value 文本显示
- [x] 18.6 Presenter: 将 `condition.minvalue/maxvalue` 解释为真实 value 阈值，并映射到对应方块
- [x] 18.7 `TerraformingTaskList.vue`: 在项目条件区域接入 `TerraformingStatScale`
- [x] 18.8 stats 卡片区域：统一使用 `TerraformingStatScale` 展示当前 stat
- [x] 18.9 `objective.neutralize` 展示改为复用同一套方块组件，不再单独拼文本阈值
- [x] 18.10 tooltip 文案明确区分 “state 需求” 与 “value 需求”
- [x] 18.11 无 `ranges` 的 stat（如 `population`）改为数字展示，不再显示方块
- [x] 18.12 条件方块当前值命中时仅边框高亮，不使用位移
- [x] 18.13 条件方块当前值未命中时，整组需求方块显示为空心，不额外补出当前值方块
- [x] 18.14 可重复/冷却项目标签在文案后直接显示 `duration`，格式化为 `HH:MM:SS`
- [x] 18.15 可用态与阻塞态前置条件统一使用 `需要: ...` 文案，不再显示箭头符号
- [x] 18.16 项目前置条件进入与 stat 条件相同的 `condition-list`，统一条目边框/背景样式
- [x] 18.17 条件 stat 改为显示完整状态方块图，并以连续片段外框标识命中条件区间
- [x] 18.18 条件区外框与内部方块保留固定间距，圆角与方块圆角保持视觉匹配

- [x] 14.1 `Biosphere=false` cluster 正确跳过 (GetsuFune, ScalePlateGreen)
- [x] 14.2 `EnergyProject` 替换 (BlackHoleSun→pwr_wind, AtiyasMisfortune→pwr_geothermal)
- [x] 14.3 `Ignore*` flags (OceanOfFantasy: IgnoreHumidity, IgnoreMethane)
- [x] 14.4 温度项目仅当 temperature stat 存在时添加
- [x] 14.5 `atm_outgassing` 仅当 airpressure stat 存在且 < 5 时添加
- [x] 14.6 8.0-Diplomacy + 9.0-Empire-beta 双版本数据重建

## 19. 运行时派生 stat 与动态项目池

- [x] 19.1 `useLiveProductionStore.ts`: 将当前 stat 计算升级为统一 `terraformingRuntimeState` 管线，而非仅 `initialStats + effects`
- [x] 19.2 在运行时 stat 管线中实现 airpressure 派生：`floor((O2 + CH4 + CO2) / 4) + AddedAtmoPressure`
- [x] 19.3 在运行时 stat 管线中实现 `evt_globalwarming_*` 的重复回推逻辑，并接入 cluster `GlobalWarmingLimit`
- [x] 19.4 基于当前 runtime stats + Ignore 开关，动态重算 `SetupStatDependentProjects` 项目池
- [x] 19.5 `terraformingTaskResolver.ts`、Presenter 与 Vue 共用同一份 runtime stats / runtime project pool，不再各自猜测缺失 stat
- [x] 19.6 若 cluster 显式忽略某 stat，或该 stat 被 mission patch 删除，则隐藏对应条件显示，并从可用性判定中排除
- [ ] 19.7 回归验证 `AtiyasMisfortune` 的 airpressure / warming / 动态项目显示与可用性
- [ ] 19.8 回归验证 `OceanOfFantasy` 的 `IgnoreHumidity` / `IgnoreMethane` 隐藏语义

## 20. 可重复项目输入上界收敛

- [x] 20.1 移除 `projectMaxCounts` 预测逻辑，不再为 `X4NumberInput :max` 预演未来状态
- [x] 20.2 可重复项目输入改用轻量上界 `99`
- [x] 20.3 保持实际执行语义由 store execution log 与 runtime state 控制，而非 presenter 预测总上限

## 21. 右列执行序列与取消校验

- [x] 21.1 store 新增 per-cluster `terraformingExecutionLog`
- [x] 21.2 中间任务区的执行操作同步追加 execution log
- [x] 21.3 Presenter 基于 execution log 逐条回放 runtime state，生成 `executionTimeline`
- [x] 21.4 Presenter 为每条记录生成 beforeStats / afterStats / resources / deliveries
- [x] 21.5 Presenter 生成“相邻同组组名标记”，但不折叠不合并记录
- [x] 21.6 右侧单条取消时，按该记录之后的顺序逐条重放并校验后续记录
- [x] 21.7 取消预演改为按需计算，不在 `executionTimeline` 渲染期预先为每条记录计算
- [x] 21.8 组件侧按 `entryId` 缓存单条取消预演结果，execution log 变化后失效
- [ ] 21.9 回归验证跨组插入时同组标记会断开，后续同组重新开启新段
