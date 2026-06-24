# auto-sector-group-one-core E2E Knowledge

## Fixture 数据

### db.json (save bindings)

路径：`tests/fixtures/db.json`

包含应用的完整 localStorage 状态。auto-sector-group 相关字段：

- `x4_save_bindings`：已保存的 binding 记录，含 `gameGuid: "CB8837FE-98C1-42F8-9D6A-ED0ADC539111"`，5 个 sector groups，7 个 station plans
- `x4_empire_data`：3 个 empires
- `x4_logic_flow_plans`：对应的 logic flow plans

### save.json

路径：`tests/fixtures/save/save.json`

从 `save_009.json` 裁剪而来（脚本：`analysis/scripts/trim_save_for_e2e.py`）。仅保留有 `player_stations` 的 22 个 sector，大小约 1MB。

关键要求：`meta.parser_version` 必须为 `"v9"`（与 store `CURRENT_PARSER_VERSION` 匹配），否则 `isValid` 为 false，`initAutoGroupDraft()` 会跳过计算。

### db.json (save bindings)

### 加载 fixture

**推荐方式**：使用 `loadLiveBindingFixture(page)` (位于 `tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts`)：

```ts
import { loadLiveBindingFixture } from '../helpers/loadLiveBindingFixture'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
})
```

此 helper 处理：
1. 注入 `db.json` 到 localStorage
2. 构建 `x4_save_archives` state
3. 写入 save 数据到 IndexedDB
4. reload 并等待 `#debug-ready-marker`
5. 切换到 live-production 视图

**语言设置**：必须通过 UI selector 设置（不能直接操作 localStorage），可在 `loadLiveBindingFixture` 后追加：

```ts
const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
await langSelect.selectOption('zh-CN')
```

### 需要新增的 fixture

当前 `db.json` 已有完整 binding 数据（5 groups），适合测试 incremental 模式。如需测试 clean slate 模式（无已有 groups），需要构造不含 `x4_save_bindings` 的 fixture 或清除 binding 数据。

## UI 入口与导航

### 进入 auto-sector-group 面板

1. 切换到 Live Production 视图：点击 `[data-testid="top-view-btn-live-production"]`
2. 在 sidebar 选择自动星区分组入口：点击 `[data-testid="sidebar-auto-sector-group"]`
3. 面板以三列布局展示：Col 1 (SectorGroupList)、Col 2 (AutoSectorBar + 编辑区)、Col 3 (assignments / bridge / trade station)

### 关键 UI 区域

| 区域 | 组件 | 定位线索 |
|------|------|----------|
| Col 1 | `SectorGroupList` / `SectorGroupCard` | `.sector-group-card` 或 group 名称文本 |
| Col 2 | `AutoSectorBar` / 参数栏 | jumpRange 滑动条、[计算] 按钮、[编辑] 按钮 |
| Col 3 | `SectorAllocationList` / `SectorTradeStationList` | assignment cards、bridge cards、trade station cards |
| Hub 添加 | 独立 overlay | [添加] 按钮触发，fixed overlay 展示 |

### 编辑态进入/退出

- **进入**：[编辑] 按钮，位于 SectorGroupStatBar（非 AutoSectorBar），仅在 result 模式显示
- **退出**：[退出] 按钮（i18n key: `sector.exit`），位于 SectorGroupStatBar，切回 result 模式
- 编辑态不创建恢复 snapshot；[退出] 只切 mode，不恢复 draft

### 确认流程

- [确定] 按钮在 AutoSectorBar 顶部栏（i18n key: `sector.confirm` → "确定"，非 "确认"）
- 需 bridge、assignment、trade station 全部解决后才 enabled
- 确认后 Col 3 切换为 `EmpireWareFlowsDashboard`

### 文本匹配（i18n 优先）

```ts
// 中英双语匹配（注意：确认按钮文本是 "确定"，不是 "确认"）
page.getByRole('button', { name: /确定|Confirm/i })
page.getByRole('button', { name: /编辑|Edit/i })
page.getByRole('button', { name: /计算|Calculate/i })
page.getByRole('button', { name: /退出|Exit/i })
page.getByRole('button', { name: /添加|^Add$/ })
```

### CSS class 参考

