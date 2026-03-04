# Bugs: ship-status-diff

## Bug: 空炮塔槽位高亮候选后炮塔平均输出差值为 0
- **ID**: BUG-001
- **Description**: 在更换舰船并进入 M 级大太刀的炮塔槽位后，当前炮塔装备为空时，高亮候选炮塔 `ARG M 霰弹炮塔`，状态面板未出现大于 0 的炮塔平均输出差值。
- **Steps to Reproduce**:
  1. 点击更换舰船（`ship-build-change-ship`）。
  2. 选择 M 级并选择 `Odachi`（大太刀）。
  3. 选择 `T` 炮塔槽位，确保目标炮塔槽位当前装备为空。
  4. 在候选列表中高亮 `ARG M 霰弹炮塔`。
  5. 观察状态面板中的“炮塔平均输出值”差异显示。
- **Expected Behavior**: 炮塔平均输出值存在 `> 0` 的 diff。
- **Actual Behavior**: 炮塔平均输出值 diff = `0`。
- **Status**: Verified
- **Related Test**: `tests/e2e/ship-status-diff/bug-ship-status-diff.spec.ts` (修复前), `tests/e2e/ship-status-diff/bugfix-ship-status-diff.spec.ts` (修复后), `test_tasks.md 4.1`
- **Execution Evidence (current run)**:
  - Reproduce (修复前): `pnpm exec playwright test tests/e2e/ship-status-diff/bug-ship-status-diff.spec.ts` -> `Passed`
  - Build: `npm run build` -> `Passed`
  - Verify (修复后): `pnpm exec playwright test tests/e2e/ship-status-diff/bugfix-ship-status-diff.spec.ts` -> `Passed`
  - Sync: `python3 skill-scripts/verify_bug_sync.py ship-status-diff --json` -> `[]`
- **Fix Summary**:
  - 简化模式预演替换数量从 `target.count` 调整为 `target.totalCount`，保证空槽位场景在高亮候选时也会生成有效 target diff。
