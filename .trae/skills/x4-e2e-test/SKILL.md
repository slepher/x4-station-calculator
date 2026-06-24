---
name: x4-e2e-test
description: "Orchestrate X4 E2E-only test workflow across high-level docs, detailed docs, review, implementation, and run phases. Trigger with /x4:e2e-test <change-name>."
---

# X4 E2E Test Workflow

## 目的

`x4-e2e-test` 只负责编排 E2E 测试链路，不接管旧 `x4-test-*` 的 `test_tasks.md` / Unit / Bug 测试职责。

## 输入

- `openspec/changes/<change-name>/request.md`
- `openspec/changes/<change-name>/design.md`
- `openspec/changes/<change-name>/tasks.md`
- `openspec/changes/<change-name>/specs/**/spec.md`
- 已存在的 `e2e_tests.md`、`e2e_test_tasks.md`、`knowledge.md`、`fixtures.md`

## 编排顺序

1. `x4-e2e-test-doc`
   - 只生成或更新高层 `e2e_tests.md`
2. `x4-e2e-test-doc-details`
   - 基于 `e2e_tests.md` 生成或更新 `e2e_test_tasks.md`
   - 基于测试方案生成或更新 `fixtures.md`
   - 为需要额外数据的任务创建 `tests/e2e/<change-name>/fixtures/*.patch.json`
   - 必要时创建并运行 `openspec/changes/<change-name>/fixtures/generate-*-patch.ts`
   - 同步保留并更新 `knowledge.md`
3. `x4-e2e-test-doc-viewer`
   - 使用隔离 reviewer 审核最终文档草稿。
   - 如果高层测试方案有问题，回到 `x4-e2e-test-doc`。
   - 如果细化、fixture 或知识库有问题，回到 `x4-e2e-test-doc-details`。
4. `x4-e2e-test-impl`
   - 根据 `e2e_test_tasks.md` 与 `knowledge.md` 实现或补充 Playwright E2E 测试。
   - 如存在 `fixtures.md` 和 `*.patch.json`，测试必须通过 `tests/helper/e2eFixturePatch.ts` 载入基础 fixture 与 patch。
   - 校验每个 E2E 任务与测试用例、子任务注释的对应关系。
5. `x4-e2e-test-run`
   - 运行 change-scoped E2E 测试。
   - 根据失败类型返回到文档、实现或缺陷流程。

## 文件边界

- 高层文档阶段只允许修改 `openspec/changes/<change-name>/e2e_tests.md`。
- 细化文档阶段允许修改 `openspec/changes/<change-name>/e2e_test_tasks.md`、`knowledge.md`、`fixtures.md`、`openspec/changes/<change-name>/fixtures/generate-*-patch.ts`、`tests/e2e/<change-name>/fixtures/*.patch.json`。
- 实现阶段只允许修改 E2E 测试相关文件，优先使用 `tests/e2e/<change-name>/`.
- 运行阶段不修改产品代码；如果发现产品缺陷，记录为后续修复输入。

## 命名约定

- E2E 文档任务文件的规范名称是 `e2e_test_tasks.md`。
- 如果用户口头写成 `test_e2e_tasks.md`，按同一文件理解，但落盘仍使用 `e2e_test_tasks.md`。

## 输出

- 每个阶段的结果摘要。
- 实际修改文件列表。
- 文档校验、fixture patch 校验、任务-测试映射校验、E2E 运行命令与结果。
