---
name: x4-e2e-test-impl
description: "Implement Playwright E2E tests for X4 changes from `e2e_test_tasks.md` and validate task-to-test mapping. Trigger with /x4:e2e-test-impl <change-name>."
---

# X4 E2E Test Implementation

## 目的

根据 `openspec/changes/<change-name>/e2e_test_tasks.md` 与 `knowledge.md` 实现或补充 Playwright E2E 测试。

本 skill 只处理 E2E 测试实现，不处理旧 `test_tasks.md` 的 Unit/E2E/Bug 混合任务。
如果 change 存在 fixture patch 需求，必须先由 `x4-e2e-test-doc-details` 准备并校验 fixture，再进入本 skill。

## 输入

- `openspec/changes/<change-name>/e2e_test_tasks.md`
- `openspec/changes/<change-name>/knowledge.md`
- `openspec/changes/<change-name>/fixtures.md`（如存在）
- `tests/e2e/<change-name>/fixtures/*.patch.json`（如存在）
- 相关产品代码、presenter、store、fixture、现有 E2E 测试

## 输出

- `tests/e2e/<change-name>/**/*.spec.ts`
- 必要的 E2E helper 或 fixture 文件

## 任务映射契约

1. `e2e_test_tasks.md` 中每个顶层任务 `x.y` 必须对应一个 Playwright `test()` 用例。
2. 用例标题必须以任务编号开头，例如：
   ```ts
   test('1.1 自动分组入口展示核心状态', async ({ page }) => {
   ```
3. 每个子任务 `x.y.z` 必须在对应测试用例中以注释标记：
   ```ts
   // 1.1.1 进入地图视图并定位自动分组入口
   ```
4. 注释标记后必须有实际测试动作或断言。
5. 测试实现必须优先使用 `knowledge.md` 中记录的 locator、fixture、UI 入口与断言策略。

## Fixture 使用规则

- 如果 `fixtures.md` 记录了当前 case 需要的 patch，测试必须 import 对应 `tests/e2e/<change-name>/fixtures/*.patch.json`。
- 使用 `tests/helper/e2eFixturePatch.ts` 中的 helper 载入基础 fixture 和 patch。
- 主要 patch 应为 `save.json` patch；localStorage / `db.json` 状态优先通过 UI 操作形成。
- 只有故意构造错误数据、迁移边界、损坏状态或 UI 无法产生的必要状态，才使用 `db.json` patch。
- 不在测试中手写大段 localStorage 初始对象。
- 不在测试运行时执行 `openspec/changes/<change-name>/fixtures/generate-*-patch.ts`。
- 如果缺少 `fixtures.md` 中声明的 patch，或 patch 无法通过校验，返回 `x4-e2e-test-doc-details`，不要在实现阶段临时改数据结构。

## 必跑校验

实现或修改测试后，必须运行：

```bash
python3 .trae/skills/x4-e2e-test-impl/scripts/validate_e2e_case_refs.py <change-name> --json
```

如果校验失败，先修复任务-用例映射，再进入测试运行阶段。

## E2E beforeEach 要求

遵守仓库 `AGENTS.md` 中的 E2E beforeEach 规则：

- 加载 `tests/fixtures/db.json` 到 localStorage，排除 `vsn`。
- 普通 localStorage 状态通过 UI 操作设置；只有必要例外才先在内存中将 `db.json` patch 应用到基础 fixture，再写入 localStorage。
- reload 页面初始化 store。
- 通过 UI 设置语言，不直接改 Cookie 或 localStorage 触发语言。
- 禁止 `localStorage.clear()`。
- Live Production / save-binding / archive 联动测试优先沿用现有 live fixture helper，并按 `x4-e2e-test-doc-details` 产出的 save patch 约定扩展 wrapper。

## 约束

- 不修改产品代码，除非用户明确要求实现产品修复。
- 不修改 `e2e_tests.md` 和 `e2e_test_tasks.md` 的任务定义；发现文档缺失时，返回 `x4-e2e-test-doc`。
- 不修改旧 `test_tasks.md`。

## 输出

- 修改的测试文件列表。
- `validate_e2e_case_refs.py` 结果。
- 建议交给 `x4-e2e-test-run` 的测试命令。
