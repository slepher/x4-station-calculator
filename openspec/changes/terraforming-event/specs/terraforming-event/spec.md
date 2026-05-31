# terraforming-event Specification

## Purpose

定义 terraforming 事件的自动化管理行为：影响 stat 的事件在条件满足时自动插入执行队列，不影响 stat 的重复事件在条件未解决时生成预防型 goal。事件不再提供手动执行入口。

## ADDED Requirements

### Requirement: 事件 MUST 按 effects 有无分类

系统 MUST 根据 `project.effects` 是否为空将事件分为「影响 stat」和「不影响 stat」两类。

**前提** 存在 terraforming 事件项目

**当** 系统加载事件列表

**那么** `effects.length > 0` 的事件 MUST 归类为影响 stat

**并且** `effects.length = 0` 的事件 MUST 归类为不影响 stat

**并且** xenon group 下的事件 MUST NOT 受此分类规则约束

### Requirement: 影响 stat 事件 MUST 在编辑模式自动插入

编辑模式 replay 中，影响 stat 的事件 MUST 在累积 stats 首次满足其全部 conditions 时自动插入为 task entry。

**前提** 用户进入 terraforming 编辑模式

**并且** draft 队列中存在 task entry

**当** replay 累积 stats 首次满足某个影响 stat 事件的所有 conditions

**并且** 该事件尚未被插入

**那么** 系统 MUST 将该事件作为 task entry 自动插入

**并且** 插入位置 MUST 在导致条件变为满足的 entry 之后

**并且** 该 entry MUST 带 `[EVENT]` 标签

**并且** 系统 MUST NOT 提供该 entry 的手动移除或拖拽能力

#### Scenario: repeatable 事件仅插入一次

**前提** evt_globalwarming_co2 为 repeatable 事件

**并且** replay 过程中某位置条件首次满足

**当** 系统自动插入该事件后

**并且** 其后累积 stats 仍满足条件

**那么** 系统 MUST NOT 再次插入该事件

**并且** 每个影响 stat 事件在整个 replay 中最多出现一次

#### Scenario: ONE_TIME 事件已存在或已完成时跳过

**前提** evt_icemelt 为 ONE_TIME 事件

**并且** 该事件已在 draft 队列中或已在 cumulativeCompleted 中

**当** replay 累积 stats 满足其 conditions

**那么** 系统 MUST NOT 再次插入该事件

### Requirement: stat goal 阻断 MUST 停止后续 auto-insert

编辑模式 replay 中首次出现与事件 stat 相关的 stat goal 时 MUST 阻断后续所有 auto-insert。

**前提** replay 过程中某个 draft entry 的 project conditions 中存在未满足项

**并且** 该未满足项的 stat 与任一 auto-insert 候选事件的 condition stat 相同

**当** 系统检测到该 stat goal

**那么** eventBlocked 标志 MUST 置为 true

**并且** 当前 entry 之后 MUST NOT 出现任何 auto-event 插入

**并且** position 0 的 auto-insert MUST NOT 受此阻断影响

### Requirement: 编辑模式 planDisplayEntries MUST 遵循 interleaving 顺序

同一 position 下多 entry 渲染顺序 MUST 为：auto-event > stat goal > project goal。

**前提** 编辑器 replay 产生 task、auto-event、stat goal 和 project goal

**当** `planDisplayEntries` 组装 display 列表

**那么** 若 position 0 存在预防型 goal，其 MUST 优先于所有其他 entry

**并且** auto-event MUST 紧跟在触发它的 task entry 之后

**并且** 同一 task 衍生的 stat goal MUST 排在 auto-event 之后

**并且** 同一 task 衍生的 project goal MUST 排在 stat goal 之后

### Requirement: 预防型 goal MUST 支持多行 stat 方块与 req stats 过滤

预防型 goal 的显示模型 MUST 包含事件图标、事件名称、条件 stat 方块（可多行），点击时 MUST 同时施加 satisfier 过滤和 req stats 过滤。

**前提** 编辑模式存在预防型 goal

**当** UI 渲染该 goal

**那么** UI MUST 渲染 icon + event name + reqStatBlocks（每 stat 一行的 target 方块）+ 圈圈标记

**当** 用户点击该 goal

**那么** goal MUST 进入过滤激活状态并高亮

