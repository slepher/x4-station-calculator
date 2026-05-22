# LiveStationToolbar 知识库

## UI 锚点映射

### 模式切换按钮

| 元素 | 选择器 | 描述 |
|-----|--------|------|
| 模式切换按钮 | `.mode-toggle-chip` | toggle-chip 样式按钮, 切换实时/规划模式 |
| 模式状态文本 | `.mode-toggle-chip .chip-status` | 显示 '实时' 或 '规划' |
| 模式图标 | `.mode-toggle-chip .mode-icon` | 显示 📡(实时) 或 📝(规划) |

### 规划控件

| 元素 | 选择器 | 描述 |
|-----|--------|------|
| 偏好种族下拉 | `.race-select` | 规划模式下可见, 实时模式下隐藏 |
| 工人运算开关 | `.toggle-chip` (workforce 区域) | 显示 ON/OFF 状态 |
| 显示缺口开关 | `[data-testid="toggle-show-empire-gaps"]` | 显示 ON/OFF 状态 |

### 只读字段

| 元素 | 选择器 | 描述 |
|-----|--------|------|
| 站点编码 | `.readonly-pill` | 显示存档 station 的 code |
| 星区名称 | `.sector-popover` 前的输入组 | 点击弹出坐标 popover |
| 星区资源 | `.resources-popover` 前的输入组 | 点击弹出资源列表 popover |
| 光伏效率 | `.count-pill` (sunlight 区域) | 显示百分比数值 |

### 状态样式

| 状态 | CSS 类 | 描述 |
|-----|--------|------|
| 规划模式激活 | `.active-planning` | amber 色系 border |
| 实时模式激活 | `.active-live` | sky 色系 border |
| 不可切换 | `.no-toggle` | cursor-default 状态 |

## Fixture 数据映射

### 站点数据

| 测试场景 | 站点名称 | 数据状态 | bindingStation | saveStation | 预期模式 | 可切换 |
|---------|---------|---------|----------------|-------------|---------|-------|
| Case 3.1/3.4 | 地球人 | 双数据源 | 有 (id: `d8e8a897...`) | 有 (code: KXN-018) | 规划 | 可 |
| Case 3.2 | 新建空间站 | 仅binding | 有 (id: `f36126e5...`) | 无 | 规划 | 不可 |
| Case 3.3/3.5 | PPW-916 | 仅save | 无 | 有 (code: PPW-916) | 实时 | 可 |

### Binding GUID

| 属性 | 值 |
|-----|---|
| gameGuid | `CB8837FE-98C1-42F8-9D6A-ED0ADC539111` |
| bindingName | `slepher` |

### 星区数据

| 站点 | 星区名称 | sectorMacro |
|-----|---------|-------------|
| 地球人 | 小行星 | `cluster_100_sector001_macro` |
| 新建空间站 | 小行星 | `cluster_100_sector001_macro` |
| PPW-916 | 神圣眼光 | `cluster_24_sector001_macro` |

## Playwright 定位策略

### 模式断言函数

```typescript
async function assertModeState(page, expectedMode: 'live' | 'planning', canToggle: boolean) {
  const modeBtn = page.locator('.mode-toggle-chip')
  await expect(modeBtn).toBeVisible()
  
  if (canToggle) {
    await expect(modeBtn).toBeEnabled()
  } else {
    await expect(modeBtn).toBeDisabled()
  }
  
  const modeText = await modeBtn.locator('.chip-status').textContent()
  // 中文环境: expectedMode === 'live' -> '实时'
  // 英文环境: expectedMode === 'live' -> 'Live'
}
```

### 规划控件可见性检查

```typescript
async function assertPlanningControlsVisible(page, visible: boolean) {
  const raceSelect = page.locator('.race-select')
  if (visible) {
    await expect(raceSelect).toBeVisible({ timeout: 500 })
  } else {
    await expect(raceSelect).toBeHidden({ timeout: 500 })
  }
}
```

### 站点选择流程

```typescript
async function selectStationInSector(page, sectorName: string, stationName: string) {
  const supplyTab = page.locator('.supply-tab').filter({ hasText: sectorName })
  await expect(supplyTab).toBeVisible({ timeout: 5000 })
  await supplyTab.click()
  await page.waitForTimeout(500)
  
  const stationTab = page.locator('.station-tab').filter({ hasText: stationName })
  await expect(stationTab).toBeVisible({ timeout: 5000 })
  await stationTab.click()
  await page.waitForTimeout(300)
}
```

## i18n 键映射

| UI 文本 | 中文 | 英文 | i18n key |
|---------|-----|------|---------|
| 实时 | 实时 | Live | `toolbar.mode_live` |
| 规划 | 规划 | Planning | `toolbar.mode_planning` |
| 星区 | 星区 | Sector | `toolbar.sector` |
| 坐标 | 坐标 | Position | `toolbar.position` |
| 无坐标数据 | 无坐标数据 | No position data | `toolbar.no_position` |
| 星区资源 | 星区资源 | Sector Resources | `toolbar.sector_resources` |
| 光伏效率 | 光伏效率 | Sunlight Efficiency | `toolbar.sunlight_efficiency` |

## 测试设置流程

### beforeEach 标准流程

1. 加载 fixture: 读取 `tests/fixtures/db.json` 到 localStorage (排除 vsn)
2. reload: 重新加载页面以初始化 store
3. 设置语言: 通过 UI 选择器设置当前语言

### Live Production 数据初始化

```typescript
// 导入存档数据
await importSaveArchives(page)
// 设置活动 binding
await setupActiveBinding(page)
// 切换到 Live Production 视图
await switchToLiveProduction(page)
// 选择站点
await selectStationInSector(page, sectorName, stationName)
```

## 组件位置

- `src/components/empire/context_toolbar/LiveStationToolbar.vue`

## 测试覆盖说明

### 测试范围

| 类别 | Case | 覆盖内容 |
|-----|------|---------|
| 模式切换 | 3.1-3.4 | 原 mode-toggle.spec.ts 测试整合 |
| UI 展示 | 3.5 | Toolbar 布局结构验证 |
| Popover | 3.6, 3.7 | 星区坐标/资源 popover |
| 规划控件 | 3.8, 3.9 | 显示/隐藏状态，可编辑验证 |

### Popover 选择器

| Popover 类型 | 选择器 | 触发方式 |
|-------------|--------|---------|
| 星区坐标 | `.sector-popover` | 点击星区字段 `.input-group` (hasText: 星区/Sector) |
| 星区资源 | `.resources-popover` | 点击资源字段 `.input-group` (hasText: 星区资源/Sector Resources) |