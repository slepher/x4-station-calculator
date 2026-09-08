# Generation 6 决策与事实边界

沿用[plan.md](plan.md) Revision 1。下列“保留”是历史证据范围，不是本代执行通过；本文件没有代替用户作新的产品选择。T001–T009各自边界在D02–D10，后续草案的最晚决策点和返回路线同条记录。任务索引见[tasks.md](tasks.md)。

## D00

- Decision: 本代承接direct-migration实际成果；generation-4/5和旧generation-1仅为历史证据，不恢复旧运行状态、lane、模型或合并门。当前用户要求启用codex-workflow并working-tree交付，取代旧“不启用”与固定合并路线。
- Evidence: ["docs/plan/unified-test-repair/generation-6/input-evidence.md","docs/plan/unified-test-repair/generation-4/plan.md","docs/plan/unified-test-repair/generation-5/plan.md","docs/plan/unified-test-repair/generation-5/current-failure-summary-1.md","docs/plan/unified-test-repair/direct-migration/README.md"]
- Affected tasks: ["T002","T003","T020","T021","T022","T025"]
- Preserved results: 旧失败表中已被更新通过覆盖的M3/M6/M8/M10/M15/M16按本代映射继承；M13/M14独立review缺口仍保留。
- Open questions: 历史审核对应与当前全量证据分别由T002/T003及T025处理。
- Decide before: dispatcher采用本revision和逐次派发前，不从旧status推定本代done。
- Returns to: 当前dispatcher采用；新事实按受影响闭包返回planner。

## D01

- Decision: 新建generation-6 Revision 1，以d0614371558b2f6b30e8fd6b148347868228c413绑定当前tracked输入；2496项旧manifest已全部核验一致。T001–T009只读可执行，T010可执行且等待T001接受，T011–T025保持draft。旧任务编号仅供语义追溯，旧运行/接受状态不接入。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/generation-1/evidence/input-manifest.sha256","docs/plan/unified-test-repair/generation-6/input-evidence.md"]
- Affected tasks: ["T001","T002","T003","T004","T005","T006","T007","T008","T009","T010","T011","T012","T013","T014","T015","T016","T017","T018","T019","T020","T021","T022","T023","T024","T025"]
- Preserved results: 保留generation-4/5的原A1–A8、71文件范围及plan Acceptance mapping全部历史成果与剩余项；旧固定lane/merge路线由working-tree交付替代。当前tracked clean，仅已有untracked workflow-resume-handoff.md保留；旧51 dirty/25 untracked不是当前状态。
- Open questions: 本次未产生任务运行结果、独立review或dispatcher采用记录。运行前相关输入若变化，需把变化归属和影响闭包交planner；manifest不是可还原备份。
- Decide before: 独立dispatcher采用本coherent revision及每次任务派发前；planner语义变更需增plan及受影响合同revision，保留已派发合同。
- Returns to: 独立dispatcher会话采用并调度；新事实或输入漂移返回planner，只暂停受影响任务。

## D02

- Decision: T001仅核实环境事实；T010合同已固定sandbox wrapper、canonical Unit/collection和建材UI六项smoke命令，T001接受后可执行，无需再为普通运行步骤规划。T025负责最终完整验证。build/browser独占shared-dist-build与chromium-runtime，各任务PORT=231xx独占；配置/helper只读。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","playwright.config.ts","package.json","vitest.config.ts","docs/plan/unified-test-repair/direct-migration/environment.md"]
- Affected tasks: ["T001","T010","T011","T013","T014","T015","T016","T017","T018","T019","T020","T021","T022","T023","T024","T025"]
- Preserved results: 当前配置wait.stdout=/Local:/、webServer每次build→preview的事实；旧preview-only与抽查/tmp日志缺失不否定明确历史通过，但不能供本代运行。
- Open questions: 版本匹配、browser启动、构建/Unit结果及端口/权限仍需本次证据。T001只读不能证明运行；T010实际核验。已有工具不可用只记unavailable，不全局暂停独立调查。
- Decide before: T001接受后dispatcher绑定T010实际attempt/候选与空闲端口即可派发；命令或配置需语义扩张才回planner。其他E2E绑定各自新build；T025前冻结最终候选。并发放宽需事实及planner修订。
- Returns to: T001 → dispatcher → T010；T010 → E2E消费者/T025。配置/helper缺陷回planner指定唯一owner，不复制helper；环境不可用保留验收未满足。

