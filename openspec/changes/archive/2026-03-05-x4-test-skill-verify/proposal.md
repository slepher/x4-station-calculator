## Why

当前 `x4-test-doc` 的文档规范与审核脚本长期存在漂移，导致同一份 `test_tasks.md` 在不同阶段出现相互冲突的格式要求。需要先收敛一套稳定、可执行、可审查的文档格式契约，再继续脚本调试。

## What Changes

- 定义并固定 `test_tasks.md` 为四章结构（1~4），取消第 5 章要求。
- 固化编号树模型：顶层 `x.x`、子任务 `x.x.x`、并要求同父级连续递增。
- 固化 Bug 顶层格式：`- [ ] 4.x BUG-<number> <description>`。
- 明确允许第三级 checklist 子项（子任务的子任务）。
- 将 `/x4:ff x4-test-skill-verify` 的本次执行策略设为“先产出文档，不做脚本校验 gate”，用于支持后续脚本 debug。

## Capabilities

### New Capabilities
- `x4-test-skill-verify`: 建立并落地 test 文档格式契约，作为后续 skill/script 对齐与调试基线。

### Modified Capabilities
- `ship-build-stat`: 该能力下已有 `test_tasks.md` 可作为迁移样式参考，后续按新契约逐步收敛。

## Impact

- Affected docs:
  - `openspec/changes/x4-test-skill-verify/*`
  - `.trae/skills/x4-test-doc/SKILL.md`
- Affected workflow:
  - `/x4:test-doc` 文档生成口径
  - `/x4:ff` 在脚本不稳定阶段的执行策略（临时跳过脚本验证）
- Non-code impact only in this phase.
