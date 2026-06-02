# terraforming-blocks Tasks

## 1. 更新 OpenSpec 文档

- [x] 同步 `request.md`，明确“同 stat 条件和效果合并”为本次唯一核心目标
- [x] 新增 `specs/terraforming-blocks/spec.md`，覆盖任务树合并展示、队列方块化、数字型 stat 单行规则
- [x] 新增 `design.md`，明确 presenter 聚合模型、组件收敛边界、任务树/任务队列差异

## 2. Presenter：任务树按 stat 聚合

- [x] 在 `useTerraformingPresenter.ts` 中新增任务树 stat line 组装模型
- [x] 从项目条件中抽取 stat 条件，并保留现有 state-range/value-range 语义
- [x] 从项目 effects 中抽取 stat effect，并标识 increase/decrease/set/none
- [x] 按 `statId` 合并条件与效果，保证同一 stat 只输出一条 UI line
- [x] 对无 `ranges` 的 stat 生成数字型单行文本模型

## 3. 方块组件：同图渲染条件与效果

- [x] 扩展现有 `TerraformingStatScale.vue` 或等价唯一基础组件，支持同一条方块图同时渲染：
  - [x] 当前值
  - [x] 条件外框
  - [x] 效果叠加
- [x] 保持现有条件外框覆盖在方块图上方的语义，不改成旁置需求条
- [x] 为任务树单行场景收敛紧凑布局：`stat名 + 方块图 + 效果文案`

## 4. 任务树组件重构

- [x] 在 `TerraformingTaskNode.vue` 中新增 `stat-impact-list`
- [x] 从 `condition-list` 中移除 stat 条件的重复展示
- [x] 从 `effect-list` 中移除 stat effect 的重复展示
- [x] 保留 dependency 作为独立条件条目
- [x] 保留 rebate / sideEffect / description 作为独立效果条目

## 5. 任务队列：单行效果方块图

- [x] 在 execution timeline presenter 中新增队列 stat line 组装
- [x] 对有 `ranges` 的 stat 输出单行效果方块图
- [x] 对无 `ranges` 的 stat 输出单行 `before -> after` 文本
- [x] 队列中的 stat 行不显示条件外框
- [x] 队列中的 stat 行不显示 `+2(max:5)` / `-2(min:3)` 这类效果文案

## 6. 清理与回归检查

- [x] 清理任务树中已失效的“同 stat 分层展示”文案与样式
- [x] 清理任务队列中与新方块图重复的 stat 效果文字
- [x] 确认任务树与任务队列对同一 stat 使用一致的方块语义
- [x] 运行 `npm run build`，确保变更后无编译错误
