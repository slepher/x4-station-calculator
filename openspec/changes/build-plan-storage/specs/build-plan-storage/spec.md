# Build Plan Storage Specification

## Purpose

定义建造目标方案的持久化存储、方案管理和 UI 行为规范。

## ADDED Requirements

### Requirement: Build Plan Goals Persistence

系统 SHALL 将用户手动添加的建造目标（`production-rate` / `build-module`）以方案为单位持久化到 localStorage。

**前提** 用户添加了建造目标或编辑了方案属性
**当** 触发自动保存时机（buildGoals 变更、方案名编辑确认、切换逻辑产线方案）
**那么** 系统将当前方案的 `buildGoals`、`name`、`logicFlowPlanId`、`lastUpdated` 写入 `SavedBuildPlanGoalsState.list` 中对应条目，并持久化到 localStorage

**并且** localStorage key 通过 `gameData.getStorageKey('build_plan_goals')` 获取，区分游戏版本

#### Scenario: 首次添加目标自动创建方案

**前提** `savedPlans.activeId` 为 `null`
**当** 用户通过 BuildGoalSearchBox 添加第一个建造目标
**那么** 系统自动创建一个新的 `BuildPlanGoalSnapshot`，`id` = `crypto.randomUUID()`，`name` = "建造规划 N"（N = `list.length + 1`），`buildGoals` = `[新目标]`，`logicFlowPlanId` = 当前活跃逻辑产线方案 id 或 `null`
**并且** 设置 `savedPlans.activeId` = 新方案 id
**并且** 持久化到 localStorage

#### Scenario: 目标变更自动保存

**前提** `savedPlans.activeId` 不为 `null`
**当** 用户的 `buildGoals` 发生变更（添加、删除、修改参数）
**那么** 系统更新当前方案快照的 `buildGoals` 和 `lastUpdated`
**并且** 持久化到 localStorage

#### Scenario: 方案名编辑自动保存

**前提** `savedPlans.activeId` 不为 `null`
**当** 用户通过 `useTitleEditor` 确认编辑方案名
**那么** 系统更新当前方案快照的 `name` 和 `lastUpdated`
**并且** 持久化到 localStorage

#### Scenario: 页面刷新后恢复方案

**前提** localStorage 中存在 `SavedBuildPlanGoalsState` 且 `activeId` 不为 `null`
**当** 页面加载时
**那么** 系统从 localStorage 读取并恢复 `savedPlans` 状态
**并且** 加载 `activeId` 对应方案的 `buildGoals` 到 `useBuildPlanStore.buildGoals`

### Requirement: Logic Flow Plan ID Association

每个建造目标方案 SHALL 记录关联的逻辑产线方案 id，并在适当时机更新和还原。

#### Scenario: 切换逻辑产线方案时更新关联

**前提** `savedPlans.activeId` 不为 `null`
**当** 用户切换逻辑产线方案（加载另一个 logic-flow plan）
**那么** 系统更新当前建造目标方案的 `logicFlowPlanId` 为新加载的逻辑产线方案 id
**并且** 持久化到 localStorage

#### Scenario: 加载方案时还原关联的逻辑产线

**前提** 用户切换到一个建造目标方案，其 `logicFlowPlanId` 不为 `null`
**当** 系统加载该方案
**那么** 系统尝试在 `logicFlowStore.savedPlans.list` 中查找对应 id 的逻辑产线方案
**并且** 若找到则加载该逻辑产线方案
**并且** 若未找到则不加载任何逻辑产线方案（fallback 到 `undefined`）

### Requirement: Build Plan Scheme Management

系统 SHALL 提供方案的 CRUD 操作和菜单 UI。

#### Scenario: 新建方案

**前提** 用户在方案菜单中点击 "新建" 项
**当** 系统执行新建操作
**那么** 创建一个新的 `BuildPlanGoalSnapshot`，`id` = `crypto.randomUUID()`，`name` = "建造规划 N"（N = `list.length + 1`），`buildGoals` = `[]`，`logicFlowPlanId` = 当前活跃逻辑产线方案 id 或 `null`
**并且** 设置 `savedPlans.activeId` = 新方案 id
**并且** 清空当前 `useBuildPlanStore.buildGoals`
**并且** 持久化到 localStorage

#### Scenario: 切换方案

**前提** 用户在方案菜单中点击一个已有方案
**当** 系统执行切换操作
**那么** 加载该方案的 `buildGoals` 到 `useBuildPlanStore.buildGoals`
**并且** 设置 `savedPlans.activeId` = 该方案 id
**并且** 尝试还原该方案关联的逻辑产线方案（logicFlowPlanId 联动规则）
**并且** `buildFlowMode` 保持当前值不变

#### Scenario: 删除方案

**前提** 用户点击方案项右侧的 x 按钮
**当** 系统执行删除操作
**那么** 从 `savedPlans.list` 中移除该方案
**并且** 若该方案为当前激活方案，则切换到列表中下一个方案；若无则 `savedPlans.activeId` = `null`
**并且** 持久化到 localStorage

#### Scenario: 无方案时的标题显示

**前提** `savedPlans.activeId` 为 `null`
**当** 系统渲染 Panel-header 标题
**那么** 标题显示 `useTitleEditor` 的 `getDefaultName()` 返回值（"建造规划"）

### Requirement: Build Plan Scheme Menu UI

方案菜单 SHALL 复用当前 logic-flow 菜单的按钮+浮动下拉形态，并增加新建和删除功能。

#### Scenario: 菜单列表内容

**前提** 用户点击方案菜单按钮
**当** 菜单下拉展开
**那么** 列表第一项为 "新建"（不高亮）
**并且** 后续项为 `savedPlans.list` 中的方案，按列表顺序排列
**并且** 当前 `activeId` 对应的方案项高亮显示
**并且** 每个方案项右侧显示 x 删除按钮

#### Scenario: 菜单位置

**前提** 方案菜单按钮位于 Panel-header 右侧
**当** 菜单展开
**那么** 浮动下拉位置和样式与当前 logic-flow 菜单一致

### Requirement: UI Layout Restructuring

Panel-header 和 Panel-content 的布局 SHALL 按以下规范重组。

#### Scenario: Panel-header 布局

**前提** Panel-header 渲染
**当** 显示内容
**那么** 左侧为方案名标题（通过 `useTitleEditor` 可编辑）
**并且** 右侧为方案菜单按钮

#### Scenario: Panel-content 计算按钮上方新行

**前提** Panel-content 渲染
**当** 显示内容
**那么** 计算按钮上方有一行，左侧靠齐为 "建材产线" checkbox，右侧靠齐为 logic-flow 菜单按钮
**并且** 计算按钮在该行下方

#### Scenario: logic-flow 菜单移至新位置

**前提** logic-flow 菜单原来在 Panel-header 右侧
**当** UI 重构完成
**那么** logic-flow 菜单移至计算按钮上方同一行的右侧
**并且** 保持原有 UI 形态（按钮显示当前逻辑产线方案名 + 浮动下拉列表）
