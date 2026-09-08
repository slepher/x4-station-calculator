- Schema: 1
- Revision: 4
- Repository: /home/slepher/project/x4-station-calculator
- Target: /home/slepher/project/x4-station-calculator working-tree delivery
- Base: d0614371558b2f6b30e8fd6b148347868228c413
- Delivery: working-tree

## Goal

实际完成 direct-migration 尚未完成的测试修复、其必要产品修复和最终完整验证。调查必须转成有精确 owner 的代码/测试修复；保留有效历史成果及当前产品/Unit 候选，不宣称它们已接受。交付可追溯的工作树候选、完整 canonical E2E/Unit/build 结果及独立审查。generation-6 本次发布 revision 4，继续原任务编号，不创建新 generation。

控制仓库为 `/home/slepher/project/x4-station-calculator`，initiative 控制目录为其 `docs/plan/unified-test-repair/`；本代规划唯一写入目录为 `generation-6/`。旧 direct-migration、generation-4/5、旧报告和失败记录均只读。用户授权继续未完成任务、working-tree 交付；planner 本轮仅写规划文档，不修改产品、测试、配置、规范或 Git metadata。没有提交、合并、reset、stash、删除或覆盖既有变动的权限。

## Acceptance

1. 保留旧计划 A1–A8 的有效验收语义：全部原 71 个 canonical E2E 文件及新增补充 spec 均有场景去向；旧编号 → 当前行为 → 固定输入 → 用户动作 → 独立 expected → 测试/证据映射齐全。数量变化必须解释，不以删除、排除、skip、条件通过造绿。
2. 下表所有未完成项均有责任任务；draft 也是剩余工作。T006-A1-review 已确认原规范仍有效，T014/T015/T017/T023 默认恢复原规范，不等待新的用户决定。只有确实要求改变既有产品语义时才需要新权威；代码现状、历史勾选和局部绿不能撤销规范。
3. E2E 业务操作走 UI/真实 pointer。fixture 仅建立初态，page.evaluate 只注入 fixture 或读取结果，不写 store 冒充事务；expected 不从被测算法输出反推。普通 fixture 排除 vsn、reload、UI 语言；Live/save/binding 复用唯一 loadLiveBindingFixture；Logic Flow 显式 clean/seeded 及版本/storage key。
4. 保留 latest 单次运行与 composite/历史/collection 的区别。候选、合同 revision、命令、cwd、exit、passed/failed/skipped/flaky及日志/trace需绑定同一输入/输出身份；仅规范/expected变更、产品修复和最终候选需要独立review。仅dispatcher记录接受与完成。
5. 完整 canonical E2E 是最终验收，不是可选抽查；collection、调查结束、局部通过或修复任务自报完成均不能替代。最终工作树必须有完整 canonical E2E、build、diff 及 canonical Unit 的真实结果。完整 E2E 使用原 canonical collection 与并行配置，不能用 filtered run、只跑剩余文件或逐功能串行结果拼接替代。Unit 使用 `npm run test:unit` 的 `tests/unit/**/*.spec.ts`，不包含 legacy/skills suite。没有当前全绿证据便不得宣称全功能通过；工具不可用只能标 unavailable，明确验收仍未满足。
6. 原有用户变更全部保留，可归属补丁不要求先提交。产品修复与测试迁移、独立验证各自有边界；必要回归权限随修复合同一起落实，不借失败越权修改共享 helper/source。

## Design and constraints

输入身份为不可变 Base `d0614371558b2f6b30e8fd6b148347868228c413`，分支检查为 `develop`。generation-6 初始调查曾记录 tracked diff 为空；这不是 revision 4 当前状态。现在保留 `src/store/useDragTestStore.ts` 修改和未跟踪 `tests/unit/common/drag-demo-list-ownership.spec.ts`，以及已有 status/handoff/规划产物。本次不修改这些产品/Unit 文件，也不记录其接受。旧 manifest 的 2496 项内容在初始调查全部核验一致（`sha256sum --quiet -c` exit 0），其 SHA-256 为 `857ee9beea436b7dbaca73e7512a817e1dfb723875d7d5fdef75ebc841afb9ec`。因此可以继承旧源码/测试内容证据，但旧 51 dirty/25 untracked 状态不再描述当前树，也不需要恢复它。核验命令及来源见 [input-evidence.md](input-evidence.md)。执行前重核相关输入；后续用户或 worker 变更只暂停受影响闭包，并由 dispatcher 留存实际补丁/内容指纹。Base 与 manifest 都不授权 reset。

