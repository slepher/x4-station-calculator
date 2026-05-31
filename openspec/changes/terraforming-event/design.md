# terraforming-event Design

## 架构

本变更延续 `store -> presenter -> vue` 三层结构，事件自动化逻辑集中在 presenter。

```
store
  useTerraformingStore
    └── executionLog / draftEntries（不变）

presenter
  useTerraformingPresenter
    ├── goal 生成 / 合并 / 定位（不变）
    ├── 事件分类（effects > 0 / effects = 0）
    ├── 统一队列回放 + auto-event 插入
    ├── stat goal 阻断检查
    ├── 预防型 goal 生成
    ├── 非编辑模式自动执行
    └── goal 过滤祖先遍历修复

vue
  TerraformingTaskList
    └── events group 移除手动操作入口（tag 展示替代按钮）
  TerraformingResourcePanel
    └── auto-event 复用 task 渲染结构，◇ 占位替代 drag-handle
```

## 核心模型

### 事件分类

```ts
function isStatAffectingEvent(project: TerraformingProject): boolean {
  return project.effects.length > 0
}
```

| 类别 | 判定 | 事件 | 触发类型 |
|------|------|------|---------|
| 影响 stat | `effects.length > 0` | icemelt, globalwarming_co2, globalwarming_methane, solidify_crust, volcano_extinction, salinization | ONE_TIME ×4 + REPEATABLE ×2 |
| 不影响 stat | `effects.length = 0` | quake_mild, quake_moderate, quake_severe | REPEATABLE ×3 |

### 类型扩展

```ts
type TerraformingGoalKind = 'project' | 'stat' | 'cluster' | 'preventive'

interface TerraformingDraftTimelineEntry {
  isEvent: boolean
  source?: 'committed' | 'draft'
}
```

## 编辑模式

### 入口：startQueueEdit

剥离已提交的 event → `committedEventCounts`，只将 user tasks 写入 `draftExecutionLog`。

### 回放：computePlanDraftEntries

单一回放路径，events 直接插入 `replayEntries` 队列：

```
completedProjects = {} (纯净，不含 committed events)

// position 0 检查
for event in statAffectingEvents (filtered by cluster taskProjectIds):
  if checkAll(conditions, initStats) AND not inserted:
    pushEventEntry(event)

// 逐条 replay
for entry in draftExecutionLog:
  // eventBlocked: 出现与事件 stat 相关的 stat goal → 阻断
  if !eventBlocked AND unmet condition matches eventStat:
    eventBlocked = true (position 0 豁免)

  pushTaskEntry(entry)
  completedProjects += entry

  if !eventBlocked:
    check and pushEventEntry for newly satisfied events

// 队尾检查
checkRemainingEvents()
```

- events 和 tasks 共享 `completedProjects`，单一累积路径
- 每个事件最多插入一次（`insertedEventIds` 去重）
- ONE_TIME 事件在 baseline 中存在时跳过
- `cluster.taskProjectIds` 过滤事件可用性

### planDisplayEntries

```
[预防型 goal]              ← position -1
[task / event / stat goal / project goal]  ← 交错显示
[task / event / ...]
...
[cluster goal]              ← 队尾
```

- stat goal 和 project goal 的 `position` 在 `draftReplayEntries`（含 events）上 remap
- cluster goal 统一放队尾
- vuedraggable `handle=".drag-handle"` — event 无 `.drag-handle`，自然不可拖拽

### 提交：completeQueueEdit

从 `draftReplayEntries` 写出全部条目（task + event），不额外追加 committed events。

## 非编辑模式

### executeAutoEvents

`toggleProject` / `setProjectCount` 后调用，loop 处理级联触发。过滤 `cluster.taskProjectIds`。

### 进入集群时

仅在 `executionLog` 为空时触发，不补执行已有 log。

## 预防型 goal

- `kind: 'preventive'`, `position: -1`
- 非 stat 影响的 repeatable 事件（quakes）条件满足时生成
- 累积 stats 脱离危险区后自动移除
- 不与同类 stat goal 合并

## goal 过滤祖先遍历修复

`goalFilteredTaskIds` 中树父节点向上遍历的 `if (current !== pid) break` 在未找到父节点时也 break，改用 `found` flag 只在确实找到时推进。

## 任务树

events group：不响应点击/拖拽，显示 count tag（ONE_TIME → "已触发"，REPEATABLE → "N次"）

## 非目标

- 不模拟概率/回退
- xenon group 行为不变
