Status:
changes_required

Task:
`unified-test-repair` BUG-002 / BUG-003 修复候选审查；仅审查 `365fa75c840aa70e0069bb8dc525f4d909bf6fc9` 相对 parent `a5931b8ca896f1f5965e3a444072566b13b346ab` 的产品修复、相关历史与既有 focused 证据。

Reviewed commit:
`365fa75c840aa70e0069bb8dc525f4d909bf6fc9`（parent `a5931b8ca896f1f5965e3a444072566b13b346ab`）

Evidence:

- candidate 是 immutable single-parent commit，HEAD 与完整 hash 一致，工作树在审查开始时干净；delta 仅修改 `src/composables/useToolbarWorkflowController.ts` 与 `src/components/empire/ImportPlanModal.vue`，`git diff --check a5931b8c 365fa75c` 通过。
- `useBlueprintProductionStore.createEmpire(name, stationName?)` 先创建 `stations: []`；只有传入 `stationName` 才调用 `createStation()`。candidate 的 blueprint-production import handler 改为 `createEmpire('')`，因此 import reset 只创建空 empire。
- 普通 New 仍由 `executeNew('blueprint-production', ...)` 调用 `createEmpire('', t('sector.new_station_name'))`，保留默认 station。`SAVE_AND_IMPORT` 与 `DISCARD_AND_IMPORT` 共用同一 import handler；前者先 `executeSave()`，两者随后都执行空 empire reset 和同一个 `importData()`。
- `buildEmpireImportTargets()` 的既有结果仍由 `executeEmpireImport()` 逐个创建 station；candidate 未改 mapping、空 group 跳过或保存语义。历史 `279ce6eb8` 的 import reset 也以无 station 的 empire 为起点，当前修复恢复该边界。
- worker focused 专门回归中，两条 `2.5` 与 `2.7` / `2.8` / `2.17` 均通过。随后同文件总 focused 的本地遗留结果为 34 cases、`.last-run.json` 仅列 3 个失败，且 `test-results/` 仅保留 `2.20`、`3.3`、`3.18` 三个 failure artifact；与 assignment 的 `31/34` 及三项已确认 test-owned context 归属一致。
- 三条 warning case 只断言 warning modal 可见及文案，不点击 warning 的确认/关闭按钮；因此它们证明“warning 可观察”，不能证明确认后的 lifecycle 收口。
- `SmartSaveDialog` 在 Save and Import / Discard and Import 中同步依次 emit `submit-import`、`close`。没有 timeout、延时或 fallback；问题来自同步 close ownership，而非时序漂移。

Findings:

1. Blocking — BUG-003 的 warning 确认后不能收口，且部分无-warning 路径会重复 close。

   Immutable evidence: `365fa75c:src/components/empire/ImportPlanModal.vue` 的 `finishImport()` 在有 warning 时保留外层 modal；模板仍以 `@close="showWarningModal = false"` 处理 `LogicFlowImportWarningModal`，所以用户确认 warning 后只隐藏 warning，`selfClosed` 不变，也不 emit 外层 `close`。该结果覆盖 station confirm 的 new/overwrite、非空 station strategy 的 overwrite/add/new，以及 clean/dirty empire import。另一方面，strategy-new 无 warning 时 `finishImport()` 已调用 `handleClose()`，随后 `handleBlueprintActionNew()` 又调用一次；dirty empire 无 warning 时 `finishImport()` 与随后 SmartSave `close` 回调也各调用一次。

   Contract basis: BUG-003 要求 warning 在导入完成后可观察；前序 review 的 focused closure 还要求确认 warning 后流程正常收口。本 assignment 明确要求核对 warning close 生命周期、station/empire/strategy overwrite/add/new、无竞态及无延时/fallback。

   Correction owner: BUG-003 coding owner。Allowed path: 仅 `src/components/empire/ImportPlanModal.vue`；如补最小行为回归，可使用现有 `tests/e2e/logic-flow/import-logic-flow.spec.ts` public UI seam。Preserve: warning 必须先可见；warning 内容、mapping、station/empire 写入、普通取消、SmartSave choice 与无 warning 自动关闭语义不变。

   Minimal correction: 让 warning modal 的 close/acknowledge 进入唯一外层 `handleClose()`；让 `finishImport()` 成为导入完成后的唯一 close 决策 owner，并删除 strategy-new 的第二次 `handleClose()`，同时让 submitted SmartSave 的后续 `close` 只清理 submitted flag、不再次关闭外层。

   Focused validation: 至少用一个 empire warning 路径和 station strategy 的 overwrite/add/new 路径验证 warning 先可见、点击确认后 `logicflow-import-warning-modal` 与 `import-view-modal` 都消失；无-warning new 与 dirty empire 各验证外层 close 只发生一次。Observable closure: 所有路径无需 timeout、延时或 fallback，且没有遗留 overlay 或重复 close event。

Verdict:

`changes_required`。BUG-002 的根因已以最小、共享 import handler 修复，且两种 choice 均有 focused pass；BUG-003 只关闭了“warning 被过早清除”这一半，尚未完成 warning 确认后的收口，并留下两个重复 close 路径，因此 candidate 不能整体通过。

Changes:

1. 保留 `useToolbarWorkflowController.ts` 的空 empire import reset；无需改动普通 New 或另建 reset abstraction。
2. 在 `ImportPlanModal.vue` 统一 warning acknowledge 与 import completion 的 close ownership，删除重复 close。
3. 用现有 focused seam 补/跑最小 warning-ack lifecycle 回归；无需扩展全量测试。
4. BUG 状态建议：BUG-002 `Confirmed -> Verified`；BUG-003 保持 `Confirmed`（可在说明中标注 candidate 已修复 warning 可观察，但完整 lifecycle 未闭合）。

Caveats:

- reviewer 未重跑 Playwright，也未扩展全量测试；测试结论采用 assignment 提供的 worker focused 结果，并由当前 34-case 文件、`.last-run.json` 与三个 failure artifacts 交叉复核。
- `2.20`、`3.3`、`3.18` 仍按既有裁定归 test-owned context；candidate 未修改测试，本审查没有将它们升级为产品缺陷。
- 审查开始时工作树干净；结束核验时并发出现 `tests/e2e/logic-flow/import-logic-flow.spec.ts` 的 30 additions / 9 deletions 未提交改动。该改动不是 reviewer 产生、不是 candidate 内容，也未纳入 verdict；已原样保留。
- reviewer 除指定 review artifact 外未修改产品、测试、OpenSpec 或 git 状态，也未提交。
