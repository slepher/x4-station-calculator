# terraforming-task-goal Request

## 目标

将 terraforming 编辑模式从线性 draft queue 翻修为目标驱动的任务规划队列。用户可以从 cluster 未实现目标或任务依赖目标出发，点击目标过滤中列任务，逐步添加能够实现目标或作为目标实现链前置的任务，最终形成一条完整自洽的 terraforming execution log。

本变更直接替代 `terraforming-log-edit` 中的 draft queue 启用/禁用方案；目标 entry 是编辑模式中的派生规划辅助项，不进入正式 execution log。

## 已确认方案（审核重点）

### 目标驱动编辑队列

- 编辑模式下 log 区域不再只显示 task entry，而是显示 task entry 与系统派生的 goal entry。
- goal entry 来自两类来源：
  - cluster 的未实现任务目标，放在 log 列表末尾，作为从目标出发规划的入口。
  - 已加入 task 的未满足依赖，放在最早依赖该目标的 task 前方。
- goal entry 不支持手动排序；用户只能移动 task，goal 会随 task 顺序变化重新生成、合并和定位。
- goal entry 不进入正式 execution log；完成编辑时只提交 task entry。

### 任务添加与插入位置

- 编辑模式下，点击未执行过的 terraforming task 不再要求前置条件已满足，可以直接加入规划队列。
- 对已执行过的 task，编辑模式下不再校验撤销是否会导致其他任务不可行，可以直接移除。
- 该放宽只影响按钮是否可点击；任务卡片其他 UI 状态不变，例如禁止图标、依赖提示仍按原逻辑显示。
- 新增 task 时，系统按该 task 与现存 goal 的关系决定插入位置：
  - 如果 task 能直接实现某个现存 goal，则插入该 goal 上方。
  - 如果 task 不能直接实现 goal，但它是能实现该 goal 的 task 的父节点/前置链节点，也插入该 goal 上方。
- 如果 task 关联多个 goal，则插入最靠前的相关 goal 上方。
- “最靠前”按当前 log 渲染顺序判断，不按 goal 生成顺序或类型优先级判断。
- 如果 task 不关联任何 goal，则插入队列末尾。
- 新加入的 task 也会继续生成自己的依赖 goal。

### Goal 生成、合并与生命周期

- 为 task 的每一条未满足依赖生成一条 goal，再对同类 goal 做合并。
- 同类 project 依赖 goal 合并为一个。
- 同类 stat goal 合并为一个。
- 如果多个 task 依赖同一个 goal，goal 放在最早依赖该 goal 的 task 前方。
- Project 依赖型 goal 只在未满足时显示；当 goal 位置之前的累计 replay 状态已经满足该 project 依赖时，goal 自动移除。
- Stat 型 goal 只要仍有 task 依赖它就长期保留；满足后显示为已达成检查点，不自动移除。
- Stat goal 不因满足或依赖关系变化自动移除；它作为数值检查点长期保留。
- Cluster root goal 允许未满足；用户可以保留未完成的 cluster 入口 goal 作为后续规划入口。
- Task 衍生的 goal 不允许在完成编辑时仍未满足。
- 传送目标不生成占位 goal。

### Stat goal 方块表示

- Stat goal 必须复用 `terraforming-blocks` 中已经确认的方块控件语义，不新增另一套方块表示。
- Stat goal 所在位置之前的累计 stat 值作为方块 `currentValue`。
- 目标条件推导出的目标值作为 `targetValue`。
- 方块图显示从 `currentValue` 到 `targetValue` 的 diff：
  - `targetValue > currentValue` 时使用 increase overlay。
  - `targetValue < currentValue` 时使用 decrease overlay。
  - 当前值已满足条件时 diff 为 0。
- Stat goal 可显示条件外框，因为 goal entry 是目标检查点，不是普通 task 执行记录。
- 无 `ranges` 的数字型 stat 不画方块，使用单行文本表达当前值、目标值和差值。
- 范围型条件中，若当前值不满足条件，`targetValue` 取离当前位置累计值最近的满足边界。

