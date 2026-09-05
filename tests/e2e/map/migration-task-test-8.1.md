# task-test-8.1 迁移记录

## 范围与 checkpoint

- Lane：`integrate`，分支 `workflow/unified-test-repair-integrate`。
- 执行 target/base：`761310260d1188d836326fadbdd7bdc7616de05c`。
- candidate：`a4d425379238088f14b003112cf31c2e86affc07`；focused run 未完成，不能作为通过证据。
- runner：Playwright Chromium，`--workers=1 --retries=0 --trace=on`。
- fixture：`tests/fixtures/db.json` 的运行时副本，删除 `vsn` 后逐项注入；每个 spec reload，再以 `data-testid="language-select"` 选择 `zh-CN`。
- 固定地图实体：`cluster_01_sector001_macro`（Grand Exchange I / 大交易所 I）。

## 原场景到当前行为

`map-refactory.spec.ts` 原有 2.1–2.5、3.1–3.14 全部保留。有效覆盖映射如下：

| 原编号 | 当前覆盖 | 处理 |
| --- | --- | --- |
| 2.1–2.5 | `map-svg-canvas` 渲染、默认状态、固定 macro hover、tooltip 离开 | 保留，beforeEach 迁移 fixture/language |
| 3.1–3.6 | sector link、highway、gate、cross-cluster line、clipPath/filter 唯一性 | 保留；移除条件通过，要求集合存在并验证稳定属性 |
| 3.7–3.8 | sector hover/leave 与 sunlight 行 | 保留，hover 改为固定 macro |
| 3.9–3.10 | placement/save POI overlay pointer-events | 保留，当前 fixture 缺少入口时由运行结果分类，未删除 |
| 3.11–3.12 | tooltip 移入保持、鼠标几何拖拽/滚轮缩放后关闭 | 保留；坐标仅用于真实鼠标动作 |
| 3.13–3.14 | tooltip 标题、owner、sunlight、资源与语言切换 | 保留；owner 当前事实为 `Teladi公司` |

`map-search.spec.ts` 保留原有效 2.1–2.3、3.1–3.17：搜索入口、name/localeName/id 规则、批量高亮阈值、候选选择聚焦、清空、语言显示和宽列表。移除无效的常量自比较；id oracle 改为当前真实 macro 文本 `cluster_01_sector001_macro` 与 `sector001`。

`x4-map-tooltip.spec.ts` 保留原有效 2.1–2.2、3.1–3.5：固定 macro hover、内容/语言、tooltip 稳定、拖拽关闭、缩放行为。当前 DOM 的 sunlight 锚点为 `.sunlight-name`，资源颜色由资源名称行的 inline style 表达；owner oracle 为 `Teladi公司`。

## 执行证据

### 原始 focused baseline

命令：

```text
npm exec playwright test -- tests/e2e/map/map-refactory.spec.ts tests/e2e/map/map-search.spec.ts tests/e2e/map/x4-map-tooltip.spec.ts --project=chromium --workers=1 --retries=0 --trace=on
```

退出码 `1`；46 collected，27 passed，19 failed。主要失败：旧默认/overlay 前置找不到 gate 或 station entry；search 3.5/3.16 使用过期 `Cluster_01`/`Sector` 文本；tooltip 3.1 使用不存在的 `.sunlight-swatch`；tooltip 3.5 恢复显示未达旧期望。失败 trace 位于 `test-results/**/trace.zip`，错误上下文位于对应 `error-context.md`。

### candidate focused

同一命令在迁移后启动并收集 31 tests。因用户要求停止过度删减核对，运行于 `map-refactory` 2.4 失败后被中断，未完成全量 candidate，退出码不可作为通过证据：

- 通过后已观察：map-refactory 2.1–2.3；map-search 2.1–3.13（截至中断）；
- 失败：临时简化候选中的 map-refactory 2.4，owner 实际为 `Teladi公司`；该简化候选随后已恢复；另有 map-search 3.14 因中断显示 interrupted；
- trace：`test-results/map-map-refactory-map-refa-20285--Case-固定星区-hover-显示-tooltip-chromium/error-context.md` 及同目录 `trace.zip`；
- 当前 candidate 未完成，不能声称 focused 通过。

### diff 校验

`git diff --check` 在候选启动前退出码 `0`。未运行 build/list；按用户指示在 focused 收束时停止扩展。

## 未决与分类

- `map-refactory` 的原场景集合已恢复，未以 smoke test 替代；当前仅有 fixture/lifecycle、稳定 locator、条件通过收紧和陈旧文本修正。
- candidate 全量 focused 未完成，因此 task-test-8.1 不能标记完成；需要 dispatcher/reviewer 在不变语义输入下重新运行同一命令。
- baseline 中 gate/overlay 缺失、tooltip zoom 恢复等行为归属尚未由本 worker 裁决；保留为候选产品/环境分类项。
