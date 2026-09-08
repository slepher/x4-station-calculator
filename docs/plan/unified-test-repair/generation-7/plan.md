- Schema: 1
- Revision: 1
- Repository: /home/slepher/project/x4-station-calculator
- Target: /home/slepher/project/x4-station-calculator working-tree delivery
- Base: 8b5894bc85a7de3d608efa8db74357d942764519
- Delivery: working-tree

## Goal

以当前代码库实际提供的功能为准，更新 unified-test-repair 范围内的旧 E2E：保留仍有效的用例，重写过时行为，补写现有功能缺失的覆盖。不是原样 1:1 迁移，不要求恢复旧 UI、旧数据结构或旧文档规定的产品能力。

用户已确认 generation 6 错用旧文档约束修改了 src，并已撤回部分修改；明确要求新建 generation 7。本代替换 generation 6 的执行规划，保留其历史文件、失败和有效成果，不继承其产品修改授权、未完成任务门槛或接受状态。本轮仅出版规划；后续执行需在新的 dispatcher 会话显式采用本代。

## Acceptance

1. 当前基线 `tests/e2e/` 有 74 个 `.spec.ts` 文件；执行时以仓库 Playwright 实际 collection 为准。全部文件有去向，重点改动有“旧测试目的 → 当前行为及证据 → 保留/重写/补写/退休 → 新测试位置”的简明映射。无需保留旧编号、测试数或文件数；合并重复场景、移除已消失行为必须说明原因和有效覆盖去向。
2. 所有新增/改写断言符合当前 UI 到领域状态的实际调用链及公开行为；已有 presenter 时沿其真实输入/动作核对，不假设遗留组件已经完成分层。预期由固定 fixture、游戏数据事实、明确行为规则或独立手算给出；不得读取被测函数的返回值再当 expected，不得通过条件 skip、空断言、宽松匹配、吞错或仅检查元素存在制造通过。
3. 业务动作通过 UI；拖放通过真实 pointer。fixture 只建立初态，后续 `page.evaluate` 可只读观察，不能写 store 代替被测操作。涉及保存的用例验证 Save、reload 后的同一对象身份和有效状态，不能只验保存按钮或 reload 前内存。
4. 已消失或不向 UI 开放的旧行为可以有证据地退休，不再作为必须补产品入口的阻塞。仍存在的功能应测试真实可达前置及正反分支。缺少复现路径不等于功能不存在；疑似崩溃、数据丢失或业务矛盾单独记录，不能将故障固化成“正确预期”，也不能借此改 src。
5. 修改范围为合同列出的 E2E spec 和本代证据/映射。`src/`、Rust、Unit、共享 fixture/helper、runner 配置、依赖、旧规划和旧规范均无写权限。不得恢复用户撤回的修改、添加产品 testid、清理源码/调试日志或修复无关 warning。
6. 对最终同一冻结候选执行完整 canonical E2E；活跃用例全部通过，无未解释的 skip、flaky 或遗漏。focused、collection、旧结果和多次局部通过不能替代最终单次全量运行。保留 canonical Unit、build、diff 的真实检查结果；失败明确归属，不能宣称全绿或自动扩权修产品。测试改写和最终覆盖由独立 reviewer 核对。
7. 交付可归属的工作树测试补丁、实际运行证据及未满足项。没有提交、合并、发布、reset、stash 或覆盖他人改动授权；用户验证通过前不提交。

## Design and constraints

### 权威与输入

优先级：最新用户指令 → 当前代码的有效公开行为及当前数据 → 为这些行为编写的测试预期。generation 6、旧 OpenSpec、旧测试和历史 review 只提供覆盖线索，不可要求当前产品符合它们。尤其不继承 generation 6 的“代码现状不能撤销原规范”“恢复独立 AutoSupply”“恢复旧 sector 来源/装备布局/No Demand/80-70 列宽”命令。

规划开始时 `git status --short` 为空，实际 HEAD 为上述 Base。这是用户撤回后的完整已提交基线，不需要恢复旧 dirty tree。收集资料见 [context/coverage.md](context/coverage.md) 与 [context/current-behavior.md](context/current-behavior.md)；两者是静态事实，不是本候选的运行通过证据。

执行入口重新确认 HEAD、tracked/untracked 变动和相关文件。若用户又改动代码，用其最新状态更新受影响行为与合同，保留其补丁；Base 不授权 checkout/reset。旧运行结果只保留原候选含义，不沿用旧计数作为当前验收阈值。

### 测试方式与共享输入

