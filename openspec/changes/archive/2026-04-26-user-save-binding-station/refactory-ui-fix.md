# user-save-binding-station Refactory UI Fix

## Purpose

本文件用于记录对提交 `8ef4c94` 的审查结论，并将“UI 去耦首轮落地后遗留的问题”整理为可执行的修正方向。

该提交的主目标是：

- 将 production workbench UI 从中层 store 直接依赖中解耦
- 让 `ProductionWorkbenchView` 成为当前唯一的 store 入口
- 让中层组件改为 props / emits 驱动

但从当前代码状态看，这次提交虽然建立了 props 化方向，却没有完全收紧边界，且引入了若干新的风险点。

本文件回答四个问题：

1. `8ef4c94` 做到了什么
2. 哪些地方没有做到位
3. 哪些地方做错了或引入了行为回退
4. 下一步应该如何修正，而不是继续在当前中间态上堆新逻辑

---

## 当前结论

### F1. 这次提交完成了 UI 去耦的“形”，但还没有完成“边界收口”

`8ef4c94` 的价值主要在于：

- `StationTabBar` 改成了 props + emits
- `ContextToolbar` 改成了 props + emits 形态
- `StationPlanningPanel` / `StationModulePicker` 移除了中层对 station store 的直接读取
- `StationWareFlowsDashboard` / `StationDashboard` 被改成 props 输入为主
- `ProductionWorkbenchView` 成为了新的集中装配点

这说明 UI 去耦方向是对的。

但当前状态更准确的判断是：

- 中层组件接口已经开始成型
- 顶层编排与外围 modal 仍然没有收口
- 新增的类型与 composable 还没有成为可靠 contract

所以这不是“UI 去耦完成”，而是“UI 去耦的第一轮骨架已经搭出来”。

### F2. `ProductionWorkbenchView` 现在承担了过多的临时编排责任

当前 `ProductionWorkbenchView` 不仅是顶层 store 入口，还承担了：

- toolbar 数据组装
- station planning 数据组装
- ware flow 数据组装
- transit hub 数据组装
- station gap 计算
- 大量 update handler
- 多个字段的直接 persisted object 写入

这会导致它成为新的 UI 总编排器。

如果不及时收口，后续虽然中层组件不再直接依赖 store，但系统仍然会从：

- “store 穿透到中层组件”

变成：

- “所有复杂度堆在 `ProductionWorkbenchView`”

这只是换了一个热点，不是真正的重构完成。

### F3. 部分写路径回退成了“直接修改对象”

这次提交里，若干本应通过命令层/显式 action 的变更，被回退为直接修改 `activeStation`：

- station type
- station count
- station minerals
- reorder modules

这与之前 refactory 系列建立的原则冲突：

- 不要让组件或页面层直接改 persisted object
- 应通过统一入口触发 recompute / dirty / sync

这类回退虽然短期看起来能工作，但会让：

- recompute
- binding draft
- dirty 标记
- flow cache

等链路重新依赖隐式副作用。

### F4. `ImportPlanModal` 仍然是 UI 去耦中的未收口旁路

虽然 `ContextToolbar` 已经 props 化，但它仍然内部直接挂载：

- `ImportPlanModal`

而 `ImportPlanModal` 仍直接依赖：

- `useEmpireStore`

这意味着 production workbench 子树仍保留一个绕过顶层边界的 store 旁路。

从架构上说，这会带来两个问题：

1. `ContextToolbar` 仍不是纯展示层
2. 后续消除 `useEmpireStore` 时，modal 会成为再次返工的阻塞点

### F5. 新增的 types / composables 还没有成为可靠 source of truth

这次提交新增了：

- `src/types/production-ui.ts`
- 多个 `use*Model.ts`

但至少存在以下问题：

- 一些 composable 还没真正接入主路径
- 一些 props contract 与真实组件需求不一致
- 一些字段定义不完整

例如：

- `useContextToolbarModel` 在 transit 模式下只提供 `racePreference`，但真实 toolbar 还依赖 `sunlight`、`transportMinutes`、`showEmpireGaps`、`considerWorkforceForAutoFill`
- `StationDashboardProps.stationAnalysis` 在类型里漏掉了 `totalWorkerDiff`

这意味着当前这些类型层更接近“草稿 contract”，而不是可以放心依赖的正式 contract。

---

## 具体问题清单

### P1. 页面层直接写 persisted station 对象

当前 `ProductionWorkbenchView` 中存在以下直接写法：

- 更新 station type
- 更新 station count
- 更新 minerals
- reorder modules 时直接替换 `activeStation.modules`

问题在于：

- 写路径没有显式统一
- 依赖其他地方自动同步
- 容易绕过 store 命令层与计算刷新逻辑

这是行为层面的风险，不只是结构问题。