历史事实优先级：本轮实际代码/文件存在性与最新具体结果优先于旧 handoff/context 的基线描述；README 的审核记录可作为继承证据，worker “待审核”不自动等于 accepted。同文档后续具体验证覆盖其旧失败段落；无法核实候选或审核对应关系的项标待确认。旧 /tmp 原始日志若缺失，不推翻明确历史通过事实，也不据此制造当前 pass。T002 核对继承，M8.3 的当前闭合并入 T025，M9.1 的缺口并入 T016。

当前 `playwright.config.ts` 已有 `wait: { stdout: /Local:/ }`，不是 context 所称 URL gate；默认 webServer 每次会 `npm run build && vite preview`。旧 preview-only 配置及抽查的 /tmp 原始日志当前不存在；node_modules、dist、Chromium cache 目录存在，但目录存在不证明版本匹配、dist 新鲜、浏览器可启动或端口可用。详见 D02。

共享资源约定（实际占用写在任务合同中，不由任务编号推断）：

- `shared-dist-build`：仓库 dist、Vite 产物和 TypeScript build cache；构建及使用默认 webServer 的整个浏览器运行独占，禁止预览期间重建。T010 是首个候选 build/canonical Unit/runner 验证责任任务，T025 负责最终候选；缺陷修复后由 dispatcher 安排新构建身份。
- `chromium-runtime`：当前安装的 Chromium 与 sandbox 执行环境；在 T001 证明可安全并发并由 planner 修订前，所有浏览器任务串行。不得关闭 chromiumSandbox 绕过权限、安装依赖或沿用历史 escalation 当成本次授权。
- `preview-port-231xx`：合同各自的候选端口，使用前查占用；产物目录按 generation/task/attempt 唯一。端口冲突是调度事实，可机械换空闲端口并记录，不能重用他人 server。
- `playwright-config`：playwright.config.ts 及既有 test-setup.ts 只读，无本代 writer。T010 直接使用仓库配置、smoke 路径与命令；配置缺陷返回唯一 owner，不新建临时 runner。
- `live-binding-helper`：tests/e2e/live/helpers/loadLiveBindingFixture.ts；`logic-flow-helpers`：tests/e2e/logic-flow/helpers/setupLogicFlow.ts 与 dragLogicFlow.ts；`base-fixtures`：tests/fixtures/db.json、save.json、save/ 及 tests/test-setup.ts。全部冻结、无修改 owner；各消费者通过 Inputs 绑定。若发现共享缺陷，planner 新增唯一修复 owner 和有限消费者回归合同，不能复制 helper 或并行修改。
- T001/T002/T006/T007 的既有结果保留。T003/T004/T005/T008/T009 退休，其必要调查分别并入 T016/T025、T011、T012、T016、T024。普通调查和机械迁移由 dispatcher 核对；只有 expected/规范变化、产品修复和最终候选要求独立 review。不同 spec 可并行编辑，browser/build 仍串行。

产品代码的新设计严格 store → presenter → vue：store 负责领域能力/持久化，presenter 组装 UI，Vue 经 presenter 取数及触发行为，不加中间层。持久化新增字段必须同步 normalizeState；不增 fallback 链，不删除未核实代码或调试日志。T012 及本次开放的 T014/T015/T017/T023 产品修复适用已读取的 audit-implementation-simplicity 标准；不将该标准套入纯测试实现/审查。根因未确定时不预设泛化重构，也不扩展正式 Logic Flow 来修独立 demo。

角色按 `/home/slepher/.codex/skills/codex-workflow/role-profiles.toml`；本次已核验当前会话为 planner，只出版规划，交 dispatcher 采用 revision 并执行。可执行调查使用 context_collector/evidence_runner；独立语义审查由 reviewer，最终验证 full_tester 与实现者独立。无需重新创建 dispatcher 会话，也不沿用旧 handoff 的 Astra medium 执行者要求。

本次 amendment 只写指定规划产物，不运行测试/build、不修改源码或测试、不派生 agent。后续修改任务默认同工作树按精确文件所有权隔离；并行编辑只限不重叠路径，shared-dist-build/chromium-runtime 保证整个 build/browser 周期独占。若 dispatcher 分配隔离 lane，必须从本 Base 加已接受的实际依赖补丁建立可见输入，记录工作目录、候选与资源；不能只检出旧 Base 遗漏 working-tree 修复。测试前冻结相应源码/配置/fixture 写入，交接以可归属补丁和内容指纹完成，无固定 coding→target→integrate 合并路线。角色名及 task-to-lane 绑定由 dispatcher 记录。

