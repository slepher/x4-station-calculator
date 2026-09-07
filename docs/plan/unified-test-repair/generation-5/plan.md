# unified-test-repair：第 5 代广泛功能测试迁移计划

- Goal: unified-test-repair
- Generation: generation-5
- Language: Chinese（简体中文）
- Context: context.md
- Lanes: lanes.md
- Target branch: develop
- Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Evidence target: da05d84514c90428fd4e51907df9b6424fa5ccff
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Planning role: planner
- Acceptance state: 待独立计划审查与接受；本文件不是状态推进。
- Execution strategy: split-def
- Worker role: def_coding_worker

## 实质结果与覆盖范围

把当前 canonical E2E 的测试任务/spec、fixture 使用、helper、locator 和 assertion 迁移到最新接受行为与当前代码事实，形成可独立执行、复现、分类和验收的功能集合。覆盖全部 71 个现存 `tests/e2e/**/*.spec.ts`，16 个测试父任务、36 个平级子任务；collector 的 980 个测试是冻结目标的 collection 基线，不是通过数字，也不是必须保留的机械数量。

本代由用户明确要求广泛迁移。context.md 中源自 generation-4 的“只做三个 Auto Sector spec”“其他功能以后再做”限制不继承；只复用其中有证据支持的 fixture、生命周期和 failure seams。没有整包交给一个 worker 的巨型父任务；每个子任务拥有一项独立可观察功能、一组稳定文件和一条 focused 命令。

规范优先级为本次用户要求、当前明确接受的规范、与规范一致的当前产品事实，再到测试旧假设和历史计划/报告。代码揭示当前锚点、入口、存储版本与实际行为，不能单凭代码失败反推预期错误。Auto Sector 新 binding mode/draft、virtual-station 和 binding-preview 规则覆盖旧 core 的 Exit、retain 与 UUID-first；使用 sectorMacro identity。Build compute 明确声明当前代码不构成需求依据，冲突必须保留产品候选。对于仍不明的接受状态，只冻结争议项为 unknown 交 reviewer 裁决，不把整条功能线暂停给用户决定确定性拓扑。

## canonical、legacy 与排除范围

`playwright.config.ts` 的 testDir 是 `./tests/e2e`，`npm run test:e2e` 是 `playwright test tests/e2e`；版本/DLC 两种目录、顶层 compact-drag/vue-drag 和所有 bugfix spec 都属于 canonical，不能因为名称像旧测试就排除。现有 legacy 原件 `tests/legacy/e2e` 的 26 个文件、`tests/legacy/unit` 的 115 个文件只读保留，不移动、不删除、不纳入默认 runner。canonical 旧用例语义如被替换，迁移映射必须保留原编号、目的、替代用例与理由，历史失败报告保留不重写。

本代不迁移 `tests/unit` 的 163 个文件/927 个 collection 项。条件修复 task-test-5-fix-1 仅开放 `tests/unit/logic-flow/logic-flow-candidate.spec.ts`，修正与接受规范直接冲突的 Energy Cells 断言并补足同一候选限制的自测；这是 coding 自测边界，E2E worker 仍无 Unit 权限。collector 只确认该 canonical suite 已存在；active Build 文档虽有具体 Unit 章节，但没有给出其当前 fixture/断言迁移差异，不能将未勾选项或旧 Unit 报告推断为当前失败。Build 本代只拥有 E2E 章节与 E2E spec，Unit 第 1 章保持原样。16 条独立 E2E 父任务通过公开操作覆盖主要功能，不借 Unit collection 代替用户行为。最终可按已有治理要求运行 `npm run test:unit` 作为独立兼容证据，结果不授权 E2E worker 改 Unit 或产品代码。

