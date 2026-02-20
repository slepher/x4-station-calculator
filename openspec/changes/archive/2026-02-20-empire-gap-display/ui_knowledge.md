# UI Knowledge: Empire Gap Display

本文档记录 `empire-gap-display` 功能测试所需的 UI 定位器和交互流程。

## 0. 分组产生条件（重要）

**帝国运营**：来自产品 + 运营，满足 `netRate < 0` 或 `priority > 0` 的项。
- 例如：电子黏土产线锁定量子管，量子管成为帝国运营

**帝国补给**：来自补给组，满足 `netRate < 0`，或 `netRate > 0` 且在当前站 `plannedModules` 中存在对应模块。
- 例如：开启工人运算后，食物配给、医疗物资进入帝国补给

## 1. 显示缺口开关

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 开关按钮 | `.toggle-chip` | 与"工人运算"、"站内补给"相同的开关样式 |
| 开关状态 | `.toggle-chip.active-green` | ON 状态 |
| 开关位置 | 技术与运营组，"站内补给"旁边 | - |
| 开关按钮（稳定） | `[data-testid="toggle-show-empire-gaps"]` | 推荐使用，避免文案匹配失效 |

### 交互流程
```typescript
// 切换显示缺口开关
const toggle = page.locator('[data-testid="toggle-show-empire-gaps"]');
await toggle.click();

// 验证开关状态
await expect(toggle).toHaveClass(/active-green/);
```

## 2. 帝国运营/补给分组

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 分组容器 | `.empire-gap-group` | 分组容器（复用 `EmpireWareFlowGroup`） |
| 帝国运营标题 | `.empire-gap-group` + `hasText: /帝国运营/` | - |
| 帝国补给标题 | `.empire-gap-group` + `hasText: /帝国补给/` | - |
| 分组项 | `.flow-wrapper` | 复用 `EmpireWareFlow` 的容器 |
| - 按钮 | `.remove-btn` | 减少模块按钮（新增在 `EmpireWareFlow` 中） |
| + 按钮 | `.add-btn` | 添加模块按钮（新增在 `EmpireWareFlow` 中） |

### 显示条件
- 仅在资源视图 (`viewMode === 'quantity'`) 显示
- 经济视图 (`viewMode === 'economy'`) 不显示
- 体积视图 (`viewMode === 'volume'`) 不显示
- 分组为空时不显示

### 交互流程
```typescript
// 验证分组显示（资源视图）
const operationsGap = page.locator('.empire-gap-group').filter({ hasText: /帝国运营/ });
await expect(operationsGap).toBeVisible();

// 点击 + 按钮添加模块
const addBtn = page.locator('.flow-wrapper .add-btn').first();
await addBtn.click();

// 点击 - 按钮减少模块
const removeBtn = page.locator('.flow-wrapper .remove-btn').first();
await removeBtn.click();
```

### 更新验证
- 点击 + 后可通过 `.flow-wrapper[data-resource-id="..."] .value` 文本变化或该行消失确认分组更新。
- 当补给净值转正时，仅在当前站 `plannedModules` 中存在对应模块时保留在“帝国补给”分组。
- 模块数量调整可定位 `.module-row` 内的 `.x4-num-input` 输入框。

## 3. 分组项样式

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 分组项容器 | `.flow-wrapper` | 复用 `EmpireWareFlow` 的容器 |
| 资源名称 | `.header-name` | - |
| 数值 | `.value` | - |
| - 按钮 | `.remove-btn` | 减少按钮，位于 + 左侧 |
| + 按钮 | `.add-btn` | 新增按钮，位置对应锁按钮 |
| 收藏按钮位置 | 无 | 不显示收藏按钮，位置留空 |

### 验证要点
- 分组项不显示收藏按钮
- 收藏按钮位置留空
- - 按钮位于 + 左侧
- + 按钮位于分组项右侧

### 禁用规则
- 当缺口项 `netRate > 0` 时禁用 +
- 当无可用默认产线模块时禁用 +
- 当不存在对应模块时禁用 -

## 4. 视图切换
经济视图不显示分组，仅资源视图显示。

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 视图切换按钮组 | `.view-mode-switcher` | 建议以含“经济/Economy”的按钮组为主 |
| 数量视图按钮 | `.view-mode-switcher` → `.view-mode-btn.nth(0)` | - |
| 经济视图按钮 | `.view-mode-switcher` → `.view-mode-btn.nth(1)` | 缺口不显示 |
| 体积视图按钮 | `.view-mode-switcher` → `.view-mode-btn.nth(2)` | - |

