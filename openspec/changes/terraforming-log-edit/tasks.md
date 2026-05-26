# terraforming-log-edit Tasks

## 1. 数据层依赖归一化

- [x] 1.1 在 terraforming project 类型中新增统一依赖表达式字段 `dependencies`
- [x] 1.2 保留同组项目和 group `predecessors` 作为任务树结构凭据，并将跨组项目前置转换为 `dependencies`
- [x] 1.3 将 `blockedProjects` 转换为被阻塞项目对 blocker 完成的依赖
- [x] 1.4 将 `blockedGroups` 转换为组内项目对 blocker 完成的依赖
- [x] 1.5 将 `removedProjects` 转换为目标项目对 remover 未完成的互斥依赖
- [x] 1.6 将 `sideEffects[].project` 参与的 blocker 转换为条件 blocker，并保留概率展示字段
- [x] 1.7 保持原概率 effect-list 展示语义不变，不引入概率模拟
- [x] 1.8 对二选一分支含 sideEffect blocker 的项目输出等效表达式，例如 `A OR (B AND blocker)`
- [x] 1.9 group 前置只作为展示标记，evaluator 跳过 `groupCompleted` / `groupNotCompleted`
- [x] 1.10 sideEffect 目标项目依赖其生成源；单来源同组转 `predecessors`，单来源跨组转 `dependencies.completed`，多个生成源统一用 `dependencies.any` 且不进入 `predecessors`

## 2. 共享执行可用性 evaluator

- [x] 2.1 抽出轻量 `evaluateTerraformingProjectExecution`，不构建完整 TaskTree
- [x] 2.2 evaluator 支持一次性项目重复限制
- [x] 2.3 evaluator 支持统一依赖表达式
- [x] 2.4 evaluator 支持 stat conditions
- [x] 2.5 evaluator 支持运行时项目池判断
- [x] 2.6 非编辑添加、非编辑撤销校验、编辑 draft replay 共用该 evaluator

## 3. Presenter 编辑模式状态

- [x] 3.1 在 `useTerraformingPresenter` 中增加编辑模式状态
- [x] 3.2 进入编辑模式时从正式 execution log 创建 draft execution log
- [x] 3.3 取消编辑时丢弃 draft
- [x] 3.4 完成编辑时校验无启用失效项，移除禁用项，并提交为正式 execution log
- [x] 3.5 新增 draft replay，输出禁用 / 启用有效 / 启用失效三态
- [x] 3.6 replay 中失效项不应用 effects，但继续扫描后续 entry
- [x] 3.7 输出完成按钮可用性、invalid count 与失败原因

## 4. 右列编辑模式 UI

- [x] 4.1 标题栏「清空任务」替换为「编辑」
- [x] 4.2 编辑模式下标题栏显示「取消 | 完成」
- [x] 4.3 编辑模式下队列顶部新增「全部禁用」card
- [x] 4.4 提供「全部启用」恢复入口
- [x] 4.5 draft entry card 显示依赖项、stat effects、依赖 stat、状态与失效原因
- [x] 4.6 编辑模式下不显示材料、交付、建造、折扣、返还明细
- [x] 4.7 编辑模式下正式撤销按钮禁用或替换为编辑态操作
- [x] 4.8 非编辑模式不再显示撤销影响详情，仅显示是否允许撤销
- [x] 4.9 `notCompleted` 依赖显示为“互斥: 项目名”，不显示为“需要 项目名”
- [x] 4.10 edit log 隐藏组依赖正文；entry 无正文内容时只显示标题行
- [x] 4.11 地球化任务列表同时显示同组 `predecessors` 与 `dependencies` 依赖，并隐藏 group 依赖
- [ ] 4.12 任务树父子关系保持 runtime cluster 范围限制，不为潜在子项目全局拉入无关项目

## 5. 拖拽、插入、禁用、复制

- [x] 5.1 支持 draft queue 任意拖拽排序
- [x] 5.2 拖拽 hover 期间不 replay，drop 后 replay 并标出失效任务
- [x] 5.3 支持单条启用/禁用
- [x] 5.4 可重复项目支持复制到当前 entry 下方
- [x] 5.5 连续重复项目首条显示禁用，后续条显示删除/撤销
- [x] 5.6 一次性项目不允许重复插入

## 6. 中列任务交互分流

- [x] 6.1 非编辑模式执行任务前使用 evaluator 校验当前正式队列尾部状态
- [x] 6.2 非编辑模式一次性项目只允许 0 -> 1
- [x] 6.3 非编辑模式可重复项目每增加 1 次追加一条正式 entry
- [x] 6.4 非编辑模式删除/减少次数走正式撤销校验，不直接删 count
- [x] 6.5 编辑模式点击执行插入 draft queue 尾部
- [x] 6.6 编辑模式点击取消处理 draft 中该 projectId 最后一条记录（禁用或删除）
- [x] 6.7 编辑模式下中列 count 与完成状态基于 draft enabled count

## 7. 构建验证

- [x] 7.1 `npm run build` 通过
- [x] 7.2 若出现编译错误，修复后重新运行 `npm run build`
