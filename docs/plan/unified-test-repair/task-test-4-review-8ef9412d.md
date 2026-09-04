# task-test-4 review — candidate 8ef9412d

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；复核 immutable candidate `8ef9412d`。未修改产品、测试、fixture、配置、candidate、Git index 或 workflow 状态；唯一有意仓库写入是本报告。

Reviewed commit:
`8ef9412d133280eeb9d0a1fc90dcd24944203508`，single parent `9542ac3b81df95b1a92009dc0e2992373d88cec1`。

Evidence:

- 审查开始时 `HEAD` 精确为 candidate，`git status --short` 无输出。candidate 只修改 `tests/e2e/logic-flow/**` 下 4 个文件，合计 `62 insertions / 3 deletions`；无 `src/**`、legacy、fixture、OpenSpec、配置或 workflow 状态改动。`git diff --check 8ef9412d^ 8ef9412d` exit `0`。
- reviewer collection：`npm exec playwright test -- tests/e2e/logic-flow --list` exit `0`，收集 `116 tests in 8 files`。按要求未运行完整 suite。
- current selector 对照：`.tab-btn` 由 `LogicFlowCandidateZone.vue:98-109` 生成，顺序由 presenter 固定为 industrial、agricultural（`:49-56`），所以新增 `.tab-btn.nth(1)` 当前确实切到农业类别并使 `spaceweed` setup有机会成立；`.flow-node[data-ware-id]` 由 `FlowNode.vue:96-109` 提供；`.connection-line` 由 `ProductionLineGroup.vue:372-382` 提供；compact target按 `groups` 顺序渲染后追加 new-zone（`LogicFlowPlanningZone.vue:382-410,490-505`）。这些 selector 当前存在，但 positional selector 只在该现行顺序下有效。
- candidate 新增的 `page.evaluate` 全部只读 store 状态，没有写业务状态；未新增 native drag dispatch、`dragTo()` 或 DOM 模拟。新增 `mouse.move()` 均有 `steps`。shared helper在 release 前验证 `isDragging`，并对 existing/new target验证 exact `hoveredGroupId` / `isHoveringNewZone`；新增 5.1b 在 release 前明确 hover-off，release 后比较完整 group/ware shape。
- worker报告的 build/diff-check通过可接受为静态证据；browser smoke因 sandbox/preview中断的部分既不算通过也不算产品失败。worker所报 Auto/Replace失败可由下述确定的 setup/expectation错误解释，未达到产品 bug升级门槛。
- normative basis：current `openspec/specs/logic-flow-operation/spec.md:8-56,125-139,190-282`、`openspec/specs/logical-flow-planner/spec.md:160-224`；较新的 active `logic-flow-energycells` change `:67-93,116-130`；历史 browser intent `logic-flow-operation/test_tasks.md` 的 Auto/Replace、7b/21、module-name、isolation/T0、i18n/default-lock条目。

Findings:

## F1 — blocking：新增 Auto/Replace case没有建立可达到的 current 状态

Classification: `test-owned setup + stale postcondition`。

`logic-flow-bug-regression.spec.ts:79-92` 先以 `weaponcomponents` 建组，再把 `refinedmetals` 期待为 `auto`。但 8.0 权威数据中 Weapon Component Production 的输入仅为 `energycells`、`hullparts`、`plasmaconductors`（`modules.json:5877-5907`），不会自动生成 `refinedmetals`；`refinedmetals` 又只有 `module_gen_prod_refinedmetals_01` 这一通用生产模块（`:5492-5522`），切到 Teladi不能形成不同 module的 `replace`。因此两个 `expectedStatus` 都不是 truthful setup。

该 body还有一个反向断言：helper若真的完成 `auto` drop，会在 `dragLogicFlow.ts:165-173` 验证节点已转为 `manual`，caller随后却在 `:82` 期待节点仍含 `Auto`。即便第一步修通，随后同一节点已是 manual，也不能继续承接“不同 lineage Auto节点 Replace”。

Contract basis: active Auto→Manual与不同 lineage Auto→Replace。Correction owner: `task-test-4` test coding worker。Allowed paths: `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts` 与必要 shared helper；不得改 `src/**`。Preserve: real Mouse API、actual-status equality、pre-up label/target identity与post-up source/module/lineage。