## D03

- Decision: T002有界核对Acceptance mapping中明确分配给它的历史继承与审核候选关系，不重迁移已审核工作。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/README.md","docs/plan/unified-test-repair/direct-migration/results/M6.1.md","docs/plan/unified-test-repair/direct-migration/results/M10.4.md","docs/plan/unified-test-repair/direct-migration/results/M15.4.md"]
- Affected tasks: ["T002","T010","T025"]
- Preserved results: M3补充图/草案/TRADE-DRAG/UI分别并入旧编号映射；M6.2、M8.1、M8.2按最新结果继承；M10.3/M10.4/M10.5及M15.4闭合oracle不按旧失败重做。其余保留范围以plan表为准。
- Open questions: M6.1 README审核与pending文字、M10.4旧HULL标题与后续审核的候选对应尚待核实；找不到旧原始日志需区分报告事实和可重新核验证据，不能猜测。
- Decide before: T002交独立review以及T025继承闭合前；如需当前最小重证，由planner在T010或T025开放前明确范围。
- Returns to: T002 → 独立reviewer/dispatcher；明确缺口 → planner → T010/T025。已指定未完成项仍由T011–T024负责。

## D04

- Decision: T003准备M8.3/M9.1候选与覆盖证据交独立reviewer；已有运行通过不是独立接受。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/results/M8.3.md","docs/plan/unified-test-repair/direct-migration/results/M9.1.md"]
- Affected tasks: ["T003","T008","T010","T016","T025"]
- Preserved results: M8.3历史20/20及Unit/build报告；M9.1六import＋一station placement的7/7按原强度保留。不会把placed class/marker提升为空间身份持久化。
- Open questions: 缺明确独立接受记录及可能的候选关联；部分原日志可否读取待核对。完整station/sector/position保存与reload另属T008/T016。
- Decide before: T003的独立review及T016候选选择前；需要真实运行才能判断的事项进入T010/T025新revision。
- Returns to: T003 → 独立reviewer → dispatcher；空间缺口 → T008/T016；运行重证 → T010/T025，身份争议 → planner。

## D05

- Decision: T004调查M2.1-FOCUS原1.3.5自动站点变化的公开因果入口；T011仅在明确入口或获准的精确Unit边界后开放。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/tasks/M2.1-FOCUS.md","docs/plan/unified-test-repair/direct-migration/results/M2.1.md","openspec/changes/auto-sector-group-one-binding/specs/auto-sector-group-binding-draft/spec.md"]
- Affected tasks: ["T004","T011"]
- Preserved results: M2.1已有16/16不重做；原自动activeBindingStation/active transit变化不得覆盖工作台的语义保留。sidebar点击允许切换仅作对照。
- Open questions: 哪个实际生产事件可经公开UI引起前后对象真实变化、如何固定两个身份和工作台锚点？若只能Unit证明，需要哪个精确调用边界及测试路径？
- Decide before: T011开放前落实公开动作、fixture、独立expected、必要Unit路径和写入授权；无入口不得用静态值/写store替代。
- Returns to: T004 → planner/独立reviewer → T011；缺产品入口或验收层级改变返回planner，新增产品选择交用户。

## D06

