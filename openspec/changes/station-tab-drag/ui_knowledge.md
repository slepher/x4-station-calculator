# UI Knowledge: station-tab-drag

本文档仅覆盖 `test_tasks.md` 中 Web Integration Tests 所需的页面元素、交互流程与测试数据来源。

## 1. 关键定位器

| 元素 | 定位器 | 来源文件 | 说明 |
|------|--------|----------|------|
| 标签栏容器 | `.station-tab-bar-container` | `src/components/StationTabBar.vue` | 标签栏根容器 |
| 总览标签 | `.overview-tab` | `src/components/StationTabBar.vue` | 固定首位，不参与拖拽 |
| 分站标签列表 | `.tabs-draggable-list` | `src/components/StationTabBar.vue` | `vuedraggable` 根容器 |
| 分站标签项 | `.station-tab` | `src/components/StationTabBar.vue` | 可拖拽目标元素 |
| 分站标签稳定 ID | `.station-tab[data-station-id]` | `src/components/StationTabBar.vue` | 用于顺序断言，避免依赖重复文本 |
| 新建分站按钮 | `.add-btn` | `src/components/StationTabBar.vue` | 新建空间站 |
| 拖拽幽灵态 | `.tab-drag-ghost` | `src/components/StationTabBar.vue` | 拖拽反馈样式 |
| 拖拽选中态 | `.tab-drag-chosen` | `src/components/StationTabBar.vue` | 拖拽反馈样式 |
| 拖拽进行态 | `.tab-dragging` | `src/components/StationTabBar.vue` | 拖拽反馈样式 |
| 保存状态提示容器 | `div.fixed.bottom-6.right-6.z-\\[9999\\]` | `src/components/StatusMonitor.vue` | 保存后右下角状态提示区域 |
| 保存状态分类标签 | `span.text-[10px].font-black.uppercase` | `src/components/StatusMonitor.vue` | 期望包含 `save` 分类 |
| 保存状态消息内容 | `div.text-xs.font-mono` | `src/components/StatusMonitor.vue` | 期望为“保存/Save”语义内容 |

## 2. 拖拽操作基线流程（Playwright Mouse API）

```ts
const tabs = page.locator('.station-tab');
const source = tabs.nth(2); // 第3个分站
const target = tabs.nth(0); // 第1个分站

const s = await source.boundingBox();
const t = await target.boundingBox();
if (!s || !t) throw new Error('missing tab box');

await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
await page.mouse.down();
await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(2000);
```

说明：`vuedraggable` 在本项目中应优先使用 Mouse API，不使用 `dispatchEvent` 模拟原生 `DragEvent`。若拖拽断言失败，最多重试 2 次。

## 3. 断言策略

- 顺序断言：读取 `.station-tab[data-station-id]` 的 `data-station-id` 数组，比较拖拽前后顺序。
- 固定首位断言：断言第一个标签为 `.overview-tab`。
- 取消拖拽断言：在无效区域 `mouse.up()` 后，顺序数组应与初始值一致。
- 持久化断言：保存并刷新后再次读取顺序数组，必须等于保存前顺序。

## 4. 测试数据映射（fixtures）

| 数据用途 | fixture 文件 | 字段 | 输入/匹配逻辑 |
|---------|--------------|------|---------------|
| 分站顺序断言（无需固定命名） | 无需额外 fixture | `data-station-id` | 通过 DOM 的 `data-station-id` 直接断言顺序 |
| 备用模块数据（如需触发保存脏状态） | `tests/fixtures/module_fixtures.yaml` | `modules[].name` | 通过搜索框按 `name` 字段输入并匹配结果项文本 |

说明：当前拖拽测试不依赖分站命名文本，避免 i18n 与默认命名引发的不稳定。

## 5. 前置与清理

- 前置：`localStorage.clear()` 与 `sessionStorage.clear()`，等待 `#debug-ready-marker`。
- 建站：通过 `.add-btn` 连续创建目标数量分站，不依赖随机名称断言。
- 清理：每个用例独立初始化，避免跨用例顺序污染。

## 6. Fail-first 失败证据与排查指引（R1-R4）

- W1 失败证据：`tests/e2e/station-tab-drag/station-tab-drag.spec.ts:73`，断言 `expect(success).toBe(true)`，实际为 `false`。说明三次拖拽重试后，标签顺序仍未达到 `Gamma -> Alpha -> Beta`。
- W3 失败证据：`tests/e2e/station-tab-drag/station-tab-drag.spec.ts:98`，断言重载后顺序等于保存前顺序失败；期望 `['Alpha','Gamma','Beta']`，实际 `[]`。
- W1（R4）失败证据：`tests/e2e/station-tab-drag/station-tab-drag.spec.ts:91`，改为 `data-station-id` 顺序断言后，`expect(success).toBe(true)` 仍失败，说明问题不在标签文本读取。
- W3（R4）失败证据：`tests/e2e/station-tab-drag/station-tab-drag.spec.ts:120`，失败点前移到保存前拖拽重排阶段，尚未进入刷新后恢复断言。
- 排查优先级：
  1. 保留 `.station-tab[data-station-id]` 顺序断言与刷新后数量恢复等待，避免回退到不稳定文本断言。
  2. 重点排查拖拽信号是否真正生效（`@start/@end` 是否触发、目标容器是否接受排序、拖拽位移阈值是否满足）。
  3. 对 W1 先做最小化可视化诊断（拖拽过程中检查 `.tab-drag-ghost/.tab-drag-chosen` 是否出现），确认失败发生在“拖拽未触发”还是“触发但未重排”。

## 7. W1/W3 详细执行口径（与 test_tasks.md 同步）

- W1（拖拽重排）操作脚本口径：
  - 点击 `.add-btn` 三次创建 3 个分站
  - 依次把 3 个分站重命名为 `Alpha`、`Beta`、`Gamma`
  - 拖拽 `Gamma` 到 `Alpha` 前方
  - 最终可见顺序应为 `Gamma -> Alpha -> Beta`
- W3（刷新后保持）操作脚本口径：
  - 在完成 W1 后点击保存按钮 `.btn-tool`（保存/Save）
  - 检查右下角 `StatusMonitor` 状态提示：分类包含 `save`，消息为“保存/Save”语义
  - 刷新页面并等待 `#debug-ready-marker`
  - 标签恢复显示后，顺序仍应为 `Gamma -> Alpha -> Beta`
- 两项共同保护断言：
  - `.overview-tab` 固定首位
  - 分站标签数量保持不变（3 个）
