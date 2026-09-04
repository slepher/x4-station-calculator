# task-test-4 review — candidate fafb2acc

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；只读复核 immutable candidate `fafb2acc`。未修改产品、测试、fixture、配置、workflow 状态或 candidate；唯一仓库写入是本报告。

Reviewed commit:
`fafb2acc0e7c8ba469bef4ad332c9f791e18b8eb`，single parent `3711f0e321ca11abbd388ff0fa19616471f1b376`。

Evidence:

- Candidate delta 仅修改 7 个 `tests/e2e/logic-flow/**` 文件，共 `56 insertions / 207 deletions`；无 `src/**`、OpenSpec、fixture、legacy 或配置变更。`git diff --check fafb2acc^ fafb2acc` 通过。
- 本轮按要求未运行完整 suite，也未运行浏览器测试。采用 worker 报告的有效 smoke：13 项中 `3 passed / 10 failed`；第二次 `ERR_CONNECTION_REFUSED` 是 webServer 端口回收后的无效环境结果，不作为产品或测试语义证据。
- `x4-drag-test` 要求 Mouse API、每次 `mouse.move` 带 `steps`、release 前验证 UI/store 可观察 hover phase，且禁止 native drag dispatch、`page.evaluate` 模拟拖拽和手工 DOM 修改。静态扫描 `tests/e2e/logic-flow/**` 得到 80 个 `page.mouse.move`，缺少 `steps` 的数量为 0；未发现 native drag dispatch、`dragTo()` 或 DOM 写入。
- Candidate helper 的 new-zone 断言已从 `/border-blue-500/` 改为 `/border-blue-500\/50/`，与 `LogicFlowPlanningZone.vue:497-504` 的 current class/dragenter owner 一致；但没有一次有效的 candidate 后 focused run 证明该握手已跑通，且 worker 明确声明仍有手写路径未完成 guardrail。
- `setupLogicFlow(page, 'clean')` 现在于 reload 前把 `x4_logic_flow_plans` 设置为 `{ version: 3, activeId: null, list: [] }`；`seeded` 保留 `db.json` 的 active `Logic Flow 1` 与 3 groups。clean/seeded 的状态来源已分离。
- `logic-flow-bug-regression.spec.ts` 仍有 62 个 `page.evaluate` 调用；静态匹配到 61 行 `clearAllGroups/addGroup/expandUpstream/toggleNodeIsolation/lockedLineage/isIsolated` 等业务写入。相同 store 语义已有 `tests/unit/logic-flow/logic-flow-bug-regression.spec.ts`、`logic-flow-lineage*.spec.ts` 和 `logic-flow-locked.spec.ts` 覆盖。
- Candidate 没有删除/重命名测试文件或 test declaration。此前移出的 compact vertical case 原件仍在 `tests/legacy/e2e/from-e2e/compact-drag-view.spec.ts:57-80`；其 `display:flex/flex-direction:column` 断言与 current `logical-flow-planner` / `logic-flow-ui-adjust` 的 `grid-cols-4` 契约相反，属于已正确保留的过期 legacy，而非应恢复的当前行为。

Findings:

## F1 — blocking：拖拽 guardrail 仍未闭合；归属 test-owned

共享 helper 的静态形态已有改善，但“所有拖拽路径”仍不成立：

- `logic-flow-bug-regression.spec.ts:93-113` 在目标上 release 前只调用 `getWareGroupStatus()`，没有验证真实 hover UI/store phase；`:576-607` 的 new-zone drop、`:633-668` 的 existing-group drop、`:1284-1320` 的 new-zone drop 均在 release 前没有正向 hover 断言；`:1144-1176` 的 cancel path 以 optional target branch 跳过 hover-on，离开后也不强制验证 hover-off。
- 同文件 `:612-618` 在 clean 空状态直接调用 `dragWareToTarget(..., 0)`，而索引 `0` 实际是 new zone，却走 existing-group 的 `hoveredGroupId !== null` 分支；`:633-636` 又在空状态依次使用 target `0`、`1`。这是测试目标索引错误，不是产品失败。
- `logic-flow-new-feat.spec.ts:342-357,364-380,396-412` 与 `logic-flow-interaction.spec.ts:189-205` 仍自行管理 pointer lifecycle；前者在 release 前没有建立目标 hover，后者只验证 `isDragging`。若这些是 cancel/drag-active 用例，必须明确验证对应的 hover-off/active phase；若是 target 用例，应走 helper 并验证正向 hover。

Preserve：Mouse API、全部 move 的 `steps`、release 前可观察 phase、release 后具体 UI/数据 postcondition；不得删除 hover 断言、改成 native event 或用 store/DOM 模拟拖拽。Focused closure：一个 clean new-zone、一个 existing-group、一个 rejected、一个 hover-leave/cancel 均以有效运行通过。

## F2 — blocking：clean/seeded 已分离，但 seeded plan case 仍使用旧断言；归属 test-owned