- Decision: T005只读定位独立drag demo locked hover根因；T012产品修复＋组件回归与T013真实pointer十项验收分开，正式LogicFlow不进入依赖。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/results/M5.3.md","docs/plan/unified-test-repair/direct-migration/tasks/FIX-M5.3.md","openspec/changes/archive/2026-02-16-vue-drag-test/specs/vue-drag-test/spec.md","openspec/changes/fix-drag-demo-list-ownership/specs/drag-demo-list-ownership/spec.md"]
- Affected tasks: ["T005","T012","T013"]
- Preserved results: latest final-current2为8/10、0skip；compact两项及normal/cancel/Auto/Isolate/duplicate/Reset保留，locked Argon reject与Terran accept hover两项仍未满足。早期计数仍为历史。
- Open questions: 真实list/modelValue、hover/事件与所有权链的根因及能证伪它的组件检查待T005核实；旧任务标题不是根因证据。add/drop规范差异需独立判断。
- Decide before: T012开放前冻结确证根因、最小source/Unit闭包和授权，并应用audit-implementation-simplicity；T013开放前取得T012 review与修复后新build。若事实显示无需产品修复，由planner显式修订依赖和验收映射。
- Returns to: T005 → planner → T012 → dispatcher安排新build → T013 → T025；根因反例返回T005，不泛化重构正式LogicFlow。

## D07

- Decision: T006分别整理已有规范与实现冲突，由独立reviewer判断来源；新增产品选择由用户决定。代码、测试绿或历史勾选不撤销规范。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/results/M7.2.md","docs/plan/unified-test-repair/direct-migration/results/M7.3.md","docs/plan/unified-test-repair/direct-migration/results/M10.2.md","docs/plan/unified-test-repair/direct-migration/results/M15.2.md"]
- Affected tasks: ["T006","T014","T015","T017","T023"]
- Preserved results: 每项原验收及旧失败/skip未完成均保留；每个争议只暂停自身闭包。D07a/b/c分别可决，不互相吞并。
- Open questions: D07a–D07f哪些有明确后续替代条款？如无，旧条款仍是验收，不把实现现状当产品批准。
- Decide before: 分别在T014/T015/T017/T023相应场景开放前；不能用环境调查或其他争议作为全局暂停原因。
- Returns to: T006 → 独立reviewer → planner → 对应任务；确有产品选择由dispatcher交用户。

## D07a

- Decision: M10.2 bugfix-panel4.1 Fit展开占2/3的验收继续有效，直到有明确权威替代映射；历史实际0.31623只是冲突观察。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/tasks/M10.2.md","docs/plan/unified-test-repair/direct-migration/results/M10.2.md","openspec/specs/equipment-panel/spec.md","tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts"]
- Affected tasks: ["T006","T017"]
- Preserved results: Fit安装行为与独立FIT/DETAILS已验证成果保留；布局1未满足，不能因其他43项通过而关闭。
- Open questions: 原2/3条款是否被明确替代？如果仍有效，所需产品布局修复的精确owner是什么？不得改为当前0.31623 oracle。
- Decide before: T017布局1写入/运行验收前，由reviewer核实来源；需产品修改则先由planner另立合同和新build。
- Returns to: T006 → 独立reviewer/planner → T017布局1；新增比例设计交用户。

## D07b

- Decision: M10.2 selector3.5 race tags>3应两行保留；实际一行且实现阈值>5不构成授权替代。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/results/M10.2.md","openspec/specs/equipment-panel/spec.md","tests/e2e/ship/ship-equipment-selector.spec.ts"]
- Affected tasks: ["T006","T017"]
- Preserved results: 布局2原阈值与两行行为保留；装备选择及FIT/DETAILS已有成果不重开。
- Open questions: 是否存在把>3改为>5的明确权威条款？应以哪个固定tags集合和viewport证明断行？
- Decide before: T017布局2开放前独立核对阈值来源和几何oracle；新产品断行选择由用户决定。
- Returns to: T006 → 独立reviewer/planner → T017布局2。

## D07c

