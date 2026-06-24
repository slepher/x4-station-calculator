---
name: x4-e2e-test-run
description: "Run change-scoped X4 Playwright E2E tests and validate implementation coverage against `e2e_test_tasks.md`. Trigger with /x4:e2e-test-run <change-name>."
---

# X4 E2E Test Run

## 目的

运行指定 change 的 E2E 测试，并在运行前后确认 `e2e_test_tasks.md` 与实际 Playwright 用例仍保持对应。

## 输入

- `openspec/changes/<change-name>/e2e_tests.md`
- `openspec/changes/<change-name>/e2e_test_tasks.md`
- `openspec/changes/<change-name>/fixtures.md`（如存在）
- `tests/e2e/<change-name>/**/*.spec.ts`

## 执行步骤

1. 先运行任务-测试映射校验：
   ```bash
   python3 .trae/skills/x4-e2e-test-impl/scripts/validate_e2e_case_refs.py <change-name> --json
   ```
2. 如果映射校验失败：
   - 缺少用例或子任务注释：交回 `x4-e2e-test-impl`。
   - `e2e_tests.md` 顶层任务本身不合理：交回 `x4-e2e-test-doc`。
   - `e2e_test_tasks.md` 细化不合理：交回 `x4-e2e-test-doc-details`。
3. 运行 change-scoped Playwright：
   ```bash
   npm exec playwright test -- tests/e2e/<change-name>
   ```
4. 如果测试失败，读取失败输出并分类：
   - 测试实现问题：交回 `x4-e2e-test-impl`。
   - 高层测试方案与真实需求冲突：交回 `x4-e2e-test-doc`。
   - 子任务、fixture、knowledge 与真实需求冲突：交回 `x4-e2e-test-doc-details`。
   - 产品缺陷：记录失败现象、复现路径、关联任务编号，交给缺陷修复流程。
5. 对已执行且可判定的 E2E case 应用结果：
   ```bash
   python3 .trae/skills/x4-e2e-test-run/scripts/apply_e2e_test_results.py <change-name> \
     --successes "1.1,1.2" \
     --failures "1.3" \
     --fail-steps "1.3.2" \
     --json
   ```
6. 测试通过或结果应用后，再运行一次映射校验，防止调试过程中破坏任务对应关系。

## 约束

- 本 skill 不修改产品代码。
- 本 skill 不修改旧 `test_tasks.md`。
- checklist 状态只能通过 `apply_e2e_test_results.py` 修改，不手动打勾。
- 不把失败测试标记为完成；失败 case 使用 `[✗]`，失败点之前的同级子任务使用 `[✓]`，失败点之后保持 `[ ]`。
- 如果需要更新文档或实现，只说明交回哪个 skill，并列出具体原因。

## 输出

- 映射校验命令与结果。
- Playwright 命令与结果。
- `e2e_test_tasks.md` 结果应用命令与结果。
- 失败分类和下一步交接目标，或通过摘要。
