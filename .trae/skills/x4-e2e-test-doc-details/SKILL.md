---
name: x4-e2e-test-doc-details
description: "Use when refining X4 `e2e_tests.md` into detailed E2E task, fixture, and implementation knowledge documents before Playwright implementation."
---

# X4 E2E Test Documentation Details

## 目的

基于 `e2e_tests.md` 细化 E2E 测试方案，生成实现前需要的详细文档和 fixture 资产。

本 skill 负责：

1. `e2e_test_tasks.md`：把每个 `e2e_tests.md` 顶层任务展开为可实现 E2E 子任务。
2. `fixtures.md`：只记录少数需要额外 fixture patch 的任务及其数据性质。
3. `knowledge.md`：保留并补充 locator、UI 操作、fixture 使用、断言策略。
4. 必要的 `tests/e2e/<change-name>/fixtures/*.patch.json`。
5. 必要的 `openspec/changes/<change-name>/fixtures/generate-*-patch.ts`。

## 输入

- `openspec/changes/<change-name>/e2e_tests.md`
- `openspec/changes/<change-name>/knowledge.md`（如已有）
- 相关代码、fixture、现有测试
- `x4-e2e-fixtures` 中的 patch 规则和验证脚本

## 输出文件

- `openspec/changes/<change-name>/e2e_test_tasks.md`
- `openspec/changes/<change-name>/fixtures.md`
- `openspec/changes/<change-name>/knowledge.md`
- `tests/e2e/<change-name>/fixtures/*.patch.json`（仅需要额外数据的任务）
- `openspec/changes/<change-name>/fixtures/generate-*-patch.ts`（仅需要生成脚本的 patch）

## 细化规则

- `e2e_test_tasks.md` 的章节和顶层任务必须与 `e2e_tests.md` 一一对应。
- 每个顶层任务必须至少有一个子任务。
- 子任务写可实现步骤和断言，但 locator、fixture 细节、经验沉淀写入 `knowledge.md`。
- 不新增 `e2e_tests.md` 中不存在的顶层任务；需要新增时返回 `x4-e2e-test-doc`。

## Fixture 规则

- fixture 规划必须结合 `e2e_tests.md` 和 `e2e_test_tasks.md`，不得单独运行。
- `fixtures.md` 只记录少数需要额外 fixture patch 的任务。
- 大部分不需要 patch 的任务不要写入 `fixtures.md`。
- 主要 patch 应为 `save.json` patch；localStorage / `db.json` 状态优先通过 UI 操作形成。
- `db.json` patch 只用于故意构造错误数据、迁移边界、损坏状态或 UI 无法产生的必要状态，并必须在 `fixtures.md` 写明 `reason:`。
- 创建 patch 时遵守 `x4-e2e-fixtures` 的 patch 创建顺序：
  1. 先写 `fixtures.md`。
  2. 判断每个 patch 是否需要生成脚本。
  3. 需要生成脚本时，先创建并运行 `generate-*-patch.ts`，由脚本写出 `*.patch.json`。
  4. 不需要生成脚本时，直接创建 `*.patch.json`。
  5. 最后运行 `validate_e2e_fixture_patch.py`。

## 必跑校验

先校验文档映射：

```bash
python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_test_docs.py <change-name> --json
```

如果创建了 patch，再校验 patch：

```bash
python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_fixture_patch.py \
  tests/e2e/<change-name>/fixtures/*.patch.json --json
```

## 约束

- 不修改 `e2e_tests.md`，除非用户明确要求回到高层测试方案。
- 不修改旧 `test_tasks.md`。
- 不修改产品代码或 Playwright 测试主体。
- 不为普通用户可操作状态创建 `db.json` patch，应通过 UI 操作形成。
- 不删除 `knowledge.md` 中已有有效描写。

## 输出

- 修改过的文件路径。
- `validate_e2e_test_docs.py` 结果。
- 如有 patch，输出 `validate_e2e_fixture_patch.py` 结果。
- 明确哪些 `e2e_tests.md` 任务被细化为 fixture 需求。
