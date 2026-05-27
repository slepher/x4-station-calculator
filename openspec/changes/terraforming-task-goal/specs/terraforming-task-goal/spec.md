# terraforming-task-goal Specification

## Purpose

定义 terraforming 编辑模式的目标驱动规划行为：系统根据 cluster 目标和 task 依赖生成 goal entry，用户点击 goal 过滤可实现任务，并通过添加、排序、移除 task 形成完整自洽的 execution log。该模式替代旧 draft queue 的启用/禁用三态模型。

## ADDED Requirements

### Requirement: 编辑模式 MUST 使用目标驱动规划列表

编辑模式 MUST 使用 task entry 与派生 goal entry 组成的目标驱动规划列表，替代旧线性 draft queue。

**前提** 用户进入 terraforming 编辑模式

**当** log 区域渲染编辑列表

**那么** 系统 MUST 显示用户选择的 task entry

**并且** 系统 MUST 显示 presenter 派生的 goal entry

**并且** goal entry MUST NOT 进入正式 execution log

**并且** 完成编辑时 MUST 只提交 task entry

**并且** 该目标驱动模型 MUST 取代 `terraforming-log-edit` 的旧 draft 三态编辑模型

#### Scenario: Cluster root goals 显示在 log 末尾

**前提** 当前 cluster 存在未实现的任务目标

**当** 编辑模式 log 区域渲染

**那么** 系统 MUST 在 log 列表末尾显示由 cluster 任务目标生成的 root goal

**并且** 传送目标 MUST NOT 生成占位 goal

### Requirement: Goal MUST 从未满足依赖生成并合并

系统 MUST 从 task 的未满足依赖生成 goal，并在定位前合并同类 goal。

**前提** 编辑队列中存在 task entry

**当** 系统 replay 编辑队列并发现 task 的依赖未满足

**那么** 系统 MUST 为每一条未满足依赖生成候选 goal

**并且** 系统 MUST 在候选 goal 生成完成后合并同类 goal

**并且** 相同 project 依赖 goal MUST 合并为一个

**并且** 相同 stat goal MUST 合并为一个

#### Scenario: 多个 task 依赖同一 goal

**前提** task A 和 task B 都依赖 goal G

**当** 系统定位合并后的 goal G

**那么** goal G MUST 显示在 task A 与 task B 中最早出现者的前方

#### Scenario: Goal 不支持手动排序

**前提** 编辑模式 log 区域存在 goal entry

**当** 用户尝试调整列表顺序

**那么** 系统 MUST 只允许 task entry 被排序

**并且** goal entry 的位置 MUST 由 presenter 根据 task 顺序重新生成

### Requirement: Project goal MUST 在满足后移除

Project goal MUST 作为临时缺口占位，并在其位置之前的累计状态满足该 project 依赖后自动移除。

#### Scenario: Project goal 满足后消失

**前提** 某个 project goal 位于依赖它的 task 前方

**当** goal 位置之前的累计 replay 状态已经满足该 project 依赖

**那么** 系统 MUST 自动移除该 project goal

**并且** 该依赖 task MUST 继续保留在编辑队列中

### Requirement: Stat goal MUST 作为检查点保留

Stat goal MUST 作为数值检查点保留，直到不再有 task 依赖该 stat 条件。

#### Scenario: Stat goal 满足后保留

**前提** 某个 stat goal 仍被一个或多个 task 依赖

**当** goal 位置之前的累计 replay 状态已经满足该 stat 条件

**那么** 系统 MUST 继续显示该 stat goal

**并且** 该 stat goal MUST 显示为已达成状态

**当** 不再有任何 task 依赖该 stat goal

**那么** 系统 MUST 继续保留该 stat goal，直到用户离开或重建当前编辑计划

### Requirement: Stat goal MUST 复用方块表示法

Stat goal MUST 复用 `terraforming-blocks` 的既有方块表示法，且不得新增另一套 stat 方块语义。

**前提** stat goal 对应的 stat 存在 `ranges`

**当** UI 渲染该 stat goal

**那么** 系统 MUST 复用 `terraforming-blocks` 的方块控件语义

**并且** goal 所在位置之前的累计 stat 值 MUST 作为 `currentValue`

**并且** 目标条件推导出的值 MUST 作为 `targetValue`

