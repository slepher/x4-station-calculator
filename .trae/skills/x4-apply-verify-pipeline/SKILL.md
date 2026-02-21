---
name: x4-apply-verify-pipeline
description: "Trigger with /x4:pipe to run X4 dual-subagent pipeline, and /x4:subdis <change-name> to start a discussion subagent."
---

# X4 Apply Verify Pipeline

此 skill 用于把实现与测试编排成一个固定流程，目标是先暴露问题，再在实现完成后做最终验证。

## Core Model

- 一个“子任务”定义为：`/x4:discuss` 到实现与验证流水线结束（`/x4:apply` + `/x4:test-impl` + `/x4:test` + `/x4:verify`）的完整链路。
- 允许多个子任务并行运行。
- 并行前提：必须遵守 `src/` 目录互斥写入规则（见下文）。

## Trigger

- 用户输入 `/x4:pipe`
- 用户输入 `/x4:subdis <change-name>`
- 用户明确要求并行子代理流程
- 用户描述类似以下顺序：
  - 启动编程 subagent 执行 `/x4:apply`
  - 启动测试 subagent 先执行 `/x4:test-impl`（仅写测试）再执行 `/x4:test`（首轮允许失败）
  - 等待编程完成后再次执行 `/x4:verify`
- 用户在流程进行中要求“随时开启新的需求讨论 subagent”

### Trigger Semantics

1. `/x4:pipe <change-name>`
   - 启动该 skill 的完整子任务流水线：
   - `/x4:apply` + fail-first (`/x4:test-impl` + `/x4:test`) + `/x4:verify`
   - 主 agent 必须为该子任务生成并登记别名（alias）。
2. `/x4:subdis <change-name>`
   - 仅启动讨论 subagent，执行：
   - `/x4:discuss <change-name>`
   - 不自动启动 `/x4:apply` 或 `/x4:verify`，除非用户后续明确要求。
   - 主 agent 必须为 discussion subagent 生成并登记别名（alias）。

## Inputs

- `change-name`（可选，但建议显式提供）
- 当前会话中的变更上下文（若未提供 `change-name`）
- `discussion-topic`（可选，用于临时新需求讨论）

## Workflow (MANDATORY)

### Step 1: Resolve Change Context

1. 解析当前目标 change（优先使用用户显式传入的 `change-name`）。
2. 若上下文不明确，先询问用户，不要盲目执行。

### Step 1.2: Assign Subagent Roles Directly With Fallback (MANDATORY)

启动 subagent 时直接指定角色，并在创建失败时按顺序回退：

1. coding subagent:
   - 首选 `implementation_engineer`
   - 失败回退 `worker`
2. test subagent:
   - 首选 `test_runner`
   - 失败回退 `worker`
3. discussion subagent:
   - 首选 `codebase_explorer`
   - 失败回退 `explorer`
   - 再失败回退 `default`

若发生回退，必须在状态汇报中明确标注“使用回退角色”。

### Step 1.5: Acquire `src/` Write Lock (MANDATORY)

在进入会修改 `src/` 的阶段时，子任务必须先申请 `src-lock`，并在整个修改流程结束后再释放：

1. 若当前没有子任务持有 `src-lock`，当前子任务获取锁并继续。
2. 若已有其他子任务持有 `src-lock`，当前子任务可继续执行不写 `src/` 的工作（例如讨论、测试分析、文档整理），但所有 `src/` 写操作必须排队等待。
3. 锁持有者必须在“整个子任务修改流程”结束后释放锁，不允许在流程中途释放。
4. “整个子任务修改流程”至少包含：`/x4:apply` 的代码修改、fail-first 测试引发的必要代码修复、`/x4:verify` 期间的必要代码修复。
5. 任意时刻只允许一个子任务对 `src/` 执行写操作。
6. 若 `src-lock` 被其他子任务持有，当前子任务禁止执行 `build` 与测试运行，必须等待。

### Step 2: Spawn Coding Subagent

1. 按 Step 1.2 的“直接指定+失败回退”规则创建编程 subagent。
2. 向该 subagent 发送：
   - `/x4:apply <change-name>`
