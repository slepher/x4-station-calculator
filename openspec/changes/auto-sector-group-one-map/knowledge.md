# auto-sector-group-one-map E2E Knowledge

## 导航路径

### 从 live-production 进入 map binding-sector

```
loadLiveBindingFixture(page)
→ page 位于 live-production
→ 点击 top-view-btn-maps 切到地图
→ 点击 map-save-panel-tab 打开 save panel
→ save panel 检测到 liveStore.autoGroupResult + activeBinding → 自动切到 binding-sector
→ MapSavePanel 渲染 AutoSectorGroupPanel layout="tabs"
```

### 语言设置

所有测试 beforeEach 必须在 loadLiveBindingFixture 后通过 UI 设置语言:

```typescript
const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
await langSelect.selectOption('zh-CN')
await page.waitForTimeout(500)
```

## Locator 字典

### 全局导航

| 用途 | Locator | 说明 |
|------|---------|------|
| 切换到地图视图 | `page.getByTestId('top-view-btn-maps')` | TopViewSwitch |
| 切换到 live 视图 | `page.getByTestId('top-view-btn-live-production')` | TopViewSwitch |
| 打开/关闭 save panel | `page.getByTestId('map-save-panel-tab')` | MapWorkbenchView 底部 tab |
| save panel 容器 | `page.getByTestId('map-save-panel')` | MapSavePanel aside |
| 关闭 save panel | `page.getByTestId('map-save-panel-close')` | 头部关闭按钮 |
| map 容器 | `page.locator('[data-testid="map-workbench-view"]')` | MapWorkbenchView |
| map 视口 | `page.locator('.map-viewport')` | map render area |

### AutoSectorGroupPanel 内部 (map binding-sector)

| 用途 | Locator | 说明 |
|------|---------|------|
| 面板根元素 | `.auto-sector-group-map-panel` | map tabs layout |
| 顶部参数栏 | `.auto-sector-bar` | 共用的 AutoSectorBar |
| Tab 栏 | `.tab-bar` | 包含所有 tab 按钮 |
| Tab 按钮 | `.tab-btn` | 各 tab 切换按钮 |
| Hub tab | `.tab-btn:has-text("枢纽")` / `.tab-btn:has-text("Hub")` | |
| Allocation tab | `.tab-btn:has-text("分配方案")` / `.tab-btn:has-text("Allocation")` | |
| Trade Station tab | `.tab-btn:has-text("交易站")` / `.tab-btn:has-text("Trade Station")` | |
| Virtual Station tab | `.tab-btn:has-text("虚拟空间站")` / `.tab-btn:has-text("Virtual Station")` | |
| Tab 内容区 | `.tab-content` | 当前激活 tab 内容 |

### Group Card (SectorGroupCard)

| 用途 | Locator | 说明 |
|------|---------|------|
| Group card 列表项 | `.group-item` | 每个 group 的卡片 |
| Group 标题/名称 | `.group-name` | |
| Group 统计信息 | `.group-stats` | |
| 色块 (color swatch) | `[class*="color-swatch"]` / group card 内的颜色方块 | 16×16 色块 |
| Anchor pill | `.pill--anchor` | |
| Coverage pill | `.pill--coverage` | |
| Candidate pill | `.pill--candidate` | |
| Connected pill | `.pill--connected` | |
| Pill action button | `.pill-action--remove`, `.pill-action--add`, `.pill-action--transfer` | |
| Drag handle | `.drag-handle` / group card 的拖拽手柄 | |
| Jump range 显示 | `.jump-readonly` | result 态 |
| Jump range 编辑 | `.jump-control` | edit 态 |
| Pin/delete 按钮 | `.state-btn`, `.state-btn--delete` | |

### 操作按钮 (AutoSectorBar)

