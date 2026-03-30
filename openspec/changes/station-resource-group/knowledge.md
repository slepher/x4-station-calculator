# station-resource-group Knowledge

## UI 锚点

### 载入组件

| 锚点 | testid | locator | 说明 |
|------|--------|---------|------|
| 载入按钮 | `map-resource-advanced-loader-trigger` | `page.getByTestId('map-resource-advanced-loader-trigger')` | 点击打开/关闭载入菜单 |
| 载入菜单 | `map-resource-advanced-loader-menu` | `page.getByTestId('map-resource-advanced-loader-menu')` | fixed 定位的下拉菜单 |
| 星区项 | `map-resource-advanced-loader-sector-{sector.id}` | `page.getByTestId('map-resource-advanced-loader-sector-sector-1')` | 星区载入选项 |
| 逻辑组网项 | `map-resource-advanced-loader-logicflow-{plan.id}` | `page.getByTestId('map-resource-advanced-loader-logicflow-logic-flow-1')` | 逻辑组网存档载入选项 |

### 相关组件

| 锚点 | testid | locator | 说明 |
|------|--------|---------|------|
| 新增组按钮 | `map-resource-advanced-add-group` | `page.getByTestId('map-resource-advanced-add-group')` | 位于载入按钮左侧 |
| 刷新按钮 | `map-resource-advanced-refresh` | `page.getByTestId('map-resource-advanced-refresh')` | 位于 pending 提示右侧 |
| 组卡片 | `.advanced-group-card` | `page.locator('.advanced-group-card')` | 组列表项 |
| 组标签 | `map-resource-advanced-summary-tag-{group.id}-{tagId}` | `page.getByTestId('map-resource-advanced-summary-tag-group_1-ore')` | 组摘要中的资源标签 |

### 菜单分组标题

| 标题 | locator (zh-CN) | locator (en) |
|------|-----------------|--------------|
| 星区分组 | `.loader-menu-group-title` 含 "星区" | `.loader-menu-group-title` 含 "Sectors" |
| 逻辑组网分组 | `.loader-menu-group-title` 含 "逻辑组网" | `.loader-menu-group-title` 含 "Logic Flow" |

### 空列表提示

| 提示 | locator (zh-CN) | locator (en) |
|------|-----------------|--------------|
| 无星区 | `.loader-menu-empty` 含 "没有资源需求的星区" | `.loader-menu-empty` 含 "No sectors with resource demand" |
| 无逻辑组网 | `.loader-menu-empty` 含 "没有 tier0 资源需求的存档" | `.loader-menu-empty` 含 "No logic flow plans with tier0 demand" |

### 载入按钮状态

| 状态 | 文本 (zh-CN) | 文本 (en) | locator |
|------|-------------|-----------|---------|
| 自定义 | "自定义" | "Custom" | `.loader-trigger-label` |
| 已载入星区 | 星区名称 | Sector name | `.loader-trigger-label` |
| 已载入存档 | 存档名称 | Plan name | `.loader-trigger-label` |

### 刷新按钮行

| 锚点 | class | locator | 说明 |
|------|-------|---------|------|
| 刷新行容器 | `.advanced-refresh-row` | `page.locator('.advanced-refresh-row')` | 包含 pending 提示和刷新按钮 |
| pending 提示 | `.advanced-pending` | `page.locator('.advanced-pending')` | 左对齐 |
| 刷新按钮 | `.advanced-refresh-btn` | `page.locator('.advanced-refresh-btn')` | 右对齐 |

## Fixture 数据映射

### 星区数据

来源: `tests/fixtures/db.json` → `x4_empire_data.list[].sectors[]`

| fixture id | name (CN) | 示例 locator |
|------------|-----------|--------------|
| `sector-1` | "星区 1" | `getByTestId('map-resource-advanced-loader-sector-sector-1')` |

### 空间站数据

来源: `tests/fixtures/db.json` → `x4_empire_data.list[].stations[]`

| fixture id | name | sectorId | 模块 |
|------------|------|----------|------|
| `empire-1-station-1` | E1-S1 | sector-1 | claytronics, hullparts |
| `empire-1-station-2` | E1-S2 | sector-1 | quantumtubes |
| `empire-1-station-3` | E1-S3 | sector-1 | foodrations, medicalsupplies |

### 逻辑组网存档数据

来源: `tests/fixtures/db.json` → `x4_logic_flow_plans.list[]`

| fixture id | name (CN) | 示例 locator |
|------------|-----------|--------------|
| `logic-flow-1` | Logic Flow 1 | `getByTestId('map-resource-advanced-loader-logicflow-logic-flow-1')` |
| `logic-flow-2` | Logic Flow 2 | `getByTestId('map-resource-advanced-loader-logicflow-logic-flow-2')` |

