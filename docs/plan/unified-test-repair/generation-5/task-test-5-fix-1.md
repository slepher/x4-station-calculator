# task-test-5-fix-1：候选区 T0 与 Energy Cells 操作限制

- Plan: plan.md
- Context: context.md
- Kind: coding
- Lane: coding
- Worktree path: /home/slepher/project/x4-station-calculator/.worktree/coding
- Branch: workflow/unified-test-repair-coding
- Target branch: develop
- Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Evidence target: da05d84514c90428fd4e51907df9b6424fa5ccff
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Test candidate: b2060a45d41697593e09ac405a9064f436cc5fd1
- Depends on: none
- Covers: none
- Returns to: task-test-5
- Route: coding -> target -> integrate -> target
- Execution strategy: split-def
- Worker role: def_coding_worker
- Worker profile: /home/slepher/.codex/workflow-agents/def-coding-worker.toml（gpt-5.6-luna / medium）
- Reviewer: reviewer；独立于 coding worker，完整修复审查后才可交 dispatcher 判定 target 合并。
- Reviewer profile: /home/slepher/.codex/workflow-agents/reviewer.toml（gpt-5.6-sol / high）
- Goal: 在真实 pointer 启动之前拒绝 raw T0 与 Energy Cells 候选操作，隐藏其快速添加入口，保持合法产物的既有拖放与添加行为。
- Owned paths: `src/components/logic-flow/presenters/useLogicFlowCandidatePresenter.ts`, `src/components/logic-flow/LogicFlowCandidateZone.vue`, `tests/unit/logic-flow/logic-flow-candidate.spec.ts`
- Activation gate: task-test-5.1 按父合同先完成有界 test-owned 纠错并提供 reviewer 确认的独立 oracle 与失败签名；本修复合同获接受后执行。该纠错只留 integrate checkpoint，不合 target，不恢复 task-test-5.1 的通过判定或后续子任务。

## 有界拓扑与输入身份

本合同是已接受 generation-5 内由 task-test-5 失败触发的条件修正，不是第 17 个测试父任务、新的顶层 plan phase 或新一代。只含一项可由默认 worker 完整交付的候选操作限制；选择 split-def 的默认执行强度，一次派发本 fix，不新增子合同、嵌套编号或 lane。UI 选择资格与 Sortable 起点属于同一个可观察责任面，拆开交付不能独立关闭禁止拖拽；不需要 superior worker 持续处理跨域事务。

现有 target 已核对为上述 Base；不可变测试候选与 Base 的 `src/**` 无差异。执行前另冻结 `Execution base` 为包含 Base 的 develop 完整 SHA；不得将测试候选当作 coding base 或合入 coding。测试纠错 checkpoint 是只读规范/复现证据，不是产品合并输入。fix 的 Depends on 不指向尚未完成的 task-test-5，Returns to 仅为恢复指针，避免依赖环。

## 接受行为与精确签名

权威来源为 `openspec/specs/logic-flow-operation/spec.md` 的 Candidate Zone T0 Restriction 四个场景；`logical-flow-planner` 的合法拖放、取消、lineage、隔离与显示要求保持。保留的 `task-test-5.1-review-1.md` 和 `task-test-5-report-1.md` 是本修正的证据，不改写其历史文字。

| 签名 | 已确认的输入与违约 | 修复后必须观察到 |
| --- | --- | --- |
| LF-T0-SORTABLE | clean / game version 8.0 / Ore；真实按下、移动后 source 进入 `sortable-chosen sortable-ghost`。当时 compact view 仍隐藏 | pointer 按下、移动、释放全程不进入 Sortable chosen/ghost/drag 状态；`draggable=false`，无快速添加按钮；compact view 隐藏，store drag state 未启动，释放后 groups/nodes 精确不变 |
| LF-ENERGY-SELECTABLE | clean / game version 8.0 / Energy Cells；`draggable=true`、可见 `.ware-card-add-btn`，能开始真实拖放 | 与 Ore 使用同一独立禁止操作 oracle；Energy Cells 保持可见的候选展示，但没有拖拽或快速添加能力 |

禁止把 `compact-view` DOM 数量作为产品签名：该节点由 `v-show` 常驻，只能按可见性判断。没有真实 pointer witness、仅修改 HTML 属性或仅在 `@start` 后调用 stopDragging，均不能证明 LF-T0-SORTABLE 关闭。

## 最小责任边界与必做工作