| 用途 | i18n 文本匹配 (zh-CN / en) | 说明 |
|------|---------------------------|------|
| 编辑按钮 | `/编辑\|Edit/` | |
| 计算按钮 | `/计算\|Calculate/` | |
| 重置按钮 | `/重置\|Reset/` | |
| 确定按钮 | `/确定\|Confirm/` | |
| 返回按钮 | AutoSectorBar 内左侧返回箭头 | |
| 添加枢纽 | `/添加枢纽\|Add Hub/` 或 `/添加\|^Add$/` | |

### HubAddMenu

| 用途 | Locator | 说明 |
|------|---------|------|
| Hub add popup | `.hub-add-menu` | |
| 定位地图按钮 (仅 map) | `.hub-add-menu` 内包含 `focus-sector` 相关按钮 | 只在 map context 显示 |
| sector 列表项 | `.hub-add-menu-item` | |
| 搜索输入 | `.hub-add-menu-search-input` | |
| 关闭按钮 | `.hub-add-menu-close` | |

### Allocation (SectorAllocationList)

| 用途 | Locator | 说明 |
|------|---------|------|
| Allocation card | `.allocation-card` | |
| 不确定态 card | `.allocation-card.card-uncertain` | unresolved assignment |
| Assignment option row | `.option-row` | |
| Radio checked | `.radio-checked` | |
| Option label | `.option-label` | |
| Sector name (clickable) | `.allocation-card` 内的 sector 名称 | map context emit focus-sector |

### Trade Station (SectorTradeStationList)

| 用途 | Locator | 说明 |
|------|---------|------|
| Trade station card | `.trade-station-card` | |
| Candidate item | `.candidate-item` | |
| Selected candidate | `.candidate-item--selected` | |
| Virtual 选项 | `.candidate-item--virtual` | virtual trade station |
| Trade station coordinates | `.candidate-item--virtual` 内的坐标显示 | |

### Virtual Station Tab

| 用途 | Locator | 说明 |
|------|---------|------|
| Tab 内容容器 | `.virtual-station-tab` | |
| Blueprint empire selector | `.virtual-station-tab` 内的 select/下拉 | |
| Blueprint station 来源 | `.free-station-item` | 可拖拽的 blueprint 空间站 |
| Virtual station 分组 | `.virtual-group` | 按 group 分组 |
| Virtual station 行 | `.virtual-row` | 单个 virtual station |
| 未分组区域 | `.virtual-station-tab` 内包含"移除"文本的 section | |

### Confirm 弹窗

| 用途 | Locator | 说明 |
|------|---------|------|
| 确认弹窗 | `.confirm-popup` | |
| 弹窗背景 | `.confirm-popup-backdrop` | |

### Confirm 完成态

| 用途 | Locator | 说明 |
|------|---------|------|
| 进入 station binding 按钮 | 每个 group card 上的按钮 | 完成态显示 |

### Map Overlay

| 用途 | Locator | 说明 |
|------|---------|------|
| Map SVG canvas | `[data-testid="map-svg-canvas"]` | |
| Sector group color 六边形 | SVG 内代表 hub color 的六边形元素 | 2/3 半径内部六边形 |

## 常见操作模式

### 1. 进入 map binding-sector (完整 setup)

```typescript
test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
  // 通过 UI 设置语言
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
  await page.waitForTimeout(500)
  // 切换到地图
  await page.getByTestId('top-view-btn-maps').click()
  await page.waitForTimeout(1000)
  // 打开 save panel (auto-switch to binding-sector)
  await page.getByTestId('map-save-panel-tab').click()
  await page.waitForTimeout(1000)
  // 确认 save panel 可见
  await expect(page.getByTestId('map-save-panel')).toBeVisible()
})
```

### 2. Tab 切换

```typescript
// 切换到 Hub tab
await page.locator('.tab-btn:has-text("枢纽")').click()
await page.waitForTimeout(300)

// 验证 tab 激活
await expect(page.locator('.tab-btn:has-text("枢纽")')).toHaveClass(/active/)
```

