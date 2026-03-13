# resource-pie 测试知识库

## 1 UI 定位符

### 1.1 资源过滤面板

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 资源入口按钮 | `[data-testid="map-resource-entry-button"]` | overlay 模式下打开资源面板 |
| 资源面板标题 | `[data-testid="map-resource-panel-header"]` | sidebar 模式下可见的面板头部 |
| 关闭面板按钮 | `[data-testid="map-resource-close-panel"]` | 关闭资源面板 |
| ore 资源 tag | `[data-testid="map-resource-tag-ore"]` | 矿石资源筛选标签 |
| silicon 资源 tag | `[data-testid="map-resource-tag-silicon"]` | 硅资源筛选标签 |
| 日光 tag | `[data-testid="map-resource-tag-sunlight"]` | 日光筛选标签（显示为 EC） |

### 1.2 地图 SVG 画布

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 地图视口 | `.map-viewport` | 地图容器 |
| 地图 SVG | `.map-viewport svg` | SVG 画布 |
| sector hover 目标 | `.sector-hover-target` | sector 鼠标悬停区域 |
| sector ID 属性 | `[data-sector-hover-id="<sector_id>"]` | 标记 sector 的唯一 ID，用于定位特定 sector |
| 饼图切片 | `[data-testid="resource-pie-slice"]` | 多资源饼图切片元素 |
| sector 多边形 | `[data-sector-hover-id="<sector_id>"] polygon` | sector 单色填充通过父级 ID 定位 polygon 元素 |

### 1.3 测试用 Sector ID

| Sector ID | 名称 | 资源 | 用途 |
|-----------|------|------|------|
| `Cluster_01_Sector001_macro` | Grand Exchange I | ore(14), silicon(8), hydrogen(10), ice(8) | 多资源饼图测试首选目标 |

## 2 数据映射

### 2.1 资源颜色映射

| 资源 ID | 颜色值 | 来源 |
|---------|--------|------|
| ore | `#CF7F54` | regionyields.json |
| silicon | `#A6A6AF` | regionyields.json |
| ice | `#D4F4F4` | regionyields.json |
| methane | `#82D8C9` | regionyields.json |
| hydrogen | `#E6E696` | regionyields.json |
| helium | `#C8E6FF` | regionyields.json |
| nividium | `#E696E6` | regionyields.json |
| sunlight | `#F7D24B` | 默认日光颜色 |

### 2.2 饼图切片数据结构

```typescript
type SectorResourceFill =
  | { mode: 'solid'; ware: string; color: string }
  | { mode: 'pie'; slices: SectorResourceColorSlice[] }

type SectorResourceColorSlice = {
  ware: string
  color: string
  share: number // 0 ~ 1, 总和为 1
}
```

### 2.3 份额计算规则

1. 每个切片最小份额: `minShare = 0.05` (5%)
2. 计算公式:
   - `baseShare = minShare * n` (n = 切片数量)
   - `remainingShare = 1 - baseShare`
   - 若 `totalLevel > 0`: `share = minShare + remainingShare * (level / totalLevel)`
   - 若 `totalLevel = 0`: `share = minShare + remainingShare / n` (均分)
3. 归一化: 最后一个切片份额 = `1 - 前面所有切片份额之和`

## 3 测试语义

### 3.1 饼图触发条件

| 条件 | 渲染模式 |
|------|----------|
| 0 个普通资源选中 | 不触发资源染色 |
| 1 个普通资源选中 | `solid` 单色填充 |
| >= 2 个普通资源选中 | `pie` 饼图切片 |
| 仅日光选中 | `solid` 日光颜色填充 |
| 普通资源 + 日光选中 | `pie` 饼图（日光不参与切片） |

### 3.2 切片顺序规则

切片顺序遵循资源 tag 固定顺序，而非按 sector 实际资源 level 排序:
- ore → silicon → ice → hydrogen → helium → methane

### 3.3 事件映射

| 组件 | 事件名 | Payload |
|------|--------|---------|
| MapResourceFilterPanel | `resource-visual-change` | `{ highlightedSectorIds, sectorFills }` |
| MapResourceFilterPanel | `highlight-change` | `sectorId[]` |
| MapResourceFilterPanel | `panel-open` | 无 |
| MapResourceFilterPanel | `panel-close` | 无 |

## 4 测试场景速查

### 4.1 单元测试函数

| 函数 | 文件位置 | 用途 |
|------|----------|------|
| `buildSectorResourceFill` | `src/store/logic/mapResourceFilter.ts` | 计算 sector 饼图切片数据 |
| `normalizeSliceShares` | `src/store/logic/mapResourceFilter.ts` | 归一化切片份额 |

### 4.2 E2E 测试前置条件

进入地图视图:
```typescript
await page.goto('/?router=maps')
await page.waitForSelector('.map-viewport svg', { timeout: 10000 })
```

打开资源面板:
```typescript
await page.click('[data-testid="map-resource-entry-button"]')
```

设置语言:
```typescript
const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
await langSelect.selectOption('zh-CN')
```

## 5 关键断言模式

### 5.1 饼图切片数量断言

```typescript
const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
const slices = await sector.locator('[data-testid="resource-pie-slice"]').count()
expect(slices).toBeGreaterThanOrEqual(2)
```

### 5.2 单色填充断言

```typescript
const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
const hasPieSlice = await sector.locator('[data-testid="resource-pie-slice"]').count() > 0
expect(hasPieSlice).toBe(false) // 单色填充时无 pie-slice 元素
```

### 5.3 切片颜色断言

```typescript
const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
const firstSlice = sector.locator('[data-testid="resource-pie-slice"]').first()
await expect(firstSlice).toHaveAttribute('fill', '#CF7F54') // ore 颜色
```

### 5.4 单色填充颜色断言

```typescript
const sector = page.locator('[data-sector-hover-id="Cluster_01_Sector001_macro"]')
const polygon = sector.locator('polygon').first()
await expect(polygon).toHaveAttribute('fill', '#CF7F54') // ore 颜色
```

## 6 测试运行

### 6.1 已解决问题

- [✓] 单元测试 1.4/1.5 缺少 `@vitest-environment jsdom` 指令导致 `document is not defined` 错误
- [✓] E2E 测试颜色断言使用错误的颜色值（从 regionyields.json 获取正确颜色: ore=#CF7F54, silicon=#A6A6AF, sunlight=#F7D24B）