| Class | 用途 |
|-------|------|
| `.group-item` | group card（非 `.sector-group-card`） |
| `.group-item--new` | 新添加的 group |
| `.group-item--baseline` | 来自 editing 前的 baseline group |
| `.group-item--pinned` | 已固定 group |
| `.group-item--unpinned` | 已取消固定 group |
| `.pill--coverage` | coverage sector pill |
| `.pill--candidate` | candidate sector pill |
| `.pill--connected` | connected group pill |
| `.pill--anchor` | anchor sector pill |
| `.pill--trade-station` | trade station pill |
| `.pill--baseline` / `.pill--new` / `.pill--removed` | baseline diff 标记 pill |
| `.pill-action--remove` | pill × 按钮 |
| `.pill-action--add` | pill + 按钮 |
| `.pill-action--transfer` | pill → 按钮 |
| `.retain-chk` | retain checkbox 容器 |
| `.allocation-card` | assignment card |
| `.allocation-card.card-auto` | auto resolved |
| `.allocation-card.card-uncertain` | unresolved |
| `.allocation-card.card-standalone` | standalone |
| `.trade-station-card` | trade station card |
| `.trade-station-card .candidate-item` | candidate row |
| `.trade-station-card .candidate-item--selected` | 已选中 |
| `.trade-station-card .candidate-item--virtual` | 虚拟站 |
| `.bridge-plan-card` | bridge plan card |
| `.bridge-plan-card--recommended` | 推荐标记 |
| `.hub-add-menu` / `.hub-add-menu--overlay` | hub 添加菜单 |
| `.hub-add-menu-item` | 菜单项 |
| `.hub-add-menu-item[disabled]` / `.hub-add-menu-item.orange` | 不可选 |
| `.auto-sector-bar` | AutoSectorBar 容器 |
| `.stat-bar` | SectorGroupStatBar 容器 |
| `.supply-tab` | sector 分类 tab（用于 sector-overview 面板） |
| `.station-tab` | station tab |

## Store 暴露（E2E 访问）

在 dev/test 模式下，stores 通过 `window` 暴露：

| window 属性 | 对应 store |
|-------------|-----------|
| `liveStore` | useLiveProductionStore |
| `saveStore` | useSaveStore |
| `saveBindingStore` | useSaveBindingStore |
| `activeViewStore` | useActiveViewStore |
| `gameDataStore` | useGameDataStore |

```ts
// 读取 live store 的 auto group result
const autoResult = await page.evaluate(() => {
  return (window as any).liveStore?.autoGroupResult
})

// 读取 save binding 的持久化数据
const binding = await page.evaluate(() => {
  return (window as any).saveBindingStore?.draftBinding
})
```

## 断言策略

### 可见性断言

```ts
// 验证元素可见
await expect(locator).toBeVisible()

// 验证元素不可见
await expect(locator).toBeHidden()

// 验证按钮 disabled/enabled
await expect(button).toBeDisabled()
await expect(button).toBeEnabled()
```

### 内容断言

```ts
// 验证包含文本
await expect(page.locator('.sector-group-card')).toContainText('小行星')

// 验证计数
await expect(page.locator('.sector-group-card')).toHaveCount(5)

// 验证 checkbox 状态
await expect(checkbox).toBeChecked()
await expect(checkbox).not.toBeChecked()
```

### 数据一致性断言

```ts
// 通过 store 验证持久化后的数据
const groups = await page.evaluate(() => {
  return window._saveBindingStore?.draftBinding?.groups
})
expect(groups.length).toBe(expectedCount)
expect(groups[0].tradeStation).toEqual(expectedTradeStation)
```

### 拖拽测试（vuedraggable）

参考 x4-drag-test skill。vuedraggable 使用 Sortable.js，需要用 Playwright Mouse API 模拟：

```ts
// 拖拽 group card 排序
const source = page.locator('.sector-group-card').first()
const target = page.locator('.sector-group-card').nth(2)
const sourceBox = await source.boundingBox()
const targetBox = await target.boundingBox()
await page.mouse.move(sourceBox.x + sourceBox.width/2, sourceBox.y + sourceBox.height/2)
await page.mouse.down()
await page.mouse.move(targetBox.x + targetBox.width/2, targetBox.y + targetBox.height/2, { steps: 10 })
await page.mouse.up()
```

## 关键领域规则

### 计算模式状态

- `calculationMode: 'result'` — 展示计算结果，非编辑
- `calculationMode: 'edit'` — 编辑输入态

### Group 的 baseline vs new

- `baseline=true`：来自进入编辑态前的 group，unpin 后保留展示但不参与计算，不可删除
- `isNew=true && baseline=false`：手动新增 hub，可以删除

### Hub 容量

- 只统计 container cargo
- 合并 modules[] 和 constructions[]
- 公式：`cap / (1 + ln(1 + prod_lines))`

### Assignment bucket

- `resolved`：已有默认值或用户已选择
- `unresolved`：等距 tie（score 差距 < 30%）

### Bridge plan

- 多 plan：gate ordinary assignments
- 单 plan：自动采用

### Trade station 类型

- `type: 'player'` + `stationCode`：玩家站
- `type: 'virtual'` + `stationCode: '__virtual__'`：虚拟交易站（UI 层）

