# task-test-4 review — candidate cb92fe76

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；只读复核 immutable candidate `cb92fe76`。未修改产品、测试、fixture、配置、workflow 状态或 candidate；唯一仓库写入是本报告。

Reviewed commit:
`cb92fe76f5bd8670f8c34fcb5f66342299c320a1`，single parent `51216608e3532cfa3792e3fa4559a0d872f30d9c`。

Evidence:

- Candidate 仅修改 7 个 `tests/e2e/logic-flow/**` 文件，共 `101 insertions / 1550 deletions`；无 `src/**`、OpenSpec、fixture、legacy 或配置变更。`git diff --check cb92fe76^ cb92fe76` 通过。
- `logic-flow-bug-regression.spec.ts` 从 36 个旧 declaration 改为 5 个新 declaration，文件从 1369 行缩至 50 行；candidate 没有向 `tests/legacy/e2e/**` 写入任何文件，当前 legacy 中也没有该 regression 原件。
- Collection-only 命令成功：`npm exec playwright test -- --list` 对 7 个 Logic Flow 文件列出 72 tests。Parent 对应文件共有 103 tests，因此本轮净少 31 个 canonical declarations；未运行浏览器或完整 E2E。
- `context-2.md` 与 `task-test-4.md` 要求旧测试原件留在 `tests/legacy/e2e/**`，只有明确分类为 duplicate/stale/retired implementation 的行为才可离开 canonical；可迁移旧测试被直接删除是明确 reject 条件。
- 历史归属可核对：`0096a89b` 引入 1.1–15.1 的核心回归，`e5e75eca` 增补 lineage、模块名、隔离边界、语言、锁定与 cancel 行为，`8115a84e` 增补 16.1/16.2；`e7d3d05d` 后续把 Energy Cells 改为可生产、可拖拽节点。不能用 2026-02 的旧 T0/EC 前提覆盖 2026-05 的 active contract。
- Current authority 包括 [logic-flow-operation/spec.md](../../../openspec/specs/logic-flow-operation/spec.md)、[logic-flow-energycells/spec.md](../../../openspec/changes/logic-flow-energycells/specs/logic-flow-energycells/spec.md)、lineage/new-feature archived specs 及 [test_experience.md](../../../openspec/test_experience.md)。`x4-drag-test` 进一步要求 Mouse API、每次 move 带 `steps`、release 前验证真实 target-hover phase。
- 没有 dedicated Logic Flow `bugfix-*.spec.ts`。现有 [logic-flow-interaction.spec.ts](../../../tests/e2e/logic-flow/logic-flow-interaction.spec.ts) 只对 No Module、Teladi 上游选择、新建入口、T0/raw-material 等提供部分 browser coverage；[logic-flow-bug-regression.spec.ts](../../../tests/unit/logic-flow/logic-flow-bug-regression.spec.ts) 的 Unit 覆盖可承接 method-only 状态矩阵，但不能替代模块名、hover 标签、连线、语言和锁定传递等浏览器行为。

Findings:

## F1 — blocking：36 个删除场景没有 legacy 原件，且 15 个 current-contract 行为族没有等价 browser coverage

Classification key：

- `C`：当前浏览器契约，必须留在 canonical；旧实现可以重写，但旧原件仍迁 legacy。
- `C/R`：candidate 已尝试重写，仍需修正断言/握手。
- `L-D`：store-only、重复或已由更精确 case 覆盖；从 canonical 退出可以，但原件必须迁 legacy。
- `L-X`：旧实现前提与当前契约明确冲突；只保留 legacy。

