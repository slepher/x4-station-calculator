# M15.2 按钮 tooltip 测试迁移

状态：incomplete；7 项通过，1 项规范与历史改名冲突失败，待主 agent 审核。未改产品或规范。

## 输入与路径

- 规范：`openspec/specs/button-tooltip/spec.md`；三级名称佐证：`openspec/specs/ware-priority/spec.md:9`；原纯消耗验收：`openspec/changes/archive/2026-02-16-button-tooltip/test_tasks.md:56`。
- 原路径和 8 项测试标题完整保留。普通 beforeEach 注入 `tests/fixtures/db.json`（排除 vsn），明确 8.0 stable，reload，通过 `language-select` 选择 English，再点击 `empire-1-station-1`。
- 使用该 fixture 既有 hullparts（计划产物，12h/2h）和 ore（纯消耗，1h），不修改 fixture、不调用 store 产生业务动作。
- 已追踪 `productionWareRuleActions` → `useProductionWareflowPresenter` → `StationWareFlowsDashboard`/`StationWareFlowGroup` → `StationWareFlow` → `FavoriteButton`/`LockButton`。按钮以真实 hover/click/mouse leave 驱动；无规范 focus 场景，未强行给 div 添加焦点能力。

## 旧 → 新映射

| 旧编号/标题 | 当前行为与用户动作 | 独立 expected | 新用例 |
|---|---|---|---|
| integration / Tooltip persistence on click | 固定 hullparts，hover → click → leave | 初始 Primary/level-2；点击 Secondary/level-1 且 tooltip 保持；移开隐藏 | 同名保留 |
| integration / Lock button tooltip persistence | 固定 hullparts，hover → click → leave | Unlocked → Locked，高亮同步，保持显示，移开隐藏 | 同名保留 |
| integration / Tooltip Layout and Content Filtering | hover hullparts | 容器四列 grid；四种 cell 可见；仅 Primary/Secondary；12h/2h；Long/Short | 同名保留；旧能源计划产物改为 fixture 已有的等价纯产出 hullparts |
| integration / Pure Consumption Resource Interaction | hover ore → disabled click → leave | disabled、level-0、cursor default、opacity 1；唯一 No Demand 行，1h/Res；点击无状态变化；移开隐藏 | 同名保留；No Demand 使用 soft 断言，让其他独立验收继续执行但整体仍失败 |
| side / 2.0 | 点击固定站点 | hullparts rail、Fav、Lock 可见 | 同编号保留 |
| side / 3.1 | hover hullparts Fav → leave | placement left 和实际 bounding box 左置；两行完整内容；隐藏 | 同编号保留 |
| side / 3.2 | hover hullparts Lock → leave | placement right 和实际 bounding box 右置；Unlocked/Locked、Auto Fill/Keep Current；隐藏 | 同编号保留 |
| side / 3.3 | 连点 Fav 两次、Lock 两次，再点 ore disabled Fav | 2→1→2；unlocked→locked→unlocked；ore 始终 level-0；ore Lock non-operable/pointer-events none | 同编号保留；删除条件通过分支，明确覆盖可操作和禁用两态 |

## 分类与保留边界

- 基线 8 failed：integration 四项在 setup 抛 `store.clearAll is not a function`（stale）；side 四项默认 9.0 读取不到 8.0 fixture 站点（test-owned 版本初始化）。
- 行使用 `display: contents`，容器承载 grid；迁移断言到容器和 cell，保留四列布局有效目的。
- 清除固定 delay、任意 first flow、条件通过与业务 store 写入。
- 首轮迁移漏 JSON import attribute 导致 collection 失败；添加 `with { type: 'json' }` 后纠正。
- 初次成功运行 8/8 使用当前 Resource 文案；规范复核未发现允许覆盖 No Demand 的确认依据，因此该次通过不作为最终通过证据。最终恢复旧 No Demand 验收，产品当前 Resource 导致真实失败；主 agent 提供改名 commit b375a820d6b26d8d9d73d86e31a2ce5e1c18258f，已请求用户裁决，暂不认定为产品缺陷。
- 规范还要求 label/hour 最小宽度 80px/70px；当前 CSS 无对应最小宽度，本次原 8 项没有这条断言，记录为静态规范覆盖缺口，未声称验证通过，也未扩大合同新增产品功能。

## 验证

精确命令、exit、计数与 trace 见 `docs/plan/unified-test-repair/direct-migration/results/M15.2.md`。无 skip/fixme/only；未运行 Rust build；复用 ENV 已验证构建。最终失败必须保留到文案规范冲突被授权解决，并按相同动作重跑。

## 审查修正：保留原调试证据

恢复原 beforeEach 的 `[Browser Console]:` 监听和 `[Test Debug]` 日志。后者仅在 reload 后只读检查原 `hasStore`/`hasPinia` 布尔字段；不改变 fixture 或业务状态。恢复日志后 collection 仍为 8 项，`Tooltip persistence on click` focused 1/1 通过。名称争议仍 pending，未重跑已知失败。