不增加产品功能、UI 中间层、测试框架、runner 路线或 speculative fixture；E2E 迁移不改 `src/**`，条件修复只开放 task-test-5-fix-1.md 的两个精确 src 路径。其余 `src/**`、`rust-parser/**`、`src/wasm/**`、配置、package/lockfile、全局 seeds、基础 `tests/fixtures/db.json`、`tests/fixtures/save/**`、`tests/test-setup.ts` 均为 reuse/只读输入。没有 `build-rust` 权限；不允许改 Rust，自然不得运行它。planner 本轮只写本代 plan/lanes/contracts 和指定临时进度文件，不写 status/git/其他代，不启动 worker、审查、接受、建 lane、提交或合并。

## 拓扑、共享所有权与不变量

| 能力 | 选择 | 唯一写入 owner | 消费者与顺序 |
| --- | --- | --- | --- |
| Live archive 初始化与 transformSave | extend 既有入口；无当前问题则 reuse | task-test-1.1：loadLiveBindingFixture.ts | 先归档选择，再 1.2；父 1 进入 target 后才运行父 2、4、9，父 3 经父 2 获取 |
| Binding patch fixture | extend 现有两份 patch | task-test-2.1 | 只供 binding 测试使用，不改基础 db/save |
| Logic Flow setup/Mouse API | extend 既有两份 helper | task-test-5.1 | 先反馈/拒绝再 5.2、5.3；父 5 进入 target 后运行父 6、11 |
| Logic Flow 候选禁止操作 | extend 既有 presenter/selectability 与 Vue Sortable filter；reuse store/drop | 条件 task-test-5-fix-1 | 5.1 先测试纠错；fix 自测/review 到 target 后 5.1 正式复验；无新顶层父任务 |
| 普通 base fixture、runner、静态游戏数据 | reuse，只读 | 无本代写入者 | 无额外依赖；副本 patch 限各 spec 内明确字段 |
| 各 feature spec/测试迁移映射 | extend / new 声明的迁移文档 | 相应平级子任务 | 精确路径见各合同，无并行写同一路径 |
| Auto Sector 旧任务文档 | extend 当前 E2E 口径 | 2.1、3.1、3.2 各自对应文档 | 原编号与旧失败保留，current 语义为准 |
| Build 当前 test_tasks.md | extend 仅 E2E 第 2–4 章 | 11.1、12.1、13.1、14.1 各自对应文档 | 不改 Unit 第 1 章及其完成标记 |
| station-tabs 旧目录与 canonical 路径映射 | reuse 只读规范；记录迁移映射 | task-test-7.1 仅写 `tests/e2e/production/migration-task-test-7.1.md` | `openspec/specs/station-tabs/spec.md` 仅作 Normative source；记录 unified 旧路径与当前路径，不修改规范 |

测试 worker 的文档写入以各子任务 Owned paths 为精确白名单：规范文件（含 spec.md）以及未声明的 OpenSpec 文档（含 e2e_test_tasks.md / test_tasks.md）一律只读；场景映射和执行证据仅写入已声明的 migration 文档。父 2、3、11–14 已声明的测试任务文件保留必要 E2E 迁移权限，仅限各自列出的文件和章节，不授权修改其规范 spec.md 或相邻文件。既有 control 报告交接归属不变。

共用 fixture 不是 single-sup 的理由。归档 identity+IndexedDB 恢复在 1.1 完整完成；binding 的 reset/recompute/confirm 事务保持在 2.1；core 和 map 各自完整证明鼠标按下→合法 hover→preview→释放→draft 变化，不能以跨 worker 中间状态作为 witness。core 独立 oracle 和映射可作为 3.2 的稳定交接。其余功能通过独立 browser context 与固定输入恢复，不需要跨测试保存运行态。

全部父任务使用 `split-def` 与 `def_coding_worker`；同 lane 一次一个写入执行单元，兄弟子任务的独立性不代表同一工作目录同时写。父级拥有完整审查和 target merge 边界；子任务 checkpoint 只在 lane 内保留，不能代替父级通过或成为新 phase。共享 helper 在接受后出现 fresh 问题时，退回原 owner 做有界修正并冻结新的 checkpoint/证据，不由消费者复制或重写。

## 执行顺序与 Base

