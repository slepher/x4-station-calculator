## Context

本 change 仅聚焦验证脚本，并拆分为两条能力线：
- test-doc verify（文档结构/语义）
- test-impl verify（文档到测试实现映射）

## Decisions

1. 验证边界
- `validate_test_tasks_refs.py` 只处理 `test_tasks.md` 合法性。
- `validate_test_case_refs.py` 只处理 `test_tasks.md` 与 `spec.ts` 映射一致性。

2. test-impl verify 核心模型
- 顶层编号映射到 case 名标号。
- Chapter 1/4 维持“二/三级编号映射到 case 注释标号”与“标号区间”内容校验。
- Chapter 2 改为严格 helper 模型：`2.x` case 仅做编排调用，步骤注释与断言下沉到 helper。
- Chapter 3 对 `状态/切换` 子步骤执行 helper 调用链校验，并强制“先状态后切换”顺序。
- 对 `#期望: [...]` 做值级断言匹配。
- helper 定位采用 `case -> helper` 实际调用链，不依赖命名猜测；helper 可位于同文件任意位置（含 `describe` 内）。

3. 状态/切换职责拆分（新增）
- 状态 helper：`build + assert(state ready)`。
- 切换 helper：`assert(from) + switch + assert(to)`，不负责建态。
- 任何切换使用点都要求先调用状态 helper，再调用切换 helper。
4. Chapter 4 专项模型
- 采用 bug 与 bugfix 双文件映射。
- 修复前/修复后期望分别归属不同文件通道。
- 对“修复后已勾选”场景支持根任务不强制映射 bug 文件。

## Test Strategy

1. test-doc verify：维持现有 `tests/skills/data/tasks` 覆盖。
2. test-impl verify：在 `tests/skills/data/impls` 维护样例集（`test_tasks-*.md` + 四类 spec：`test-unit-*`、`test-e2e-*`、`test-bug-*`、`test-bug-fix-*`），并在 `tests/skills/unit` 编写真正执行校验的单测。
3. 命名统一两位 `N`，保持稳定排序与可扩展性。

## Risks

1. 两条 verify 线混淆导致职责重叠。
2. 期望值断言匹配若不统一，误报率会升高。
3. x4-test 运行结果回写若与 verify 校验混用，职责边界会再次模糊。

## Mitigations

1. 在 request/spec/tasks 明确职责边界。
2. 使用分目录样例（tasks/impls）与分命名单测隔离回归。
3. 新增 x4-test verify 章节，定义“回写器”而非“校验器”。
4. 为 x4-test verify 的 `--mode=test` 引入 `tests/skills/data/runs/` 与 `test_tasks_run-*` 基准输出，确保不修改输入样例文件。

## X4-Test Verify Extension

1. 职责定义
- x4-test verify 脚本只负责根据运行结果回写 `test_tasks` 勾选状态，不做一致性校验。

2. 输入输出模型
- 输入必须包含成功 case 与失败 case（失败附失败标号）。
- 未提及 case 保持不变。
- 更新采用“每次测试”为单位（一次测试可含多个 case），在测试完成后统一更新。
- 多次测试按测试执行顺序串行应用。

3. 回写规则
- 失败位置 `[✗]`，同级前 `[✓]`，同级后 `[ ]`，父链路 `[✗]`；
- 规则同时作用于二级与三级；
- 成功 case 顶层及其二/三级子任务全部 `[✓]`。

4. 单测模式
- `--mode=test` 使用 `tests/skills/data/runs/`；
- 输入样例沿用四类 spec 命名；
- 期望输出基准为 `test_tasks_run-NN-<case-name>.md`；
- 该模式仅用于单元测试，且不改输入 `test_tasks-NN-<case-name>.md`。