## Acceptance mapping

表中证据均在本仓库 [旧 results](../direct-migration/results/) 和 [旧 tasks](../direct-migration/tasks/)，已由本轮 manifest 核验与 Base 绑定。表中“保留”指具体历史成果，绝不声称本次运行通过。T002 仅补旧编号/审核对应缺口，不重做已核验的 2496 项文件身份核对或无理由重跑已审核工作。generation-4/5 的 A1–A8、71 文件范围与尚未满足的 M13/M14 语义保留；旧 lane/status/merge 接受不接入本代，详见 D00。

| Legacy 验收 | 最新具体证据及保留范围 | 本代承接 |
|---|---|---|
| M1.1 | README 审核通过；结果 2/2，精确 GUID/time/有效归档双向变化 | T002 继承核对，共享 helper 冻结 |
| M1.2 | README 审核通过；CRUD 4/4，独立持久化边界 | T002 |
| M2.1 | 16/16 是已迁移事务；自动站点保护无 witness；内部调用次数/live flow 数值不宣称覆盖 | T002 保留16；T011 内调查并补 witness；额外边界由 T024 即时核对 |
| M2.1-FOCUS | 无结果；旧 1.3.5 自动 activeBindingStation/active transit 变化保持工作台 | T011，显式点击仅作对照 |
| M3.1 | 基础15/15，非玩家 hub 修复已验证；不能独自覆盖补充图/草案/拖放 | T002 将以下三份补充逐编号并入映射 |
| M3.1-GRAPH | 最新9/9；6.9 Unit6/6、相关86/86、build、独立源码复审 | T002 保留 clean slate/增量/30%分差/MST/bridge/单向/unpin/retain-off/五跳/BFS |
| M3.1-DRAFT | 最新6/6、Unit47/47、build、独立复审 | T002 保留统计/transfer/assignment/jump/baseline/standalone/连接和废弃组持久化 |
| M3.1-TRADE-DRAG | README 审核通过；复用 M3.2 精确 6.1–6.5 真实 drag→拒绝→confirm→reload | T002 复用该 witness，不另建重复 spec |
| M3.2 | 最新原13/13、FIX-M3.2 Unit/build 和透明恢复；旧补充未完描述已被新结果取代 | T002，补充与原合同分别记录 |
| M3.2-UI | 7/7，README 审核通过；layer/focus/style/color/settings copy、row不含group名 | T002 |
| M4.1 | README 审核通过7/7；只覆盖合同仪表盘/总览，不声称所有成本算法 | T002 |
| M4.2 | README 审核通过20/20，贡献/缺口/流向联动 | T002 |
| M4.3 | README 审核通过16/16，站点/中转工具栏 | T002 |
| M5.1 | 审核通过8/8、稳定16/16、消费者4/4；helper业务 expected 由消费者提供 | T002 冻结接口 |
| M5.2 | 审核通过49/49、Unit6/6、build；compact module 名称修复 | T002 |
| M5.3 / FIX-M5.3 | latest final-current2 为8/10、0skip；locked Argon reject、Terran accept hover失败。早期4/6、7/3、6/4均历史 | T012 内诊断并修复→T013；保留compact2、normal、cancel、Auto、Isolate、duplicate、Reset八项 |
| M6.1 | README 审核通过45/45；结果仍写 pending parent review，审核候选对应待核对 | T002 证据审查，禁止按旧41/4重做 |
| M6.2 | 最新14/14、Unit4/4、build及独立复审；32px扩展、资源标签隐藏 | T002 保留，不沿旧28px失败重复 |
| M7.1 | 审核通过27/27、真实拖放稳定21/21 | T002 |
| M7.2 | 可达24/25；唯一原 Case5 skip未完成，独立AutoSupply冲突 | T002 保留24；T014恢复独立AutoSupply并启用Case5 |
| M7.3 | 97中93通过、4失败、0skip；dashboard33/33、ware48/48、resource12/16 | T002 保留93；T015恢复sector来源，仅3.2/3.3/3.9/3.12 sector来源四项未满足 |
| M7.4 | 审核通过24/24；导入版本/身份及Save/reload | T002 |
| M8.1 | README 审核通过；latest final4 单次46/46；final2 asset404属历史瞬态 | T002 保留，禁止因旧context重新迁移 |
| M8.2 | README 审核通过；final-current-32单次32/32；静态资源集合及hub身份 | T002 保留，不把旧30/2当当前 |
| M8.3 | 最新完整20/20、gate Unit6/6＋地址Unit4/4、build；无明确独立接受记录 | 已有pass保留，当前候选由T025闭合 |
| M9.1 已通过部分 | 六个import＋一个station placement共7/7；其中placement当前仅placed class/标记存在，未证明完整身份持久化 | T016保留六项导入并审查/加强placement |
| M9.1 未覆盖部分 | sector placement、station/sector保存与reload完整空间身份；真实pointer后精确实体/sector/position不混淆 | T016内先冻结oracle再实现 |
| M10.1 | 审核通过35/35、Unit5/5、build；选择生命周期 | T002 |
| M10.2 已通过部分 | 单次43/46，FIT唯一候选填满/清空/step与DETAILS五项已独立验证 | T002 保留43及FIT/DETAILS，不重修 |
| M10.2 布局1 | bugfix-panel4.1 Fit展开占2/3，历史实际0.31623 | D07a，T017按已定规范修复 |
| M10.2 布局2 | selector3.5 race tags>3两行，实际一行/实现阈值>5 | D07b，T017按已定规范修复 |
| M10.2 布局3 | selector3.1/3.6三行两列、首列calc(50% - 4rem)、前两行25.6px；实际none/26/56 | D07c，T017按已定规范修复 |
| M10.3 / FIX-M10.3 | 最新22/22；原3.8真实鼠标DOM220、总250/250；mounted15/15，README审核通过 | T002 保留，旧21/1不可当单次 |
| M10.4 / HULL / STATS | 最新23/23、Unit消费者32/32；2297、301.1显示精度、1%/s；README审核通过 | T002；旧HULL pending标题被后续具体结果覆盖，审核候选关联需核对 |
| M10.5 | reviewed10/10、0skip；合法保留/禁用回退及reload/装备tag | T002 保留 |
| M11.1 | README排队，无结果；当前27个test声明含条件/合成drag路径 | T007→T018；完整菜单/绑定/归档/真实drag/持久化迁移 |
| M12.1 | 待执行，无direct结果；当前21个test声明，Fleet等含if-visible/first选择 | T007→T019；目标、Fleet、CRUD、active隔离及reload |
| M13.1 | 旧审查5pass/4fail；当前9项，logic-flow-1与建材前置仍待证明 | T007→T020，derived/required/moduleId/graph=null/SCC空及用户目标分离 |
| M14.1 独立五项 | 历史5/6不能作当前通过；保留2.1/2.2/3.1/3.2/3.4 | T007→T021，不等待3.3裁决 |
| M14.1 3.3 | 历史多轮steps开关不可达；groupType=build-material＋modules非空＋target rates非空才恢复 | T022仍draft，缺精确卡片/UI witness；保留默认汇总→steps→汇总及内容，禁止旧energycells+last路线重试 |
| M15.1 | 审核通过46/46、原9项、M7.1消费者2/2 | T002 |
| M15.2 | 7/8，最终No Demand≠Resource失败；暂态8/8不能作规范通过 | T023修复No Demand及T024已确认的80/70列宽 |
| M15.3 | 审核通过6/6 | T002 |
| M15.4 | README审核通过，二审ledger闭合3/3；推荐baseline、一跳外部贡献与quantum+258抵消 | T002 保留，不重新裁决已闭合oracle |
| M16.1 | 审核通过10/10；历史mock缺activeDlcs已修且Unit4/4 | T002 |
| M16.2 | 审核通过51/51、UI Unit6/6、CALC Unit4/4、消费者9/9 | T002 保留；Live/archive/reference floor、批量scale由T024判定是否既有必需验收 |
| 环境与整体验收 | 历史926/950/969/1000 Unit分别属于旧候选；没有当前工作树全量结论 | T001→T010；最终T025保留原A7完整canonical E2E要求 |

