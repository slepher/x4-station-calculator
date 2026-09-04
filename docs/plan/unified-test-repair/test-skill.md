# Test Skill 问题记录

## unified-test-repair blocker

### 问题归属

这是 X4 测试技能自身的脚本/测试资产不完整问题，不是产品代码问题，也不是 `db.json` fixture 问题。

### 问题一：E2E 配对资产缺失

`tests/skills/unit/validate-test-impl-assets.spec.ts` 要求每个 `test_tasks-XX-*.md` 都有四个同名配对 spec：

- `test-unit-XX-*.spec.ts`
- `test-e2e-XX-*.spec.ts`
- `test-bug-XX-*.spec.ts`
- `test-bug-fix-XX-*.spec.ts`

当前缺少以下 task 对应的 E2E spec：

- `test-e2e-20-top-level-numbering.spec.ts`
- `test-e2e-21-missing-comment.spec.ts`
- `test-e2e-22-l2-content-missing.spec.ts`
- `test-e2e-23-l3-content-missing.spec.ts`
- `test-e2e-24-bug-before-after-same-number.spec.ts`
- `test-e2e-25-transition-step-and-reference-threshold.spec.ts`
- `test-e2e-26-consecutive-state-refs.spec.ts`

因此配对资产校验失败 7 项。

### 问题二：结果校验脚本缺失

`tests/skills/unit/validate-test-results-run.spec.ts` 期望存在：

```text
skill-scripts/validate_test_results.py
```

该脚本当前不存在，因此 5 个 test-result run case 无法执行。`tests/skills/data/runs/` 目录及其 run 数据当前存在；缺失的是 validator 脚本。

### 验证结果

```text
npm run test:unit -- tests/skills/unit tests/e2e-skills/unit
```

- 8 files：6 passed / 2 failed
- 73 tests：66 passed / 7 failed

### 对 unified-test-repair 的影响

`task-test-1` 只拥有 `tests/unified-unit/` 和 `tests/unit/`，不拥有：

- `tests/skills/**`
- `tests/e2e-skills/**`
- `skill-scripts/**`

所以当前任务不能通过迁移 unit spec、删除失败测试或修改 `db.json` 来解决此问题。应由 X4 test skill / `x4-test-skill-verify` 的资产与脚本 owner 补齐后，再重新运行 `task-test-1`。

不得通过跳过 skills suite、删除校验用例或伪造 validator 输出绕过 gate。
