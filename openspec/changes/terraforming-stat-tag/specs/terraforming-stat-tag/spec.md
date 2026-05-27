# Terraforming Stat Tag Specification

## ADDED Requirements

### Requirement: Stat Name Clickable

Stat name text in `TerraformingStatScale` SHALL emit a click event.

#### Scenario: Click stat name

**前提** TerraformingStatScale 渲染 stat 名称

**当** 用户点击 stat 名称 `.stat-name`

**那么** emit `clickStat(statId)`

### Requirement: TaskList Tag Bar

TaskList SHALL display a tag bar when statFilter is non-empty.

#### Scenario: Show tag bar

**前提** statFilter 非空

**那么** panel-header 右侧显示 tag bar
**并且** 每个活跃 tag 以药丸形式展示 stat 名称 + × 按钮
**并且** 所有模式（编辑/非编辑）均显示

#### Scenario: Hide tag bar

**前提** statFilter 为空

**那么** tag bar 不显示

### Requirement: Effect-Only Filtering

TaskList SHALL filter tasks by project effects only, excluding conditions.

#### Scenario: Filter by effect

**前提** statFilter 包含 "temperature"

**当** 项目 effects 包含 temperature 的 stat

**那么** 项目显示
**并且** 仅有 conditions 引用 temperature 的项目不显示

#### Scenario: Completed project still matches

**前提** 一次性项目已完成，effect direction 为 'none'

**当** `line.effectToValue !== null`

**那么** 项目仍被视为 effects 匹配

### Requirement: Ancestor Inclusion

When a child project matches the filter, its ancestors SHALL also be visible.

#### Scenario: Child matches

**前提** 项目 C 是 B 的子项目，B 是 A 的子项目，C 命中过滤

**那么** B 和 A 均标记为可见

### Requirement: Empty Group Hiding

Groups with no visible tasks SHALL be hidden.

#### Scenario: Group hidden

**前提** group X 下的所有任务被过滤隐藏

**那么** group X 的 header 和内容区不渲染

### Requirement: Events Filtering

Events SHALL respect the same filter rules as regular tasks.

#### Scenario: Events filtered

**前提** statFilter 非空

**那么** 不命中过滤的 event 条目隐藏
**并且** 全部 event 隐藏时 events section 整体不渲染

## MODIFIED Requirements

### Requirement: Completed Project Effect Label

**Reason**: `formatEffectLabel` moved outside `hideBlockEffectPreview` guard.

Completed one-time projects SHALL display effect text labels while hiding block direction markers.