额外静态发现不自动扩成产品功能：T024 对 M2.1 内部数量、M15.2列宽、M16.2 Live/bulk 等报告限制逐条核对原合同及规范；既有必需项进入对应功能任务，范围新增交用户决定。

## 任务执行公共合同（Revision 4）

以下适用于本次八份修订合同，补充其精确 Owned paths、Dependencies、Review 和 Return route：

- 修改范围只限 Owned paths；产品 store 负责领域能力，presenter 负责界面数据与行为，Vue 只消费 presenter。共享 fixture/helper、tests/test-setup.ts、playwright.config.ts、openspec 和 Git metadata 只读。现有用户补丁和调试日志保留，不提交、不覆盖他人改动。
- 普通 E2E beforeEach 用 tests/fixtures/db.json 排除 vsn → reload → UI 设置语言，禁止 localStorage.clear；固定游戏版本与对应 storage key。Live/save/binding/archive 统一复用 tests/e2e/live/helpers/loadLiveBindingFixture.ts 和其 save fixture；Logic Flow 复用 setupLogicFlow.ts/dragLogicFlow.ts，明确 clean/seeded。业务动作走 UI/真实 pointer，page.evaluate 仅初始 fixture 或只读观察，不写 store 冒充行为。
- 修复与必要 focused 检查属于同一个工作合同。源码/测试补丁、独立 expected、实际运行结果缺一不可；局部失败在已有 Owned 内继续修正，超出边界才带明确失败和路径回 planner。不得仅返回调查结果、旧测试重跑或不存在的退休任务 result。
- 可立即开始安全的测试编辑/产品修复，不等待 T010 所有 smoke 通过；browser 阶段复用已确认的 T010 运行前提，并以默认 webServer 重新 build 当前候选。独占 shared-dist-build/chromium-runtime，不重用别人的 preview。调度问题由 dispatcher 恢复，工具不可用如实记录，不能降低验收。
- 每任务保留实际 attempt 的命令/cwd/exit/count、补丁身份及日志/trace；产品/Unit 已有结果是证据，不是 accepted。旧 attempt 不覆盖。独立 reviewer 与实现者分离，只有 dispatcher 记录采用/接受/完成。
- Revision 3 合同中的退休 T003/T005/T008 预留结果不再是必需输入；必要事实已内化到 owner。T012 文件本次不改：其现有候选可先交 T013 真实 pointer 验证，T012 的独立产品接受随后消费 T013 结果。不能反向要求 T013 先等待 T012 accepted；T012 未完成的 review/组件验收也不能借此豁免。
- T014/T015 共用 useBlueprintProductionStore.ts；T014 的本文件候选先交接，T015 再写。T015 的依赖仅约束共享写入，非共享文件可先准备。T021/T022 共用 compute spec，依赖仅约束单 writer 交接。新接口消费者使用实际候选，不混入旧 Base。