### 点击 goal 过滤任务

- 点击 goal entry 后，该 goal 进入过滤激活状态，goal 样式必须变化。
- 再次点击同一个 goal，取消该 goal 的过滤激活状态。
- 多个 goal 可以同时激活过滤；多个过滤以 OR 形式共存。
- 有激活过滤时，中列 terraforming task 列表显示：
  - 能直接实现任一激活 goal 的 task。
  - 这些直接实现 task 在当前任务树上的父节点。
- 父节点范围仅限当前任务树中已经存在的父节点，不为了过滤目标全局拉入不属于当前 runtime cluster 范围的 project。
- 没有激活过滤时，中列恢复正常任务列表。
- 过滤只影响中列 task 可见性，不改变 task 插入算法；task 插入仍按它与现存 goal 的可实现关系计算。
- 在目标过滤状态下添加 task 时，如果该 task 关联当前激活 goal，则仍插入相关 goal 上方；如果关联多个 goal，插入最靠前的相关 goal 上方。
- 如果处于过滤激活状态的 project goal 因满足而移除，其过滤状态也必须自动清理；stat goal 不会因满足而移除，因此过滤状态可继续保留。
- 过滤激活样式必须能与 goal 本身状态叠加，例如未满足且过滤中、已满足 stat goal 且过滤中、存在风险且过滤中。

### 互斥依赖处理

- 单纯 `notCompleted(project)` 依赖不额外生成 goal。
- 单纯互斥关系在互斥双方 task/project 上打互斥标记。
- 当队列中已经存在互斥一方后，后加入的互斥对象被系统禁用，并且不参与目标满足与最终提交。
- 这里的禁用不是旧 draft queue 的用户启用/禁用机制；它只表示互斥冲突导致的系统状态。
- 系统禁用的互斥 entry 仍保留显示，必须显示互斥原因，并提供移除操作。
- 复合条件 blocker 仍可生成 goal。例如 `未执行 消灭有毒水果 OR 执行 消灭寄生虫`：
  - 如果“消灭有毒水果”未执行，条件已满足，不生成 goal。
  - 如果“消灭有毒水果”已执行且“消灭寄生虫”未执行，则生成“执行 消灭寄生虫”的 project goal。
- 有互斥风险的 task 仍允许显示为候选，但必须标记风险。
- 更一般地，对 `all` / `any` 嵌套复合依赖，goal 生成器应基于 evaluator 结果提取可执行的正向缺口；单纯负向分支不生成 goal。

### 替代旧 draft 启用/禁用方案

- 不再使用「禁用 / 启用且有效 / 启用但失效」的 draft 三态模型。
- 不再提供用户手动启用/禁用 task 的操作。
- 单条 draft 操作改为「移除」。
- 顶部的「全部启用 / 全部禁用」替换为「移除全部」。
- Goal 用于暴露未满足缺口并支持过滤；它不阻止用户继续添加后续 task。
- 完成编辑时，允许 cluster root goal 仍未满足，但不允许 task 衍生的 goal 仍未满足。
- 本变更修改并取代 `terraforming-log-edit` 的编辑模式行为；新目标驱动模型不与旧 draft 三态模型并存。
- 可重复项目复制按钮从 `terraforming-log-edit` 延续：**可重复项目始终显示复制按钮**（不限于相邻同名 entry 存在时），点击后在该 entry 下方复制一条相同 projectId 的 draft entry。

## 边界

### In Scope

