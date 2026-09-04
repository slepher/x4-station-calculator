Status:
changes_required

Task:
`unified-test-repair` BUG-003 第二轮修复候选审查；以 immutable cumulative range `365fa75c840aa70e0069bb8dc525f4d909bf6fc9..0c52a3bed1761749bd27dcab362356e347bb8897` 核对 Logic Flow import completion close ownership、warning acknowledge 收口、重复 close、既有导入语义与 focused 证据。

Reviewed commit:
`0c52a3bed1761749bd27dcab362356e347bb8897`（assignment checkpoint `365fa75c840aa70e0069bb8dc525f4d909bf6fc9`；Git 直接 parent 实为 `2cb98d2a8850ff6e4110517355f9770df307adcf`）

Evidence:

- `365fa75c..0c52a3be` 是可解析的 immutable 三提交累计范围；工作树在审查开始时干净，`git diff --check 365fa75c 0c52a3be` 通过。该范围包含 review artifact、test stabilization 与 BUG-003 lifecycle fix；`0c52a3be` 自身相对直接 parent 只修改 `src/components/empire/ImportPlanModal.vue` 的四处 close lifecycle 行。
- `0c52a3be:src/components/empire/ImportPlanModal.vue:114-117` 让 `finishImport()` 根据 `warnings.length` 作唯一 Logic Flow import completion close 决策：有 warning 时只展示 warning，无 warning 时调用一次 `handleClose()`。所有成功的 Logic Flow station/empire completion 都汇入它：`executeStationImport()`（line 221）、`executeEmpireImport()`（line 240）及 strategy overwrite/add/new（lines 435/464/489）。
- `ImportPlanModal.vue:647-650` 将 `LogicFlowImportWarningModal @close` 统一接到 `handleClose()`；warning modal 的标题栏关闭按钮和 acknowledge 按钮都 emit 同一个 `close`。`handleClose()`（lines 104-111）同时令 `showWarningModal = false`、`selfClosed = true` 并向父层 emit `close`，因此 acknowledge 后 warning 与 `import-view-modal` 一并消失。
- strategy-new 的 `finishImport()` 后续二次 `handleClose()` 已删除。submitted SmartSave 的同步事件仍是 `submit-import` 后 `close`；`handleEmpireImportDialogClose()`（lines 298-304）在 submitted 分支只清 flag，不再关闭外层。故 strategy-new、SmartSave submitted 与无 warning direct import 均只由 `finishImport()` 关闭一次。
- 普通取消语义保留：未 submitted 的 SmartSave `close` 仍只隐藏 SmartSave，外层 import modal 保持；外层标题栏/Cancel 仍直接调用 `handleClose()`。`SAVE_AND_IMPORT` / `DISCARD_AND_IMPORT` payload、`runImportAction()` 调用及执行顺序未改。
- 本轮 source delta 未修改 `buildStationImportPayload()`、`buildEmpireImportTargets()`、`applyImportPayloadToStation()`、station 创建/覆盖/追加或 warning 数据；因此上一轮已核对的 station/empire mapping、空 group 跳过、non-container isolated 忽略、warning 内容与 SmartSave choice 语义保持不变。
- 接受 assignment 提供的 Carson focused 证据：build 通过；指定 grep 共 13 cases，11/13 通过。`3.3` / `3.18` 按既有裁定属于 test-owned overlay cleanup 误用，不是 BUG-003 产品回归；例如 `3.3` 在 clean、无 warning import 已自动关闭外层后仍调用要求 modal 可见的 `closeImportViewModal()`。
- 现有 warning cases `2.7`、`2.8`、`2.17` 仅断言 `logicflow-import-warning-modal` 与 warning 文案可见；仓库中没有测试点击 `logicFlowImport.action_acknowledge` 或 warning modal 的 `close`，因而没有运行证据覆盖本轮修复的核心 acknowledge 收口。

Findings:

1. Blocking — BUG-003 的产品修复语义正确，但缺少上一轮 closure gate 要求的最小 warning-ack 回归。

   Immutable evidence: `0c52a3be:tests/e2e/logic-flow/import-logic-flow.spec.ts:531-554` 与 `670-700` 都止于 warning 可见及文案断言；全仓测试没有 acknowledge click。Contract basis: `task-test-4-review-365fa75c.md` 明确要求点击确认后 `logicflow-import-warning-modal` 与 `import-view-modal` 都消失，并将该 focused validation 列为 BUG-003 closure。Correction owner: task-test owner。Allowed path/public seam: 仅现有 `tests/e2e/logic-flow/import-logic-flow.spec.ts`。Preserve: station/empire mapping、warning 内容、普通取消、SmartSave 两种 choice、warning 先可见及无 warning 自动关闭均不变。Focused validation: 在现有 `2.7` dirty-empire warning 路径点击 acknowledge，随后断言两个 modal 均为 count 0；该一条路径同时覆盖 submitted SmartSave、warning acknowledge 与双层关闭。Observable closure: 新断言通过，且无需 timeout、fallback 或新增 helper/fixture。

Verdict:

`changes_required`。`0c52a3be` 的产品代码已满足唯一 completion close owner、warning acknowledge 双层收口及无重复 close 的语义要求，不建议继续修改 `ImportPlanModal.vue`；但直接针对第二轮根因的 runnable regression 尚缺，不能用“warning 可见”替代“acknowledge 后完整关闭”。

Changes:

1. 在现有 `2.7` warning case 内补最小 acknowledge click，并断言 `logicflow-import-warning-modal` 与 `import-view-modal` 都消失；无需新增用例、helper 或 fixture。
2. `3.3` / `3.18` 继续按 test-owned cleanup 修正或在其既有 test closure 中处理；不得据此回退产品的无 warning 自动关闭。
3. BUG-003 状态建议：当前保持 `Confirmed`；上述最小回归通过后改为 `Verified`。无需第三轮产品代码修复。

Caveats:

- reviewer 未重跑 Playwright 或 build；运行结论采用 assignment 提供的 Carson evidence，并以候选测试源码和现有两个 failure artifacts 核对 failure ownership。未声称 13/13 通过。
- assignment 将 `365fa75c` 标为 parent，但 Git metadata 显示 `0c52a3be` 的直接 parent 是 `2cb98d2a`；本审查使用 assignment 明示且祖先关系成立的精确累计范围，未把该措辞差异视为产品阻塞。
- 除本 review artifact 外，未修改产品、测试、OpenSpec 或 git 状态，也未提交。