## Planning horizon

T013、T014、T016、T017、T023 可以立即进入修复；T015 是 executable，可先准备非共享部分，store 修改在 T014 交接后进行。T011/T012/T018–T021/T024 保持原合同的未完成工作，不重新派发退休调查，不因本次 amendment 无理由重跑既有证据。T010 保留运行前提与环境恢复职责。

仅 T022 保留 draft：缺少同时满足 groupType=build-material、modules 非空和正的非 energycells 建材 target rates 的精确卡片/UI witness，尚不能安全冻结测试前置。此技术边界由 planner 在原范围内解决，不要求用户重新选择产品语义，也不能遗漏原 3.3。

T025 为 executable 的最终验证合同，依赖全部 T010–T024 闭合后才运行；T022 未完成时最终验收仍不可达。它负责单次完整 E2E 及同候选 build/Unit/diff，失败直接回修复 owner，不能以 collection/局部绿关闭。

## Revision 4 amendment impact

- 已将本次修改前的 plan/tasks/decisions/summary 和八份受影响合同保存到 [revisions/revision-3/](revisions/revision-3/)。旧 results/evidence 和 revision 1 快照不修改。
- T013/T014/T015/T016/T017/T022/T023/T025 均发布 contract Revision 4；若有旧合同运行，由 dispatcher 在交接点暂停该旧合同并显式换发新 revision。T022 保持暂停实现；T025 等待前置闭合。其余任务不换合同、不重置运行状态。
- T001/T002/T006/T007 既有结果保留。T012-A1 产品/Unit 2/2 是现有候选证据，尚非独立接受；T016-A1 unchanged spec 的 7/7 和 T021-A1 五项结果只保留实际局部覆盖。完整 E2E 未执行、E2E 文件尚未修复的事实不被本次出版改变。
- 本次删除的只是非必要等待：T006 review 已确定沿用原规范；T024 已确认 80/70 属既有必需。其余尚无规范依据的新增 Live/archive/DLC/reference-floor/bulk 政策不是本次修复前置，不自动纳入产品范围，也不宣称覆盖；T024 的已确认原必需缺口仍须映射至 owner。
- Resume route：dispatcher 采用 revision 4 → 换发受影响合同，先修复/补测试 → 必要独立 review → T025 完整最终验证。planner 本次不派发、不运行、不接受。
