# Test Skill 问题与边界

## 结论

旧 X4 test skill 的自测资产不完整是独立问题，不再阻塞产品 Unit/E2E 目录重构。

- 产品测试权威目录：`tests/unit/**`、`tests/e2e/**`
- 历史产品测试：迁移到 `tests/legacy/**`，保留但不进入默认验证
- 活跃 E2E skill 自测：独立命令/配置验证，不混入 `npm run test:unit`
- 旧 `x4-test-*` skill 与其自测：保留为 legacy，不参与 active routing 或产品验证 gate

## 已知旧技能缺口

旧校验仍缺少 7 个 `test-e2e-20..26-*.spec.ts` 配对资产，以及 `skill-scripts/validate_test_results.py`。这些缺口属于旧 skill 资产 owner，不属于产品测试迁移任务。

历史证据：

```text
npm run test:unit -- tests/skills/unit tests/e2e-skills/unit
8 files: 6 passed / 2 failed
73 tests: 66 passed / 7 failed
```

## Gate 规则

产品测试任务只被以下问题阻塞：

1. 失败来自该任务 owned paths 内的改动或验证目标；
2. `tests/unit/**` 或 `tests/e2e/**` 的权威套件不满足任务合同；
3. 旧测试被删除而不是迁移到 `tests/legacy/**`。

以下问题必须记录并路由给对应 owner，但不得阻塞产品测试重构：

- `tests/skills/**`、`tests/e2e-skills/**`、`skill-scripts/**` 中的既有失败；
- `tests/legacy/**` 中的失败；
- 当前任务无权修改的其他既有失败。

独立的 workflow/skill 任务在修改活跃 skill 资产时，仍必须运行并负责其 own-path skill validation；“不阻塞产品重构”不等于忽略该 owner 自己引入的失败。