固定起点为 `da05d84514c90428fd4e51907df9b6424fa5ccff`。每个 phase 的 `Base` 均非空且等于该完整 SHA；执行前另记录 `Execution base` 为含已接受依赖的 develop 完整 SHA。两者区分证据起点与累计执行输入，禁止将“latest”“HEAD”当作留存证据。每次 base 推进保留原证据，不把历史运行重新标注成当前结果。

首次有可用环境时，对每个功能在固定 Target base 执行其原 focused 命令，之后在依赖进入 target 的 Execution base 上复现；相同提交不重复。迁移后的候选在同语义 fixture 下重跑。没有 fresh 执行前所有历史 failure 只是线索。

| 调度波次 | 可运行父任务 | 说明 |
| --- | --- | --- |
| 首批独立 | 1、5、7、8、10、12、13、14、15、16 | 任一失败不阻断同波其他父任务 |
| 父 1 已进入 target | 2、4、9 | Live helper/绑定初始化 barrier |
| 父 5 已进入 target | 6、11 | Logic Flow helper barrier |
| 父 2 已进入 target | 3 | binding draft lifecycle barrier；3.1 后 3.2 |
| 最终累计 | initiative gates | 全部独立父任务结果进入 target 后执行，未决保留并回流 owner |

数字顺序是建议 lane 排程，不额外增加依赖。失败只阻断显式依赖闭包及该父级完成门；无依赖的兄弟仍可从干净 target 输入继续。受阻父任务的未接受 checkpoint 不得混入其他父任务提交；由 dispatcher 保留不可变候选，在稳定 integrate lane 上隔离后切换可运行任务。

当前有界修正覆盖上表父 5 的恢复门：task-test-5.1 只先做 reviewer 指定的 test-owned 纠错，正式执行/验收仍暂停；条件 task-test-5-fix-1 进入 target 并同步 integrate 后才恢复 5.1。5.2/5.3 及父 6/11 保持原依赖，其余调度波次不变。

## 可执行父任务

每节的 contract 是执行授权的细分边界。父任务下仅有平级 `task-test-M.K`，没有嵌套 ID、独立子任务合同文件或隐含 checklist 执行单元。

## task-test-1

- Goal: Live 归档选择与存档绑定
- Contract: task-test-1.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 2 个 spec、相关 helper/测试文档与 2 个迁移映射文档。
- Execution units: task-test-1.1（有效归档选择准确绑定 GUID、时间与兼容性）；task-test-1.2（绑定创建、保存、切换、删除遵守独立持久化边界）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-1 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-2

- Goal: Auto Sector binding 的上下文与草案事务
- Contract: task-test-2.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Owned paths: 仅合同中逐项声明的 1 个 spec、相关 helper/测试文档与 1 个迁移映射文档。
- Execution units: task-test-2.1（三态切换、重置与确认保持同一草案的正确保存语义）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-2 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-3

- Goal: Auto Sector 候选分组与地图虚拟站操作
- Contract: task-test-3.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-2
- Covers: none
- Owned paths: 仅合同中逐项声明的 2 个 spec、相关 helper/测试文档与 2 个迁移映射文档。
- Execution units: task-test-3.1（候选过滤、分组和 core 虚拟站操作符合独立预期）；task-test-3.2（地图分组页签与虚拟站拖放保持 draft group 边界）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-3 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-4

- Goal: Live 生产展示与工具栏
- Contract: task-test-4.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Owned paths: 仅合同中逐项声明的 7 个 spec、相关 helper/测试文档与 3 个迁移映射文档。
- Execution units: task-test-4.1（Live 总览与站点仪表盘展示正确归档和规划结果）；task-test-4.2（贡献名称、缺口按钮与流向地图联动选中正确对象）；task-test-4.3（站点及中转工具栏操作正确保存当前绑定）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-4 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-5

