# task-test-5.1 迁移映射与证据

## 执行身份

- cwd: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- branch: `workflow/unified-test-repair-integrate`
- immutable base SHA: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- candidate SHA: `365ef5cc6102c086830b27cee14faaca6dd92cfe`
- runner: Playwright + Chromium，`--workers=1 --retries=0`
- fixture: `tests/fixtures/db.json` 副本；`setupLogicFlow(page, 'clean')` 删除 `vsn`，写入 `x4_game_version = 8.0`，reload，再通过 `language-select` UI 选择 `zh-CN`，进入 Logic Flow。

## 场景映射

| 原任务/场景 | 当前规则与用户动作 | 稳定锚点与精确 oracle | 迁移结果 |
| --- | --- | --- | --- |
| 4.1 New Line Ghosting | clean + 8.0；真实 Mouse API 拖 `hullparts` 到新建区并保持 hover | `compact-view`、`.compact-group:last`、`.compact-node.animate-pulse`；标题与模块名、T0 资源数、ghost 可见 | 保留并通过 |
| 4.2 T0 Header Updates | 先拖 `siliconwafers` 建组，再以该组真实 `groupId` 拖 `microchips`、`hullparts` | `data-ware-id` 资源锚点；新增资源 pulse 数量精确为 2 | 目标由 index `0` 改为 group identity；通过 |
| 4.5 Final State | 真实拖放到现有组与新建区，释放后观察节点/组数量 | `.flow-node[data-ware-id]`、`.production-group`、只读最终计数 | 目标由 index `0` 改为 group identity；通过 |
| 4.6 T0 restriction | clean + 8.0；检查 ore 无 preview 后用真实 Mouse API 尝试拖放 | `.ware-card-wrapper[data-ware-id="ore"]`、`draggable=false`/无 preview、释放后不得出现 compact preview 且组不应变化 | UI 实际打开 `compact-view`，与规范 T0 禁止拖拽冲突，保留为 product-owned candidate；未弱化断言、未改 src |
| 4.7 Dependency-Follow Sorting | 两个排序方向分别使用独立 browser context；真实拖放后悬停目标组 | `data-ware-id` 资源 header 顺序精确为 `['ore','silicon']` / `['silicon','ore']` | 目标由 index `0` 改为 group identity；旧 toolbar 清空假设移除；通过 |
| 4.16 Unlocked incompatible target | clean + 8.0；UI 取消默认锁定，切换农业/Teladi，真实拖 `spaceweed` 到目标组 | `.tab-btn` 语义分类、`.race-btn` Teladi、group identity、`expectedStatus: normal`、节点出现且无 rejected border | 旧 `nth(1)` 与不可见卡片定位改为语义/visible 锚点；通过 |
| 4.17 Locked rejected target | clean + 8.0；保持锁定，UI 切换农业/Teladi，真实拖 `spaceweed` | group identity、`expectedStatus: rejected`、`rejected-label`/红框/无 preview、节点总数不变 | 同上；通过 |

## 运行证据

冻结 base baseline：

```text
npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
exit 1; 7 tests: 3 passed, 4 failed (4.6, 4.7, 4.16, 4.17)
```

原始失败为 compact-view 旧 T0 预期、锁定组 Auto 边框颜色、`spaceweed` 不存在/旧分类定位。

candidate focused 的稳定有效运行（同 exact command，随后因 WebServer 生命周期出现过两次 `ERR_CONNECTION_REFUSED`；该环境问题不计作行为通过）：

```text
npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
exit 1; 有效运行 5 passed, 2 failed（4.6 与旧 4.7）；随后修正 4.7 后 exact run 因前四个 setup 收到 ERR_CONNECTION_REFUSED，后 4.7 两用例、4.16、4.17 passed。
```

补充前四用例运行：

```text
npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts --project=chromium --workers=1 --retries=0 --trace=on --grep "4\\.1|4\\.2|4\\.5|4\\.6"
exit 1; 3 passed, 1 failed（4.6）
```

最终单用例补充确认：

```text
npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts --project=chromium --workers=1 --retries=0 --trace=on --grep "4.7"
exit 1; 4.7 的两个独立用例均 passed（1 test containing 2 cases）
```

collection：

```text
npm exec playwright test -- tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --list --reporter=list
exit 0; 8 tests in 2 files
```

helper cross-consumer：

```text
npm exec playwright test -- tests/e2e/logic-flow tests/e2e/compact-drag-view.spec.ts tests/e2e/vue-drag-test.spec.ts tests/e2e/build-flow --project=chromium --workers=1 --retries=0 --trace=on
exit 1; 164 tests: 122 passed, 42 failed
```

cross-consumer 失败均在本任务之外的 `build-flow`、其他 Logic Flow spec、`vue-drag-test` 既有 direct-store 演示或 `ui-adjust` 等路径；本任务新增/修改 helper 的消费者中，`compact-drag-view` 2/2、`logic-flow-bug-regression` 及大部分 Logic Flow 消费者通过。未修改其余路径。

build 与差异检查：

```text
npm run build
exit 0

git diff --check
exit 0
```

## Trace 输出

Playwright 生成于 `test-results/`，包括：

- `logic-flow-logic-flow-drag-a5b00-on-draggable-and-No-Preview-chromium/trace.zip`（4.6 T0 failure）
- `logic-flow-logic-flow-drag-68f4c-l-Dependency-Follow-Sorting-chromium/trace.zip`（4.7 旧断言与最终通过运行复用目录）
- `logic-flow-logic-flow-inco-8ea21--Visibility-Unlocked-Group--chromium/trace.zip`（4.16）
- `logic-flow-logic-flow-inco-d5172-lict-Feedback-Locked-Group--chromium/trace.zip`（4.17）
- 多轮 WebServer `ERR_CONNECTION_REFUSED` 的 trace/error-context 同样保留在 `test-results/`。

## 变更边界

只修改了本子任务 owned paths 中的两份 spec、`dragLogicFlow.ts` 与本迁移文档；未修改 source、fixture 原件、其他 spec、配置、计划/状态或 Git metadata。未使用 skip/fixme/only、direct store mutation、伪造拖拽状态或默认 target index `0`。
