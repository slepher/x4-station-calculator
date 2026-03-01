# X4 Test Skill Verify Specification

## Purpose
定义两类验证脚本的职责与行为：
- test-doc verify（`validate_test_tasks_refs.py`）
- test-impl verify（`validate_test_case_refs.py`）

## ADDED Requirements

### Requirement: Test-Doc Verify Contract

#### Scenario: Validate Four Chapters And Fixed Titles
- **当**：执行 `validate_test_tasks_refs.py`。
- **那么**：文档 MUST 包含且仅包含 `## 1 单元测试`、`## 2 E2E 标准状态与状态迁移`、`## 3 E2E 测试场景`、`## 4 Bug 测试`。
- **并且**：四章顺序固定，空章允许。

#### Scenario: Validate Task Tree Levels And Indentation
- **那么**：脚本 MUST 仅接受 `x.x` / `x.x.x` / `x.x.x.n` 三级任务树。
- **并且**：缩进 MUST 固定为 0/2/4 空格。

#### Scenario: Validate Contiguous Numbering
- **那么**：顶层、二级、三级编号在同父级下 MUST 从 `.1` 连续递增。

#### Scenario: Validate Chapter-Specific Top Types
- **那么**：
  - Chapter 2 顶层 MUST 为 `状态:` 或 `切换:`；
  - Chapter 3 顶层 MUST 为 `Case:`，且 case 名 MUST 唯一且长度 <= 64；
  - Chapter 4 顶层 MUST 为 `BUG-<number>: <bug-description>`。

#### Scenario: Validate Top-Level Subtask Presence
- **那么**：每个顶层任务 MUST 至少包含一个二级子任务。

#### Scenario: Validate Last-Subtask Expectation Rule
- **那么**：顶层任务最后一个二级子任务 MUST 含期望语义；若其本身不含，则其全部三级子任务 MUST 含期望语义。

#### Scenario: Validate Unified Expectation Marker
- **那么**：凡含期望语义的条目 MUST 使用 `#期望: [...]`。

#### Scenario: Validate Chapter2 Reference Integrity
- **那么**：Chapter 2 的 `状态/切换` MUST 在 Chapter 3 或 Chapter 4 子任务中被显式引用。

#### Scenario: Validate Chapter4 Bug Child Semantics
- **那么**：每个 BUG 任务 MUST 同时包含复现步骤、`修复前` 断言、`修复后` 断言。
- **并且**：`修复前` 与 `修复后` 断言 MUST 使用同一任务编号。
- **并且**：Chapter 4 中仅该场景允许同号重复，其他编号仍 MUST 连续递增。

#### Scenario: Validate Structured JSON Output
- **当**：使用 `--json`。
- **那么**：输出 MUST 为 `[{case, desc, error_code, error_msg}]`。

### Requirement: Test-Impl Verify Mapping Contract

#### Scenario: Validate Task-To-Spec Case Mapping
- **当**：执行 `validate_test_case_refs.py`。
- **那么**：脚本 MUST 校验 `test_tasks.md` 顶层任务与四类 `spec.ts`（unit/e2e/bug/bug-fix）的 case 映射。

#### Scenario: Validate Number Mapping Granularity
- **那么**：一级标号 MUST 对应 case desc 标号；二/三级标号 MUST 对应 case 内注释标号。

#### Scenario: Validate Content In Numbered Blocks
- **那么**：
  - 仅二层任务时，二层区间 MUST 有实际内容；
  - 含三层任务时，三层区间 MUST 有实际内容。

#### Scenario: Validate Expectation Assertion Value Match
- **那么**：含 `#期望: [...]` 的任务块 MUST 存在断言，且断言值 MUST 与期望值匹配。

#### Scenario: Validate Chapter4 Bug/Bugfix Routing
- **那么**：Chapter 4 MUST 使用 bug 与 bugfix 双文件映射。
- **并且**：`修复前` 期望仅匹配 bug 文件，`修复后` 期望仅匹配 bugfix 文件。
- **并且**：若 `修复后` 期望项已勾选，根任务 MAY 不要求映射 bug 文件，但仍 MUST 映射 bugfix 文件。

### Requirement: Unit Test Asset Layout

#### Scenario: Enforce Impl Test Naming Convention
- **那么**：数据样例 MUST 放在 `tests/skills/data/impls/`，命名 `test_tasks-N-<case-name>.md`。
- **并且**：对应样例 spec MUST 也放在 `tests/skills/data/impls/`，并拆分为：
  - `test-unit-N-<case-name>.spec.ts`
  - `test-e2e-N-<case-name>.spec.ts`
  - `test-bug-N-<case-name>.spec.ts`
  - `test-bug-fix-N-<case-name>.spec.ts`
- **并且**：真正执行校验的单测 MUST 放在 `tests/skills/unit/`。
- **并且**：`N` MUST 为两位数字。

### Requirement: X4-Test Verify Run-Result Apply Contract

#### Scenario: Apply Run Results Instead Of Validating
- **当**：执行 x4-test verify 脚本。
- **那么**：脚本 MUST 基于运行结果回写 `test_tasks.md`，而非执行一致性校验判定。

#### Scenario: Apply Explicit Success And Failure Inputs
- **那么**：输入 MUST 显式包含成功 case 集合与失败 case 集合。
- **并且**：失败 case MUST 包含失败标号（`x.x.x` 或 `x.x.x.n`）。
- **并且**：未提及 case MUST 视为未运行并保持不变。

#### Scenario: Apply Sequential Immediate Updates
- **那么**：脚本 MUST 以“每次测试”为更新单位（一次测试可包含多个 case），在该次测试完成后统一更新。
- **并且**：多次测试更新 MUST 按测试执行顺序串行应用，不得并发批量更新。

#### Scenario: Apply Failure Marking Rules At L2 And L3
- **那么**：失败标号位置 MUST 标记为 `[✗]`。
- **并且**：同级中失败项之前 MUST 标记 `[✓]`，之后 MUST 标记 `[ ]`。
- **并且**：失败项父任务链路 MUST 标记 `[✗]`。
- **并且**：上述规则 MUST 同时适用于二级与三级任务。

#### Scenario: Apply Success Marking Rules
- **那么**：成功 case 的顶层与其已定义二级/三级任务 MUST 标记为 `[✓]`。

#### Scenario: Support Mode Test Fixtures For Run Apply
- **当**：使用 `--mode=test`。
- **那么**：样例目录 MUST 为 `tests/skills/data/runs/`。
- **并且**：输入文件命名 MUST 兼容：
  - `test_tasks-NN-<case-name>.md`
  - `test-unit-NN-<case-name>.spec.ts|.spec.test`
  - `test-e2e-NN-<case-name>.spec.ts|.spec.test`
  - `test-bug-NN-<case-name>.spec.ts|.spec.test`
  - `test-bug-fix-NN-<case-name>.spec.ts|.spec.test`
- **并且**：期望输出基准 MUST 为 `test_tasks_run-NN-<case-name>.md`。
- **并且**：`--mode=test` 下 MUST NOT 修改原始 `test_tasks-NN-<case-name>.md`。