- Goal: Logic Flow 拖放、隔离与紧凑视图
- Contract: task-test-5.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5-fix-1
- Covers: none
- Conditional fix: task-test-5-fix-1.md；Returns to: task-test-5；fix 的 target-visibility barrier 由 Depends on 与提交包含证明落实。
- Route: coding -> target -> integrate -> target；5.1 先纠正测试 oracle/setup，保持暂停至 fix 到达 target 后正式复验。
- Owned paths: 仅合同中逐项声明的 7 个 spec、相关 helper/测试文档与 3 个迁移映射文档。
- Execution units: task-test-5.1（拖放反馈与不兼容拒绝产生可观察且准确的结果）；task-test-5.2（产线交互、隔离和新增行为遵循当前 lineage 与 T0 规则）；task-test-5.3（紧凑视图和拖放演示以真实鼠标验证开始、取消和完成）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-5 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-6

- Goal: Logic Flow 方案导入、保存与布局
- Contract: task-test-6.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5
- Covers: none
- Owned paths: 仅合同中逐项声明的 3 个 spec、相关 helper/测试文档与 2 个迁移映射文档。
- Execution units: task-test-6.1（逻辑方案保存、切换与导入保留生产线含义）；task-test-6.2（逻辑布局与模块显示在交互前后保持当前约定）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-6 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-7

- Goal: Production 帝国与站点规划
- Contract: task-test-7.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 8 个 spec、相关 helper/测试文档与 4 个迁移映射文档。
- Execution units: task-test-7.1（帝国和站点 CRUD、导航与恢复指向正确计划）；task-test-7.2（模块管理与设置修改规划并持久化）；task-test-7.3（站点仪表盘、资源分组及 ware flow 显示正确维度）；task-test-7.4（帝国导入导出保留版本和计划内容）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-7 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-8

- Goal: Map 导航、搜索、资源与 DLC
- Contract: task-test-8.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 7 个 spec、相关 helper/测试文档与 3 个迁移映射文档。
- Execution units: task-test-8.1（地图导航搜索和 tooltip 定位正确星区）；task-test-8.2（简单与高级资源筛选显示正确候选集合）；task-test-8.3（地图 DLC 显隐与可选星区一致）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-8 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-9

- Goal: Map 导入与空间位置变更
- Contract: task-test-9.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-1
- Covers: none
- Owned paths: 仅合同中逐项声明的 1 个 spec、相关 helper/测试文档与 1 个迁移映射文档。
- Execution units: task-test-9.1（真实文件导入和地图移动保存准确空间身份）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-9 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-10

- Goal: Ship 建造、装备、蓝图与分析
- Contract: task-test-10.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 20 个 spec、相关 helper/测试文档与 5 个迁移映射文档。
- Execution units: task-test-10.1（选船与放弃选择保持建造面板正确状态）；task-test-10.2（装备选择、预设和比较面板准确反映安装结果）；task-test-10.3（蓝图层级、存储和条目操作可保存恢复）；task-test-10.4（建材、价格和性能面板显示独立可核算结果）；task-test-10.5（船舶 DLC 筛选保留合法选择与回归覆盖）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-10 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-11

- Goal: Build Flow 绑定、归档与恢复
- Contract: task-test-11.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: task-test-5
- Covers: none
- Owned paths: 仅合同中逐项声明的 1 个 spec、相关 helper/测试文档与 1 个迁移映射文档。
- Execution units: task-test-11.1（建筑流菜单和真实拖放建立、替换、移除并持久化绑定）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-11 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-12

- Goal: Build Plan 目标与方案持久化
- Contract: task-test-12.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 1 个 spec、相关 helper/测试文档与 1 个迁移映射文档。
- Execution units: task-test-12.1（目标、舰队和方案 CRUD 经 UI 保存后正确恢复）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-12 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-13

- Goal: Build Plan 预览责任与显示
- Contract: task-test-13.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 1 个 spec、相关 helper/测试文档与 1 个迁移映射文档。
- Execution units: task-test-13.1（预览明确区分 derived、required 与用户目标）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-13 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-14

- Goal: Build Plan 计算与静态方案展示
- Contract: task-test-14.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 1 个 spec、相关 helper/测试文档与 1 个迁移映射文档。
- Execution units: task-test-14.1（显式计算、重算和详情展示尊重预览已选责任）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-14 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-15