- 普通 beforeEach 复用/注入 `tests/fixtures/db.json`（排除 vsn）→ reload → UI 设置语言，固定实际游戏版本与对应 storage key。禁止 `localStorage.clear()` 或直接设置 cookie 冒充语言切换。
- Live/save-binding/archive 使用 `tests/e2e/live/helpers/loadLiveBindingFixture.ts` 的 `loadLiveBindingFixture(page)`；通过其现有选项形成不同初态，不复制 archive 注入流程。
- Logic Flow 使用既有 `setupLogicFlow.ts` / `dragLogicFlow.ts`，声明 clean/seeded；独立 drag demo 使用其实际入口和现有测试辅助，不套用正式 Logic Flow 的领域状态。拖放实现/测试方法需要时采用项目 x4-drag，不开启第二个流程协调者。
- 优先现有 testid，其次当前语义化 role/label 和局部稳定结构。不为测试修改产品；改写文件使用 `tests/test-setup.ts` 既有异常检查，不禁用错误收集。
- `tests/test-setup.ts`、共享 helpers、`tests/fixtures/`、`playwright.config.ts`、`vitest.config.ts`、package 文件只读。确证共享测试设施缺陷时先回 planner，给予单一精确 owner 和实际消费者验证范围；禁止复制 helper 或顺手改配置。
- 纯测试合同不应用产品 implementation-simplicity 审查，不产生产品重构任务。

### 任务、资源与交付

任务索引见 [tasks.md](tasks.md)，合同独占文件和依赖只在对应合同定义。先完成一次当前基线记录，再由功能 owner 将必要调查、测试重写和 focused 验证在同一任务中完成；不把普通定位细节拆成反复调查关卡。基线出现已记录测试失败可作为后续修复输入，不要求先变绿才能派修。

codex-workflow 的 role-profiles.toml 是执行角色配置来源。规划根实际 runtime role 为 dispatcher，但入口匹配 planner（gpt-6-astra/high），本轮仅使用其规划权限。后续 dispatcher 为 gpt-5.6-luna/high；实现默认 def_coding_worker，复杂的建筑规划测试合同使用 sup_coding_worker；reviewer 与实现者独立，最终 full_tester 不修改测试。

并行执行使用动态可复用 Git worktree lane，稳定名如 lane-01；由 dispatcher 在执行时分配，不绑定任务号。最多两个并行测试实现 lane，加独立 reviewer/验证角色且不超过会话容量；单 lane 一个 writer。仅在有独立可执行任务时扩容。无法安全建立 lane 时串行使用交付工作树，不在共享树并行构建/改同一文件。

每 lane 绑定当前实际 source/tests/fixtures/config 及已接受依赖补丁，隔离 dist、TypeScript cache、Playwright reports 与运行输出，明确独立空闲端口。不能从旧 Base 启动而漏掉用户/依赖变更。所有 browser/build 周期取得 `e2e-build-browser` 独占资源；端口不同不代表共享 dist 安全。只读 review 可直接检查冻结候选。工作树交付不要求创建提交；保留可归属 patch 和必要未跟踪输入，再串行应用到交付树。实际 lane、进程和资源由 dispatcher 记录，不在本轮写 status。

各任务运行前冻结其实际输入，记录 base + 可归属 patch/未跟踪文件；不新增全仓库哈希清单。结果按本代 `results/Txxx-A<n>.md` 和 `evidence/Txxx-A<n>/` 保存，attempt 取未使用值；独立 review 单独写结果。保留旧失败，禁止覆盖历史 attempt。最终验证期间冻结整棵候选；修改候选后须重新完成最终全量 E2E。

### 已定决策与技术未知

详细映射和替换理由见 [decisions.md](decisions.md)。用户已授权重写与补写，不再询问是否可以偏离旧用例，也不等待用户批准普通 locator/fixture 选择。steps 的公开可达输入、已保存帝国资源组和数值 expected 等，由对应测试 owner 在现有能力内查明并验证；不预设恢复旧能力。若证据显示产品故障或必须越出 Owned paths，仅暂停该受影响范围，带具体观察回 planner/用户，其他工作继续。

## Planning horizon

本版发布可执行的基线、重点功能测试重写和最终验证合同；每个合同包含当前行为线索、写权限、验证命令和返回条件。其他已有用例先保留，由完整 collection 和全量验证防止遗漏；如果它们暴露本轮未定位的过时语义/失败，planner 在本 generation 内增补精确测试合同，不重新建立 generation，也不委派无边界的全仓库修复。

本轮止于规划格式校验及 clean-session handoff。未运行 Unit/E2E/build，未实现或接受任何测试修复；这不影响后续显式 execute 的完整工作范围。
