# terraforming-task-goal Design

## 架构

本变更延续 `store -> presenter -> vue` 三层结构，并把目标规划逻辑集中在 presenter。

```
store
  useLiveProductionStore
    └── 正式 terraformingExecutionLog

presenter
  useTerraformingPresenter
    ├── 编辑模式 task queue
    ├── goal 生成 / 合并 / 定位
    ├── goal 过滤状态
    ├── task 插入位置决策
    └── 提交时 task-only execution log

vue
  TerraformingTaskList
  TerraformingResourcePanel
    └── 只消费 presenter 输出与触发 presenter 行为
```

Store 继续维护正式 execution log 与运行时状态。编辑模式中的 goal 是 presenter 派生的 UI/规划模型，不进入 store 持久状态，也不作为正式 execution entry 提交。

## 核心模型

编辑模式下的规划列表由两类 entry 组成：

```ts
type TerraformingGoalPlanEntry =
  | TerraformingTaskPlanEntry
  | TerraformingGoalEntry
```

Task entry 表示用户选择的 terraforming project。Goal entry 表示某个未满足或需要保留检查的目标。

Goal entry 建议区分：

```ts
type TerraformingGoalKind =
  | 'project'
  | 'stat'
  | 'cluster'
```

其中：

- `project` goal 来自 `completed(project)` 或复合 blocker 中可执行的正向分支。
- `stat` goal 来自 stat condition。
- `cluster` goal 来自 cluster 的未实现任务目标，作为 log 末尾的 root goal；其具体展示可复用 project/stat goal 的子类型语义。

单纯 `notCompleted(project)` 不建 goal，只作为互斥元数据输出到相关 task/project。

## Goal 生成流程

Goal 生成是派生过程，不直接存储为用户可排序数据。

```
用户 task queue
  ├─ replay 累计 project count / stats（所有非 systemDisabled 的 entry）
  ├─ 对每个 task 读取未满足依赖
  ├─ 将每条未满足依赖转成候选 goal
  ├─ 追加 cluster root goals
  ├─ 合并同类 goal
  ├─ 根据最早依赖者定位 goal
  └─ 根据生命周期规则过滤已满足 goal
```

### 可用性过滤

Goal 生成时必须过滤 cluster 不可达的依赖，采用两个可复用函数：

- `isStatInRuntime(stats, statId)` — stat 是否存在于当前 cluster 的运行时 stats 中（底层为 `computeTerraformingRuntimeStats`）。stat condition 不满足此条件时不生成 goal。
- `getRuntimeTerraformingProjectIds(cluster, stats, completed, data)` — 返回 cluster 当前运行时可见的 project 集合。`completed(projectId)` 依赖 leaf 不在此集合内时不生成 goal。

这两个过滤器保证 cluster 无关的 stat（如月之舟没有 temperature）和不可见的 project（如需特定 stat 阈值才出现的动态 project）不会产生无效 goal。

### 同类合并

- 相同 `completed(projectId)` 合并为同一 project goal。
- 相同 stat goal 按 **stat + targetValue** 合并：同一 stat 追求相同数值目标则合并为一个 goal，targetValue 不同则各自独立。targetValue 在生成阶段计算（取离当前值最近的满足边界）。
- 复合 blocker 只在当前 replay 状态下需要正向修复时，生成其可执行正向分支 goal。
- `completed(project)` 与 `notCompleted(project)` 不合并；后者仅参与互斥标记。

### 位置规则

合并后的 goal 放在最早依赖它的 task 前方。

```
[goal G]
[task X] 依赖 G
[task Y] 依赖 G
```

用户选择用于实现 goal 的 task 时，该 task 插入 goal 上方。

```
[task A] 实现 G
[goal G]
[task X] 依赖 G
```

移动 task 后，presenter 重新生成 goal 列表和位置。Vue 不保存 goal 的手动排序状态。

### 生命周期

Project goal 是临时缺口占位。当 goal 位置之前的累计 replay 状态已经满足该 project 依赖时，project goal 不再输出。

Stat goal 是长期检查点。满足后切换为已达成状态，但不因满足或依赖关系变化自动移除。

Cluster root goal 放在 log 列表末尾。完成编辑时允许 cluster root goal 仍未满足，方便保留后续规划入口；但 task 衍生的 goal 不允许未满足。

## Stat goal 表示

Stat goal 复用 `terraforming-blocks` 中的 stat 方块语义。

Presenter 为 stat goal 输出：

```ts
interface TerraformingStatGoalLineModel {
  statId: string
  statName: string
  hasRanges: boolean
  currentValue: number
  targetValue: number
  ranges: TerraformingScaleRange[]
  requirementSegments: Array<{ startIndex: number; endIndex: number }>
  effectDirection: 'none' | 'increase' | 'decrease'
  effectFromValue: number
  effectToValue: number
  numericText: string | null
  satisfied: boolean
}
```

关键规则：

- `currentValue` 来自 goal 所在位置之前的 replay 累计 stat。
- `targetValue` 来自 goal condition。
- 若条件是范围且当前值不满足，则取离当前值最近的满足边界。
- 若当前值已满足，`effectDirection = 'none'`，diff 为 0。
- `ranges` 型 stat 使用现有 `TerraformingStatScale` 的条件外框与 increase/decrease overlay。
- 无 `ranges` 的数字型 stat 输出单行文本。

普通 task execution row 仍使用队列效果语义，不显示条件外框。Goal row 是检查点，可以显示条件外框。

## Goal 过滤

Goal 过滤状态由 presenter 管理。

```ts
activeGoalFilterIds: Set<string>
```

点击 goal：

- 如果 goal 未激活，则加入 `activeGoalFilterIds`。
- 如果 goal 已激活，则从 `activeGoalFilterIds` 移除。
- Vue 根据 presenter 输出的 `isFilterActive` 修改 goal 样式。