- Goal: 公共工具栏、提示和资源组件交互
- Contract: task-test-15.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 5 个 spec、相关 helper/测试文档与 4 个迁移映射文档。
- Execution units: task-test-15.1（统一工具栏的保存、另存和导入事务完成正确分支）；task-test-15.2（按钮 tooltip 在触发、侧向定位与隐藏时可观察）；task-test-15.3（建材 UI 组件输入与结果联动）；task-test-15.4（sector 聚合与单站流量筛选保持各自范围）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-15 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## task-test-16

- Goal: 游戏版本与 DLC 设置
- Contract: task-test-16.md
- Lane: integrate
- Base: da05d84514c90428fd4e51907df9b6424fa5ccff
- Depends on: none
- Covers: none
- Owned paths: 仅合同中逐项声明的 4 个 spec、相关 helper/测试文档与 2 个迁移映射文档。
- Execution units: task-test-16.1（版本切换只保存勾选的 dirty 模块并正确隔离数据）；task-test-16.2（DLC 开关、设置持久化和标签显示对齐当前数据）
- Blocking validation: 合同的逐单元 focused run、父级累计 focused run、npm run build、git diff --check。
- Deferred closure owner: task-test-16 保留未决行为；reviewer 分类，dispatcher 组织可用 runner 与最终 target 闭环。
- Handoff: 不可变 base/candidate、旧→新场景映射、实际执行结果、owned diff、未决归属提交父级 reviewer。

## 明确验收项

- A1：当前 71 个 canonical E2E 文件各有且仅有一个 spec writer，每个有效原场景映射到当前行为、固定输入、真实动作及精确后置条件；新旧计数差有解释，不能用删场景、排除路径或 skip 造绿。
- A2：fresh Target base/Execution base 原用例结果与 candidate 结果可比较；collection 与静态证据单独标识。只有可用环境实际运行满足断言才能记 pass。
- A3：共享 Live/Logic Flow helper 有唯一 owner、稳定接口和消费者回归证据；不改基础 fixture，无 store-direct mutation 作用户行为证据。
- A4：Auto Sector 采用新三态、显式重算、正确 reset/confirm/virtual group identity；有效 pointer witness 后才能判断产品问题。Logic Flow 用真实 hover/status/drop；其他功能核对身份、持久化与领域值，避免存在性弱断言。
- A5：stale/test-owned 迁移成功与 genuine product defect、unknown、infeasible 分别列出；每个未决报告有 owner、依赖闭包和恢复条件，失败任务与报告未被覆盖或删除。
- A6：每个父级累计 validation 完成并由 reviewer 对不可变 candidate 作完整审查；若有产品插入，其 target 到达与受影响测试闭环证据齐全。
- A7：最终 target 的 full canonical E2E、build、diff 检查有真实结果，所有可执行的有效场景无 skip；保留 unavailable 时只能明确说明迁移产物已交接、行为证据未闭环，不得声称全功能测试通过。
- A8：legacy originals、Unit、产品/Rust、配置、用户 dirty 状态及其他代均未被本代测试迁移越权改动；无直接 coding→integrate 合并。

## 失败分类、归属与保留

| 分类 | fresh 证据门槛 | owner 与处理 |
| --- | --- | --- |
| stale | 原用例在当前 base 失败，明确 accepted 规范/锚点已经替代旧假设，迁移后真实断言有效 | spec writer 修订测试与任务映射；reviewer 确认不是迁就产品缺陷 |
| test-owned | 可复现 setup/key/archive/locator/expected/witness 问题，独立输入能证明测试前提错误 | 当前子任务修 in-scope；共享 helper 退唯一 owner；修后重跑 |
| product | 前提与 UI witness 有效、独立 oracle 与现行 accepted 要求一致，产品仍违约 | reviewer 分类后 planner 插入有界产品修复；测试 worker 不改 src |
| unknown | 当前证据不能区分测试与产品，或接受规范仍有真正冲突 | reviewer 保留未决与所需证据；只影响该项依赖闭包 |
| infeasible | 实际命令因 browser/toolchain/server 等无法达到行为步骤 | dispatcher 负责运行环境恢复；报告 unavailable，不升级产品错误，不阻断独立迁移 |

