# terraforming-task-goal Tasks

## 1. Presenter：目标驱动编辑模型

- [x] 1.1 在 `useTerraformingPresenter` 中替换旧 draft 启用/禁用状态模型，建立编辑模式 task queue 与派生 goal 输出
- [x] 1.2 为 cluster 未实现任务目标生成 log 末尾 root goal，并排除传送目标
- [x] 1.3 从 task 未满足依赖生成候选 goal
- [x] 1.4 合并同类 project goal 与 stat goal
- [x] 1.5 根据最早依赖者定位 goal
- [x] 1.6 实现 project goal 满足后移除
- [x] 1.7 实现 stat goal 满足后长期保留
- [x] 1.8 完成编辑时允许 cluster root goal 未满足，但阻止 task 衍生 goal 未满足的计划提交

## 2. Presenter：Stat goal 展示模型

- [x] 2.1 基于 goal 所在位置之前的 replay 累计值生成 stat goal `currentValue`
- [x] 2.2 从 stat condition 推导 `targetValue`，范围条件取最近满足边界
- [x] 2.3 复用 `terraforming-blocks` 的方块 line 模型表达 increase/decrease diff
- [x] 2.4 对无 `ranges` 的数字型 stat goal 输出单行文本模型
- [x] 2.5 区分 goal row 与普通 task execution row，使 goal row 可显示条件外框

## 3. Presenter：Goal 过滤与任务可见性

- [x] 3.1 增加 goal 过滤激活状态集合
- [x] 3.2 点击 goal 切换过滤激活状态，并输出 UI 样式状态
- [x] 3.3 多个激活 goal 以 OR 形式过滤中列 task
- [x] 3.4 过滤结果包含能直接实现目标的 task
- [x] 3.5 过滤结果包含这些 task 在当前任务树上的父节点
- [x] 3.6 无激活过滤时恢复正常任务列表输出
- [x] 3.7 project goal 移除时清理对应过滤状态
- [x] 3.8 goal 过滤激活样式与未满足、已满足、风险等状态叠加显示

## 4. Presenter：Task 添加、移除与插入位置

- [x] 4.1 编辑模式下允许未满足前置的未执行 task 直接加入规划队列
- [x] 4.2 编辑模式下允许已执行 task 直接移除，不做撤销影响校验
- [x] 4.3 新增 task 能直接实现现存 goal 时插入 goal 上方
- [x] 4.4 新增 task 是可实现目标 task 的当前任务树父节点时插入对应 goal 上方
- [x] 4.5 新增 task 关联多个 goal 时插入当前 log 渲染顺序最靠前的相关 goal 上方
- [x] 4.6 新增 task 不关联任何 goal 时插入队列末尾
- [x] 4.7 插入位置计算不依赖当前过滤状态

## 5. Presenter：互斥与复合 blocker

- [x] 5.1 单纯 `notCompleted(project)` 不生成 goal
- [x] 5.2 为互斥双方输出互斥标记
- [x] 5.3 后加入的互斥对象标记为系统禁用
- [x] 5.4 系统禁用对象保留显示、显示互斥原因、提供移除操作
- [x] 5.5 系统禁用对象不参与 goal 满足且不进入最终提交
- [x] 5.6 目标过滤结果中有互斥风险的候选 task 仍可见并显示风险标记
- [x] 5.7 复合条件 blocker 在负向分支被破坏时生成可执行正向分支 goal
- [x] 5.8 对 `all` / `any` 嵌套依赖提取可执行正向缺口，不为单纯负向分支生成 goal

## 6. UI：Log 区域目标驱动编辑

- [x] 6.1 log 区域渲染 task entry 与 goal entry
- [x] 6.2 goal entry 支持点击切换过滤状态并显示激活样式
- [x] 6.3 goal entry 不提供拖拽排序能力
- [x] 6.4 task entry 保留拖拽排序能力 (via emit: moveDraftEntry / reorderDraftEntries)
- [x] 6.5 单条 task 操作替换为移除
- [x] 6.6 顶部批量操作替换为移除全部
- [x] 6.7 移除旧的全部启用、全部禁用与用户手动启用/禁用 UI

## 7. UI：中列任务列表

- [x] 7.1 中列任务列表消费 presenter 的过滤后 task 输出
- [x] 7.2 过滤激活时显示能实现目标的 task
- [x] 7.3 过滤激活时显示目标实现 task 在当前任务树上的父节点
- [x] 7.4 编辑模式下按钮可点击性按新规则放宽
- [x] 7.5 保留任务卡片禁止图标、依赖提示等现有展示语义

## 8. 提交与构建

- [x] 8.1 完成编辑时只提交非系统禁用的 task entry
- [x] 8.2 确认 goal entry 不进入正式 execution log
- [x] 8.3 清理旧 draft 三态相关的提交阻断逻辑
- [x] 8.4 新提交阻断逻辑允许 cluster root goal 未满足，阻止 task 衍生 goal 未满足
- [x] 8.5 确认目标驱动模型取代 `terraforming-log-edit` 旧编辑模式且不与旧三态并存
- [x] 8.6 运行 `npm run build`
- [x] 8.7 若出现编译错误，修复后重新运行 `npm run build`

## 9. Bug 修复：goal 生成路径顺序 stats 重放

- [x] 9.1 `generateGoalEntries` 的 stat goal satisfaction 回放改用 `computeSequentialStatsFromLog(slice)` 替代累积 `computeTerraformingRuntimeStats`
- [x] 9.2 `generateGoalEntries` 的 fallback `checkStats` 改用增量顺序 `sequentialGoalStats` 替代 `cumulativeStats`
- [x] 9.3 `generateGoalEntries` 新增 `goalProjectMap` / `goalIgnoredStats` / `sequentialGoalStats` 追踪