3. 编程 subagent 负责完整实现任务并推动 `tasks.md` 勾选状态。
4. 编程 subagent 在每次准备修改 `src/` 前，必须确认当前子任务已持有 `src-lock`。
5. 在当前子任务的修改流程全部结束前，不得主动释放 `src-lock`。
6. 主 agent 记录别名：
   - `alias = <change-name>-coding`
   - `alias_map[alias] = <coding_agent_id>`
   - `short_alias = <abbr>-c`
   - `alias_map[short_alias] = <coding_agent_id>`

### Step 3: Spawn Test Subagent (Fail-First Round)

1. 按 Step 1.2 的“直接指定+失败回退”规则创建测试 subagent。
2. 向该 subagent 发送：
   - `/x4:test-impl <change-name>`
   - `/x4:test <change-name>`
3. 明确要求该 subagent 严格执行：
   - `x4:test-impl` 只根据 `test_tasks.md` 补齐/编写测试，不运行测试命令
   - 再由 `x4:test` 立即执行测试
   - 第一轮允许失败，失败信息要记录并同步 `test_tasks.md`
4. 执行约束：只有当前子任务持有 `src-lock` 时，才允许实际运行测试命令。
5. 主 agent 记录别名：
   - `alias = <change-name>-test`
   - `alias_map[alias] = <test_agent_id>`
   - `short_alias = <abbr>-t`
   - `alias_map[short_alias] = <test_agent_id>`

### Step 4: Wait for Coding Completion

1. 等待编程 subagent 完成 `/x4:apply`。
2. 测试 subagent 第一轮结束后不做最终结论，只保留结果。

### Step 5: Second Test Round (Verification)

1. 在实现完成后，继续使用测试 subagent（或新建一个测试 subagent）。
2. 执行：
   - `/x4:verify <change-name>`
3. 该轮为最终验证轮，输出通过/失败结果和关键失败原因。
4. 执行约束：若未持有 `src-lock`，禁止运行 `build` 或测试命令，必须等待锁可用。

### Step 6: Final Report

向用户汇总以下信息：
- 编程 subagent 完成状态（完成任务数、是否有阻塞）
- 第一轮 `/x4:test` 失败要点（fail-first 证据，测试由 `/x4:test-impl` 预先补齐）
- 第二轮 `/x4:verify` 结果（是否通过、剩余失败项）
- 若失败，给出下一步最小修复建议

### Step 7: On-Demand Discussion Subagent (Anytime)

当用户在任意时刻提出“开启新的需求讨论”时，立即执行：

1. 启动一个新的讨论 subagent。
   - 角色按 Step 1.2 的“直接指定+失败回退”规则选择。
   - 采用软约束写权限策略：允许写入，但仅允许修改 `openspec/changes/<change-name>/` 目录内文件。
2. 向该 subagent 发送：
   - `/x4:discuss <discussion-topic>`
3. 该讨论 subagent 与当前实现/测试流水线并行运行，不抢占已有 subagent 的职责。
4. 讨论产出与当前 change 严格隔离，默认不修改正在实施的 change 文档，除非用户明确要求合并。
5. 返回主线程时，持续原有 `/x4:apply` 与 `/x4:verify` 节奏，不因新讨论中断验证闭环。
6. 主 agent 记录别名：
   - `alias = <change-name>-discuss-<n>`
   - `alias_map[alias] = <discussion_agent_id>`
   - `short_alias = <abbr>-d<n>`
   - `alias_map[short_alias] = <discussion_agent_id>`

### Step 7.5: `/x4:subdis <change-name>` Fast Path

当用户显式输入 `/x4:subdis <change-name>` 时，直接执行：

1. 新建 discussion subagent。
   - 角色按 Step 1.2 的“直接指定+失败回退”规则选择。
   - 采用软约束写权限策略：仅允许修改 `openspec/changes/<change-name>/` 目录内文件。
2. 发送 `/x4:discuss <change-name>`。
3. 在主线程登记该 subagent 到对应子任务注册表。
4. 返回“讨论已启动”状态，并继续监听该 subagent 进度。
5. 主 agent 记录别名：
   - `alias = <change-name>-subdis-<n>`
   - `alias_map[alias] = <discussion_agent_id>`
   - `short_alias = <abbr>-d<n>`
   - `alias_map[short_alias] = <discussion_agent_id>`