历史 core 5.3、旧 archive time 缺失、old Exit/UUID 与 connection refused 不能预先充当本代失败结论。发生 failure 后保留原 task、checkpoint、report/review 序号与 trace，修复使用新的 candidate/report；不得覆盖旧报告，也不得把受阻任务的完成标记改为通过。审查争议由 reviewer 负责，worker 不能自行修改规范绕过它。

## 间歇失败策略

focused 用 `--workers=1 --retries=0 --trace=on` 给出首次结果。首次失败后可在相同 SHA、fixture 和环境进行一次同命令诊断重跑；两次结果都保留。只有存在时间/并发假设时才增加 `--repeat-each=3 --retries=0` 的有界 run，说明理由，不能无限重试直到绿或加 sleep 掩盖生命周期问题。失败后偶然通过仍是 intermittence 未决；reviewer 依据 trace 判 setup、产品或环境，修复后重跑原失败输入和父级，必要时恢复原并行度验证。full suite 配置已有 retries 时必须展开首次失败与 retry 结果，不能仅报最终成功。

## 不可行与未决报告合同（仅定义，尚未实例化）

本 packet 没有当前执行 failure，因此不创建 `task-test-N-report-M.md` 或 failure-report task。实际执行失败后才生成本代 retained report；报告不是可派发的新 checklist 父任务。最小 schema：

```text
Task: task-test-N
Subtask: task-test-N.K
Generation: generation-5
Target branch: develop
Target base: da05d84514c90428fd4e51907df9b6424fa5ccff
Execution base: <完整 SHA>
Candidate: <完整 SHA>
Classification: stale | test-owned | product | unknown | infeasible
Availability: available | unavailable
Command: <精确命令、cwd、环境和退出码>
Expected behavior: <接受规范条款和独立 oracle>
Observed behavior: <首次失败阶段；未到达行为时写明>
Fixture identity: <版本、GUID/time、明确 patch；无敏感原始存档>
Witness: <source/hover/preview/release 或该功能 UI 事件>
Artifacts: <完整日志、trace、截图的持久引用与校验标识>
Attempts: <逐次结果；历史线索另列>
Owner: <子任务 worker / reviewer / dispatcher>
Blocked closure: <只列实际依赖闭包>
Independent runnable: <仍可运行的任务>
Recovery condition: <可观察恢复条件和重跑命令>
Acceptance effect: <不能计通过的范围>
Returns to: task-test-N
```

例如 browser launch 的 EPERM/SIGTRAP 需要可启动 Chromium 的 runner；connection refused 需要精确同 cwd/port 的 preview 启动证据；缺 toolchain 需要版本明确的可用运行环境。恢复后在相同 target/candidate 与 fixture 复测，若 target 前进，记录新旧完整 SHA 并重新绑定证据。环境不可用是 evidence unavailable，允许文档/测试迁移及独立父任务继续，不是要求用户批准的阻塞；缺行为证据的要求仍不获得 pass。

## 条件性产品修复与 Implementation simplicity

- Standard: audit-implementation-simplicity
- Application: 对 task-test-5-fix-1 的产品 coding contract 前瞻应用；本代测试及其审查不做 simplicity audit。

本轮依据 `task-test-5.1-review-1.md`、`task-test-5-report-1.md` 与不可变测试候选 `b2060a45d41697593e09ac405a9064f436cc5fd1`，实例化 [task-test-5-fix-1.md](task-test-5-fix-1.md) 和 lanes 条件 coding route，`Returns to: task-test-5`。接受的两条签名为 raw T0 Ore 的真实 pointer 启动 Sortable chosen/ghost，以及 Energy Cells 的 draggable=true、快速添加可见且可启动真实拖放；compact-view 原 count 失败归测试，不是第三条产品签名。task-test-5.1 先修独立 oracle、4.7/4.16/4.17 的合法 witness、expectedStatus/group identity 和 cross-consumer 分组归属，暂停通过判定至 fix target 到达后复验；详见父合同。

