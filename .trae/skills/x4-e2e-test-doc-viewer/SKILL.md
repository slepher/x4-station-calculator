---
name: x4-e2e-test-doc-viewer
description: "Review X4 E2E test documentation draft and gate x4-e2e-test-doc completion. Must run in a dedicated isolated subagent. Trigger with /x4:e2e-test-doc-viewer <change-name>."
---

# X4 E2E Test Documentation Viewer

## 角色

`x4-e2e-test-doc-viewer` 是 E2E 文档审核 gate。它只审核，不重写文档，不实现测试。

必须在隔离 reviewer subagent 中运行，避免主线程生成文档时的上下文污染审核判断。

## 审核对象

- `openspec/changes/<change-name>/e2e_tests.md`
- `openspec/changes/<change-name>/e2e_test_tasks.md`
- `openspec/changes/<change-name>/fixtures.md`
- `openspec/changes/<change-name>/knowledge.md`

## 必跑校验

```bash
python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_test_docs.py <change-name> --json
```

如果存在 `tests/e2e/<change-name>/fixtures/*.patch.json`，还必须运行：

```bash
python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_fixture_patch.py \
  tests/e2e/<change-name>/fixtures/*.patch.json --json
```

校验失败时，直接返回 `review_status=rewrite_required`。

## 人工审核清单

1. `e2e_tests.md`
   - 是否只包含主要 E2E 测试要点。
   - 是否没有实现明细、locator、脚本路径、Playwright API。
   - 每个任务是否对应真实可测的用户行为或业务行为。
2. `e2e_test_tasks.md`
   - 顶层任务是否与 `e2e_tests.md` 一一对应。
   - 子任务是否足够实现 E2E 测试。
   - 子任务是否避免空泛词，例如 `检查`、`验证`、`合理即可`。
3. `knowledge.md`
   - 是否保留已有有效描写。
   - 是否补充了新 E2E 任务需要的 fixture、UI 入口、locator、断言知识。
   - 是否没有把主要测试任务重复堆到知识库。
4. `fixtures.md`
   - 是否只记录需要额外 fixture patch 的任务。
   - 已记录任务是否来自 `e2e_tests.md`。
   - 是否优先使用 `save.json` patch。
   - `db.json` patch 是否写明必要理由。
   - patch 文件是否存在并通过校验。
5. 跨文件一致性
   - 同一行为、UI 名称、fixture 名称在三份文档中含义一致。
   - 没有 E2E 任务缺少实现知识支撑。

## 输出格式

必须使用下面格式：

```text
review_status: pass|rewrite_required
blocking_issues:
- <issue id>: <file>: <reason>
non_blocking_notes:
- <note>
handoff: x4-e2e-test-doc|x4-e2e-test-doc-details|none
```

规则：

- `review_status=pass` 时，`blocking_issues` 必须为空，`handoff=none`。
- `review_status=rewrite_required` 时，`blocking_issues` 必须非空。
- 高层 `e2e_tests.md` 问题使用 `handoff=x4-e2e-test-doc`。
- `e2e_test_tasks.md`、`fixtures.md`、`knowledge.md` 或 patch 问题使用 `handoff=x4-e2e-test-doc-details`。
- 不得在 viewer 内直接修改文件。
