- Schema: 1
- Revision: 1
- Repository: /home/slepher/project/x4-station-calculator
- Target: /home/slepher/project/x4-station-calculator working-tree delivery
- Base: d0614371558b2f6b30e8fd6b148347868228c413
- Delivery: working-tree

## Goal

承接 direct-migration 的未完成行为验收，补齐真实 UI、空间身份、持久化和规范裁决证据，保留已证实的迁移成果。交付可追溯的工作树候选及独立审查结果。generation-6 是新的规划与执行身份；复用旧 generation-1 的有效合同语义和任务编号便于追溯，不继承任何运行、接受或完成状态。

控制仓库为 `/home/slepher/project/x4-station-calculator`，initiative 控制目录为其 `docs/plan/unified-test-repair/`；本代规划唯一写入目录为 `generation-6/`。旧 direct-migration、generation-4/5、旧报告和失败记录均只读。用户授权继续未完成任务、working-tree 交付；planner 本轮仅写规划文档，不修改产品、测试、配置、规范或 Git metadata。没有提交、合并、reset、stash、删除或覆盖既有变动的权限。

## Acceptance

1. 保留旧计划 A1–A8 的有效验收语义：全部原 71 个 canonical E2E 文件及新增补充 spec 均有场景去向；旧编号 → 当前行为 → 固定输入 → 用户动作 → 独立 expected → 测试/证据映射齐全。数量变化必须解释，不以删除、排除、skip、条件通过造绿。
2. 下表所有未完成项均有责任任务；draft 也是剩余工作。规范冲突由独立 reviewer 核对依据，涉及新产品选择由用户决定；代码与历史勾选不能替代规范。规范被替代须逐条映射且有权威来源。
3. E2E 业务操作走 UI/真实 pointer。fixture 仅建立初态，page.evaluate 只注入 fixture 或读取结果，不写 store 冒充事务；expected 不从被测算法输出反推。普通 fixture 排除 vsn、reload、UI 语言；Live/save/binding 复用唯一 loadLiveBindingFixture；Logic Flow 显式 clean/seeded 及版本/storage key。
4. 保留 latest 单次运行与 composite/历史/collection 的区别。候选、合同 revision、命令、cwd、exit、passed/failed/skipped/flaky、日志/trace、独立 reviewer verdict 需绑定同一输入/输出身份。仅 dispatcher 记录接受与完成；本代未创建运行状态或伪造结果。
5. 最终工作树必须有完整 canonical E2E、build、diff 及 canonical Unit 的真实结果。完整 E2E 使用原 canonical collection 与并行配置，不能用 filtered run、只跑剩余文件或逐功能串行结果拼接替代。Unit 使用 `npm run test:unit` 的 `tests/unit/**/*.spec.ts`，不包含 legacy/skills suite。没有当前全绿证据便不得宣称全功能通过；工具不可用只能标 unavailable，明确验收仍未满足。
6. 原有用户变更全部保留，可归属补丁不要求先提交。产品修复与测试迁移、独立验证各自有边界；必要回归权限随修复合同一起落实，不借失败越权修改共享 helper/source。

## Design and constraints

输入身份为不可变 Base `d0614371558b2f6b30e8fd6b148347868228c413`，分支检查为 `develop`。本轮 tracked diff 为空，仅已有 untracked `workflow-resume-handoff.md`，保留该文件且不作为模型身份或执行授权依据。旧 manifest 的 2496 项内容在本轮全部核验一致（`sha256sum --quiet -c` exit 0），其 SHA-256 为 `857ee9beea436b7dbaca73e7512a817e1dfb723875d7d5fdef75ebc841afb9ec`。因此可以继承旧源码/测试内容证据，但旧 51 dirty/25 untracked 状态不再描述当前树，也不需要恢复它。核验命令及来源见 [input-evidence.md](input-evidence.md)。执行前重核相关输入；后续用户或 worker 变更只暂停受影响闭包，并由 dispatcher 留存实际补丁/内容指纹。Base 与 manifest 都不授权 reset。