### P2. `ImportPlanModal` 仍然直接依赖 `useEmpireStore`

当前 `ContextToolbar` 虽然已经 props 化，但并没有真的把 import 动作上抛到顶层，而是：

- 内部控制 modal 打开
- modal 内部继续读 empire store

结果就是：

- toolbar 与 modal 形成一条绕过 `ProductionWorkbenchView` 的业务旁路

### P3. `ProductionWorkbenchView` 仍然手写大量局部 view-model

虽然新增了多个 composable，但主路径上实际仍有大量组装逻辑留在 `ProductionWorkbenchView`：

- toolbar props
- planning props
- ware flow settings
- empire gaps
- dashboard props
- transit props

这使得 composable 的存在价值没有真正落地，也让页面层体积继续膨胀。

### P4. 局部 composable 没接线或接线不完整

当前新增 composable 中，存在：

- 已创建但未实际使用
- 已创建但 contract 与组件真实需求不一致

的问题。

这会带来一个 review 误区：

- 看起来“已经拆了”
- 但实际上只是多了几层未完全接线的中间文件

### P5. `production-ui.ts` 存在 contract 漂移

当前类型文件已经被当作接口层使用，但实际与真实组件不完全一致。

这种问题比“没有类型”更危险，因为它会给接手的人一种错误稳定感。

---

## 修正目标

### G1. 先修写路径，不让 UI 去耦引入业务回退

第一优先级不是继续新增更多 props，而是先修复：

- 页面层直接写 persisted object

应恢复到：

- 页面层表达意图
- 统一 action / command 执行变更

### G2. 让 `ImportPlanModal` 真正脱离 `useEmpireStore`

这一步是 UI 边界是否收口的关键。

目标应是：

- `ContextToolbar` 不再直接掌握业务 store
- `ImportPlanModal` 不再直接访问 `useEmpireStore`
- 导入动作由 `ProductionWorkbenchView` 注入

### G3. 让新增 composable 真正成为主路径

当前不是缺文件，而是缺接线。

下一步应优先：

- 把 `ProductionWorkbenchView` 中重复的 props 组装迁入对应局部 composable
- 避免页面层继续手写大块 mapping

### G4. 让 `production-ui.ts` 变成可信 contract

要求：

- 类型必须与组件真实消费字段一致
- 不允许继续保留“编译能过但语义不完整”的接口定义

---

## 建议修正顺序

### Phase Fix-1: 修复行为回退

先处理 `ProductionWorkbenchView` 中直接修改 station 对象的几条写路径：

- station type
- station count
- minerals
- reorder modules

要求：

- 不再直接写 `activeStation`
- 改为走显式 action / store 方法 / command

这是最优先修复项，因为它关系到业务正确性。

### Phase Fix-2: 拆掉 import 旁路

处理：

- `ContextToolbar`
- `ImportPlanModal`

目标：

- toolbar 只发 `openImport`
- modal 由 `ProductionWorkbenchView` 或上层控制
- import station / create station / apply payload 全部由上层注入

### Phase Fix-3: 让局部 composable 真正接入主路径

优先接入：

- `useStationTabBarModel`
- `useContextToolbarModel`
- `useStationPlanningPanelModel`
- `useStationWareFlowsModel`
- `useStationDashboardModel`
- `useTransitHubWorkbenchModel`

要求：

- `ProductionWorkbenchView` 不再手写同一份 props 映射
- composable 只负责各自局部模型，不跨区组装

### Phase Fix-4: 校正 contract

校正：

- `production-ui.ts`
- 各组件 props 定义
- 各 composable 输出类型

重点检查：

- `ContextToolbarProps`
- `StationDashboardProps`
- `StationWareFlowsDashboardProps`

### Phase Fix-5: 回归验证

至少验证：

- station type/count/minerals/modules 修改后行为正确
- `showEmpireGaps` 开关仍正常
- import 流程可用
- overview / station / transit 三种模式切换正常

---

## 成功标准

只有满足以下条件，才算完成对 `8ef4c94` 的修正：

- `ProductionWorkbenchView` 不再直接修改 persisted station 对象
- `ImportPlanModal` 不再直接依赖 `useEmpireStore`
- `ContextToolbar` 只负责展示和发意图，不再内嵌业务旁路
- 新增的局部 composable 已接入主路径，而不是仅存在于代码库中
- `production-ui.ts` 与真实组件需求一致
- UI 去耦没有引入 station 编辑、gap 展示、import 行为回退

---

## 非目标

本文件不要求在这一轮内完成：

- `useEmpireStore` 的最终消除
- 双入口 store 最终落地
- 所有 modal 的统一重构

本轮只要求：

- 把 `8ef4c94` 留下的中间态问题修平
- 让 UI 去耦这条线重新回到可持续推进的状态