**并且** 方块图 MUST 使用现有 increase/decrease overlay 显示 `currentValue` 到 `targetValue` 的 diff

**并且** stat goal MAY 显示条件外框

#### Scenario: 范围条件选择最近满足边界

**前提** stat goal 的条件是范围条件

**并且** goal 位置之前的累计值不满足该范围

**当** 系统计算 `targetValue`

**那么** `targetValue` MUST 取离当前位置累计值最近的满足边界

#### Scenario: 数字型 stat goal 使用文本

**前提** stat goal 对应的 stat 不存在 `ranges`

**当** UI 渲染该 stat goal

**那么** 系统 MUST NOT 构造伪方块图

**并且** 系统 MUST 使用单行文本表达当前值、目标值和差值

### Requirement: 点击 Goal MUST 切换任务过滤状态

Goal entry MUST 支持点击切换过滤状态，并由过滤状态驱动中列任务可见集合。

**前提** 编辑模式 log 区域存在 goal entry

**当** 用户点击未激活的 goal

**那么** 该 goal MUST 进入过滤激活状态

**并且** UI MUST 使用不同样式显示该 goal 正在参与过滤

**当** 用户再次点击已激活的 goal

**那么** 系统 MUST 取消该 goal 的过滤激活状态

#### Scenario: 多个 goal 过滤以 OR 共存

**前提** goal A 与 goal B 均处于过滤激活状态

**当** 中列 terraforming task 列表渲染

**那么** 系统 MUST 显示能实现 goal A 的 task

**并且** 系统 MUST 显示能实现 goal B 的 task

**并且** task 只要满足任一激活 goal 的可见条件就 MUST 可见

#### Scenario: 过滤后显示父节点

**前提** goal G 处于过滤激活状态

**并且** task A 能直接实现 goal G

**并且** task P 是 task A 在当前任务树上的父节点

**当** 中列 terraforming task 列表渲染

**那么** task A MUST 可见

**并且** task P MUST 可见

**并且** 系统 MUST NOT 为过滤结果全局拉入不属于当前 runtime cluster 范围的 project

#### Scenario: Goal 消失后清理过滤状态

**前提** project goal G 处于过滤激活状态

**当** goal G 因满足而从 log 区域移除

**那么** 系统 MUST 自动取消 goal G 的过滤激活状态

#### Scenario: 过滤样式与状态叠加

**前提** goal G 处于过滤激活状态

**当** UI 渲染 goal G

**那么** UI MUST 同时表达过滤激活状态与 goal 自身状态

#### Scenario: 无过滤时恢复正常任务列表

**前提** 没有任何 goal 处于过滤激活状态

**当** 中列 terraforming task 列表渲染

**那么** 系统 MUST 按正常任务列表规则显示 task

### Requirement: Task 插入 MUST 按目标关系定位

编辑模式添加 task 时 MUST 按 task 与现存 goal 的可实现关系决定插入位置。

**前提** 用户在编辑模式添加 task

**当** 该 task 能直接实现某个现存 goal

**那么** 系统 MUST 将该 task 插入该 goal 上方

**当** 该 task 是能实现某个现存 goal 的 task 的当前任务树父节点

**那么** 系统 MUST 将该 task 插入该 goal 上方

**当** 该 task 关联多个 goal

**那么** 系统 MUST 将该 task 插入当前 log 渲染顺序中位置最靠前的相关 goal 上方

**当** 该 task 不关联任何 goal

**那么** 系统 MUST 将该 task 插入队列末尾

#### Scenario: 插入规则不受过滤状态影响

**前提** 一个或多个 goal 处于过滤激活状态

**当** 用户添加 task

**那么** 系统 MUST 仍按 task 与现存 goal 的可实现关系计算插入位置

**并且** 系统 MUST NOT 仅根据当前过滤集合决定插入位置

### Requirement: 编辑模式 MUST 放宽添加与移除按钮限制

编辑模式 MUST 将 task 按钮语义从“立即合法执行”放宽为“加入或移除规划项”。

#### Scenario: 未满足前置的 task 可加入

**前提** 系统处于编辑模式

**当** 用户点击未执行过的 terraforming task

**那么** 系统 MUST 允许添加该 task，即使该 task 当前前置条件不满足

