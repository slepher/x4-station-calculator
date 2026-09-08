- Task: T014
- Contract revision: 4
- Result: T014-A1.md (`sha256:c66ee43207bad4e1835f5f28fb20c6f0afac3ed155ba6554b011cc3e759bf7e7`)
- Candidate snapshot: `evidence/T014-A1/candidate.sha256` (`sha256:4eb96cee6e2057c6745353b3389d28b6d5d7a98aa254cf4483342d56f2666f6f`); shared-store handoff `src/store/useBlueprintProductionStore.ts` at `ee9a9432...`
- Verdict: changes-required

## Findings

### F1 — High — AutoSupply 的输出 ware 反向抹除了主仓储的合法流量

- Owner: T014 implementation owner
- Evidence: `StationDerivedMap.deriveFinalSupportState()` 先从不含 AutoSupply 模块的 `finalCoreResult.productionFlows` 计算主流量，随后又按 AutoSupply 全部输出的 `wareId` 过滤主仓储输入。这样，当计划产业与 AutoSupply 生产相同 ware（典型为 `energycells`）时，计划产业的该 ware 主仓储需求也被整体删除。`openspec/specs/storage-auto-fill/spec.md` 要求按模块来源隔离：Main 输入为 Planned + AutoIndustry、排除 AutoSupply 模块；它没有授权按共享输出 ware 删除 Main 流量。现有 Unit 只验证无输出重叠的情形，未覆盖此分支。
- Allowed correction: 在 `StationDerivedMap` 的领域计算中按模块/贡献来源隔离 Main 与 AutoSupply 输入，不按 AutoSupply 输出 ware ID 对 Main 流量做整项排除；不要在 presenter/Vue 做补偿，也不要引入持久化派生列表。
- Verification: 增加真实入口 Unit：计划产业与 AutoSupply 同时输出同一 ware，断言 Main 仍保留计划产业仓储、AutoSupply 仓储独立，最终 resolved module ID 不重复；随后执行 T014 契约指定的完整独占 E2E。

### F2 — High — 关闭 workforce 计算时，AutoSupply 仍递归增加供应链 workforce 与 habitat

- Owner: T014 implementation owner
- Evidence: `calculateAutoSupplyModules()` 无条件把供应模块 workforce 加入下一轮 `suppliedWorkforce`，并在供应模块有 workforce 时无条件追加 habitat；`considerWorkforceForAutoFill` 只传入生产效率计算。`openspec/specs/empire-management/spec.md` 要求该设置为 false 时，工业与供应模块均不得计算 workforce 需求，全部按基础产量计算。当前 Unit 和 Case 5 都只覆盖 workforce 开启状态，因此不能证明关闭语义。
- Allowed correction: 由同一领域计算函数依据 `considerWorkforceForAutoFill` 精确控制供应模块 workforce 闭包与 habitat；关闭时不得因供应模块 workforce 扩张需求，仍保留基础产量下的 AutoSupply 计算。不要添加 fallback 分支。
- Verification: 在 `auto-supply-storage.spec.ts` 增加 workforce 开/关成对断言，覆盖供应模块自身有 workforce 的数据，并核对关闭时无供应 workforce habitat、流量按基础产量计算。

### F3 — High — 当前候选没有通过候选绑定的 25 项独占浏览器复验，保存/重载证据未成立

- Owner: dispatcher/evidence runner for exclusive resource; T014 owner if the rerun exposes product or test failure
- Evidence: 首轮 25 项为 23 passed / 2 failed；后续 Case 5 聚焦运行暴露并修正预期。最后一次完整运行受共享 `dist` 并发污染，结果为 8 passed / 2 failed / 1 interrupted / 14 not run、exit 130；且该运行之后仍修改了中文 locator。Case 5 在保存与 reload 步骤之前就因文本断言失败，因此现有日志没有证明 `internalSupply` 通过 UI 保存并在 reload 后恢复。测试清单证明 25 项已收集，但不能代替运行结果。
- Allowed correction: F1/F2 修正后冻结新候选，由 dispatcher 提供独占浏览器/build 资源并运行契约中的精确 25-test 命令；不得复用受并发污染的 `dist` 或旧运行结论。
- Verification: 25/25 passed，0 failed/skipped/flaky/retry；Case 5 证据须覆盖 UI 开关、Main/AutoSupply 仓储隔离、resolved 无重复、Save、localStorage 持久化及 reload 后恢复，并保留候选绑定的 report/trace。

## Acceptance

- Accepted: T006 review 已明确原始 AutoSupply/sector 规范仍具约束力，无 replacement authority。
- Accepted: Blueprint toolbar → toolbar presenter → `productionSettingActions.updateSetting('internalSupply')` → recompute 的调用边界成立；字段沿既有 StationSettings/empire 保存路径持久化，未新增持久化派生清单。
- Accepted: AutoSupply 与 `autoInfrastructure` 是不同领域结果，presenter 仅组装展示，新增 Vue 路径通过 props/actions 消费；resolved 合并按 module ID 去重。
- Accepted as bounded evidence only: Unit 2 files/3 tests、类型检查和 build 日志成功；25 项 E2E 均为 active collection。
- Not accepted: Main/AutoSupply 同 ware 输出的隔离语义、workforce 关闭语义、25 项独占浏览器结果，以及 UI 保存/重载持久化。
- Candidate identity: 除共享 store 已按 T014→T015 交接进入 T015 候选外，T014 owned files 与其 manifest 一致；T015 input 记录确认是在 `ee9a9432...` 的 T014 handoff 上增量修改，未覆盖 T014 AutoSupply 段。

## Remaining

1. 修正 F1 的主仓储来源隔离，并补重叠输出 Unit。
2. 修正 F2 的 workforce-off 语义，并补开/关 Unit。
3. 冻结新候选，完成候选绑定的独占 25-test 浏览器复验及 Save/reload 证据。
4. 对新候选重新独立审查；当前 review 不授权更新 task/status。

## Explanation

候选已建立正确的 store → presenter → Vue 路径和独立 AutoSupply 展示，但领域隔离仍有两个未覆盖的反例，且浏览器证据在候选最终修改后没有成功闭环，因此不能判定通过。本次审查未运行测试或 build，也未修改源码、规划、状态或 Git。
