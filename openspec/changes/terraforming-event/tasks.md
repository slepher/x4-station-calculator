# terraforming-event Tasks

## 1. Presenter：事件分类与类型扩展

- [x] 1.1 新增 `TerraformingGoalKind = 'project' | 'stat' | 'cluster' | 'preventive'`
- [x] 1.2 新增 `TerraformingGoalEntry.relatedEventId?: string`
- [x] 1.3 新增 `TerraformingDraftTimelineEntry.isEvent: boolean`、`source?: 'committed' | 'draft'`
- [x] 1.4 实现 `isStatAffectingEvent(project)`
- [x] 1.5 实现 `getEventStatIds(data)`
- [x] 1.6 实现 `checkAllConditions(conditions, stats, statDefs)`

## 2. Presenter：编辑模式统一队列回放

- [x] 2.1 `startQueueEdit` 剥离已提交 event → `committedEventCounts`
- [x] 2.2 `completedProjects` 纯净初始化（不含 committed events）
- [x] 2.3 单一回放：pushTaskEntry / pushEventEntry 写入统一 `replayEntries`
- [x] 2.4 event effects 即时进入 `completedProjects`
- [x] 2.5 eventBlocked 阻断（position 0 不受影响）
- [x] 2.6 `insertedEventIds` 去重
- [x] 2.7 ONE_TIME 事件已在 committedEventCounts 中跳过
- [x] 2.8 集群 `taskProjectIds` 过滤事件可用性

## 3. Presenter：planDisplayEntries

- [x] 3.1 预防型 goal 放开头（`position: -1`）
- [x] 3.2 stat goal / project goal 交错在依赖 task 上方
- [x] 3.3 cluster goal 放队尾
- [x] 3.4 goal position 基于 `draftReplayEntries` remap（含 events）

## 4. Presenter：预防型 goal

- [x] 4.1 quake 事件 endStats 条件检查
- [x] 4.2 `kind: 'preventive'`, `position: -1`
- [x] 4.3 关联反向 project（`goalCanSatisfyTaskIds`）
- [x] 4.4 脱离危险区自动移除
- [x] 4.5 不与同类 stat goal 合并

## 5. Presenter：非编辑模式

- [x] 5.1 `executeAutoEvents()` — 级联 loop 自动执行
- [x] 5.2 ONE_TIME 已完成后跳过
- [x] 5.3 集群 `taskProjectIds` 过滤
- [x] 5.4 进入集群仅 executionLog 为空时触发

## 6. Presenter：goal 过滤祖先遍历修复

- [x] 6.1 `goalFilteredTaskIds` 树父节点遍历改用 `found` flag

## 7. UI：任务树

- [x] 7.1 events group 不响应点击/拖拽
- [x] 7.2 标签显示（ONE_TIME → "已触发"，REPEATABLE → "N次"）

## 8. UI：log 区域 event 渲染

- [x] 8.1 event 复用 task 渲染结构（order, name, statLines）
- [x] 8.2 `◇` 占位替代 `.drag-handle`
- [x] 8.3 `[EVENT]` tag
- [x] 8.4 非 edit 模式 event 显示 tag + 隐藏撤销按钮

## 9. 提交与构建

- [x] 9.1 `completeQueueEdit` 从 `draftReplayEntries` 写出
- [x] 9.2 `npm run build` 无编译错误
- [x] 9.3 TDD 测试 3/3 通过

## 10. Bug 修复：auto-event 重触发 & 顺序 stats 重放

- [x] 10.1 `executeAutoEvents()` 改用 `computeSequentialStatsFromLog` 按执行顺序重放 stats，解决 repeatable 事件在 interleaved 场景（cloud→warming→cloud→warming）下不能重触发
- [x] 10.2 `executionTimeline` 的 `evaluateEntry` 改用顺序 stats 计算 `beforeStats`，使 second occurrence 的条件显示不从累积态取错误值
- [x] 10.3 `executionTimeline` 的 `statLines` 改用顺序 stats 计算 before/after 值
- [x] 10.4 `computePlanDraftEntries` 中 `insertedEventIds` 改用 `repeatCooldown === null` 判断，允许 repeatable 事件重复插入
- [x] 10.5 `computePlanDraftEntries` 的条件检查改用 `getSequentialStats()` 替代累积 `computeTerraformingRuntimeStats`
- [x] 10.6 `terraformingRuntime.ts` 新增 `computeSequentialStatsFromLog(cluster, log, data)` 和 `applyProjectToStats`