Observable closure: 分成两个最小 truthful scenario。Auto可用 `weaponcomponents` 自动生成的 default `hullparts`，同 lineage拖入后验证 pre-up Manual反馈、post-up `source='manual'`及对应实线结果；Replace在 fresh auto `hullparts` 上切 Teladi后拖入，精确验证 `module_gen_prod_hullparts_01` → `module_tel_prod_hullparts_01`、lineage与上游变化。只有该完整路径仍得到相反结果，才有资格升级产品 bug。

## F2 — blocking：同 ware lineage增强仍未证明模块名称或两条具体连线

Classification: `test-owned weak assertion / wrong scenario shape`。

- `logic-flow-bug-regression.spec.ts:70-76` 的两个 `Set.size === 2` 没有断言两个 lineage/moduleId均非空，也没有锁定 exact module IDs。
- `.flow-node...first()` 配 `/船体部件|Hull Parts/` 仍是 ware-name级子串，且只检查第一个节点；它不能区分 `Hull Part Production` 与 `Teladi Hull Part Production`，未满足两个节点分别显示模块名的 current contract。
- `.connection-line` selector本身当前有效，但页面级 `toHaveCount(2)` 不标识 source/target，也没有先添加共同下游 `weaponcomponents`。历史 7b/21 的场景明确要求两个 hullparts都连到 weaponcomponents；当前 body只有两个 hullparts，故这个总数既不能证明目标关系，也可能计入其各自上游的其他连线。
- existing compact node、existing-target preview、new-line header、drag ghost四个 module-name位置仍没有任何精确 browser assertion；candidate只新增了 regular `.flow-node` 的 ware子串。

Contract basis: `logical-flow-planner/spec.md:61-66,179-186`、`logic-flow-operation/spec.md:190-219`及历史 7b/21。Correction owner: `task-test-4` test coding worker。Allowed paths: 现有 `tests/e2e/logic-flow/**`；不得为取绿改产品 selector。

Observable closure: 通过 UI建立 default/Teladi hullparts与共同下游，断言两个 non-empty exact moduleId/lineage、两个 exact模块名称，并将 SVG path分别关联到两个 hullparts节点和同一 weaponcomponents节点；另以最少 drag覆盖 compact existing/preview、new header、drag ghost的模块名，而不是只数全页 `.connection-line`。

## F3 — blocking：基础 Connect有进展，但 isolated扩展/T0边界和两个旧 release guardrail仍未闭合

Classification: `test-owned remaining coverage + stale assertion`。

- `isolating a node...` 现在让 shared helper实际 drop；helper会验证解除隔离、正确 moduleId和存在上游 auto节点，基础 Connect方向有进展。但 caller最终只重复 `count=1`，helper的“任意另一个 auto节点”也不等于 exact upstream/T0边界。
- `isolated target changes...:50-62` 仍 `{ drop:false }` 后自行 `mouse.up()`，绕过 helper postcondition，再以 `.not.toHaveClass(/isolated/)` 判断结果。current `FlowNode.vue` 用 utility classes表达隔离，没有 `isolated` class，该断言仍可永久空跑，属于 stale测试表达。
- 没有新增 browser case证明后续扩展不会自动打破既有 isolation，也没有证明 compact T0 preview在 isolated中间节点停止；F5这两项仍完全开放。
- candidate新增 5.1b正确完成 hover-off + no-mutation；但原 `logic-flow-interaction.spec.ts:181-195` 仍从 `startWareDrag()`直接 release，只检查 drag flag，不具 exact target hover/leave与业务 postcondition。`logic-flow-new-feat.spec.ts:33-53` 的 locked leave错误地要求 base amber消失也仍存在。新增重复 case不能替代修正或移除旧假阳性 owner。

Contract basis: active Isolate/Connect、Isolation Node Expansion Rules、Drag Cancel Detection及既有 drag guardrail。Correction owner: `task-test-4` test coding worker。Allowed paths: 上述 canonical spec与 shared helper。Preserve: all moves with `steps`、release前 exact hover或明确 leave、release后 exact mutation/no-mutation；不要恢复 `.isolated` class或store-only旧实现。

Observable closure: 保留一个完整 Connect owner并删除/修正 vacuous duplicate；用真实 UI建立 isolated中间节点，分别验证新增下游后 isolation保持、compact T0 preview不出现该分支上游；修原 5.1与 locked cancel residue。

