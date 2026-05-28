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
    └── 非编辑模式警报提示

vue
  TerraformingTaskList
    └── events group 移除手动操作入口（tag 展示替代按钮）
  TerraformingResourcePanel
    └── auto-event 复用 task 渲染结构，无 drag-handle
```

## 核心模型

### 事件分类

```ts
function isStatAffectingEvent(project: TerraformingProject): boolean {
  return project.effects.length > 0
}
```

按 `effects.length` 分两类：

| 类别 | 事件 | 触发 |
|------|------|------|
| 影响 stat | icemelt, globalwarming_co2, globalwarming_methane, solidify_crust, volcano_extinction, salinization | ONE_TIME ×4 + REPEATABLE ×2 |
| 不影响 stat | quake_mild, quake_moderate, quake_severe | REPEATABLE ×3 |

### 类型扩展

```ts
type TerraformingGoalKind = 'project' | 'stat' | 'cluster' | 'preventive'

interface TerraformingGoalEntry {
  // ... 现有字段
  relatedEventId?: string
}

interface TerraformingDraftTimelineEntry {
  // ... 现有字段
  isEvent: boolean  // NEW: 标识该条目为事件
}
```

### 事件 stat 集合

```ts
function getEventStatIds(data: TerraformingData): Set<string> {
  const ids = new Set<string>()
  for (const project of data.projects) {
    if (project.group !== 'events') continue
    for (const cond of project.conditions) {
      ids.add(cond.stat)
    }
  }
  return ids
}
```

## 编辑模式：统一队列回放

### 入口：startQueueEdit

进入编辑模式时，剥离已提交的 event 条目，记录为 `committedEventCounts` baseline：

```
draftExecutionLog  ←  用户 task 条目 (不含 event)
committedEventCounts ← { evt_id: count }
```

### 回放：computePlanDraftEntries

单一回放路径，events 直接插入 `replayEntries` 队列：

```
completedProjects = committedEventCounts (baseline)
entries = []

// ── position 0 检查 ──
for event in statAffectingEvents:
  if checkAll(event.conditions, initStats) AND not inserted:
    pushEventEntry(event)   →  entries.push({...event..., isEvent:true})

// ── 逐条 replay ──
for entry in draftExecutionLog:
  preStats = computeStats(completedProjects)

  // 阻断检查
  if !eventBlocked AND entry has unmetCondition matching eventStat:
    eventBlocked = true

  pushTaskEntry(entry)       →  entries.push({...task..., isEvent:false})
  completedProjects += entry

  if !eventBlocked:
    for event in statAffectingEvents:
      if checkAll(event.conditions, postStats) AND not inserted:
        pushEventEntry(event) →  entries.push({...event..., isEvent:true})
        completedProjects += event

// ── 队尾检查 ──
checkRemainingEvents()
```

**关键**：events 和 tasks 共享 `completedProjects`，event effects 即时进入累积 state。不再有两个独立的 replay 路径。

### 位置规则

- events 紧跟在触发条件的 task entry 之后（同一 `replayEntries` 序列）
- 与 tasks 共享 `order` 序列号
- 通过 `isEvent: true` 区分类型

### ONE_TIME vs REPEATABLE

- ONE_TIME (`repeatCooldown === null`)：若已在 `completedProjects` 基线中（含 committed），跳过
- REPEATABLE (`repeatCooldown !== null`)：每个事件仍最多插入一次

### 拖拽

vuedraggable `handle=".drag-handle"` — event 条目无 `.drag-handle`，自然不可拖拽。无需额外的 `filter` 或 `@move`。

## 编辑模式：预防型 goal

### 生成时机

在 `generateGoalEntries` 的末尾阶段。

### 算法

```
for event in [quake_mild, quake_moderate, quake_severe]:
  if checkAll(event.conditions, endStats):
    push goal:
      kind: 'preventive',
      position: -1,
      targetStatId: 'seismicactivity',
      relatedEventId: event.id,
      hasRisk: true,
```

### 显示模型

⚠️ 图标 + 事件名称 + stat block（最终态 cumulativeStats 值 + 触发条件高亮为 requirement segments）。`effectDirection = 'none'`，不显示 diff。

### 生命周期

- 每次 goal 重新生成时检查累积 stats 是否脱离危险区
- 脱离后 goal 自动移除
- 不与同类 stat goal 合并

## 非编辑模式

### 影响 stat 事件自动执行

`toggleProject` / `setProjectCount` 后调用 `executeAutoEvents()`：

```
loop:
  for event in statAffectingEvents:
    if checkAll(event.conditions, runtimeStats) AND (ONE_TIME? count===0 : true):
      appendExecution(event.id, 1)
      recomputeRuntimeStats()
      triggered = true
  if !triggered: break
```

使用 loop 处理级联触发。

### 进入集群时自动执行

仅在 `executionLog` 为空时触发，不补执行已有 log 的集群。

### 警报提示

（待后续实现）execution log display 末尾检查 quake 事件，条件满足时输出警报。

## Submit / Commit

`completeQueueEdit` 从统一的 `draftReplayEntries`（含 tasks + events）写出：

```
draftReplayEntries.filter(!systemDisabled).map → store.replaceExecutionLog
```

## 任务树变更

events group 下所有条目：
- 不可点击添加/拖拽
- 显示 count tag（ONE_TIME 已触发显示"已触发"，REPEATABLE 显示"N次"）
- 编辑模式显示 drag 占位符（视觉对齐）

## 非目标

- 不模拟概率/回退
- xenon group 行为不变