| 能力/入口 | 选择与唯一 owner | 必做工作或保留理由 |
| --- | --- | --- |
| 候选资格、展示及快速添加 | extend `useLogicFlowCandidatePresenter.ts` 的 `isCandidateSelectable` / `waresByTier` | 在既有 raw-material、缺数据及 recycling 规则中明确排除 `energycells`；由既有 `isSelectable` 统一供 draggable、样式、按钮与 startDrag/quickAdd 使用。不要把 Energy Cells 改成 raw material，也不要将所有 tier 0 非资源产物一律禁用 |
| Sortable 起点 | extend `LogicFlowCandidateZone.vue` 的现有 `<draggable>` 配置 | 使用已安装 Sortable 的 `filter` 对既有 `.is-locked-tier` 作启动前排除；Vue 只消费 presenter 的资格标记，不另写业务条件。保留 clone、sort=false、现有 start/end 事件及合法菜单点击 |
| 候选行为回归 | extend `tests/unit/logic-flow/logic-flow-candidate.spec.ts` | 将 `should show add button for Energy Cells` 对齐禁止规则，修正不存在的 `.quick-add-container` 锚点为实际 `.ware-card-add-btn`；同组参数化证明 Ore、Silicon、Energy Cells 的禁止呈现与合法 Tier 1+ 按钮保留。该 Unit 文件是修复自测例外，不进行 Unit suite 迁移 |
| 领域拖放、hover/drop 和清理 | reuse `src/store/useLogicFlowStore.ts` 的 startDragging/stopDragging/handleHover/handleDrop；reuse `LogicFlowPlanningZone.vue` 的现有消费者 | 只读。产品源码中 candidate presenter 是该 store startDragging 的唯一调用方；先在候选入口阻断就能保持整个后续生命周期不启动。store 的上游扩展、节点隔离、锁定和正常结束路径保持 |
| 测试 fixture 与消费者 | reuse `setupLogicFlow(page, 'clean')`、现有 Playwright/Mouse API、静态游戏数据 | coding 不改 `tests/e2e/**` 或 helper，不取 integrate 未接受代码形成另一测试入口；E2E 持久回归仍由 task-test-5.1 负责 |

源码核对依据：presenter 当前只排 raw material，Energy Cells 可选；Vue 的列级 disabled 受同列可选项影响，单卡 `draggable=false` 无法阻止 Sortable；已安装 `node_modules/sortablejs/Sortable.js` 的 `_onTapStart` 支持 filter 并在启动之前返回。候选 startDrag、quickAdd、addWare 和菜单现有调用关系均留在同一 presenter；禁止另建 adapter 或移动规划区历史架构。本表仅确定规划责任，不是候选实现审查。

## Implementation simplicity

- Standard: audit-implementation-simplicity
- Application: 前瞻约束上述产品改动；测试侧只判断可观察正确性与覆盖，不进行 simplicity audit。
- Required evidence: reviewer 收到精确累计 source diff、实际调用方、两条禁止签名与合法对照、以下不变量及自测结果；coding worker 不自行出具审查结论。

保持 store -> presenter -> vue：store 继续拥有领域状态与拖放清理，presenter 拥有候选区 UI 资格，Vue 只将已导出的资格接到平台拖拽机制。复用现有 `isSelectable` 和 `.is-locked-tier`，不新增可选性副本、全局状态、模块、接口、adapter、facade、fallback 链或兼容执行分支。HTML 属性与 Sortable filter 是同一资格在两个平台入口的消费，不复制业务分类。

不变量与证明边界：候选资格在 presenter 计算/动作入口确定；Sortable 在 pointer 起点拒绝，不在 hover/drop 热路径重复审计。合法产物仍由原 startDrag → store → planning drop → stopDragging 路径处理一次；不在被拒绝操作上创建 group、preview 或清理其他组。Energy Cells 的候选限制不得改变其游戏资源身份、上游计算、既有方案/节点或导入持久化含义。保留 recycling 的精确业务分支、lineage/锁定、normal/duplicated/auto/isolated/replace/rejected 优先级、取消后的清理以及 T0 展示。

禁用操作是既有无动作结果，不新增错误包装或 catch；意外异常保持原生传播。没有新持久化字段或迁移需求，不改 normalizeState、game data、store 类型、planning Vue、依赖或 runner；不为未来兼容保留双通道。超出这两个 source 文件才可解决的新事实必须返回同一 planner 修正边界，不由 worker 扩权。

## Blocking self-validation