## F4 — blocking：empty/multi-target和农业类别修正有效，但 i18n/default-lock只部分覆盖

Classification: `mixed — passed selector/setup work + test-owned coverage gap`。

- `logic-flow-interaction.spec.ts:208-216` 当前可承接 empty-group first-node与multi-target：regular footer selector确实创建两个空组；shared helper将 compact `.nth(index)` 与同一 store group id关联并在 release前验证 exact `hoveredGroupId`，release后又按具体 `.production-group.nth(index)` 验证节点。该项静态闭合，等待 focused browser evidence即可。
- 三处新增 `.tab-btn.nth(1)` 当前准确选择 agricultural，修正 `spaceweed` source前置；4.16继续保持 unlocked accepted，4.17/regression继续保持 locked mismatch rejected。若后续仅因 preview/server中断，不得报产品 bug。
- `language switch...:131-137` 证明候选区从中文切到英文，并证明切换后新创建的规划节点是英文；它没有在切换前先建立规划节点，因而不能证明“已有候选区与规划区文本同时响应切换”。
- default-lock仍是旧的“点击创建两个空组 + page.evaluate读 boolean”，没有真实产品投放；candidate没有补前序要求的 lock-on/off product drop闭环。

Contract basis: active empty-group、multi-target、Language Switch、Candidate Zone Lock Switch与locked semantics。Correction owner: `task-test-4` test coding worker。Allowed paths: 现有 canonical Logic Flow tests/helper。

Observable closure: i18n先创建并定位同一个规划节点，再由 UI切换语言并对同一候选卡和同一节点做精确前后文本断言；default-lock用两次真实投放创建 on/off组并验证组UI及精确 lock/lineage结果。保留当前 empty/multi-target与 agricultural setup，不再扩写重复场景。

## F5 — failure ownership：当前没有可路由到产品 coding的缺陷

Classification:

| 类别 | 本轮证据 |
| --- | --- |
| `test-owned` | Auto/Replace不可达setup与反向Auto断言；lineage/module/SVG弱断言；isolated/T0缺口；i18n/default-lock部分覆盖；旧 release guardrail residue |
| `stale` | `.isolated` CSS断言、archived 4.16 hidden/dim、旧 EC禁拖/no-plus、store-only priority/merge/direct-write原件 |
| `driver/environment` | browser smoke的 sandbox/preview中断；在未到达 exact hover/current status/postcondition前的失败 |
| `product bug` | 无 |

Auto/Replace失败在 product interaction前就由数据前置和测试期望否定；其它新增项也尚未形成“truthful UI setup + visible source + drag active + exact hover/leave + current status + exact post-up结果”后仍稳定相反的证据。因此本轮不得开产品 bug或修改 `src/**`。

Verdict:
`changes_required`

candidate改善了二次 drag握手、农业类别切换、outside release和 empty/multi-target，并保持无业务状态写入；但 Auto/Replace case本身不可达且含反向断言，同 ware/module/SVG不够具体，module-name与 isolation/T0仍缺，i18n/default-lock只部分承接，旧 release假阳性仍在。active current browser coverage尚未闭合。

Changes:

1. 先用现有 `hullparts` default/Teladi模块把 Auto与Replace拆成两个可达场景，删除反向 Auto断言；只跑这两个 focused case。
2. 在同一最小 UI场景补共同下游，断言 exact moduleId/lineage、两个模块名及两条具体 source→target SVG连线；同时补四个 module-name drag位置。
3. 保留一个完整 Connect owner，补 isolation保持与T0 preview停止；删除/修正 `.isolated`、原 5.1和 locked-leave residue。
4. i18n改为同一已存在节点切换前后断言；default-lock改为真实投放。保留已正确的 empty/multi-target与 `.tab-btn` setup。
5. 仅重跑 Logic Flow collection、`git diff --check`、Auto/Replace、lineage/connection、isolation/T0、i18n/lock及4.16/4.17 focused cases；这些通过后再进入完整 suite。

Caveats:

- reviewer只运行 collection与静态检查，没有运行 browser或完整 suite；`116/8` collection不代表交互通过。
- worker browser输出未作为可重放的 exact log提交；其 sandbox/preview中断只记录为 unavailable environment evidence。Auto/Replace失败已有独立静态 test-owned解释，但修正后仍需 focused browser验证。
