---
name: x4-e2e-test-doc
description: "Use when creating or updating only the high-level X4 E2E test plan `e2e_tests.md` before detail expansion."
---

# X4 E2E Test Documentation

## 目的

为指定 change 维护高层 E2E 测试方案：

1. `e2e_tests.md`：高层 E2E 测试要点，只写主要测试任务，不写明细步骤。

本 skill 不生成 `e2e_test_tasks.md`、`fixtures.md`、`knowledge.md`，这些由 `x4-e2e-test-doc-details` 负责。

## 输入

- `openspec/changes/<change-name>/request.md`
- `openspec/changes/<change-name>/design.md`
- `openspec/changes/<change-name>/tasks.md`
- `openspec/changes/<change-name>/specs/**/spec.md`
- 已存在的 `e2e_tests.md`
- 相关代码、fixture、现有测试

## 输出文件

- `openspec/changes/<change-name>/e2e_tests.md`

## 格式契约

### `e2e_tests.md`

- 使用章节标题：`## <number> <title>`。
- 每个测试要点使用顶层 checklist：
  - `- [ ] x.x <主要测试要点>`
- 不写子任务。
- 不写实现细节、locator、脚本路径、具体 Playwright API。

## 执行步骤

1. 解析 change 名称并读取 change 文档。
2. 阅读相关代码、fixture、现有 E2E 测试，确认可测行为和数据来源。
3. 生成或更新 `e2e_tests.md`，只保留主要 E2E 测试要点。
4. 运行校验：
   ```bash
   python3 .trae/skills/x4-e2e-test-doc/scripts/validate_e2e_tests.py <change-name> --json
   ```
5. 如果校验失败，修正文档并重复运行直到通过。
6. 将结果交给 `x4-e2e-test-doc-details` 细化。

## 约束

- Zero-code：本 skill 不修改产品代码或测试代码。
- 只修改 `openspec/changes/<change-name>/e2e_tests.md`。
- 不修改 `e2e_test_tasks.md`、`fixtures.md`、`knowledge.md`。
- 不修改旧 `test_tasks.md`。
- 不修改 `request.md`、`design.md`、`tasks.md`、`specs/**/spec.md`，除非用户明确要求。
- 禁止用 `TODO`、`待补充`、空泛占位来通过格式。

## 输出

- 修改过的文件路径。
- `validate_e2e_tests.py` 的运行结果。
- 建议交给 `x4-e2e-test-doc-details` 的下一步。