### 3. 检查编辑态 gate

```typescript
// 进入编辑态
await page.locator('.auto-sector-bar').getByText(/编辑|Edit/).click()
await page.waitForTimeout(500)

// Allocation tab 应该 disabled
await expect(page.locator('.tab-btn:has-text("分配方案")')).toBeDisabled()
// Trade Station tab 应该 disabled
await expect(page.locator('.tab-btn:has-text("交易站")')).toBeDisabled()
// Virtual Station tab 应该仍然可用
await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).not.toBeDisabled()
```

### 4. Color picker 交互

```typescript
// 进入编辑态
// 点击 group card 上的色块
await page.locator('.group-item').first().locator('[class*="color"]').first().click()
// 等待 SketchPicker popover 出现
await page.locator('.sketch-picker, [class*="color-picker"]').first().waitFor({ state: 'visible', timeout: 3000 })
// 点击一个预设色
await page.locator('.sketch-picker [class*="preset"] div').first().click()
// 验证 popover 关闭
```

### 5. Drag sort (使用 vuedraggable + Playwright Mouse API)

```typescript
// 获取两个 group card 的 bounding box
const sourceCard = page.locator('.group-item').first()
const targetCard = page.locator('.group-item').last()
const sourceBox = await sourceCard.boundingBox()
const targetBox = await targetCard.boundingBox()
if (!sourceBox || !targetBox) throw new Error('Box not found')

// 定位 drag handle
const dragHandle = sourceCard.locator('[class*="drag-handle"]')
const handleBox = await dragHandle.boundingBox()

// 拖拽
await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
await page.mouse.down()
await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 10, handleBox!.y + handleBox!.height / 2 + 10)
await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 })
await page.mouse.up()
```

### 6. Store state 验证

```typescript
// 检查 autoGroupResult
const result = await page.evaluate(() => {
  return (window as any).liveStore.autoGroupResult
})

// 检查 virtualStationDrafts
const drafts = await page.evaluate(() => {
  return (window as any).liveStore.virtualStationDrafts
})
```

### 7. Confirm 流程

```typescript
// 点击确定按钮
await page.locator('.auto-sector-bar').getByText(/确定|Confirm/).click()
// 如果有未解决的 trade station 或 allocation，会弹出 confirm-popup
// 再次确认
await page.locator('.confirm-popup').getByText(/确定|Confirm/).click()
await page.waitForTimeout(1000)
// 验证进入确认态：draft tabs 隐藏，显示 station binding 按钮
await expect(page.locator('.tab-bar')).not.toBeVisible()
```

## 数据与状态说明

### loadLiveBindingFixture 提供的数据

- **Active binding**: gameGuid `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`
- **5 groups**: "小行星", "神圣眼光", "阿尔忒弥斯的朦胧", "月之舟", "警惕凝视"
- **7 station plans**: 含 saveStationCodes (KXN-018, RWC-785, XAJ-926, AVE-937, MGO-010, EOF-448, +1 virtual)
- **autoGroupResult**: 根据 binding 数据构建，处于 result/confirmed 状态
- **Live production 已初始化**: `liveStore.autoGroupResult` 已就绪

### 关键 store 暴露 (window)

| Store | window 属性 |
|-------|------------|
| liveStore | `window.liveStore` |
| saveBindingStore | `window.saveBindingStore` |
| saveStore | `window.saveStore` |
| activeViewStore | `window.activeViewStore` |

### AutoGroupResult 结构 (result mode)

- `groups`: `BindingSectorGroup[]`
  - 每个 group 有 `sectorMacro`, `name`, `coverage`, `connectedGroupIds`, `jumpRange`, `color`, `isPinned`
- `assignments`: sector → group 分配关系
- `connections`: group 间连接信息
- `bridgePlans`: 桥接方案
- `tradeStationCandidates`: 交易站候选
- `coverageByGroupId`: group → coverage sectors 映射