`setupLogicFlow.ts:16-18,37-43` 已满足状态分离，本项不要求回退 helper。问题位于 `logic-flow-plans.spec.ts:88-108`：seeded fixture 的 `Logic Flow 1` 明确有 3 groups，测试经 Load UI 选择首个方案后仍断言 `groupCount === 1`，也未验证标题与 auto-node 重建。应按 fixture truth 断言 3 groups、`Logic Flow 1` 和一个可识别的重建节点；不要把 fixture 或断言改成旧的手写单组模型。

## F3 — blocking：plan 流程仍弱化或漏掉当前行为；归属 test-owned

- E2E-3 `logic-flow-plans.spec.ts:40-53` 将历史契约中的“输入名称并保存、确认列表新增、再新建”改成寻找 `/取消|Cancel/` 后期待清空。Current `SmartSaveDialog` 的动作是“丢弃并新建”和“保存”，没有该文本按钮；且此改法丢弃了保存断言。
- E2E-4 `:58-65` 只证明 dialog 出现，没有提交名称、验证保存成功或标题更新；不满足 archived test task 与 current `logic-flow-plans` 的完整新方案保存行为。
- E2E-5 `:67-84` 只以 plan count 仍为 1 判断覆盖保存，没有证明新增 `weaponcomponents` 被持久化。
- E2E-12 `:151-157` 验证 warning，但漏掉规范要求的 SmartSaveDialog 不出现。
- E2E-14 `:160-172` 只验证入口可见，没有点击并验证创建空 group；E2E-15 `:175-184` 只验证初始名称，没有添加更高 tier manual node 后验证动态更新。两项均未完成历史中仍与 current UI 一致的行为步骤。

这些是测试实现缺口，不能通过放宽 locator、optional branch 或删除 postcondition 获得绿色结果。

## F4 — blocking：regression 仍直接写业务状态，且夹杂过期/重复 E2E；归属 test-owned 与 stale/duplicate

`logic-flow-bug-regression.spec.ts` 中的业务写入仍集中在 `:55-64,81-85,130-134,178-183,220-263,285-309,339-362,412-455,482-518,578-581,681-692,867-875,932-941,983-992,1194-1200`。浏览器有独立价值的隔离、锁定、lineage、drop feedback 场景应通过现有 UI/helper 建立前置；不得用 `page.evaluate` 写 store。

其中 method-only 的 `getWareGroupStatus` 优先级组 `:337-407`、自行重写 T0 recursion 的 `:1010-1060`、自行计算拖拽名称的 `:803-844` 已被 Unit 或 current UI case 覆盖，属于 stale/duplicate canonical residue。最小处理是从 canonical 去除其重复实现断言；若删除 test case，先把原件保存在 `tests/legacy/e2e/**`，不得只依赖 git history。仍有 current browser contract 的 case 则保留并改为 UI observable assertion。

同文件 `:744-752` 以及 `logic-flow-new-feat.spec.ts:227-236,279-289,461-477` 的 optional assertion 可在目标不存在时空跑，属于测试缺口，不是产品通过证据。

## F5 — preservation：candidate 本身未误删测试

`fafb2acc^..fafb2acc` 无 deleted/renamed test file，也无 test declaration 删除。Candidate 删除的是手写 setup/drag 代码并替换为 helper/UI 路径；当前没有误删当前行为的直接证据。后续若清除 F4 的重复 case，必须先落入 legacy 原件，并保留 OpenSpec 仍要求的浏览器行为。

## F6 — failure ownership：当前没有可升级的真实产品 bug

New-zone current source存在对应 `dragenter` owner、`isHoveringNewZone` 状态与 `border-blue-500/50` 表达；现有有效 smoke 仍混有错误 target index、旧 seeded count、错误 dialog action、直接 store setup 和未完成 hover phase。第二次运行又是环境性 `ERR_CONNECTION_REFUSED`。因此当前失败全部归为 test-owned 或 stale/duplicate；没有在正确 fixture、正确 UI path、完整 hover handshake 和 current assertion 下稳定复现相反产品结果，不创建 BUG。

Verdict:
`changes_required`

Changes:

1. 最先修 `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`：移除业务状态写入，修正 clean 状态下的 target index，完成每个 pointer lifecycle 的 pre-up hover/hover-off；纯 store 重复项先保留 legacy 原件再退出 canonical。
2. 修 `tests/e2e/logic-flow/logic-flow-plans.spec.ts`：恢复 E2E-3/4/5/7/12/14/15 的完整 UI postcondition，不弱化断言；`setupLogicFlow.ts` 的 clean/seeded 分离保留不动。
3. 收口 `logic-flow-new-feat.spec.ts` 与 `logic-flow-interaction.spec.ts` 的手写 drag/optional assertions；`dragLogicFlow.ts` 只在有效 focused run 仍无法建立 new-zone hover 时再做最小修正。
4. 先跑最小 four-phase drag cases与 plan 13-item smoke；要求有效环境下通过。之后再跑 Logic Flow focused scope；不要先跑完整 suite。

Caveats:

- 本轮证据为 immutable diff、静态扫描、current OpenSpec/source、历史 test tasks/legacy 与 worker 报告；没有声称 10 个 smoke failure 的逐项 runtime stack 已重新复现。
- `ERR_CONNECTION_REFUSED` 不计入 verdict；即使忽略该环境结果，静态 guardrail、直接业务写入和断言缺口仍独立要求 `changes_required`。