历史事实优先级：本轮实际代码/文件存在性与最新具体结果优先于旧 handoff/context 的基线描述；README 的审核记录可作为继承证据，worker “待审核”不自动等于 accepted。同文档后续具体验证覆盖其旧失败段落；无法核实候选或审核对应关系的项标待确认。旧 /tmp 原始日志若缺失，不推翻明确历史通过事实，也不据此制造当前 pass。T002 核对继承，T003 补独立审查，T025 给最终当前工作树证据。

当前 `playwright.config.ts` 已有 `wait: { stdout: /Local:/ }`，不是 context 所称 URL gate；默认 webServer 每次会 `npm run build && vite preview`。旧 preview-only 配置及抽查的 /tmp 原始日志当前不存在；node_modules、dist、Chromium cache 目录存在，但目录存在不证明版本匹配、dist 新鲜、浏览器可启动或端口可用。详见 D02。

共享资源约定（实际占用写在任务合同中，不由任务编号推断）：

- `shared-dist-build`：仓库 dist、Vite 产物和 TypeScript build cache；构建及使用默认 webServer 的整个浏览器运行独占，禁止预览期间重建。T010 是首个候选 build/canonical Unit/runner 验证责任任务，T025 负责最终候选；缺陷修复后由 dispatcher 安排新构建身份。
- `chromium-runtime`：当前安装的 Chromium 与 sandbox 执行环境；在 T001 证明可安全并发并由 planner 修订前，所有浏览器任务串行。不得关闭 chromiumSandbox 绕过权限、安装依赖或沿用历史 escalation 当成本次授权。
- `preview-port-231xx`：合同各自的候选端口，使用前查占用；产物目录按 generation/task/attempt 唯一。端口冲突是调度事实，可机械换空闲端口并记录，不能重用他人 server。
- `playwright-config`：playwright.config.ts 及既有 test-setup.ts 只读，无本代 writer；T001 核实，必要修改返回 planner 指定唯一 owner。T010 合同固定临时 sandbox wrapper、smoke 路径与命令；保留 canonical 范围、cwd、stdout readiness、browser sandbox 和 build identity，不能新增仓库 runner 路线。
- `live-binding-helper`：tests/e2e/live/helpers/loadLiveBindingFixture.ts；`logic-flow-helpers`：tests/e2e/logic-flow/helpers/setupLogicFlow.ts 与 dragLogicFlow.ts；`base-fixtures`：tests/fixtures/db.json、save.json、save/ 及 tests/test-setup.ts。全部冻结、无修改 owner；各消费者通过 Inputs 绑定。若发现共享缺陷，planner 新增唯一修复 owner 和有限消费者回归合同，不能复制 helper 或并行修改。
- T001–T009 为不启动 browser/build、不写产品的只读工作，可并行核实；每个结果文件只由其被指派者写入，独立 review 由另一会话出具。未来不同 spec 的编辑可并行，浏览器/构建仍按上述资源串行；同文件写入必须以合同依赖或独占资源序列化。

产品代码的新设计严格 store → presenter → vue：store 负责领域能力/持久化，presenter 组装 UI，Vue 经 presenter 取数及触发行为，不加中间层。持久化新增字段必须同步 normalizeState；不增 fallback 链，不删除未核实代码或调试日志。产品草案 T012 适用已读取的 audit-implementation-simplicity 标准；不将该标准套入纯测试实现/审查。根因未确定时不预设泛化重构，也不扩展正式 Logic Flow 来修独立 demo。

角色按 `/home/slepher/.codex/skills/codex-workflow/role-profiles.toml`；当前 planner 由已核验的 dispatcher 派发，仅出版，返回该 dispatcher 采用 revision 并执行。可执行调查使用 context_collector/evidence_runner；独立语义审查由 reviewer，最终验证 full_tester 与实现者独立。无需重新创建 dispatcher 会话，也不沿用旧 handoff 的 Astra medium 执行者要求。

本代首批均在控制仓库只读，不需为调查创建 worktree。后续修改任务默认同工作树按精确文件所有权隔离；并行编辑只限不重叠路径，shared-dist-build/chromium-runtime 保证整个 build/browser 周期独占。若 dispatcher 分配隔离 lane，必须从本 Base 加已接受的实际依赖补丁建立可见输入，记录工作目录、候选与资源；不能只检出旧 Base 遗漏 working-tree 修复。测试前冻结相应源码/配置/fixture 写入，交接以可归属补丁和内容指纹完成，无固定 coding→target→integrate 合并路线。角色名及 task-to-lane 绑定由 dispatcher 记录。