fix 精确拥有候选 presenter、候选 Vue 和一份已有候选 Unit 自测；复用 store/presenter/drop，不改 E2E 或其他产品文件。16 个测试父任务与原 36 个平级子任务保持，fix 不升格为 plan 顶层 phase。其余新签名仍须 fresh witness、reviewer 分类和同代有界合同；实质产品/所有权拓扑变化返回规划，不暗改测试权限。

冻结路线为 `coding -> target -> integrate -> target`：coding worker 仅修 reviewer 已确认的产品根因，完整 coding review 后由 dispatcher 合入 develop；integrate 从 develop 同步该不可变提交，原 task-test-N 重跑 affected subtask、父级及相关回归，再经测试 review 合入 develop。禁止 coding candidate 直接合 integrate。fix 的 Depends on 只列已经到 target 的输入，Returns to 是恢复指针，不创建 test→fix→test 的依赖环。

`Covers` 是 target-visibility barrier，不能仅靠任务“完成”文字满足。现有序列化只允许真实 task-coding ID，故本轮 task-test-5 的 Covers 仍为 none；新增 `Depends on: task-test-5-fix-1`，配合 fix 的 Returns to 与同等严格的提交到达证明：coding candidate 是 develop target 的祖先，该 target 是 integrate Execution base 的祖先。未来若新增正常 coding parent，其 test Covers 列真实 task-coding ID。条件 fix 不伪装正常 coding parent，也不建立 test→fix→test 的 Depends on 环。

未来 coding contract 必须落实：维持 store → presenter → vue，业务不变量与持久化 normalizeState 由真实 owner 维护；不添加中间 facade，不修测试症状掩盖根因；复用现有领域能力，清晰区分设计错误与 runtime exception、保留原生异常传播及 confirm 的提交顺序；不新增 fallback 链或多份 draft context；需要字段时同步持久化归一化。先列实际不变量、调用方、兼容边界和单一 owner，再选最小正确修复。上述是未来规划约束，不构成本轮实现审查或 src 写入授权。

## 阻断验证、延后闭环与合并门

每个子任务必须实际尝试其 focused self-run 并报告命令/退出/结果；每个父级完成时运行全部 owned spec 的累计 focused 命令、`npm run build` 和 `git diff --check`。Playwright webServer 自身会 build 后启动 preview；独立 build gate 可复用同一 candidate 已有成功 build 证据，源码/配置/candidate 变化才重新运行。collection 检查确认 owned spec 未漏收；没有 runner 时记 unavailable 而不是“0 tests passed”。

每个父级 reviewer 只审正确性、非重复的 observable 覆盖、归属、断言与运行证据。其批准的迁移 diff、精确 candidate、目标可见的所有依赖和用户既有 Git 验证/提交规则共同构成合并条件。实际 product/unknown failure 保留父任务失败，不得合并为通过；无依赖任务可以单独审查和合并。runner unavailable 可以作明确受限的迁移审查交接，其行为验收保持未决。仅当需要提交/合并时由 dispatcher 按用户已授权范围与仓库规则操作，planner 不执行这些操作。

本代不预先接受任何 transitional self-run failure，也不把测试父任务自身验证延期给另一个父任务。跨 helper 消费者发现的测试旧假设归消费者，helper 回归归 helper owner。全套执行证据延后到累计 target gate，由 dispatcher 持有调度责任，各父任务持有自己的语义闭环，reviewer 持有分类和接受责任。full_tester 只在明确启用时提供只读服务，永不拥有 phase 或 merge 路由。

全部父级审查完成且可合并结果到达 develop 后，在记录的最终 target SHA 执行：

```bash
npm exec playwright test -- --list --reporter=list
npm run test:e2e
npm run build
git diff --check
```