- Commands: `npm run test:unit -- tests/unit/logic-flow/logic-flow-candidate.spec.ts tests/unit/logic-flow/logic-flow-candidate-derivation.spec.ts tests/unit/logic-flow/logic-flow-bug-regression.spec.ts tests/unit/logic-flow/logic-flow-lineage.spec.ts tests/unit/logic-flow/logic-flow-locked.spec.ts`; `npm run build`; `git diff --check`
- Pointer self-check: 必做下述真实浏览器检查，单元测试对 vuedraggable 的 mock 不能替代；使用本 coding candidate build 和已安装 Playwright/tsx，通过 `node --import tsx --input-type=module` 的 stdin 执行，复用 Base 的 `setupLogicFlow`，记录完整 stdin、命令、cwd、退出码、trace 路径和 candidate SHA。不得新增版本化测试入口。
- Preview command: 在 coding cwd 独立会话运行 `npm run preview -- --host 127.0.0.1 --port 4285 --strictPort`；browser context 的 baseURL 为 `http://127.0.0.1:4285`，viewport 为 1440×1000。检查结束仅关闭本次启动的 preview/browser。
- Gate: 所有阻断命令退出 0；下面两条负例及合法正例全部满足。失败/环境不可用保留精确证据，不以 Unit/build 通过代替 pointer 通过，不接受两条产品签名延期到 target 后才修复。

自测步骤固定如下；worker 在同一 command 内用 `chromium` 和 `expect` 执行，正式 E2E 的纠错/迁移不归本 worker：

1. 每个输入使用独立 browser context；调用 `setupLogicFlow(page, 'clean')`，确认 game version 8.0 和 UI 语言 zh-CN。只读保存 `logicFlowStore.groups` 的完整领域快照与 drag state；不得调用 store 建组或写 isDragging。
2. 对 `ore`、`energycells` 分别定位 `.ware-card-wrapper[data-ware-id="<id>"]`，确认可见、`draggable=false`、`.ware-card-add-btn` 不存在。取卡片 bounding box，以中心点执行 `page.mouse.move`、`down`、横向移动 100px（分步）。按下及移动期间检查 source 未出现 `sortable-chosen`、`sortable-ghost`、`sortable-drag`，compact-view 隐藏、isDragging=false、draggingWareId/draggingLineage 为 null，无 hover/preview。所有断言在 finally 中释放鼠标；释放后仍检查属性/状态与 groups/nodes 精确不变。
3. 合法对照使用 `hullparts`：卡片可拖、快速添加入口存在；真实 pointer 启动后 isDragging=true、draggingWareId=hullparts 且 compact-view 可见，移动到候选区外的页面标题空白处并释放；最终 compact-view 隐藏，drag/hover/preview 清空，领域快照不变。随后通过该卡片快速菜单的新建产线入口真实点击，准确读取包含手动 hullparts 的唯一 group id，证明合法添加仍有效。实际 drop/locked 等累计行为由父测试合同在 target 上验证。
4. 记录修复前签名来源为保留的不可变测试候选；修复后证据绑定 coding candidate。不得把旧 4.6 count 失败或依赖 Energy Cells 的通过结果用作本次自测。

## 审查、target 到达与恢复

coding worker 只提交上述 owned diff 和阻断证据；dispatcher 冻结 coding candidate，交独立 reviewer 完整检查接受行为、所有权、简洁性和最终遗漏，不改写旧 review/report。coding 自测、review 与仓库既有用户验证/提交规则均满足，才由 dispatcher 将 coding 合入 develop；本合同不授予 planner 提交或合并权。

父测试的 `Depends on: task-test-5-fix-1` 是新增恢复门；`Covers: none` 保留给校验器定义的正常 task-coding parent 关系，不能伪造该 ID。此条件 fix 的同等 target-visibility barrier 由 Returns to 与提交包含证据落实：记录 coding candidate、develop 合并结果和 integrate Execution base 的完整 SHA；`git merge-base --is-ancestor <coding-candidate> <target-sha>` 与 `git merge-base --is-ancestor <target-sha> <integrate-execution-base>` 均退出 0。不得直接 coding -> integrate，也不得先把未接受测试 checkpoint 合入 target 充当修复前置。

integrate 同步该 target 后，task-test-5.1 正式恢复：先核对已冻结的 test-owned oracle/合法 setup 修正仍适用，再重跑父合同的 focused、collection、build、diff 和完整 helper cross-consumer 命令。reviewer 关闭 LF-T0-SORTABLE、LF-ENERGY-SELECTABLE；原任务 5.1 通过后才推进 5.2/5.3，完整父任务通过后才可 integrate -> target，随后恢复父 6/11。cross-consumer 的独立旧假设按父合同归属，不能变成本 fix 的额外源码权限或通过豁免。

- Done when: 两条产品签名由 coding 自测与 review 证明关闭、coding candidate 已在 target、integrate 已包含该 target，且恢复后的 task-test-5.1 reviewer 确认原始 pointer 输入及合法对照通过；父任务其余验收仍由 task-test-5 持有。
- Stop conditions: 新产品签名、边界外修复、真实规范冲突返回 planner/reviewer；runner 不可用交 dispatcher 恢复并保留 unavailable。无依赖任务继续，本 fix 不扩大阻塞闭包。