### Step 8: Multi-Subtask Scheduler Rules

当存在多个子任务并行时，调度必须满足：

1. 每个子任务维护独立上下文（change、讨论主题、测试结果、状态）。
2. 允许多个子任务同时进行 `/x4:discuss`、测试编写、测试执行、文档更新。
3. 涉及 `src/` 写入的动作必须串行化，统一受 `src-lock` 控制。
4. 若某子任务仅需只读 `src/`，不需要锁；只有写入才需要锁。
5. 当锁等待时间过长，向用户报告当前持锁子任务与队列顺序。
6. 释放时机：仅当当前子任务确认“代码修改阶段已结束”（无进一步 `src/` 写入计划）后统一释放锁。
7. 当锁由其他子任务持有时，等待中的子任务不得执行 `build`、`/x4:test` 的测试运行阶段、`/x4:verify` 的测试运行阶段。
8. 当锁由其他子任务持有时，等待中的子任务允许执行白名单动作：
   - `/x4:discuss` 讨论与需求澄清
   - 只读代码与文档分析
   - 更新 OpenSpec 文档（不触发 `src/` 写入）
   - 编写或更新测试文件（如 `tests/` 下用例），但禁止运行测试命令
   - 进度上报、状态同步与队列管理

### Step 9: Main-Agent Progress Query (No Bash)

主 agent 必须支持在对话中直接查询 subagent 进度，不依赖命令行：

1. 为每个子任务维护注册表：
   - `subtask_id`
   - `coding_agent_id`
   - `test_agent_id`
   - `discussion_agent_ids[]`
   - `alias_map`（`alias -> agent_id`）
   - `phase`
   - `src_lock`（holding / waiting / none）
2. 当用户询问“某个子任务/某个 subagent 进度”时：
   - 主 agent 通过消息向对应 subagent 请求简短状态快照（当前步骤、已完成数、阻塞原因）。
   - 使用 `wait` 获取最新回复后汇总返回。
3. 若 subagent 暂无新回复：
   - 返回“最后已知状态 + 最近更新时间”，并标注“等待下一次心跳”。
4. 输出必须包含：
   - 子任务阶段（discuss/apply/test/verify）
   - 当前执行项
   - 进度计数（done/total）
   - `src-lock` 状态与排队位置（如有）
5. 支持别名查询：
   - 用户可直接使用长 alias 查询，例如 `<change-name>-coding`、`<change-name>-test`、`<change-name>-subdis-1`。
   - 用户也可使用短 alias 查询，例如 `std-c`、`std-t`、`std-d1`。
   - 若 alias 不存在，返回可用 alias 列表。
6. 短别名生成规则：
   - `abbr` 取自 `change-name` 各连字符分段首字母（如 `station-tab-drag -> std`）。
   - coding 使用 `-c`，test 使用 `-t`，discussion 使用 `-d<n>`。
   - 若短别名冲突，追加数字后缀（如 `std-c2`）并写入 `alias_map`。

## Guardrails

- 不要跳过第一轮 fail-first 测试（`/x4:test-impl` + `/x4:test`）。
- 在 `/x4:apply` 完成前，不要把第一轮测试结果当作最终结论。
- `/x4:verify` 必须在实现完成后再执行。
- 变更上下文不明确时必须先澄清。
- 保持最小上下文污染，只关注当前 change。
- 允许随时新增讨论 subagent，但必须保持上下文隔离，避免把新需求混入当前 change。
- 允许多子任务并行，但禁止多子任务同时写 `src/`。
- 任何绕过 `src-lock` 的写入都视为违规，必须立即停止并回到排队状态。
- subagent 必须按本 skill 中的角色顺序直接指定；创建失败时再回退，不得跳过回退链。
- `src-lock` 必须覆盖整个修改流程生命周期，禁止“改到一半先释放再重新抢锁”。
- 当其他子任务持有 `src-lock` 时，禁止运行 `build` 和测试命令，必须等待锁释放。
- 等待锁期间允许编写测试文件，但仍禁止运行测试命令。
- 讨论 subagent 的写入采用软约束：仅可修改其对应 `openspec/changes/<change-name>/`，该约束为流程策略而非底层沙箱硬隔离。