full E2E broad gate 使用原 collection/并行配置，不能将它替换为 filtered run。若不可用，逐命令保留 unavailable；不标绿，不扩大阻塞闭包。父级已接受证据在新 helper/product 修正后按影响范围重新验证，其余无需无理由反复执行。

## 最终完成证据与交接

最终 evidence index 必须包括 16 个父任务/36 个子任务的 frozen base、checkpoint、focused run、paired report/review、target merge commit 及 target 包含证明；71 个原 spec 与场景去向；最终 collection 实际计数变化；全量 E2E 的 passed/failed/skipped/flaky/unavailable 明细；build/diff 结果；保留报告及依赖闭包；legacy/Unit/产品/配置未越权证明。若仍有 genuine defect、unknown 或不可用 evidence，应明确报告尚未闭环的行为，不宣称 initiative 全面完成。

planning handoff 只包含本代 bundle 与结构校验结果。工作流校验调用现有 `validate_workflow.validate_planning_pair`，显式传入 initiative、`generation-5/plan.md` 和 `generation-5/lanes.md`，避免读取或重写用户 dirty 的 status。校验通过说明图与合同结构可执行，不代表计划接受或测试通过。

## 本轮规划校验证据

已通过现有脚本的只读函数接口校验本代 bundle；脚本本身没有 CLI main，使用 pdb 调用，不创建额外脚本或修改 status：

```bash
python3 -B -m pdb -c 'break 408' -c continue -c 'p validate_planning_pair(Path("/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair"), "generation-5/plan.md", "generation-5/lanes.md", True)' -c quit /home/slepher/.codex/skills/codex-workflow/scripts/validate_workflow.py
```

实际结果为 `[]`（无结构错误），命令退出码 0。已核对 Target base 未变化；当前 canonical 71 个 spec 与合同白名单逐项相等，无遗漏、无不存在的 spec、无重复 owner；初次校验的 120 条声明写入路径无交叉所有权；本次移除 station-tabs 规范写入权后为 119 条，其余所有权不变。`git diff --check` 退出码 0；新文档另逐文件执行 `git diff --no-index --check /dev/null <文件>`，避免未跟踪文件被普通 diff 忽略。

本轮未运行功能测试或 build，未创建当前执行 failure report；这些均是后续执行合同的门，不是 planner 通过结论。

## 当前条件修正的规划校验证据

本节仅记录 task-test-5-fix-1 规划修订的实际校验，不改写上节原规划证据或已有执行报告：

- `python3 -B /home/slepher/.codex/skills/codex-workflow/scripts/workflowctl.py validate /home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair`：退出 0，`OK: resume phase=execution`。
- 上节相同的 `validate_planning_pair(..., "generation-5/plan.md", "generation-5/lanes.md", True)` 只读调用：退出 0，返回 `[]`。
- 确定性结构检查：16 个原测试父任务、36 个原平级子任务、1 个条件 fix route；没有 fix 顶层 plan phase 或独立子任务合同。71 个 canonical spec 逐项覆盖且无重复 writer；当前 122 个精确 Owned paths 无重叠（原 119 加 fix 的两个 src 与一份 Unit）。父任务的 Depends on/Covers、fix 的 Returns to/Base/role/route、精确候选 SHA 与 source 路径存在性均通过。
- 写入前后 SHA-256 对照：仅 plan.md、lanes.md、task-test-5.md 三份既有规划文件改变，新增 task-test-5-fix-1.md；其余 23 份既有本代文件及 status 输入逐字未变，含 context.md、指定 review/report 和三份粗粒度 status。另按授权更新唯一指定 progress snapshot。
- `git diff --check` 及四份修改/新增规划文件逐一 `git diff --no-index --check /dev/null <文件>`：退出 0。HEAD 仍为 `da05d84514c90428fd4e51907df9b6424fa5ccff`；src/tests/Rust/配置无差异。

本修订没有实施源码或测试、运行产品自测、提交、合并、接受计划、推进状态或派生 worker；上述通过仅说明本代修订结构与写入边界符合合同。
