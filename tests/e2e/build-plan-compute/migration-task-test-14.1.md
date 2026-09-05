# task-test-14.1 E2E migration

## Scope

迁移显式 compute、重算、卡片详情展示和无规划计算的黑盒覆盖。测试只通过搜索、输入、checkbox、flow 菜单、计算按钮和卡片/弹窗公开 UI 操作；未调用 store action，也未使用 `skip`、`fixme`、`only` 或 `localStorage.clear()`。

## Mapping

| Coverage | Test | Fixture / UI action | Oracle |
|---|---|---|---|
| 状态与固定可手算目标 | 2.1 | `db.json` 深拷贝去 `vsn`，逐 key 注入；`candidate-search-input=energycells`；Compute | Energy Cell Production ×1、Energy Cells ×520、12m |
| 目标修改重算 | 2.2 | `goal-item-energycells` 输入 2000000 后 blur；Compute | 方案卡片文本变化 |
| 基础方案与耗时 | 3.1 | Energy Cells 搜索、Compute | 计算按钮 enabled、方案卡片、duration |
| 重叠产线与材料 | 3.2 | `hullparts` + `energycells` 搜索、Compute | 模块数量、Energy Cells 建材行 count=1 |
| 详情两态 | 3.3 | 开启“建材产线”、Compute、点击最后方案卡片 | summary → switch/step #1 → summary |
| 无规划计算 | 3.4 | flow 菜单选择 `unplanned`、Compute | 方案卡片存在 |

## Fixture and setup

每个用例均执行：`db.json` JSON 深拷贝、删除 `vsn`、逐 key 写入 localStorage、写入 `isTestEnv=true`、reload、等待 `#debug-ready-marker`，再通过 `data-testid=language-select` UI 选择 `zh-CN`。未清除 localStorage。

## SCC boundary

SCC 只保留“单调增量、最大迭代次数限制”的候选约束；本 E2E 不把单次结果解释为全局最小解。SCC 稳定性与 `≤60` 次属于 Unit 第 1 章。

## Current classification

5 个 E2E 通过；3.3 在当前公开 unplanned 方案上无法找到 `role=switch`，归类为产品/fixture 可达性待分类失败，未改源码。最终完整 focused run 另有 webServer `ERR_CONNECTION_REFUSED` 环境失败，见 progress。

## Checkpoint

- Base: `761310260d1188d836326fadbdd7bdc7616de05c`
- Candidate: `8ba9c9eeb865b37dde0a61f045782c834da8a5d7`
- Candidate branch: `workflow/unified-test-repair-integrate`
