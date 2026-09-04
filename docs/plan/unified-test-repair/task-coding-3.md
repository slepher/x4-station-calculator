# Coding Task Contract

- Task: `task-coding-3`
- Bundle generation: `2`
- Plan: `plan-2.md`
- Context: `context-2.md`
- Kind: `coding`
- Depends on: `none`

## Bounded goal

让 active workflow、skill discovery 和 agent semantic gates 完全采用“实现拥有 Unit、新链路拥有 E2E、legacy 不阻塞”的合同。

## Owned paths

- `.trae/skills/**`
- `.trae/skills-legacy/**`
- `.codex/multiagent.config.yaml`
- `tests/e2e-skills/**`
- 与 active E2E skill validation 直接相关的 `skill-scripts/**`
- `docs/plan/unified-test-repair/test-skill.md`

## Required work

1. 将旧 `x4-test`、`x4-test-doc`、`x4-test-doc-viewer`、`x4-test-impl`、`x4-test-run` 及只服务旧路由的 orchestrator 移出 `.trae/skills/`，原样保留在 `.trae/skills-legacy/`。
2. `x4-doc`/`x4-apply` 把 focused Unit 放入 implementation task；E2E 仍禁止在 apply 中执行。
3. `x4-bug`/`x4-bug-fix` 按 Unit 或浏览器边界路由，不依赖旧 `test_tasks.md`。
4. `x4-verify`/`x4-archive` 只消费 canonical Unit + active E2E evidence。
5. multi-agent gate 明确 reject/allow 边界，尤其是 owned-path blocker 规则。

## Blocking validation

- 对每个变更后的 active skill 运行 `quick_validate.py`。
- `npm run test:unit -- tests/e2e-skills/unit` 验证 active E2E skill tests。
- `rg` 确认 `.trae/skills/`、`x4-user-workflow` 和 `.codex/multiagent.config.yaml` 无旧 `x4-test-*` active route。
- `git diff --check`。

`tests/skills/**` 的既有失败不是本任务 gate；它们属于待迁移的旧 skill suite。若 active `tests/e2e-skills/**` 失败，则因本任务拥有该路径而阻塞。

## Blocking self-validation

- Commands: `quick_validate.py` for each changed active skill; `npm run test:unit -- tests/e2e-skills/unit`; `rg` active-route check; `git diff --check`

## Implementation simplicity

- Standard: `audit-implementation-simplicity`

## Completion

- 旧 skill 内容保留但不可自动发现、不可从 active command map 调用。
- 行为变更缺 Unit、E2E 绕路、删除 legacy、越权 blocker 均被 agent gate 拒绝。
- 不启动 codex-workflow、不迁移产品测试目录。
