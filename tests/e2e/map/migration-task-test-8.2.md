# task-test-8.2 migration record

目标：迁移简单/高级资源筛选、bugfix 筛选与 resource pie 的黑盒 E2E。

## 已执行

- frozen/current baseline：
  `npm exec playwright test -- tests/e2e/map/advanced-resource-filter.spec.ts tests/e2e/map/bugfix-advanced-resource-filter.spec.ts tests/e2e/map/resource-pie.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`
  在旧入口上重复失败；前 8 项均在 `map-resource-entry-button` 不可见处失败，随后同一路径无新信息而停止。exit `130`，8 failed、1 interrupted、23 did not run。
- focused current：同一命令，exit `1`，11 passed、21 failed。
- `git diff --check`：pass。

## test-owned 迁移

- 三份 spec 均按合同从 `tests/fixtures/db.json` 深拷贝、删除 `vsn`、逐 key 注入 localStorage、设置 `isTestEnv=true`、reload，并通过 `data-testid=language-select` 选择 `zh-CN`。
- 地图进入改为真实 UI 的 `星区地图/Sector Map`，资源面板入口改为当前 `map-resource-panel-tab`；移除用户动作中的 `shipBuildStore.activeView` 直接写入。
- 新增高级组后直接在自动展开的组内操作，移除 stale 的“编辑”点击。
- resource-pie setup 补齐 fixture/language/map UI 流程。

## focused failures（base/candidate）

Base SHA：`761310260d1188d836326fadbdd7bdc7616de05c`

Candidate SHA：`761310260d1188d836326fadbdd7bdc7616de05c`

| # | 测试 | fixture / 动作 / oracle / trace | 分类 |
|---:|---|---|---|
| 1-15 | advanced 2.1–2.6、3.1–3.9 | 同一 runner 轮次在 `page.goto('/')` 报 `ERR_CONNECTION_REFUSED`；未到 fixture、动作或 oracle；对应 `test-results/map-advanced-resource-filter-*/trace.zip` | unavailable（runner） |
| 16 | advanced 3.17 | db fixture；展开组后点击 `button:has-text("完成")`；当前 locale/文本未匹配，oracle 未执行；`test-results/map-advanced-resource-filter-3-17-Case-tag组编辑交互-chromium/trace.zip` | test-owned stale |
| 17 | resource-pie 3.1 | db fixture；点击 ore+silicon；旧大写 sector identity `Cluster_01_Sector001_macro` 无节点；`test-results/map-resource-pie-*-3-1-*.zip` | test-owned stale |
| 18 | resource-pie 3.2 | db fixture；点击 ore；同一旧 sector identity 无 polygon；`test-results/map-resource-pie-*-3-2-*.zip` | test-owned stale |
| 19 | resource-pie 3.3 | db fixture；点击 sunlight；同一旧 sector identity 无 polygon；`test-results/map-resource-pie-*-3-3-*.zip` | test-owned stale |
| 20 | resource-pie 3.4 | db fixture；点击 ore+silicon+sunlight；同一旧 sector identity 无 pie slice；`test-results/map-resource-pie-*-3-4-*.zip` | test-owned stale |
| 21 | resource-pie 3.5 | db fixture；关闭面板后用旧 `map-resource-entry-button` 重开；入口隐藏导致 timeout；`test-results/map-resource-pie-*-3-5-*.zip` | test-owned stale |

未观察到 product-owned 或 unknown failure；runner 的 15 项 unavailable 未改动产品路径。未运行 list/build 之外的额外 spec，也未提交 Git。