## Acceptance mapping

表中证据均在本仓库 [旧 results](../direct-migration/results/) 和 [旧 tasks](../direct-migration/tasks/)，已由本轮 manifest 核验与 Base 绑定。表中“保留”指具体历史成果，绝不声称本次运行通过。T002 仅补旧编号/审核对应缺口，不重做已核验的 2496 项文件身份核对或无理由重跑已审核工作。generation-4/5 的 A1–A8、71 文件范围与尚未满足的 M13/M14 语义保留；旧 lane/status/merge 接受不接入本代，详见 D00。

| Legacy 验收 | 最新具体证据及保留范围 | 本代承接 |
|---|---|---|
| M1.1 | README 审核通过；结果 2/2，精确 GUID/time/有效归档双向变化 | T002 继承核对，共享 helper 冻结 |
| M1.2 | README 审核通过；CRUD 4/4，独立持久化边界 | T002 |
| M2.1 | 16/16 是已迁移事务；自动站点保护无 witness；内部调用次数/live flow 数值不宣称覆盖 | T002 保留16；T004→T011；额外边界 T009 |
| M2.1-FOCUS | 无结果；旧 1.3.5 自动 activeBindingStation/active transit 变化保持工作台 | T004→T011，显式点击仅作对照 |
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
| M5.3 / FIX-M5.3 | latest final-current2 为8/10、0skip；locked Argon reject、Terran accept hover失败。早期4/6、7/3、6/4均历史 | T005→T012→T013；保留compact2、normal、cancel、Auto、Isolate、duplicate、Reset八项 |
| M6.1 | README 审核通过45/45；结果仍写 pending parent review，审核候选对应待核对 | T002 证据审查，禁止按旧41/4重做 |
| M6.2 | 最新14/14、Unit4/4、build及独立复审；32px扩展、资源标签隐藏 | T002 保留，不沿旧28px失败重复 |
| M7.1 | 审核通过27/27、真实拖放稳定21/21 | T002 |
| M7.2 | 可达24/25；唯一原 Case5 skip未完成，独立AutoSupply冲突 | T002 保留24；T006→T014 |
| M7.3 | 97中93通过、4失败、0skip；dashboard33/33、ware48/48、resource12/16 | T002 保留93；T006→T015，仅3.2/3.3/3.9/3.12 sector来源四项未满足 |
| M7.4 | 审核通过24/24；导入版本/身份及Save/reload | T002 |
| M8.1 | README 审核通过；latest final4 单次46/46；final2 asset404属历史瞬态 | T002 保留，禁止因旧context重新迁移 |
| M8.2 | README 审核通过；final-current-32单次32/32；静态资源集合及hub身份 | T002 保留，不把旧30/2当当前 |
| M8.3 | 最新完整20/20、gate Unit6/6＋地址Unit4/4、build；无明确独立接受记录 | T003 独立证据审查；已有pass保留，必要当前重证纳入T010/T025 |
| M9.1 已通过部分 | 六个import＋一个station placement共7/7；其中placement当前仅placed class/标记存在，未证明完整身份持久化 | T003 审查产品候选/7项证据；不重复六项迁移 |
| M9.1 未覆盖部分 | sector placement、station/sector保存与reload完整空间身份；真实pointer后精确实体/sector/position不混淆 | T008→T016 |
| M10.1 | 审核通过35/35、Unit5/5、build；选择生命周期 | T002 |
| M10.2 已通过部分 | 单次43/46，FIT唯一候选填满/清空/step与DETAILS五项已独立验证 | T002 保留43及FIT/DETAILS，不重修 |
| M10.2 布局1 | bugfix-panel4.1 Fit展开占2/3，历史实际0.31623 | D07a，T006→T017 |
| M10.2 布局2 | selector3.5 race tags>3两行，实际一行/实现阈值>5 | D07b，T006→T017 |
| M10.2 布局3 | selector3.1/3.6三行两列、首列calc(50% - 4rem)、前两行25.6px；实际none/26/56 | D07c，T006→T017 |
| M10.3 / FIX-M10.3 | 最新22/22；原3.8真实鼠标DOM220、总250/250；mounted15/15，README审核通过 | T002 保留，旧21/1不可当单次 |
| M10.4 / HULL / STATS | 最新23/23、Unit消费者32/32；2297、301.1显示精度、1%/s；README审核通过 | T002；旧HULL pending标题被后续具体结果覆盖，审核候选关联需核对 |
| M10.5 | reviewed10/10、0skip；合法保留/禁用回退及reload/装备tag | T002 保留 |
| M11.1 | README排队，无结果；当前27个test声明含条件/合成drag路径 | T007→T018；完整菜单/绑定/归档/真实drag/持久化迁移 |
| M12.1 | 待执行，无direct结果；当前21个test声明，Fleet等含if-visible/first选择 | T007→T019；目标、Fleet、CRUD、active隔离及reload |
| M13.1 | 旧审查5pass/4fail；当前9项，logic-flow-1与建材前置仍待证明 | T007→T020，derived/required/moduleId/graph=null/SCC空及用户目标分离 |
| M14.1 独立五项 | 历史5/6不能作当前通过；保留2.1/2.2/3.1/3.2/3.4 | T007→T021，不等待3.3裁决 |
| M14.1 3.3 | 历史多轮steps开关不可达；groupType=build-material＋modules非空＋target rates非空才恢复 | T007→T022；保留默认汇总→steps→汇总及内容，禁止旧energycells+last路线重试 |
| M15.1 | 审核通过46/46、原9项、M7.1消费者2/2 | T002 |
| M15.2 | 7/8，最终No Demand≠Resource失败；暂态8/8不能作规范通过 | T006→T023；列宽80/70额外未覆盖由T009核对范围 |
| M15.3 | 审核通过6/6 | T002 |
| M15.4 | README审核通过，二审ledger闭合3/3；推荐baseline、一跳外部贡献与quantum+258抵消 | T002 保留，不重新裁决已闭合oracle |
| M16.1 | 审核通过10/10；历史mock缺activeDlcs已修且Unit4/4 | T002 |
| M16.2 | 审核通过51/51、UI Unit6/6、CALC Unit4/4、消费者9/9 | T002 保留；Live/archive/reference floor、批量scale不宣称已覆盖，T009→T024判定是否既有必需验收 |
| 环境与整体验收 | 历史926/950/969/1000 Unit分别属于旧候选；没有当前工作树全量结论 | T001→T010；最终T025保留原A7完整canonical E2E要求 |