**并且** 中列 MUST 显示 effects 反向变动目标 stat 的 project（satisfier 过滤）

**并且** 中列 MUST 显示 effects 命中任一 reqStatBlock stat 的 project（req stats 过滤，OR 关系）

**并且** 两次过滤结果以 OR 合并

#### Scenario: 预防型 goal 不与同 stat 的 stat goal 合并

**前提** 预防型 goal 与 stat goal 均针对 seismicactivity

**当** goal 合并阶段

**那么** 预防型 goal MUST NOT 与 stat goal 合并

**并且** 两者 MUST 独立存在（语义不同）

编辑模式下，不影响 stat 的多次事件 MUST 在条件满足时生成预防型 goal。

**前提** 编辑模式全 replay 完成

**并且** evt_quake_mild / evt_quake_moderate / evt_quake_severe 三者之一的 conditions 均满足

**当** 系统生成 goal

**那么** 系统 MUST 生成 `kind: 'preventive'` 的 goal entry

**并且** `position` MUST 为 0

**并且** `targetStatId` MUST 为 'seismicactivity'

**并且** `targetValue` MUST 为当前危险 state 的安全边界值

**并且** 预防型 goal MUST 关联 effects 中 seismicactivity change 反向变化的 project

#### Scenario: 累积 stats 脱离危险区后 goal 消失

**前提** 队列开头存在 seismicactivity 的预防型 goal

**当** 用户修改 draft 队列使累积 stats 脱离危险区

**那么** 该预防型 goal MUST 自动移除

### Requirement: 非编辑模式影响 stat 事件 MUST 自动执行

非编辑模式下，用户每次点击执行 task 后 MUST 检查所有影响 stat 事件，条件满足的事件 MUST 自动执行并记入 execution log。

**前提** 系统处于非编辑模式

**当** 用户执行一个 task

**那么** 系统 MUST 检查所有影响 stat 事件

**并且** 对每个条件满足且 (ONE_TIME 未完成 或 REPEATABLE) 的事件 MUST 自动执行

**并且** 自动执行结果 MUST 写入 execution log

**并且** 若初始 stats 即满足条件，进入集群时 MUST 自动执行该事件

**并且** 进入集群自动执行 MUST 仅在 executionLog 为空时触发，MUST NOT 补执行已有 log 的集群

#### Scenario: 已有 log 的集群不补执行

**前提** 非编辑模式且 executionLog 非空

**当** 用户进入集群

**那么** 系统 MUST NOT 自动执行初始 stats 即满足条件的事件

#### Scenario: ONE_TIME 事件完成后不再重复

**前提** evt_icemelt 为 ONE_TIME 事件且已执行

**当** 后续 stats 变化后其 conditions 再次满足

**那么** 系统 MUST NOT 再次自动执行该事件

### Requirement: 非编辑模式不影响 stat 事件 MUST 显示警报

非编辑模式下，不影响 stat 的多次事件在条件满足时 MUST NOT 自动执行，而是 MUST 在 log 末尾显示警报提示。

**前提** 系统处于非编辑模式

**当** 某个不影响 stat 事件的条件满足

**那么** 系统 MUST NOT 自动执行该事件

**并且** 系统 MUST 在 execution log 末尾插入警报提示

**并且** 警报提示 MUST 说明事件类别与未解决状态

### Requirement: events group MUST 移除手动操作

编辑模式下 events group 的所有项目 MUST NOT 提供手动点击添加或拖拽能力。

**前提** 系统处于 terraforming 编辑模式

**当** 中列任务树渲染 events group

**那么** events group 下的所有 task node MUST NOT 响应点击添加

**并且** 事件 task node MUST NOT 响应拖拽到 log 区域

### Requirement: TerraformingGoalKind 与 display 类型 MUST 扩展

类型系统 MUST 新增 `'preventive'` goal kind 和 `auto-event` display entry 类型。

**前提** 展开类型定义

**当** `TerraformingGoalKind` 定义

**那么** 其值域 MUST 包含 `'preventive'`

**当** `TerraformingGoalPlanDisplayEntry` 定义

**那么** 其值域 MUST 包含 `{ type: 'auto-event'; entry: TerraformingAutoEventDisplayEntry }`

**并且** `TerraformingGoalEntry` MUST 包含可选字段 `relatedEventId: string`
