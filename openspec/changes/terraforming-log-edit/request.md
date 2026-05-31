# terraforming-log-edit Request

## 目标

在 terraforming 右列任务队列中新增独立编辑模式，让用户可以在不立即改动正式执行队列的前提下调整任务顺序、插入任务、禁用/删除任务，并在拖拽或编辑后清楚看到哪些任务在当前顺序下有效或失效。同时收敛非编辑模式的执行/撤销规则，避免复杂队列编辑逻辑散落在中列和右列。

## 已确认方案（审核重点）

### 双模式执行队列

- 非编辑模式继续使用当前正式 `terraformingExecutionLog`，它表示已经确认的真实执行顺序。
- 点击右列标题栏「编辑」后进入编辑模式，创建独立的 draft execution log。
- draft queue 初始来自正式 execution log 的拷贝，编辑期间所有拖拽、插入、禁用、删除、复制只作用于 draft，不写入正式 log。
- 标题栏「编辑」按钮在编辑模式下变为「取消 | 完成」：
  - 取消：丢弃 draft，恢复正式 log 的显示。
  - 完成：仅当 draft 中不存在“启用但失效”的任务时允许；保存时自动移除禁用任务，并将剩余 draft 应用为正式 execution log。

### 编辑模式任务状态

编辑模式下，队列任务有三种状态：

- `禁用`：用户手动禁用，不参与编辑预览 replay，不贡献 completed count、stat effect 或依赖满足状态。
- `启用且有效`：参与 replay，且在当前顺序下满足项目依赖与 stat 条件。
- `启用但失效`：参与 replay，但在当前顺序下不满足依赖或 stat 条件；该状态阻止「完成」。

失效任务不应用 effects，避免后续预览被不可执行任务污染；replay 继续向后扫描，以便用户看到后续任务是否也失效。

### 编辑模式范围收缩

编辑模式只预览项目顺序与可执行性，不模拟完整经济明细：

- In：项目依赖、stat 条件、stat effects、一次性重复限制、启用/禁用/有效/失效状态。
- Out：材料、交付清单、建造时间、折扣、返还等明细计算。

非编辑模式仍可保留正式 timeline 的单条明细，但撤销相关 UI 不再展示“撤销影响”列表，只显示该项目是否允许撤销。

### 依赖语义前移到数据层

为降低 view 层复杂度，`sideEffects[].project`、`blockedProjects`、`blockedGroups`、`removedProjects` 等动态显隐/阻塞语义需要在 `terraforming-data` 阶段转换成明确分工的依赖模型：`predecessors` 保留树形结构凭据，`dependencies` 承载跨组、互斥与复杂布尔依赖。

- `predecessors` 中同组项目和 group 前置继续保留，用于任务树结构；跨组项目前置转成 `dependencies`。
- `blockedProjects` / `blockedGroups` 转成目标项目或组内项目对 blocker 完成的依赖。
- `removedProjects` 转成目标项目对 remover 未完成的互斥依赖，UI 显示为“互斥: 项目名”。
- `sideEffects[].project` 目标项目依赖生成源完成；单一来源同组时转成 `predecessors`，单一来源跨组时转成 `dependencies.completed`，多个生成源统一转成 `dependencies.any`，不进入 `predecessors`。
- `sideEffects[].project` 若参与 blocker 链，转成条件 blocker：`source 未完成 OR blocker 已完成`。
- 概率触发项目不需要页面模拟概率；原有概率展示内容保持不变，只是提前暴露“概率触发的项目”与 source project 的依赖关系。

编辑模式、非编辑撤销校验与地球化任务列表都消费 presenter 输出的统一展示模型。view 可以同时显示 `predecessors` 与 `dependencies` 的项目依赖，但不得直接解释 blocked / removed / sideEffect project 的原始动态规则。

### 编辑模式交互

- 所有任务可以任意拖拽调整顺序。
- 拖拽过程中不实时重算；拖拽完成后对 draft queue replay，并标出启用但失效的任务。
- 右列标题栏原「清空任务」按钮改为「编辑」按钮。
- 编辑模式下，原「清空任务」能力移动到队列内部第一张 card，文案为「全部禁用」。
- 建议提供「全部启用」恢复入口，避免误点「全部禁用」后恢复成本过高。
- 编辑模式下，正式的撤销按钮禁用或替换为编辑态操作。
- 可重复项目增加「复制」按钮，点击后在该项目队列条目下方复制一条相同 projectId 的 draft entry。
- 连续的重复项目中，首个项目显示禁用按钮，后续项目显示撤销/删除按钮。
- 一次性项目不允许重复插入，编辑模式与非编辑模式一致。