- Decision: M10.2 selector3.1/3.6的三行两列、首列calc(50% - 4rem)、前两行25.6px保留；历史实际none/26/56不能自动升为expected。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","docs/plan/unified-test-repair/direct-migration/results/M10.2.md","openspec/specs/equipment-panel/spec.md","tests/e2e/ship/ship-equipment-selector.spec.ts"]
- Affected tasks: ["T006","T017"]
- Preserved results: 布局3包含所有原几何子约束，不能只测有元素或选择其中一个子约束即通过。
- Open questions: 每个网格/列宽/行高约束有无明确替代条款及适用状态？若需布局恢复，精确产品owner和回归边界尚未定。
- Decide before: T017布局3开放前逐条审查并冻结固定viewport/UI状态/容差依据；产品候选先独立review。
- Returns to: T006 → 独立reviewer/planner → T017布局3；不同子约束的未决项继续记录。

## D07d

- Decision: M7.2原Case5独立AutoSupply未完成；统一autoInfrastructure不能未经裁决替代独立归属。T014保留可达24项。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/results/M7.2.md","openspec/specs/storage-auto-fill/spec.md","openspec/specs/wareflow-refactory/spec.md","openspec/specs/live-planning-station/spec.md"]
- Affected tasks: ["T006","T014"]
- Preserved results: 历史24passed/1skipped、exit0仍不是完整25项通过；internalSupply、autoSupply而非autoStorage归属的旧约束不弱化。
- Open questions: 独立AutoSupply是否明确被统一基础设施替代？若没有，公开UI前置/独立归属缺失的产品修复由谁拥有？
- Decide before: T014开放Case5前有独立裁决；需要产品能力时先经planner冻结产品与回归合同。
- Returns to: T006 → 独立reviewer/planner → T014；其他迁移继续。

## D07e

- Decision: M7.3 sector来源四项3.2/3.3/3.9/3.12保留；savedEmpire实现不是sector验收。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/results/M7.3.md","openspec/specs/station-resource-group/spec.md"]
- Affected tasks: ["T006","T015"]
- Preserved results: dashboard33/33、ware48/48、resource12/16共93项历史通过保留；仅四项来源/身份/过滤/高亮待满足。
- Open questions: 有无sector→savedEmpire明确替代条款及四项逐条映射？如仍有效则产品需恢复何种公开UI能力？
- Decide before: T015对应四项开放前；不能将logicflow来源其他通过用例复用为sector证据。
- Returns to: T006 → 独立reviewer/planner → T015；产品能力缺口另立owner。

## D07f

- Decision: M15.2最终No Demand≠Resource仍是未满足的文案语义，不用暂态8/8覆盖最新7/8。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/results/M15.2.md","openspec/specs/button-tooltip/spec.md"]
- Affected tasks: ["T006","T009","T023","T024"]
- Preserved results: tooltip触发/侧向定位/隐藏其余七项与最终稳定文案要求保留；80/70列宽额外范围交T009核对。
- Open questions: 规范要求的最终状态究竟是什么，是否有明确替代依据？列宽是否原必需不能由本项猜测。
- Decide before: T023开放前裁决最终文案；列宽在T009后、对应任务写入前冻结，重叠文件需要序列化。
- Returns to: T006 → 独立reviewer/planner → T023；列宽 → T009/T024。

## D08

- Decision: T007只读厘清M11–M14的真实UI前置，分别支持T018/T019/T020/T021/T022。T021五项独立于3.3裁决；T022仅为同文件写入交接依赖T021。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/tasks/M11.1.md","docs/plan/unified-test-repair/direct-migration/tasks/M12.1.md","docs/plan/unified-test-repair/direct-migration/tasks/M13.1.md","docs/plan/unified-test-repair/direct-migration/tasks/M14.1.md","src/components/empire/presenters/buildPlanStepsLogic.ts"]
- Affected tasks: ["T007","T018","T019","T020","T021","T022"]
- Preserved results: M11.1原27声明、M12.1原21声明、M13.1原9项全部有效目的；M14.1的2.1/2.2/3.1/3.2/3.4与3.3六项均保留。声明数及历史5/6不是当前通过。
- Open questions: 建筑流真实drag/绑定/归档，Fleet/目标确定实体，logic-flow-1与建材预览前置需要核实；3.3必须groupType=build-material、modules非空、target rates非空同时满足。
- Decide before: T018开放前确认菜单/绑定/drag及fixture；T019前确认Fleet/CRUD/active隔离；T020前确认derived/required/moduleId/graph=null/SCC空oracle；T021前只需五项确定路线和精确selector；T022前必须有三条件明确卡片/UI证据并完成T021同文件交接。
- Returns to: T007 → planner分别修订T018–T022；3.3无入口只回T022，不阻塞T021五项。禁止重试energycells+last旧路线。

