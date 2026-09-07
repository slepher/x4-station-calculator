# 拖拽方案导航与验证证据

路径相对仓库根。目录：选型 → helper/API → 失败定位 → 2026-09-07 验证记录。使用案例前重新检查当前代码；这里记录的运行不是未来任务的验收。

## 场景选型

| 操作 | 首先评估 | 具体配方 / 当前证据 |
| --- | --- | --- |
| 同列表排序 | vuedraggable model-value，经 presenter 提交顺序 | [列表配方 1](sortable-recipes.md#1-同列表排序)；ProductionSidebar |
| 跨列表移动 | Sortable group；明确两个集合与一次业务转移 | [列表配方 2](sortable-recipes.md#2-跨列表移动与-clone-创建)；演示页完整生命周期失败，不作成功模板 |
| 模板 clone 创建 | clone payload 与领域创建分离 | 同上；Logic Flow 已有真实 E2E |
| sidebar → map | 已有 mouse 阈值、坐标、preview、up 链 | [地图配方](map-drag-recipes.md)；空白与蓝图来源已验证 |
| overlay 空间移动 / 地图平移 | 当前地图自定义 mouse；业务移动与视口 pan 分开 | 同上；overlay 有独立证据，不能覆盖 sidebar |
| 改变 shadow 外观 | CSS → 模式匹配的影像 API → 必要时自绘浮层 | 两份配方均有选择条件；异构外观缺专项测试 |
| 目标插入占位 | 库占位优先；异构目标评估自绘预览和布局归属 | [列表配方 4](sortable-recipes.md#4-目标占位与插入位置)；可见通过不代表不跳动 |
| 子元素 hover 闪烁 | enter/leave 计数；首次进入、完全离开更新 | [列表配方 5](sortable-recipes.md#5-enterleave-计数器防闪烁)；嵌套边界专项缺测 |
| 文件拖入 | 原生 DragEvent/DataTransfer，验证外部输入 | `src/components/save/SaveUploadPanel.vue` 有 dragover/dragleave/drop，无上述计数；当前无专项运行证据 |

文件拖入应在 drop 入口核对类型/数量等产品限制并交给现有文件处理能力；拖入区域阻止浏览器默认打开文件，离开/完成时清视觉状态。原生 API 见 [HTML Drag and Drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)。文件选择按钮仅证明替代入口；合成 DataTransfer 只能证明 handler 路径，不得冒充外部真实拖入通过。没有适用真实输入工具时明确此验证缺口。

## 代码、helper 与测试边界

| 场景 | 入口与前提 | 消费者负责的独立断言 |
| --- | --- | --- |
| Logic Flow | `tests/e2e/logic-flow/helpers/dragLogicFlow.ts`；合法 ware ID，明确 group ID/new zone；`v-show` compact 必须实际可见 | 精确 ware/module/lineage/manual、拒绝与取消不变、一次创建；不要调用被测扩展算法生成 expected |
| Station sidebar | `tests/e2e/production/station-management.spec.ts` 内 helper；稳定 `data-station-id`，真实 sortable chosen/ghost | ID 顺序与完整成员、保存刷新、取消合同 |
| Map/sidebar/overlay/group | `tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts` 内 helper；统一 live fixture、UI 选来源和目标 | draft 身份/字段/数量、精确命中、saved 与 draft 边界、按具体入口验证持久化 |
| 计数器 | `LogicFlowPlanningZone.vue` 的普通区与 new 区；`DragTestPage.vue` 的 A/B 区 | 嵌套边界持续 hover、归零离开、取消后重入；当前只有间接覆盖 |
| MapStationPanel Unit | `tests/unit/map/map-station-panel.spec.ts` | 4px 启动与事件局部边界；不能证明浏览器命中及真实拖放 |
| Terraforming / 模块排序 | `TerraformingTaskList.vue`、`TerraformingTaskNode.vue`、`TerraformingResourcePanel.vue`、`StationPlanningPanel.vue`（均在 `src/components/empire/` 下，前三个位于 `terraforming/`） | 有实现，未确认专项真实 E2E；不要当成已验证推荐 |

测试 API：参照 [Playwright drag-and-drop](https://playwright.dev/docs/input#drag-and-drop)。完整简单操作可用 `dragTo` 做最小适配验证；需释放前检查时使用 hover/down/move/up 分段输入。实际浏览器可能需要多次移动才能触发 dragover，沿用匹配 helper 的已验证轨迹，并等待可观察状态；禁止把固定 2 秒、固定 steps 或无依据重试写成普遍保证。

## 失败签名与下一步证据

| 第一个失败阶段 | 先检查 | 不可据此声称 |
| --- | --- | --- |
| preview/server/browser 未启动 | fresh build、端口、权限、浏览器启动输出 | 产品拖拽坏了 |
| 按下后不启动 | 源可见/合法、真实命中、handle、阈值、是否点到子按钮 | hover 或 drop 已验证 |
| hover 闪退 | 父子 enter/leave 深度、计数清理、覆盖层命中 | 一律是鼠标速度或布局问题 |
| 占位来回换位 | 指针/真实项边界/索引/占位尺寸，是否布局反馈 | enter/leave 计数器必定解决 |
| shadow 重复或形状错误 | native/fallback/自绘的实际组合与渲染归属 | CSS ghost 就是自定义跟随影像 |
| 释放不提交或重复提交 | 选定提交回调、合法目标、权威数组与临时数组、会话是否重复消费 | 增加等待就能恢复 |
| DOM/count 与业务不符 | computed 缓存、库 splice、手工 DOM 修补、精确实体 ID | 某个 count 对了就是成功 |
| 刷新丢失 | 是否执行真实确认、保存了哪个状态、normalizeState 是否保留字段 | 拖动本身必定失败 |

历史证据：`docs/plan/unified-test-repair/direct-migration/results/M5.1.md` 记录禁拖输入与 compact 可见性纠正；`M5.3.md` 的 computed 数组一致性是根因候选，部分 locked hover 仍 unknown；`M3.2.md` 记录 overlay/sector 精确命中与持久化。保留失败，不能把多轮独立通过拼成一次全绿。

## 2026-09-07 专项运行记录

执行者 evidence_runner；更新 skill 前运行，产品与测试未修改，运行时工作区干净。`npm run build` exit 0（7.22s，已有 chunk size warning），未运行 build-rust。首次 sandbox preview `listen EPERM`，未执行测试；在获准环境以独立端口重新执行。浏览器 Chromium，workers=1，retries=0，trace=on。版本：Playwright 1.57.0、vuedraggable 4.1.0、Sortable 1.14.0。

| 批次 / grep | 数量 / exit | 结论及边界 |
| --- | --- | --- |
| map：`空白真实创建|从蓝图真实拖放|virtual trade overlay真实拖动|group handle排序` | 4 passed / 0 | 空白和蓝图 sidebar 创建通过；既有 row 移动通过；overlay 跨 hub 拒绝及确认刷新、group 排序通过 |
| station：`W1:|W3:|W4:` | 3 passed / 0 | 精确排序、保存刷新、取消不变 |
| logic：下方六标题 | 6 passed / 0 | 新组/已有组、重复拒绝、hover 离开取消、compact 启动、外部释放不变 |
| demo：`real mouse moves one item|hover, leave and cancel retain all items` | 1 passed / 1 failed，exit 1 | hover/leave/cancel 通过；完整生命周期缺 drop 记录 |

总计 **14 passed / 1 failed**，15 个代表用例，不是全量覆盖。

失败：`tests/e2e/vue-drag-test.spec.ts` 的 `A.1/B.1/C.1/ST.1/ST.2/E.1 real mouse moves one item and records the complete lifecycle` 在 `expect(s.events).toContain('drop')` 失败；实际 `dragstart, dragenter, dragend`。此前源/目标成员断言通过，后续 DOM 断言未到达；不能直接断言没有移动。根因 unknown，未盲目重试。

缺口：counter `2→1` 保持、父子边界序列与卸载清理；placeholder 持续不跳动；shadow 与源不同外观；MapBindingStation 普通候选/virtual trade sidebar/sector 来源；空白/蓝图新增自身的确认刷新链。已有 passing 用例不覆盖这些合同。

旧 `openspec/changes/auto-sector-group-one-map/e2e_test_tasks.md` 的 5.1.2 曾写直接 store 创建，与真实 E2E 不符；skill 更新时同步纠正步骤，未将历史任务勾选为完成。迁移说明为 `tests/e2e/auto-sector-group-one-map/migration-task-test-3.2.md`。

### 原始执行参数与产物

工作目录为仓库根。下列是该次运行记录，`/tmp` 配置/产物可能被清理；未来执行先检查当前 `playwright.config.ts` 和构建，不将这些临时路径设为永久依赖。

```bash
npm run build
PORT=22380 npm exec playwright test -- tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts --grep='空白真实创建|从蓝图真实拖放|virtual trade overlay真实拖动|group handle排序' --config=/tmp/x4-test-migration-env/preview-only.config.ts --project=chromium --workers=1 --retries=0 --trace=on --output=/tmp/x4-drag-evidence/map --reporter=list
PORT=22381 npm exec playwright test -- tests/e2e/production/station-management.spec.ts --grep='W1:|W3:|W4:' --config=/tmp/x4-test-migration-env/preview-only.config.ts --project=chromium --workers=1 --retries=0 --trace=on --output=/tmp/x4-drag-evidence/station --reporter=list
PORT=22382 npm exec playwright test -- tests/e2e/logic-flow/logic-flow-interaction.spec.ts tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep='new-zone drop creates exactly one production group|leaving a hovered target before release cancels the drop|duplicate drops are rejected without adding a second node|3\.1 Logic: Compact View Appears on Drag|4\.2 Logic: Drag to Existing Line|5\.1b Release outside target leaves groups and nodes unchanged' --config=/tmp/x4-test-migration-env/preview-only.config.ts --project=chromium --workers=1 --retries=0 --trace=on --output=/tmp/x4-drag-evidence/logic --reporter=list
PORT=22383 npm exec playwright test -- tests/e2e/vue-drag-test.spec.ts --grep='real mouse moves one item|hover, leave and cancel retain all items' --config=/tmp/x4-test-migration-env/preview-only.config.ts --project=chromium --workers=1 --retries=0 --trace=on --output=/tmp/x4-drag-evidence/vue-drag --reporter=list
```

构建日志 `/tmp/x4-drag-evidence-build.log`；map 日志 `/tmp/x4-drag-evidence/map.log`（首轮环境失败日志，成功批次以 trace/test result 为准）；各批 `.last-run.json` 与 trace 在相应 output 下。失败 trace 为 `/tmp/x4-drag-evidence/vue-drag/vue-drag-test-A-1-B-1-C-1--6e66e-ords-the-complete-lifecycle-chromium/trace.zip`。原始运行 stdout 由执行者工具结果记录；不要凭缺失文本日志补造结果。