| 簇（共 36） | 场景 | 分类与依据 | 最小承接 |
| --- | --- | --- | --- |
| 隔离、标签、连接（5） | 1.1 | `C/R`：candidate 保留了“隔离后无 preview”，但 helper 未证明 hover | 修 retained case |
|  | 2.1 | `C`：Isolate/Connect 状态优先于 Locked 标签属于 current drag priority/terminology | canonical UI label case |
|  | 7a.1、7a.2 | `L-D`：隔离合并、唯一节点、lineage 已由 Unit 7.1–7.3 精确覆盖；两项旧 E2E 主要直接调用 store | legacy 原件；无需两条 canonical store case |
|  | 8.1 | `C`：拖拽 isolated ware 后 Connect、恢复 module/upstream 是 current `Isolate Connect Operation` | canonical UI drop + postcondition |
| lineage 与 Auto/Replace（7） | 3.1 | `C`：不同 moduleId/lineage 的同 ware 共存是 current lineage contract | canonical 两 lineage UI case |
|  | 3.2 | `L-D`：只调用 `getWareGroupStatus()`，与 3.1 及 Unit 5.1/5.2 重复 | legacy |
|  | 4.1 | `C`：Auto → Manual、单节点、上游仍在是 current browser operation | canonical UI case |
|  | 4.2 | `L-D`：只检查 method status，Unit 6.3/9.4/9.5 已覆盖 | legacy |
|  | 5.1 | `C`：不同 lineage Auto replacement 的实际节点 lineage/source 变化未被 retained 5 覆盖 | canonical UI case |
|  | 14.1 | `L-D`：旧 case 在 clean 空状态把 target `0` 当 existing group；当前 [logic-flow-interaction.spec.ts](../../../tests/e2e/logic-flow/logic-flow-interaction.spec.ts#L25) 已通过 Teladi 可见上游验证选择 lineage | legacy |
|  | 16.2 | `L-D`（有条件）：与 3.1 + unlocked normal drop 重复；但当前 4.16 并非 unlocked，须先修 4.16 后才能退出 canonical | legacy + 修 4.16 |
| 状态优先级（5） | Rejected > Duplicated；Duplicated > Isolated；Isolated > Auto；Auto > Replace；Replace > Available | `L-D`：五项均为 browser 内直接调用 `getWareGroupStatus()`，Unit 9.1–9.5 一一覆盖。浏览器层仍须由 normal/duplicate/isolate/auto/replace/locked cases验证可见标签和投放结果 | 一个 legacy 原件；不恢复五条 method-only E2E |
| 组边界（3） | 10.1 | `C`：用户点击创建空组后拖入第一个节点是独立 browser path，现有 new-zone drop 不等价 | canonical UI case |
|  | 10.2、10.3 | `L-D`：单 isolated 组及 Manual/Auto/Isolated 混合主要是领域组合，Unit 10.2/10.3 精确覆盖 | legacy |
| 锁定准入（3） | 11.1、16.1 | `L-D`（有条件）：两者与 retained rejected case / 4.17 重复；canonical 必须合并为“hover 显示 rejected + release 后 ware/raw-material 均未变化”的一条完整回归 | legacy + 强化 retained/4.17 |
|  | 11.2 | `L-D`（有条件）：可由默认 locked group 的 matched-lineage existing drop 承接，但 helper 必须证明 hover 且 post-drop 成功 | legacy + 一条 locked-match canonical postcondition |
| duplicate/new/cancel（3） | 12.1、13.1、36 | `C/R`：分别被 3 条新 case 取代；13.1 的 new-zone hover 与最终 group/node 断言足够，12.1 和 36 受 F2 helper/hover-off 错误影响 | 修 retained；旧原件迁 legacy |
| 多组 target routing（1） | 15.1 | `C`：现有 multi-line cases只验证创建两个组或单次 existing drop，没有验证 hover 在多个 target 间切换后写入正确组 | canonical UI case |
| 同 ware 连线（1） | 7b.1 | `C`：Unit 可证明节点存在，不能证明两个同 ware/moduleId 的 SVG 连线都渲染；现有 4.3 只断言任意连线 `> 0` | canonical 精确连线 case |
| 模块名显示（3） | 28、29、30 | `C`：current OpenSpec 明确要求 existing/preview node、new-line header、drag ghost 显示模块名。旧 28 有 optional branch，旧 30 只重算 store 文本，均应重写而非删除 | 3 个真实 DOM assertions，可共享 setup |
| 隔离扩展/T0 preview（3） | 31 | `C` 行为、`L-X` 旧实现：当前行为要求 valid isolated 中间节点阻断自动扩展；旧代码却直接把 raw `ore` 标为 isolated，违反 T0/raw-material 无隔离按钮的当前契约 | legacy 原件 + valid UI isolation canonical case |
|  | 32 | `L-X`：旧 case 同样手写 raw `ore.isIsolated`，且标题/实现已偏离历史 test task；其合法行为由 8.1 和 33 承接 | legacy |
|  | 33 | `C`：隔离边界停止 raw-material preview 是 current contract；旧 case在测试里复制递归算法，须改为真实 hover preview DOM | canonical UI preview case |
| i18n 与默认锁定（2） | 34、35 | `C`：候选/规划节点随 UI 语言切换，以及候选锁定开关传递给新组，均是 current explicit requirements，现有 72 tests 无等价完整覆盖 | canonical UI cases；35 同时验证 on/off |

以上分类允许 16 个 method-only/重复项和 1 个明确冲突项完全离开 canonical；31 的旧实现也只进 legacy，但其 current behavior 必须重写。所有分类都不允许删除原件。最小 preservation 修正是把 `cb92fe76^` 的完整 36-case 文件保存为 `tests/legacy/e2e/from-unified-e2e/logic-flow/logic-flow-bug-regression.spec.ts`；不要只靠 git history。随后按表保留/合并 current browser behaviors，不要求把 36 条原样全部恢复到 canonical。

Correction owner: 下一位 task-test coding worker。Allowed paths: `tests/e2e/logic-flow/**` 与 `tests/legacy/e2e/**`。Preserve: current Energy Cells 可拖拽语义、clean fixture、真实 UI/Mouse path；不得改产品来适配历史断言。

Observable closure: legacy 文件可静态核对 36 个旧 declarations；canonical 对表中所有 `C` 行为有明确 case 映射，且没有用 Unit/store assertion替代 browser-only contract。

## F2 — blocking：retained 5 不足，且共享 helper 把静态 class 当作 target-hover 证据

[dragLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/dragLogicFlow.ts#L46) 在移动到 existing target 后不再验证 `hoveredGroupId`；它只检查 class：

- unlocked hovered group 的 current class 是 `border-blue-500`，helper 却要求 `border-blue-500/50`，normal existing drop 的 locator expectation不匹配产品表达；
- default-created group 本来就 locked，未 hover 时也始终带 `border-amber-500/50`，所以该断言可以在没有 `dragenter`/`hoveredGroupId` 的情况下通过；
- duplicate/rejected class 和标签由 dragged ware + group status计算，不依赖当前 pointer 是否真的进入该 target；不能替代 pre-release hover phase；
- duplicate retained case调用普通 existing branch，helper 要求 blue/amber，但产品明确显示 `border-red-500`，因此会在数量断言前失败；
- cancel retained case离开默认 locked group 后断言“不含 amber”，但 locked group在 hover-off 后仍应保持 amber，因而把静态锁定样式误作 hover-off signal；
- rejected retained case release 后没有断言 group/node/raw-material 未变化，可以只验证反馈而漏掉“禁止投放”。

因此 5 条里只有 new-zone case同时使用动态 `isHoveringNewZone` class并验证最终 group/node；其余 4 条至少存在不可达、假阳性或 postcondition 缺失。候选也完全没有覆盖 2.1、3.1、4.1、5.1、7b.1、8.1、10.1、15.1、28–31、33–35 等 current browser regressions。

最小修正：在 helper 恢复 target identity 的 store/UI observable handshake（existing target 使用 `hoveredGroupId`，new zone 使用 `isHoveringNewZone`），再按 expected status 分别断言 `border-blue-500`、`border-red-500 + duplicate-label`、Auto/Manual、Isolate/Connect、amber locked-match、red-600 rejected。hover-off 必须断言 target identity 清除，不以 locked base class 消失为条件。每次 release 后验证对应数据/DOM postcondition。

Focused closure: clean new-zone、unlocked normal existing、duplicate、isolate/connect、auto/promote、locked match、locked reject、multi-target switch、hover-leave/cancel 各至少一条有效通过。

## F3 — blocking：其它 6 个删减文件未删 declaration，但仍受 helper 回归，且 plan/4.16 旧 finding 未闭合

- Candidate 对 drag-feedback、interaction、new-feature 的大部分删减是把重复 Mouse 序列换成共享 helper，本身可以保留；但 F2 使这些 existing-target cases 都没有可信的 pre-up hover gate。
- [logic-flow-incompatible-drag.spec.ts](../../../tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts#L11) 的 4.16 名称声称 `Unlocked Group`，实际 clean 默认 `isDefaultLocked=true`，首个 Energy Cells group 是 locked，且 test期待 rejected。历史 4.16 contract要求 unlocked incompatible group不显示 rejected、应隐藏/disabled，并保持 new agricultural zone可用。当前 4.16 与 4.17 实际都在测 locked rejection，无法承接删除的 16.2/unlocked acceptance。
- [logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L40) E2E-3 点击“保存并新建”后只断言 workspace 清空，仍未证明方案写入列表；E2E-5 在点击覆盖保存后断言的是保存前已经可见的 node/title，没有 reload/load 后数据更新证据，也未断言无 dialog；E2E-14 仍未点击保留下来的入口创建第二个空组；E2E-15 仍未添加更高 tier manual node并验证动态改名。这些是上一轮已指出、candidate 仅部分触及但未闭合的 browser postconditions。
- Candidate 对 E2E-4、E2E-7、E2E-12 的修改增强了新方案保存、seeded load、空方案无 dialog 断言；这些无需回退。

Correction owner: task-test coding worker。Allowed paths: `helpers/dragLogicFlow.ts`、`logic-flow-incompatible-drag.spec.ts`、`logic-flow-plans.spec.ts` 及受 helper 影响的 focused Logic Flow specs。

Focused closure: 先运行 F2 的最小 drag matrix，再运行 `logic-flow-incompatible-drag.spec.ts` 与 E2E-3/5/14/15；不要用 optional branch、direct store write 或只检查保存前已成立的 UI 状态换绿。

## F4 — failure ownership：没有 setup 收敛后的产品失败证据，不开产品 bug

`setupLogicFlow(page, 'clean')` 的 clean/seeded 分离仍保留，collection 成功；本轮没有有效浏览器运行，更没有“truthful fixture + current locator + verified hover phase + exact current assertion”后仍出现相反产品结果的证据。已识别问题均为 test-owned helper、coverage preservation、stale contract 或 assertion 缺口。

不得因这些旧 case 可能失败而创建产品 bug。只有修复 helper 和 canonical setup 后，某个最小 current-contract case稳定复现相反 UI/data 结果，才可携带 exact focused command、前置状态、hover signal 和 postcondition 路由给产品 owner。

Verdict:
`changes_required`

Changes:

1. 新增一个 legacy snapshot，完整保存 parent 的 36 个旧 declarations；分类为 stale/duplicate/conflict 的 case只留 legacy。
2. 修 `helpers/dragLogicFlow.ts` 的 phase handshake与 status-specific assertions；修 retained duplicate、cancel、rejected postconditions。
3. 在 `logic-flow-bug-regression.spec.ts` 或现有等价 focused spec中补齐 F1 标为 `C` 且无现有完整覆盖的 browser behaviors；无需恢复五个 method-only priority E2E。
4. 修 `logic-flow-incompatible-drag.spec.ts` 的真实 unlocked 4.16 与 locked 4.17 分工，并闭合 `logic-flow-plans.spec.ts` E2E-3/5/14/15。
5. 先跑最小 drag matrix与上述 focused cases，再跑 7-file Logic Flow scope；最后执行 `npm exec playwright test -- --list` 与 `git diff --check`。本轮不要求先跑完整 E2E。

Caveats:

- 本轮按要求只做静态、历史和 collection 审查；没有把未运行的 browser case声明为通过或产品失败。
- Unit 覆盖只用于证明 method-only E2E 可归 legacy，不用于替代 DOM/drag/i18n/line-rendering 行为。
- `openspec/specs/logic-flow-operation/spec.md` 中旧的 Energy Cells 禁拖条目已被 active `logic-flow-energycells` change supersede；本报告按 active contract判定 Energy Cells 可拖拽。