### 逻辑组网组数据

来源: `tests/fixtures/db.json` → `x4_logic_flow_plans.list[].groups[]`

| fixture id | name | nodes | tier0 资源预期 |
|------------|------|-------|----------------|
| `lf-1-g1` | E1-S1 | claytronics, hullparts, isolated:quantumtubes | ore, silicon, methane (energycells filtered) |
| `lf-1-g2` | E1-S2 | quantumtubes | ore, silicon, helium |
| `lf-1-g3` | E1-S3 | foodrations, medicalsupplies | ice, ore, silicon, methane, water |

### 资源数据

来源: `tests/fixtures/ware_fixtures.yaml`

| ware id | name (CN) | tier | 说明 |
|---------|-----------|------|------|
| `ore` | 金属矿石 | 0 | tier0 资源 |
| `silicon` | 硅 | 0 | tier0 资源 |
| `ice` | 冰 | 0 | tier0 资源 |
| `methane` | 甲烷 | 0 | tier0 资源 |
| `helium` | 氦 | 0 | tier0 资源 |
| `hydrogen` | 氢 | 0 | tier0 资源 |
| `energycells` | 能量电池 | 0 | 被过滤，不在组标签中 |

## 测试模式

### 载入流程模式

```typescript
// 打开载入菜单
await page.getByTestId('map-resource-advanced-loader-trigger').click()
await expect(page.getByTestId('map-resource-advanced-loader-menu')).toBeVisible()

// 载入星区
await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()

// 载入逻辑组网存档
await page.getByTestId('map-resource-advanced-loader-logicflow-logic-flow-1').click()
```

### 点击外部关闭菜单模式

```typescript
// 打开菜单
await page.getByTestId('map-resource-advanced-loader-trigger').click()
await expect(page.getByTestId('map-resource-advanced-loader-menu')).toBeVisible()

// 点击面板外部（菜单外部）
await page.locator('.map-workbench').click({ position: { x: 10, y: 10 } })
await expect(page.getByTestId('map-resource-advanced-loader-menu')).not.toBeVisible()
```

### 刷新按钮状态检查模式

```typescript
// 载入后刷新按钮行隐藏
await page.getByTestId('map-resource-advanced-loader-sector-sector-1').click()
await expect(page.locator('.advanced-refresh-row')).not.toBeVisible()

// 修改配置后刷新按钮行显示
await page.locator('.advanced-group-card').first().locator('button:has-text("编辑")').click()
await page.locator('[data-testid$="-ore"]').first().click()
await expect(page.locator('.advanced-refresh-row')).toBeVisible()
```

## i18n 文本映射

| key | zh-CN | en |
|-----|-------|-----|
| `map.resource_filter_loader_custom` | 自定义 | Custom |
| `map.resource_filter_loader_group_sectors` | 星区 | Sectors |
| `map.resource_filter_loader_group_logicflow` | 逻辑组网 | Logic Flow |
| `map.resource_filter_loader_no_sectors` | 没有资源需求的星区 | No sectors with resource demand |
| `map.resource_filter_loader_no_logicflow` | 没有 tier0 资源需求的存档 | No logic flow plans with tier0 demand |

## 测试运行

### 测试结果 (2024-03-31)

| Case | 状态 | 说明 |
|------|------|------|
| 1.1-1.3 | [✓] | 单元测试全部通过 |
| 2.1-2.4 | [✓] | 状态和切换测试全部通过 |
| 3.1-3.12 | [✓] | 场景测试全部通过 |

### 关键修复

1. **测试代码重复点击问题**: 菜单是 toggle 模式，连续调用 `transitionAdvancedToLoaderMenuOpen` 和 `buildLoaderMenuOpen` 会导致点击两次（打开→关闭）。修复：场景测试只调用一个 helper。

2. **异步断言问题**: `locator.count()` 返回 Promise，必须 await 后再断言：
   ```typescript
   // 错误
   await expect(locator.count()).toBeGreaterThan(0)
   
   // 正确
   const count = await locator.count()
   await expect(count).toBeGreaterThan(0)
   ```

3. **点击外部关闭菜单**: 点击 `.map-workbench` 可能不会触发全局 mousedown 事件。改用 `page.locator('body').click()` 更可靠。

### 测试入口按钮

正确的入口按钮是 `map-resource-panel-tab`（在地图视图左侧），不是 `map-resource-entry-button`（在 overlay 模式下使用，sidebar 模式下隐藏）。

```typescript
// beforeEach 设置
await page.getByTestId('map-resource-panel-tab').click()  // 打开资源面板 sidebar
await page.getByTestId('map-resource-tab-advanced').click()  // 切换到高级模式
```