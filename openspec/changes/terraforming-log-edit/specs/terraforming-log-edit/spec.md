# terraforming-log-edit Specification

## Purpose

定义 terraforming 执行队列编辑模式：正式队列保持真实可执行语义，编辑模式使用独立 draft queue 支持拖拽、插入、禁用、复制与预览失效；数据层将动态阻塞/移除/sideEffect 项目统一暴露为依赖表达式，降低 view 层算法复杂度。

## ADDED Requirements

### Requirement: 数据层 MUST 输出统一依赖表达式

**前提** terraforming 数据处理器解析项目的 predecessors、blockedProjects、blockedGroups、removedProjects 或 sideEffects[].project

**当** 输出 `terraforming.json`

**那么** 每个受影响项目 MUST 包含 `dependencies` 依赖表达式字段

**并且** view 层 MUST 能通过该统一字段判断项目依赖是否满足

**并且** view 层 MUST NOT 直接解释 blockedProjects、blockedGroups、removedProjects 或 sideEffects[].project 的原始动态规则

#### Scenario: blockedProjects 转换为完成依赖

**前提** 项目 A 的 blockedProjects 包含项目 B

**当** 数据层输出项目 B

**那么** 项目 B 的 `dependencies` MUST 包含表达式 `{ "completed": "A" }`

#### Scenario: removedProjects 转换为互斥依赖

**前提** 项目 A 的 removedProjects 包含项目 B

**当** 数据层输出项目 B

**那么** 项目 B 的 `dependencies` MUST 包含表达式 `{ "notCompleted": "A" }`

#### Scenario: sideEffect blocker 转换为条件 blocker

**前提** 项目 A 的 sideEffects 中包含触发项目 B

**并且** 项目 B 的 blockedProjects 包含项目 C

**当** 数据层输出项目 C

**那么** 项目 C 的 `dependencies` MUST 包含表达式 `any(notCompleted(A), completed(B))`

**并且** 概率展示信息 MUST 保留

**并且** 页面 MUST NOT 模拟概率或随机分支

#### Scenario: sideEffect 目标项目依赖生成源

**前提** 项目 A 的 sideEffects 中包含触发项目 B
**并且** 项目 A 与项目 B 不在同一个 group

**当** 数据层输出项目 B

**那么** 项目 B 的 `dependencies` MUST 包含表达式 `{ "completed": "A" }`

#### Scenario: 同组 sideEffect 目标项目保留为树形前置

**前提** 项目 A 的 sideEffects 中包含触发项目 B
**并且** 项目 A 与项目 B 在同一个 group
**并且** 没有其他项目触发项目 B

**当** 数据层输出项目 B

**那么** 项目 B 的 `predecessors` MUST 包含项目 A
**并且** 项目 B 的 `dependencies` MUST NOT 因该 sideEffect source 包含 `{ "completed": "A" }`

#### Scenario: 多个 sideEffect source 触发同一项目

**前提** 项目 A 和项目 B 的 sideEffects 都包含触发项目 C

**当** 数据层输出项目 C

**那么** 项目 C 的 `dependencies` MUST 包含表达式 `any(completed(A), completed(B))`
**并且** 项目 C 的 `predecessors` MUST NOT 因这些 sideEffect source 包含项目 A 或项目 B

#### Scenario: 二选一分支含 sideEffect blocker

**前提** 项目 C 的前置项目为任一完成：项目 A 或项目 B

**并且** 项目 B 的 sideEffects 可能触发项目 D

**并且** 项目 D 阻塞项目 C

**当** 数据层输出项目 C

**那么** 项目 C 的 `dependencies` MUST 等效于 `A OR (B AND D)`

#### Scenario: group predecessor 只展示不阻塞

**前提** 项目 A 的 predecessors 包含 `type=group` 的组 G

**当** 系统校验项目 A 是否可执行

**那么** evaluator MUST NOT 因组 G 内项目未完成而阻塞项目 A

**并且** edit log UI MUST NOT 将组 G 显示为正文依赖

#### Scenario: notCompleted 显示为互斥

**前提** 项目 A 的 `dependencies` 包含 `{ "notCompleted": "B" }`

**当** UI 展示项目 A 的依赖说明

**那么** UI MUST 显示为“互斥: B 的项目名”

**并且** UI MUST NOT 显示为“需要 B 的项目名”

#### Scenario: edit log 空正文隐藏

**前提** edit log 中某条 entry 没有依赖、stat 变化和失效原因

**当** UI 渲染该 entry

**那么** UI MUST 只显示标题行

**并且** UI MUST NOT 渲染空正文区域

#### Scenario: 任务树父子关系保持 runtime 范围限制

**前提** 项目 B 的 predecessors 包含项目 A

**并且** 项目 A 与项目 B 在同一个 group

**并且** 项目 A 与项目 B 都属于当前 runtime cluster project ids

**当** UI 渲染地球化任务树

**那么** 项目 B MUST 作为项目 A 的子项目显示

**并且** 系统 MUST NOT 为了显示项目 B 而加载不属于当前 runtime cluster project ids 的全局项目

### Requirement: 右列 MUST 支持独立编辑模式

**前提** 右列任务队列处于非编辑模式