## D09

- Decision: T008独立研究M9.1空间身份oracle，T016补station/sector真实pointer→保存→reload；T008不等待T003审查。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/tasks/M9.1.md","docs/plan/unified-test-repair/direct-migration/results/M9.1.md","openspec/specs/x4-import-move/spec.md","openspec/specs/map-station/spec.md"]
- Affected tasks: ["T008","T003","T016"]
- Preserved results: 六import及弱station placement历史7/7保留，完整实体/sector/position保存与reload仍缺，不能以placed class关闭。
- Open questions: 固定目标实体/sector/坐标系、独立expected及容差、持久化读回键和公开UI保存路线需T008核实；是否存在产品能力缺口未知。
- Decide before: T016开放前冻结空间oracle/路径，合入T003候选审查并绑定T010构建；不让产品修复潜入测试合同。
- Returns to: T008 → planner → T016；候选审查T003并行；缺产品能力另立owner。

## D10

- Decision: T009核对报告额外限制的原始权威范围；既有必需必须进入T024或相关任务，新增范围由用户决定。T024当前Owned paths为空，禁止实施。
- Evidence: ["docs/plan/unified-test-repair/direct-migration/tasks/M2.1.md","docs/plan/unified-test-repair/direct-migration/results/M2.1.md","docs/plan/unified-test-repair/direct-migration/tasks/M15.2.md","docs/plan/unified-test-repair/direct-migration/results/M15.2.md","docs/plan/unified-test-repair/direct-migration/tasks/M16.2.md","docs/plan/unified-test-repair/direct-migration/results/M16.2.md"]
- Affected tasks: ["T009","T011","T023","T024","T025"]
- Preserved results: M2.1 16/16与M16.2 51/51、UI/CALC/消费者成果按已证明范围继承；任何未覆盖必需条款不能以额外命名排除。
- Open questions: 内部调用次数/live flow、80/70列宽、Live/archive/reference floor/bulk scale哪些原属必需，哪些已有覆盖，哪些真正新增？具体写入路径和oracle尚未定。
- Decide before: T024开放前冻结逐条裁决、精确Owned paths、回归/授权；与T011/T023等重叠先修订依赖或独占资源。T025闭合前每个条款必须有去向；无剩余时由planner显式退休T024及映射，不自动完成。
- Returns to: T009 → 独立reviewer/planner → T024或T011/T023；新增产品选择经dispatcher交用户；闭合清单交T025。

## D11

- Decision: T025保留原A7完整canonical E2E、build、canonical Unit和diff的最终候选验证；它不修复失败、不替代功能独立review、不吞掉draft。
- Evidence: ["docs/plan/unified-test-repair/generation-6/plan.md","playwright.config.ts","vitest.config.ts","package.json"]
- Affected tasks: ["T010","T024","T025"]
- Preserved results: 原71个canonical文件加补充spec的场景映射及所有原A1–A8语义；历史Unit计数不作当前候选全量证据。
- Open questions: 最终候选与全部review尚未生成；现无当前全量结论。环境不可用仅解释unavailable，不能消除全绿验收要求。
- Decide before: T025开放前前置接受/未决处置、候选身份与授权明确；整个完整运行保持canonical collection/并行，不能filtered/逐功能串行拼接。结果身份漂移需要有界回核。
- Returns to: T025 → 独立reviewer/dispatcher记录真实结论；失败回planner定位T011–T024或共享owner，环境回T010。用户验证与dispatcher接受均不由planner代行。