**并且** task 卡片的禁止图标与依赖提示 MUST 保持原展示语义

#### Scenario: 已执行 task 可直接移除

**前提** 系统处于编辑模式

**当** 用户移除已执行过的 task

**那么** 系统 MUST NOT 校验移除是否会导致其他 task 不可行

**并且** 系统 MUST 允许直接移除

### Requirement: 单纯互斥 MUST 不生成 Goal

单纯 `notCompleted(project)` 依赖 MUST 只输出互斥标记，不得生成 goal entry。

**前提** task 的未满足依赖是单纯 `notCompleted(project)` 依赖

**当** 系统生成 goal

**那么** 系统 MUST NOT 为该依赖生成 goal entry

**并且** 系统 MUST 在互斥双方 task 或 project 上输出互斥标记

#### Scenario: 后加入互斥对象被系统禁用

**前提** 编辑队列中已经存在 project A

**并且** 用户随后加入与 project A 互斥的 project B

**当** 系统更新编辑队列状态

**那么** project B 对应 entry MUST 标记为系统禁用

**并且** project B 对应 entry MUST 继续显示在 log 中

**并且** project B 对应 entry MUST 显示互斥原因并提供移除操作

**并且** project B MUST NOT 参与 goal 满足

**并且** project B MUST NOT 进入最终提交的正式 execution log

#### Scenario: 互斥风险候选仍可见

**前提** goal G 处于过滤激活状态

**并且** task A 能实现 goal G

**并且** task A 存在互斥风险

**当** 中列 terraforming task 列表渲染

**那么** task A MUST 可见

**并且** task A MUST 显示互斥风险标记

### Requirement: 复合条件 blocker MUST 可生成正向 Goal

复合条件 blocker MUST 在负向分支被破坏时生成可执行的正向 project goal。

#### Scenario: 条件 blocker 根据当前状态生成 goal

**前提** 依赖表达式为 `any(notCompleted(A), completed(B))`

**当** replay 状态中 A 未完成

**那么** 该依赖 MUST 视为已满足

**并且** 系统 MUST NOT 生成 goal

**当** replay 状态中 A 已完成且 B 未完成

**那么** 系统 MUST 生成 `completed(B)` 的 project goal

**当** replay 状态中 B 已完成

**那么** 该依赖 MUST 视为已满足

**并且** 系统 MUST NOT 生成 goal

#### Scenario: 嵌套复合依赖提取正向缺口

**前提** 依赖表达式包含 `all` 或 `any` 嵌套

**当** evaluator 判断该表达式不满足

**那么** goal 生成器 MUST 提取可执行的正向缺口生成 goal

**并且** goal 生成器 MUST NOT 为单纯负向分支生成 goal

### Requirement: 完成编辑 MUST 阻止未满足的 Task 衍生 Goal

完成编辑 MUST 允许 cluster root goal 未满足，但 MUST 阻止 task 衍生 goal 未满足的计划提交。

#### Scenario: Cluster root goal 未满足仍可完成

**前提** 编辑队列存在未满足的 cluster root goal

**并且** 不存在未满足的 task 衍生 goal

**当** 用户完成编辑

**那么** 系统 MUST 允许提交 task entry

#### Scenario: Task 衍生 goal 未满足阻止完成

**前提** 编辑队列存在未满足的 task 衍生 goal

**当** 用户查看完成编辑操作

**那么** 系统 MUST 阻止完成编辑

**并且** UI MUST 提示仍存在未满足的任务依赖目标

### Requirement: 旧启用禁用 Draft UI MUST 被移除

目标驱动编辑模式 MUST 移除旧 draft queue 的用户启用/禁用操作和三态主模型。

#### Scenario: 单条操作改为移除

**前提** 系统处于 terraforming 编辑模式

**当** UI 渲染单条 task entry

**那么** UI MUST 提供移除操作

**并且** UI MUST NOT 提供用户手动启用/禁用操作

#### Scenario: 批量操作改为移除全部

**前提** 系统处于 terraforming 编辑模式

**当** UI 渲染批量操作

**那么** UI MUST 提供移除全部操作

**并且** UI MUST NOT 提供全部启用或全部禁用操作

**并且** 系统 MUST NOT 使用“启用且有效 / 启用但失效 / 禁用”的 draft 三态作为编辑主模型