**当** 用户点击标题栏「编辑」

**那么** 系统 MUST 从正式 execution log 创建独立 draft execution log

**并且** 后续编辑操作 MUST 只修改 draft execution log

**并且** 正式 execution log MUST 保持不变，直到用户点击「完成」

#### Scenario: 取消编辑

**前提** 用户已进入编辑模式并修改 draft queue

**当** 用户点击「取消」

**那么** draft queue MUST 被丢弃

**并且** 正式 execution log MUST 保持进入编辑模式前的内容

#### Scenario: 完成编辑

**前提** 用户已进入编辑模式

**当** draft queue 中所有任务均为有效或禁用

**那么** 「完成」按钮 MUST 可用

**当** 用户点击「完成」

**那么** 系统 MUST 移除所有禁用任务

**并且** 将剩余 draft queue 应用为正式 execution log

#### Scenario: 失效任务阻止完成

**前提** draft queue 中存在启用但失效的任务

**当** 用户查看标题栏

**那么** 「完成」按钮 MUST 禁用

**并且** UI MUST 显示仍有多少个启用任务失效

### Requirement: Draft 任务 MUST 有三态

**前提** 系统处于编辑模式

**当** draft queue 完成 replay

**那么** 每条 draft entry MUST 被标记为以下状态之一：
- 禁用
- 启用且有效
- 启用但失效

**并且** 禁用任务 MUST NOT 参与 replay

**并且** 启用但失效的任务 MUST NOT 应用 effects

**并且** replay MUST 继续扫描后续任务

### Requirement: 编辑模式 MUST 支持任意拖拽排序

**前提** 系统处于编辑模式，draft queue 中存在任务

**当** 用户拖拽任务到任意位置并释放

**那么** draft queue MUST 按新顺序更新

**并且** 系统 MUST 在 drop 后重新 replay draft queue

**并且** UI MUST 标出启用但失效的任务及失效原因

**并且** 系统 MUST NOT 在拖拽 hover 期间持续 replay

### Requirement: 编辑模式 MUST 支持队列内部批量禁用

**前提** 系统处于编辑模式

**当** 右列渲染 draft queue

**那么** 队列内部首张 card MUST 提供「全部禁用」

**并且** 标题栏 MUST NOT 再显示「清空任务」

**当** 用户点击「全部禁用」

**那么** 所有 draft entry MUST 变为禁用

**并且** UI SHOULD 提供「全部启用」恢复入口

### Requirement: 编辑模式 MUST 支持可重复项目复制

**前提** 系统处于编辑模式，某 draft entry 对应可重复项目

**当** 用户点击该 entry 的复制按钮

**那么** 系统 MUST 在该 entry 下方插入一条相同 projectId 的 draft entry

**并且** 插入后 MUST 重新 replay draft queue

#### Scenario: 连续重复项目操作

**前提** draft queue 中存在连续的相同可重复项目

**当** UI 渲染该连续段

**那么** 首条 MUST 显示禁用操作

**并且** 后续条 MUST 显示删除/撤销操作

### Requirement: 一次性项目 MUST 不允许重复插入

**前提** 系统处于编辑模式，draft queue 中已存在某一次性项目的启用 entry

**当** 用户尝试再次插入该项目

**那么** 系统 MUST 拒绝插入

**并且** 该规则 MUST 与非编辑模式一致

### Requirement: 编辑模式 MUST 只预览顺序与可执行性

**前提** 系统处于编辑模式

**当** UI 渲染 draft entry

**那么** UI MUST 显示项目依赖、stat 条件、stat effects、状态与失效原因

**并且** UI MUST NOT 显示材料、交付清单、建造时间、折扣或返还明细

### Requirement: 非编辑模式 MUST 保持正式队列可重放

**前提** 系统处于非编辑模式

**当** 用户执行项目

**那么** 系统 MUST 基于正式队列尾部状态校验该项目当前可执行

**并且** 校验通过后才能追加 execution entry

**当** 用户撤销右列 entry 或减少中列可重复项目次数

**那么** 系统 MUST 对删除候选 entry 后的正式队列执行 replay 校验

**并且** 只有校验通过时才允许撤销或减少

### Requirement: 非编辑模式 MUST 简化撤销展示

**前提** 系统处于非编辑模式，右列显示正式 execution log

**当** UI 渲染单条 entry

**那么** UI MUST 只显示该 entry 是否允许撤销

**并且** UI MUST NOT 展示完整撤销影响列表

**并且** 不允许撤销时 MUST 禁用撤销按钮并显示简短原因

### Requirement: 中列任务交互 MUST 随编辑模式切换目标队列

**前提** 系统处于非编辑模式

**当** 用户点击中列任务执行或取消

**那么** 操作目标 MUST 是正式 execution log

**并且** 执行和取消 MUST 遵守正式队列可执行/可撤销校验

**前提** 系统处于编辑模式

**当** 用户点击中列任务执行

**那么** 系统 MUST 将该任务插入 draft queue 尾部

**当** 用户点击中列任务取消

**那么** 系统 MUST 处理 draft queue 中该 projectId 的最后一条记录

**并且** 处理方式 MUST 是禁用或删除，而不是修改正式 execution log
