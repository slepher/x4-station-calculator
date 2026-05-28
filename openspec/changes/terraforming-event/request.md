# terraforming-event Request

## 目标

将 terraforming 事件从用户手动执行的 task 变更为系统自动管理：影响 stat 的事件在条件满足时自动插入执行队列，不影响 stat 的多次事件在条件未解决时产生预防型 goal。事件不再提供手动点击执行或拖拽能力。

## 已确认方案（审核重点）

### 事件分类

按 `project.effects` 是否有内容划分两类：

| 类别 | 判定 | 事件 | 触发类型 |
|------|------|------|---------|
| **影响 stat** | `effects.length > 0` | evt_icemelt, evt_globalwarming_co2, evt_globalwarming_methane, evt_solidify_crust, evt_volcano_extinction, evt_salinization | ONE_TIME ×4 + REPEATABLE ×2 |
| **不影响 stat** | `effects.length = 0` | evt_quake_mild, evt_quake_moderate, evt_quake_severe | REPEATABLE ×3 |

> 注意: xenon group 下的项目不受此规则约束，保持原有行为。

### 编辑模式（draft 规划）

#### 规则 A：影响 stat 的事件 — 自动插入 task entry

- replay 过程中，当累积 stats 首次满足事件的全部 conditions 时，自动插入该事件。
- 插入位置：导致条件变为满足的 entry 之后。
- 每个事件最多插入一次，repeatable 事件也只插入一次。
- 显示为 task entry 并追加 `[EVENT]` 标签，不可手动移除或拖拽。
- `planDisplayEntries` interleaving 顺序：同一 position 下 auto-event > stat goal > project goal。

#### 全局阻断机制

- replay 期间首次出现 **与事件 stat 相关的 stat goal**（即 draft entry 的 conditions 中，与任一事件 condition 的 stat 相同的 stat goal）时，停止后续全部 auto-insert。
- position 0（初始状态）的 auto-insert 不受阻断。

#### 规则 B：不影响 stat 的多次事件 — 预防型 goal

- 全 replay 完成后（含已插入的 auto-event），若事件 conditions 仍满足，在队列开头插入预防型 goal。
- `position: 0`, `kind: 'preventive'`, `targetStatId: 'seismicactivity'`。
- 显示模型：icon + event name + reqStatBlocks（多行 target 方块）+ 圈圈。
- 点击施加双重过滤：satisfier（effects 反向的 project）+ req stats（effects 命中 reqStatBlock 中任一 stat 的 project），OR 合并。
- 预防型 goal 不与同类 stat goal 合并（语义不同）。
- cumulativeStats 脱离危险区后自动移除。

#### 任务树

- events group 下所有项目不再提供手动点击添加和拖拽操作。
- 编辑模式放宽前置条件的规则对事件不适用（事件已不在手动任务树中）。

### 非编辑模式（正式执行）

#### 影响 stat 的事件

- 用户每次点击执行一个 task 后，检查所有此类事件。
- 若条件满足且事件未完成（ONE_TIME 类事件已完成则跳过，REPEATABLE 事件不跳过），自动执行该事件并记入 execution log。
- 若初始 stats 已满足条件且 executionLog 为空 → 进入集群时自动执行（不补执行已有 log 的集群）。

#### 不影响 stat 的多次事件

- 不自动执行。
- 若执行后条件仍满足，在 execution log 末尾插入一条警报提示，说明事件尚未解决。

### 完成编辑 / 提交

- 编辑模式：auto-event entry 随 plan 一并提交；预防型 goal 不提交。
- 非编辑模式：自动执行的事件作为正式 execution entry 记入 log。

## 边界

### In Scope

- 编辑模式 auto-event 插入 + 全局阻断机制
- 编辑模式预防型 goal 生成
- 非编辑模式自动事件执行
- 非编辑模式警报提示
- events group 移除手动操作入口
- `TerraformingGoalKind` 新增 `'preventive'`
- `TerraformingGoalPlanDisplayEntry` 新增 `auto-event` 类型

### Out of Scope

- 同一 repeatable 事件多次插入
- 事件概率/回退模拟
- xenon group 行为变更
- 事件拖拽、排序

## 验收标准（DoD）

1. 编辑模式 replay 中，影响 stat 的事件条件满足后自动显示为 task entry，带 `[EVENT]` 标签。
2. 编辑模式符合阻断规则的位置不再出现 auto-event。
3. 每个影响 stat 的事件最多出现一次。
4. 不影响 stat 的多次事件条件满足时，预防型 goal 出现在队列开头。
5. 预防型 goal 在 cumulativeStats 脱离危险区后消失。
6. 编辑模式 events group 不提供手动添加和拖拽。
7. 非编辑模式执行 task 后，满足条件的影响 stat 事件自动执行入 log。
8. ONE_TIME 影响 stat 事件已完成后不再重复自动执行。
9. 非编辑模式不影响 stat 事件条件满足时 log 末尾显示警报。
10. 完成编辑时 auto-event 随 plan 提交，预防型 goal 不提交。
11. `npm run build` 无编译错误。

## 未决项

无。