- 编辑模式 log 区域支持 task entry 与 goal entry 混排展示。
- cluster 未实现任务目标在 log 列表末尾生成 root goal（含 build_project 与 build_housing 两类 objective）。
- task 未满足依赖从 `project.dependencies` 和 `project.predecessors` 两处提取，生成、合并、定位 goal。
- predecessor 中 `any` 标记的任意满足语义与 `checkPredecessors()` 对齐。
- 点击 goal 触发 OR 过滤，并显示能实现 goal 的 task 及其父节点/前置链 task。
- Goal 检测目标 project 是否已作为 draft task 存在于队列中，若存在但排序靠后则显示排序提示与"移到此处"按钮。
- 编辑模式下放宽 task 添加与移除按钮的可点击限制。
- 新增 task 按目标关系自动插入 goal 上方或队列末尾。
- Project goal 满足后移除；stat goal 满足后作为检查点保留。
- Stat goal 复用 `terraforming-blocks` 方块语义。
- 单纯互斥不生成 goal；复合条件 blocker 按可实现正向分支生成 goal。
- 替换旧的 draft 启用/禁用操作为移除/移除全部。
- Presenter 负责 goal 生成、过滤状态、插入位置与 UI 可消费模型。
- `TerraformingDraftTimelineEntry` 暴露 `price` 和 `wares` 字段供 UI 显示材料信息。
- Vue 只消费 presenter 输出，不直接解释业务依赖。
- `npm run build` 无编译错误。

### Out of Scope

- 编辑模式下材料、交付、建造、折扣、返还明细模拟。
- 概率事件随机模拟或概率分支推演。
- 与游戏存档写回同步。
- 新增 stat 方块控件语义；本变更只复用 `terraforming-blocks`。
- 测试编写与测试执行（属于 `/x4:test` 阶段）。

## 验收标准（DoD）

1. 编辑模式 log 区域显示 task entry 与系统派生 goal entry。
2. cluster 未实现任务目标生成 root goal，并显示在 log 列表末尾。
3. 已加入 task 的每条未满足依赖生成 goal，并在生成完成后合并同类 goal。
4. 多个 task 依赖同一 goal 时，goal 显示在最早依赖该 goal 的 task 前方。
5. Goal 不支持手动排序；移动 task 后 goal 位置自动重新生成。
6. Project goal 在其位置之前累计状态满足后自动移除。
7. Stat goal 在仍有 task 依赖时满足后继续保留，并显示已达成状态。
8. Stat goal 使用目标位置之前的累计值作为 `currentValue`，用目标条件推导 `targetValue` 并展示 diff。
9. 点击 goal 后 goal 样式变化，中列任务列表进入过滤状态。
10. 再次点击已激活 goal 后取消该 goal 的过滤状态。
11. 多个激活 goal 以 OR 形式过滤任务列表。
12. 过滤后中列显示能实现目标的 task，以及这些 task 的父节点/前置链 task。
13. 过滤后的父节点仅限当前任务树上的父节点，不全局拉入 runtime cluster 外项目。
14. 过滤只影响可见性，不改变新增 task 的插入算法。
15. 新增 task 若能直接实现现存 goal，或是实现该 goal 的 task 的树上父节点，则插入相关 goal 上方。
16. 多个相关 goal 命中时，插入当前 log 渲染顺序最靠前的相关 goal 上方。
17. 新增 task 不关联任何 goal 时插入队列末尾。
18. 编辑模式下未满足前置的未执行 task 仍可点击加入规划队列。
19. 编辑模式下已执行 task 可以直接移除，不再校验是否会导致其他 task 不可行。
20. 单纯 `notCompleted(project)` 不生成 goal，只在互斥双方打互斥标记。
21. 后加入的互斥对象被系统禁用、保留显示、显示互斥原因，并排除出目标满足与最终提交。
22. 复合条件 blocker 在负向分支已被破坏时生成可执行正向分支 goal。
23. 有互斥风险的 task 在目标过滤结果中仍可见，并显示风险标记。
24. Project goal 移除时，其过滤状态自动清理；过滤样式可与 goal 状态叠加显示。
25. 完成编辑时允许 cluster root goal 未满足，但 task 衍生 goal 必须全部满足。
26. 旧的启用/禁用/三态 draft UI 被移除，单条操作为“移除”，批量操作为“移除全部”。
27. 完成编辑时只提交 task entry，goal entry 不进入正式 execution log。
28. `npm run build` 无编译错误。

## 未决项

无。