### 持久化规则

- 虚拟站 `__virtual__` 不写入持久化 `saveStationCode`
- 确认后虚拟站的 sectorMacro 固定为 group hub sectorMacro
- 带 `saveStationCode` 的 save station plans 不受虚拟站同步流程影响

## beforeEach 关键修复

### 问题：db.json storage key 不匹配

`db.json` fixture 使用旧 key（`x4_save_bindings`、`x4_save_archives`），而 stores 读取 v9 key（`x4_save_bindings_v9`、`x4_save_archives_v9`）。必须在 `loadLiveBindingFixture` 之后手动迁移。

```ts
// 在 beforeEach 中：
await page.evaluate(() => {
  const pairs = [
    ['x4_save_bindings', 'x4_save_bindings_v9'],
    ['x4_save_archives', 'x4_save_archives_v9'],
    ['x4_empire_data', 'x4_empire_data_v9'],
  ]
  for (const [oldKey, newKey] of pairs) {
    const val = localStorage.getItem(oldKey)
    if (val) localStorage.setItem(newKey, val)
  }
  // 还原 activeBinding（store auto-save 可能已将其清为 null）
  localStorage.setItem('x4_station_active_view', JSON.stringify({
    activeBinding: gameGuid,
    activeView: 'live-production'
  }))
})
await page.reload()
```

`activeViewStore` 初始化后会 auto-save 状态回 localStorage，可能将 `activeBinding` 覆盖为 null。必须在 migration reload 后重新设置。

### 问题：save.json parser_version 不匹配

store 要求 `parser_version === 'v9'`（定义在 `src/workers/saveParser.post.ts:69`），旧 fixture 使用 `'v7'`。需要用 `analysis/scripts/trim_save_for_e2e.py` 从 `save_009.json`（自带 `parser_version: 'v9'`）重新裁剪：

```bash
python3 analysis/scripts/trim_save_for_e2e.py save_009.json tests/fixtures/save/save.json
```

裁剪后只保留有 `player_stations` 的 sector（约 22 个），大小从 ~6MB 降至 ~1MB。

### 问题：autoGroupResult 不会自动计算

`loadLiveBindingFixture` 后 store 初始化流程中 `activateBinding` 可能失败（binding/archive 未就绪），`autoGroupResult` 保持 null。需在 beforeEach 末尾手动触发：

```ts
await page.evaluate(async (gameGuid: string) => {
  const w = window as any
  const sb = w.saveBindingStore
  const ss = w.saveStore
  const av = w.activeViewStore

  if (av) av.activeBinding = gameGuid
  if (sb?.createOrOpenBinding) sb.createOrOpenBinding(gameGuid)

  // selectArchive 是 async 函数，必须 await
  const list = ss?.savedArchivesState?.list
  if (list?.length > 0) {
    const first = list[0]
    if (ss?.selectArchive) await ss.selectArchive(first.guid, first.time)
  }
}, GAME_GUID)
await page.waitForTimeout(300)

await page.evaluate(() => {
  const w = window as any
  if (w.liveStore?.initAutoGroupDraft) w.liveStore.initAutoGroupDraft()
})
await page.waitForTimeout(500)
```

关键点：
- `selectArchive` / `selectArchiveGroup` 是 **async** 函数，必须 await
- `selectArchive(guid, time)` 比 `selectArchiveGroup(guid)` 更可靠（直接使用 full archive ID）
- 之后调用 `initAutoGroupDraft()` 生成 `autoGroupResult`

### 正确的 window store 名称

| window 属性 | 对应 store |
|-------------|-----------|
| `liveStore` | useLiveProductionStore |
| `saveStore` | useSaveStore |
| `saveBindingStore` | useSaveBindingStore |
| `activeViewStore` | useActiveViewStore |
| `gameDataStore` | useGameDataStore |

**注意**：实际暴露的名称是 `liveStore` 等（不带 `_` 前缀），`_liveProductionStore` 等不存在。

## E2E 测试实现路径

测试文件应放在 `tests/e2e/auto-sector-group-one-core/` 目录。

建议按 e2e_test_tasks.md 的章节结构分文件：

```
tests/e2e/auto-sector-group-one-core/
├── 1-grouping-connections.spec.ts    # 自动分组与连接
├── 2-edit-assignment.spec.ts         # 编辑态与 Assignment
├── 3-hub-add-delete.spec.ts          # Hub 添加/删除
├── 4-trade-station.spec.ts           # Trade Station
├── 5-confirm-persist.spec.ts         # Confirm 写入
└── 6-regression.spec.ts              # 回归风险
```

亦可不拆分，使用 `test.describe` 组织为单个文件中的多个 suite。