### 中列任务在不同模式下的行为

- 非编辑模式：
  - 点击执行必须按当前正式队列状态与前置条件添加。
  - 删除/减少次数必须与右列撤销按钮使用同一套允许撤销校验。
  - 可重复项目减少次数时，默认尝试处理该项目最后一条正式 entry；若不可撤销，则提示用户进入编辑模式处理。
- 编辑模式：
  - 点击执行就是把任务插入 draft queue 尾部。
  - 点击取消就是处理 draft queue 中该 projectId 的最后一条记录：禁用或删除。
  - 一次性项目若已在 draft 中存在启用记录，不允许再次插入。
  - 中列任务显示与 completed count 应基于 draft enabled count，避免与正式队列混淆。

### UI 观察性

- 编辑模式下每条队列记录显示稳定顺序号，拖拽后立即重排。
- 被移动、插入、删除、禁用影响的区间应有短暂高亮或状态变化标记。
- 启用但失效的任务保留在原位置，整行显示失效状态与原因。
- 队列顶部或标题区域显示整体状态：全部有效 / 存在 N 个失效任务。
- 「完成」按钮禁用时显示原因，例如“还有 3 个启用任务失效”。

## 边界

### In Scope

- 新增 right panel 编辑模式入口与 draft execution log。
- 编辑模式下的拖拽排序、插入到末尾、禁用、全部禁用、可重复复制、后续重复项删除。
- 编辑模式 replay 预览有效/失效/禁用状态。
- 完成时移除禁用项并提交 draft 到正式 execution log。
- 非编辑模式收敛执行与撤销规则，删除/减少次数使用同一撤销校验。
- 数据层输出统一依赖表达式，覆盖 predecessors、blocked、removed、sideEffect project 等语义。
- 地球化任务树保持 runtime cluster 范围限制；非静态项目只有在当前 runtime 可见项目的 `sideEffects[].project` 引入时才进入任务树。
- Presenter 负责 draft queue、replay 结果与 UI 可消费状态组装。
- Vue 只消费 presenter 输出，不直接解释业务依赖。
- `npm run build` 无编译错误。

### Out of Scope

- 编辑模式下材料、交付、建造、折扣、返还明细模拟。
- 概率事件随机模拟或概率分支推演。
- 与游戏存档写回同步。
- 测试编写（属于 `/x4:test` 阶段）。

## 验收标准（DoD）

1. 右列标题栏显示「编辑」，点击后进入编辑模式，并显示「取消 | 完成」。
2. 编辑模式使用独立 draft queue；取消后正式 execution log 不变。
3. 编辑模式下所有队列任务可拖拽排序，drop 后显示有效/失效/禁用状态。
4. 编辑模式下启用但失效的任务阻止「完成」，并显示失效原因。
5. draft 中所有任务均为有效或禁用时允许「完成」。
6. 完成后自动移除禁用任务，并将剩余 draft 应用为正式 execution log。
7. 编辑模式下「全部禁用」位于队列内部第一张 card，而非标题栏按钮。
8. 可重复项目支持复制，复制项插入到当前 entry 下方。
9. 连续重复项目中首条显示禁用操作，后续条显示删除/撤销操作。
10. 一次性项目不允许重复插入，编辑模式与非编辑模式一致。
11. 编辑模式下中列任务执行插入 draft 尾部，取消处理 draft 中最后一条对应任务。
12. 非编辑模式下执行必须满足当前前置条件；删除/减少次数必须通过撤销校验。
13. 非编辑模式右列不再展示撤销影响列表，只展示该条是否允许撤销。
14. `sideEffects[].project`、`blockedProjects`、`blockedGroups`、`removedProjects` 已由数据层转换为统一依赖表达式，view 不直接解释原始动态规则。
15. 概率触发项目只通过条件 blocker 影响依赖，概率展示文案保持原样，页面不模拟概率。
16. 同组非 `any` project predecessor 只有在 parent 和 child 都属于当前 runtime cluster 时才形成任务树父子关系；不允许为了显示子项目而全局拉入不属于当前 runtime 范围的项目。
17. `npm run build` 无编译错误。

## 未决项

无。