### 交互流程
```typescript
const switcher = page.locator('.view-mode-switcher').filter({ hasText: /经济|Economy/ }).first();

// 切换到资源视图
await switcher.locator('.view-mode-btn').nth(0).click();

// 验证分组显示
await expect(page.locator('.empire-gap-group')).toBeVisible();

// 切换到经济视图
await switcher.locator('.view-mode-btn').nth(1).click();

// 验证分组不显示
await expect(page.locator('.empire-gap-group')).not.toBeVisible();

// 切换到体积视图
await switcher.locator('.view-mode-btn').nth(2).click();

// 验证分组不显示
await expect(page.locator('.empire-gap-group')).not.toBeVisible();
```

## 5. 分组显示顺序

### 验证流程
```typescript
// 获取所有分组
const groups = page.locator('.list-body > *');
const groupCount = await groups.count();

// 验证顺序
// 1. 帝国运营（如果有）
// 2. 帝国补给（如果有）
// 3. 产品
// 4. 运营
// 5. 补给
// 6. 资源
```

### 注意事项
- 资源视图下可能没有“产品”分组标题，若缺失需先确认该分组是否应出现再断言顺序。

## 6. i18n 翻译键

| 键名 | 中文 | 英文 |
|------|------|------|
| `ui.show_empire_gaps` | 显示缺口 | Show Gaps |
| `wareflow.empire_operations` | 帝国运营 | Empire Operations |
| `wareflow.empire_supply` | 帝国补给 | Empire Supply |

## 7. 测试数据与场景

### 标准测试场景

**空间站A**（产生分组数据）：
1. 添加电子黏土产线（搜索 "Clay"）
2. 添加船体部件产线（搜索 "Hull Parts"）
3. 开启"工人运算"开关 → 产生帝国补给（食物配给、医疗物资）
4. 锁定量子管 → 产生帝国运营（量子管）
5. 在空间站B通过“帝国运营/帝国补给”分组的 + 按钮添加对应模块，并将该模块数量提升到较大值（例如 100），验证补给转正后仅在规划内资源保留在分组中

**空间站B**（验证分组显示）：
1. 开启"显示缺口"开关
2. 验证显示"帝国运营"分组（包含量子管）
3. 验证显示"帝国补给"分组（包含食物配给、医疗物资）
4. 点击量子管的 + 按钮添加模块
5. 若需触发帝国运营排序验证，应在空间站B内添加船体部件产线并通过“帝国运营”分组的 + 按钮添加模块（非在空间站A手动添加）。

**优先级过滤场景**：
1. 在空间站B添加能量电池产线
2. 设置能量电池 priority > 0
3. 开启“显示缺口”后确认能量电池出现在“帝国运营”分组

### 常用模块
| 模块名称 | 搜索关键词 | 说明 |
|----------|------------|------|
| 电子黏土产线 | Clay | 包含量子管、微芯片等上游 |
| 船体部件产线 | Hull Parts | 包含多种上游资源 |
| 能量电池产线 | Energy Cell | 无上游依赖，不产生帝国运营 |

### 无分组场景
- 空站（不添加模块）→ 无帝国运营、无帝国补给

### 关闭工人运算场景
- 电子黏土产线 + 开启工人运算 + 锁定量子管 → 有帝国运营 + 有帝国补给
- 关闭工人运算 → 帝国补给消失，帝国运营保留

## 8. 验证经验（2026-02-20）

- 执行 `tests/e2e/empire-gap-display/empire-gap-display.spec.ts` 时，多个用例在公共前置 `addModuleToStation` 失败。
- 失败点：`.results-popover .result-item` 已可见，但 `click()` 在 1000ms 内超时。
- 影响：除“无缺口时不显示缺口分组”外，其余依赖“添加模块”前置步骤的用例均失败。
- 建议定位策略：
  - 优先使用更稳定的定位器（如基于 `data-testid` 或结果项文本精确匹配）替代 `.results-popover .result-item`.first()。
  - 在点击前增加对 popover 稳定状态的断言（避免过渡/遮挡导致 click 超时）。
