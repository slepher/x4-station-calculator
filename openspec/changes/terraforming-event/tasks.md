# terraforming-event Tasks

## 1. Presenter：事件分类与类型扩展

- [x] 1.1 新增 `TerraformingGoalKind = 'project' | 'stat' | 'cluster' | 'preventive'`
- [x] 1.2 新增 `TerraformingGoalEntry.relatedEventId?: string`
- [x] 1.3 新增 `TerraformingDraftTimelineEntry.isEvent: boolean`
- [x] 1.4 实现 `isStatAffectingEvent(project)` 分类函数
- [x] 1.5 实现 `getEventStatIds(data)` 提取所有事件 condition stat 集合

## 2. Presenter：编辑模式统一队列回放

- [x] 2.1 `startQueueEdit` 剥离已提交 event → `committedEventCounts` baseline
- [x] 2.2 `completedProjects` 初始化含 committedEventCounts
- [x] 2.3 单一回放路径：pushTaskEntry / pushEventEntry 写入统一 `replayEntries`
- [x] 2.4 event effects 即时进入 `completedProjects`，影响后续累积 state
- [x] 2.5 eventBlocked 阻断逻辑（检查 entry project conditions 是否产生与事件 stat 相关的 stat goal）
- [x] 2.6 `insertedEventIds` 去重，每个事件最多插入一次
- [x] 2.7 ONE_TIME 事件已在 completedProjects 基线中时跳过

## 3. Presenter：编辑模式预防型 goal

- [x] 3.1 goal 生成管线末尾对 3 个 quake 事件做 endStats 条件检查
- [x] 3.2 生成 `kind: 'preventive'`, `position: -1` 的 goal entry
- [x] 3.3 预防型 goal 关联 effects 方向相反的 project（复用 `goalCanSatisfyTaskIds`）
- [x] 3.4 累积 stats 脱离危险区后预防型 goal 自动移除
- [x] 3.5 预防型 goal 不与同类 stat goal 合并
- [x] 3.6 预防型 goal stat block 使用最终态 cumulativeStats + 触发条件高亮

## 4. Presenter：非编辑模式自动执行

- [x] 4.1 `executeAutoEvents()` — toggleProject/setProjectCount 后级联自动执行
- [x] 4.2 ONE_TIME 事件已完成情况下跳过
- [x] 4.3 loop 处理级联触发（事件 A 效果触发事件 B）
- [x] 4.4 进入集群自动执行仅在 executionLog 为空时触发且不补执行已有 log

## 5. Presenter：非编辑模式警报提示

- [ ] 5.1 execution log display pipeline 末尾检查 3 个 quake 事件
- [ ] 5.2 条件满足时输出警报 entry

## 6. UI：任务树 events group

- [x] 6.1 events group 不响应点击添加
- [x] 6.2 events group 不响应拖拽到 log 区域
- [x] 6.3 显示 count tag（ONE_TIME → "已触发"，REPEATABLE → "N次"）
- [x] 6.4 编辑模式显示 drag 占位符（视觉对齐）

## 7. UI：log 区域 event 渲染

- [x] 7.1 event 复用 task 渲染结构（order, name, statLines body）
- [x] 7.2 event 无 `.drag-handle`，vuedraggable `handle=".drag-handle"` 自然排除
- [x] 7.3 event 显示 `[EVENT]` tag
- [x] 7.4 非 edit 模式 event 显示 `[EVENT]` tag + 隐藏撤销按钮

## 8. 提交与构建

- [x] 8.1 `completeQueueEdit` 从 `draftReplayEntries`（含 tasks + events）一并写入 store
- [x] 8.2 `npm run build` 无编译错误