多个激活 goal 以 OR 形式过滤中列任务。过滤结果的 satisfier 定义：

| Goal 类型 | satisfier | 说明 |
|-----------|-----------|------|
| project | `goal.targetProjectId` 匹配的 project 自身 | 完成该 project 即满足 goal |
| stat | effects 命中 `goal.targetStatId` 的 project | 执行后改变对应 stat |
| cluster (project) | `goal.targetProjectId` 匹配的 project | 同 project goal |
| cluster (housing) | effects 命中 `population` stat 的 project | housing goal 存储 `targetStatId: 'population'` |

过滤可见集合 = satisfier + satisfier 在当前任务树上的祖先节点（递归向上）。不包含 satisfier 的消费者（依赖 satisfier 的 project）。

过滤只改变可见性，不改变 task 插入决策。没有激活过滤时，中列恢复正常任务列表。

父节点只取当前任务树上已经存在的父节点，不为了过滤目标全局拉入不属于当前 runtime cluster 范围的 project。

如果处于过滤激活状态的 project goal 因满足而移除，presenter 同步从 `activeGoalFilterIds` 清理该 goal。Stat goal 不会因满足而移除，其过滤状态可继续保留。Goal 的过滤激活样式需要能与未满足、已满足、风险等状态叠加。

## Task 插入位置

添加 task 时，presenter 根据当前 goal 列表计算插入位置。

优先级：

1. task 能直接实现某个现存 goal。
2. task 是能实现某个现存 goal 的 task 的当前任务树父节点。
3. 多个 goal 命中时，选择当前 log 渲染顺序中位置最靠前的 goal。
4. 没有命中 goal 时，插入 task queue 末尾。

该规则不依赖当前是否有 goal 过滤。过滤只是改变用户能看到哪些 task。

## 互斥依赖

单纯 `notCompleted(project)` 不生成 goal。Presenter 输出互斥关系元数据，用于 UI 在互斥双方显示标记。

当用户添加一个与队列中已有 task 互斥的 task：

- 先加入者保持有效。
- 后加入者标记为系统禁用。
- 系统禁用的 task 不参与 goal 满足，也不进入最终提交。
- 系统禁用的 task 仍保留在 log 中显示，输出互斥原因，并提供移除操作。

该系统禁用状态不同于旧 draft queue 中的用户启用/禁用操作。用户不能通过“启用”强行启用互斥后加入项，只能移除冲突项后重新选择路线。

复合条件 blocker 需要先按当前 replay 状态求值。对 `all` / `any` 嵌套表达式，goal 生成器应基于 evaluator 结果提取可执行的正向缺口；单纯负向分支不生成 goal。

- 对纯 `completed` leaf 的 `any(A, B, ...)`：当所有分支均未满足时，返回全部未满足 leaf 的 goal（flat），不限于第一分支。用户可看到所有可选路径。
- 对含 `notCompleted` 的混合 `any(notCompleted(A), completed(B))`：A 未完成时表达式满足，不生成 goal；A 已完成且 B 未完成时，生成 `completed(B)` 的 project goal。

```
any(notCompleted(A), completed(B))
```

- A 未完成时，表达式满足，不生成 goal。
- A 已完成且 B 未完成时，生成 `completed(B)` 的 project goal。
- B 已完成时，表达式满足，不生成 goal。

## 替代旧编辑状态

旧编辑模式的三态：

- 禁用
- 启用且有效
- 启用但失效

被目标驱动模型替代。编辑模式允许添加暂时不满足前置的 task，未满足前置通过 goal 表达。

UI 操作调整：

- 单条操作从启用/禁用改为移除。
- 批量操作从全部启用/全部禁用改为移除全部。
- 完成编辑时提交非系统禁用的 task entry，自动丢弃 goal entry。
- 完成编辑时允许 cluster root goal 仍未满足，但 task 衍生的 project/stat goal 必须全部满足。
- 编辑模式下中列任务列表的 add/undo 按钮不再校验前置条件。`isEditing` prop 从 `TerraformingTaskList` 传入 `TerraformingTaskNode`（含递归子节点），按钮 `:disabled` 和 `handleSetCount` 按 `!node.available && count === 0 && !isEditing` 判断。
- Log 区域 goal entry 在 vuedraggable 中通过 `filter=".goal-entry"` 排除拖拽能力，task entry 通过 `handle=".drag-handle"` 保留拖拽排序。
- 本变更修改并取代 `terraforming-log-edit` 的编辑模式行为，新目标驱动模型不与旧 draft 三态模型并存。

## 拖拽 Task 到 Log 区域

编辑模式下中列 terraforming task 支持拖拽到右侧 log 区域以添加任务。

- TaskNode 右侧显示 `↔` 拖拽手柄（class `drag-to-log`），仅编辑模式可见。
- TerraformingTaskList 中每个 group 的 top-level nodes 包一层 vuedraggable：`group: 'terraforming-tasks'`、`pull: 'clone'`、`handle: '.drag-to-log'`。
- 目标区域 TerraformingResourcePanel 的 vuedraggable 接受 `terraforming-tasks` group drop（`put: () => true`）。
- 落点预览：拖拽悬停时在目标列表插入位置显示预览 entry，与 log entry 的 head 行样式一致（虚线蓝色边框、半透明背景、单行项目名）。实现方式参照 `drag.md`。
- 松手后在插入位置调用 `appendDraftProject`（含互斥检查与 goal 定位）。

## 非目标

- 不改变正式非编辑模式的真实 execution log 存储结构。
- 不新增 stat 方块控件语义。
- 不模拟材料、交付、建造、折扣、返还。
- 不模拟概率分支。