额外静态发现不自动扩成产品功能：T009 对 M2.1 内部数量、M15.2列宽、M16.2 Live/bulk 等报告限制逐条核对原合同及规范；既有必需项必须进入 T024/对应任务，范围新增交用户决定。不以“额外”名义默默删除既有验收，也不把未确认的全产品DLC政策当已承诺工作。

## Planning horizon

T001–T009 executable，均为有界只读调查/证据核对，可独立开始。T010 同为 executable，待 T001 事实接受后，按已固定 wrapper 和命令运行当前 build、canonical Unit、collection 与建材 UI 六项 smoke；不要求再次规划普通运行细节。T011–T025 draft，所需事实、精确修改闭包或规范裁决见 decisions.md；planner 按各任务自身事实逐项开放，无需等待全部调查完成。用户已经授权继续工作，普通范围内修复不反复请示；仅新的产品选择、覆盖他人工作或权限扩张交 dispatcher 处理。

环境调查不阻塞规范/源码调查；M5.3独立demo不阻塞正式Logic Flow；M7.2、M7.3、M10.2、M15.2裁决仅暂停各自验收。M14.1独立五项与3.3分开推进。最终T025只负责真实整体证据与闭合核对，不吞掉失败项、不替代功能review。

下一步：当前 dispatcher 采用 revision 1，可优先派 T001、T006、T007、T008；随后按资源空闲派其他独立调查。T001 接受即派 T010，T007 已明确的任一 Build 分支可单独回 planner 开放，不等规范冲突全部裁决。各次派发留存本代合同 revision 与实际输入身份；本 planner 不接受自己的计划、不管理运行状态，不写 status.md。
