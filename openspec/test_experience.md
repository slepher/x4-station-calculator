# 测试经验与定位器知识库 (Test Experience & Locator Knowledge Base)

## 🌲 树形形态记录 (DOM Tree & Locators)

### 1. 全局与通用控件 (Global & Common)
*   **语言切换器**: `select.first()` (✅)
*   **“新建”流程**:
    *   新建按钮: `button:has-text("新建"), button:has-text("New")` (✅)
    *   丢弃确认: `button:has-text("丢弃并新建"), button:has-text("Discard & New")` (✅)
*   **模块搜索**:
    *   搜索框: `input[placeholder*="搜索"], input[placeholder*="Search"]` (✅)
    *   结果项: `.result-item, .module-item` (✅)
    *   模块列表: `.module-list-container` (✅)

### 2. 统一仪表盘 (Dashboard & View Modes)
*   **主容器**: `.list-wrapper` (✅)
*   **激活状态**: `.active` (✅)
*   **视图切换按钮组**:
    *   通用定位: `.view-mode-btn` (✅)
    *   数量视图: `.view-mode-btn.nth(0)` 或 `.filter({ hasText: /数量|Quantity/ })` (✅)
    *   经济视图: `.view-mode-btn.nth(1)` 或 `.filter({ hasText: /经济|Economy/ })` (✅)
    *   仓储视图: `.view-mode-btn.nth(2)` 或 `.filter({ hasText: /仓储|Volume/ })` (✅)
    *   逻辑流视图: `.view-mode-btn.nth(3)` 或 `.filter({ hasText: /逻辑|Logic/ })` (✅)
*   **底部汇总**:
    *   利润总计: `.profit-val` (✅)
    *   经济分组总和: `.economy-group-sum` (✅)

### 3. 资源流项目 (WareFlow & Items)
*   **行容器**: `.flow-wrapper` (✅)
*   **特定标识**: `[data-resource-id="wareId"]` (如 `[data-resource-id="energycells"]`) (✅)
*   **资源名称**: `.header-name` (✅)
*   **主数值**: `.value` (✅) - *注：数量视图显示产量，经济视图显示利润（带 Cr）*
*   **收藏按钮 (FavoriteButton)**:
    *   定位器: `.favorite-btn` (✅)
    *   状态: `.disabled` 表示无可选优先级 (✅)
*   **交互逻辑**:
    *   可点击主行: `.main-row` (✅)
    *   展开状态: `.main-row.is-active` (✅)
    *   明细列表: `.list-box` (✅)
    *   明细项: `.list-item` (✅)
    *   明细数值: `.item-val` (✅)

### 4. 仓储规划专项 (Volume/Storage Specific)
*   **分组系统**:
    *   分组总容器: `.volume-groups-container` (✅)
    *   单组容器: `.group-container` (✅)
    *   组标题: `.group-title` (✅)
    *   组汇总标题 (Summary): `.variant-summary` (✅) - *注：英文为 "Total Build Volume", 中文为 "材料总体积"*
    *   组规划空间: `.volume-group-planning` (✅) - *格式：`\d+m³`*
*   **槽位验证**:
    *   触发容器: `.volume-trigger-container` (✅)
    *   主计数值: `.volume-count-main` (✅) - *注：颜色类 `.text-blue-400`*
*   **详细数据 (Tooltip)**:
    *   容器: `.tippy-box` (✅)
    *   网格布局: `.volume-tooltip-grid` (✅)
*   **缓冲区控制**:
    *   控制区块: `.volume-controls-section` (✅)
    *   滑动条: `input[type="range"]` (✅) - *共 3 个：资源、主要、次要*

### 5. 顶部状态栏 (Stats Bar) & 右侧面板 (Station Dashboard)
*   **统计项**: `.stat-item` (✅)
*   **统计值**: `.stat-value` (✅)
*   **实战匹配文本**: `/建设总成本/`, `/总体积/`, `/工人需求/`, `/建造总用时/`, `/运输船次/`, `/工人效率/` (✅)
*   **状态颜色**: `.text-blue-400` (体积/运输), `.text-emerald-400` (工人) (✅)
*   **汇总标题 (Summary)**: `.variant-summary` (✅) - *注：建设费用下为 "Total Build Cost" / "建设总成本"*
*   **视图切换 (Right Panel)**:
    *   费用视图: `.filter({ hasText: /费用|Cost/ })` (✅)
    *   运输视图: `.filter({ hasText: /运输|Transport/ })` (✅)

### 6. 劳动力与阶级 (Workforce & Tiers)
*   **阶级区块**: `.tier-section.tier-auto` (✅)
*   **阶级页眉**: `.tier-header` (✅)
*   **劳动力选项**: `.workforce-option` (✅)
*   **选项图标**: `.option-icon` (✅)
*   **状态勾选框**: `input[type="checkbox"]` (✅)

### FavoriteButton & LockButton 提示框 (Tooltip)
*   **逻辑对象**: 收藏/锁定按钮的提示框
*   **定位器**: `.tippy-box[data-theme~="x4"]`
*   **有效路径**: 
    *   行容器: `.priority-tooltip-row` (✅)
    *   网格列: `.icon-cell`, `.label-cell`, `.hours-cell`, `.desc-cell` (✅)
*   **特定数据**:
    *   布局: `display: grid`
    *   过滤: “已规划”资源显示 2 行，“纯消耗”资源显示 1 行。

### 资源流列表 (Resource Flow List)
*   **逻辑对象**: 货物流列表中的行
*   **定位器**: `.list-body .group-container .flow-wrapper` (✅)
*   **特定数据**: 如果添加了太阳能发电厂，第一个项目通常是“能量电池”。

### 7. 逻辑流与紧凑视图 (Logic Flow & Compact View)
*   **候选区 (Candidate Zone)**:
    *   主容器: `.candidate-zone` (✅)
    *   层级容器: `.ware-tier-group` (✅)
    *   产物卡片: `.ware-card` (✅)
*   **规划区 (Planning Zone)**:
    *   主容器: `.planning-zone` (✅)
    *   产线组: `.production-group` (✅)
    *   组标题: `.production-group h3` (✅)
    *   拖拽目标 (Drop Target): `.drop-target` (✅)
*   **紧凑视图 (Compact View)**:
    *   主容器: `[data-testid="compact-view"]` (✅)
    *   布局类: `.grid-cols-4` (✅)
    *   组容器: `.compact-group` (✅)
    *   内部网格: `.compact-node-grid` (✅)
    *   内部网格布局: `.grid-cols-5` (✅)
    *   重复项标签: `[data-testid="duplicate-label"]` (✅)
    *   重复项边框: `.border-red-500` (✅)
*   **交互逻辑**:
    *   拖拽开始触发: 设置 `logicFlowStore.isDragging = true` (✅)
    *   拖拽产物 ID: 设置 `logicFlowStore.draggingWareId = 'wareId'` (✅)
    *   激活状态容器: `.compact-view` (✅)
    *   布局结构: `flex-direction: column` (与非紧凑布局一致) (✅)
    *   组槽位: `.compact-group` (✅)
    *   新建产线投放区: `.compact-view > div:last-child` (带 `border-dashed`) (✅)
*   **交互大坑**:
    *   **拖拽触发**: 必须模拟 `mouse.move` 配合 `steps` 才能触发 `vuedraggable` 的 `start` 事件并使 `compact-view` 进入 DOM。(✅)
    *   **克隆模式**: 候选区拖拽后原元素应保留，验证方式为检查拖拽前后 `.candidate-ware-item` 数量一致。(✅)
    *   **DataTransfer 模拟无效**: `vuedraggable` 基于 Sortable.js，不直接监听原生 `DragEvent`。派发 `dragstart`/`drop` 等 HTML5 事件无法触发其内部逻辑，因为缺少 `_underlying_vm_` 属性和 Sortable.js 内部状态。必须使用 Playwright 的 `mouse` API 模拟真实鼠标操作。(✅)
    *   **lineage 闭包捕获**: `handleAddFromDrop` 使用 `setTimeout` 延迟处理，而 `stopDragging` 在 `handleDragEnd` 中被调用。必须在 setTimeout 外部捕获 `draggingLineage` 的值，否则回调执行时该值已被清空为 `null`。(✅)

## 🕳️ 历史定位大坑 (Pitfalls)

*   **等待 Store 超时**: E2E 测试等待 `window.store`，但 `main.ts` 未暴露它。已通过在 [App.vue](file:///d:/Documents/project/x4-station-calculator/src/App.vue) 中当 `isTestEnv` 为真时显式暴露来修复。(✅)
*   **生产环境 vs 开发环境**: 在 `npm run preview` 中 `import.meta.env.DEV` 为假。测试必须使用通过 `addInitScript` 注入的 `isTestEnv` 标志。(✅)
*   **提示框持久性**: 设置了 `hideOnClick: false` 的 Tippy 提示框在测试中仍需要手动移动鼠标来验证隐藏行为。(✅)
*   **Vite Preview 基础路径**: 预览服务器可能使用类似 `/x4-station-calculator/` 的基础路径。`playwright.config.ts` 必须在 `baseURL` 和 `webServer.url` 中与之完全匹配。(✅)
*   **测试中的 TypeScript 错误**: Playwright 可能会尝试编译实际上是 `vitest` 单元测试的 `.spec.ts` 文件。确保使用 `testDir` 或文件过滤器将其分开。(✅)
*   **明细项单位陷阱**: `.item-val` 中仅包含格式化后的数值（如 `+3,000.0`），不包含单位（如 `m³`）。在测试验证时应避免使用 `toMatch(/m³/)` 匹配明细行数值。(✅)
*   **视图名称变更**: “体积视图”已在界面上更名为“仓储视图”。测试定位器应使用 `/仓储|Volume/` 以保持兼容性。(✅)

### 7. 逻辑组网 (Logical Flow)
*   **候选区 (Candidate Zone)**:
    *   容器: `.candidate-zone` (✅)
    *   产物卡片: `.ware-card` (✅)
    *   带文本过滤: `.candidate-zone .ware-card.filter({ hasText: /Silicon Wafers/i })` (✅)
*   **规划区 (Planning Zone)**:
    *   容器: `.planning-zone` (✅)
    *   节点卡片: `.flow-node` (✅)
    *   组容器: `.group-container` (✅)
*   **工业分类 Race 切换**:
    *   定位器: `.px-3.py-1.rounded-full` (✅)
    *   带文本过滤: `.filter({ hasText: /TELADI|TERRAN|DEFAULT/i })` (✅)
*   **SVG 视觉连线**:
    *   定位器: `svg path.connection-line` (✅)
    *   断言建议: 使用 `toBeAttached()` 代替 `toBeVisible()`，因为 faint 颜色可能导致 Playwright 判定为 hidden。 (✅)
    *   渲染等待: 在节点添加后需要 `page.waitForTimeout(200)` 以等待 `nextTick` 中的 SVG 坐标计算。 (✅)
*   **规划效率不一致**: “安排模块”在 Phase 1 曾硬编码 25% 的工人效率加成，导致高加成（如 Argon/Boron 43%+）环境下出现过量规划。已修正为使用模块定义的 `maxBonus`。(✅)
*   **太阳能板 ID 坑**: 游戏数据中通用的太阳能板 ID 是 `prod_gen_energycells_macro`，而不是 `prod_arg_energycells_macro`。在单元测试或硬编码引用时需注意。(✅)
*   **模块数据结构陷阱**: `X4Module.wareId` 不是产品ID，而是模块内部ID（如 `module_gen_prod_weaponcomponents_01`）。产品ID存储在 `X4Module.outputs` 的 key 中。查找生产某产品的模块时，必须检查 `outputs` 而非 `wareId`。例如：`modules.filter(m => m.outputs && 'weaponcomponents' in m.outputs)`。(✅)
*   **构建更新滞后**: `npm run preview` 运行的是构建后的 `dist` 文件。修改源码后，必须重新执行 `npm run build` 才能在 preview 模式下生效。在开发测试阶段，推荐修改 `playwright.config.ts` 使用 `npm run dev` 以实现代码变更的实时热更新测试，避免因忘记构建导致的假阴性测试失败。(✅)

## 🧪 Vue 拖拽测试专项 (Vue Drag Testing)

### 方案对比结论

| 方案 | 结论 | 原因 |
|------|------|------|
| dispatchEvent | ❌ 不可行 | `vuedraggable` 基于 SortableJS，不监听原生 HTML5 Drag Events |
| 直接操作 Store | ⚠️ 不适合测试 UI | 绕过了真实交互，无法验证"停靠时高亮"等视觉反馈 |
| **Playwright Mouse API** | ✅ 推荐方案 | 模拟真实用户操作，可完整测试交互流程和视觉反馈 |

### 推荐方案：Playwright Mouse API

#### 工作原理
`page.mouse.down()` + `page.mouse.move()` + `page.mouse.up()` 触发 `vuedraggable` 的事件。

#### 验证结果
*   `isDragging` 在 `mouse.down()` + 小幅移动后变为 `true` (✅)
*   `hoveredZoneId` 在移动到目标区域后变为 `'B'` (✅)
*   高亮样式在悬停时正确应用 `border-blue-500` + `bg-blue-500/10` (✅)
*   数据在 `mouse.up()` 后正确更新 (✅)

#### 完整测试代码示例
```typescript
test('Real mouse drag triggers highlight and updates data', async ({ page }) => {
  const sourceItem = page.locator('[data-item-id="item-1"]');
  const targetZone = page.locator('[data-zone-id="B"]');

  const sourceBox = await sourceItem.boundingBox();
  const targetBox = await targetZone.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Box not found');

  // 1. 鼠标按下并开始拖拽
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 10, sourceBox.y + sourceBox.height / 2 + 10);

  // 2. 拖拽进入目标区域
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });

  // 3. 【关键】在 mouse.up() 之前断言高亮样式
  await expect(targetZone).toHaveClass(/border-blue-500/);
  await expect(targetZone).toHaveClass(/bg-blue-500\/10/);

  // 4. 释放鼠标
  await page.mouse.up();

  // 5. 验证数据变动
  const zoneBIds = await page.evaluate(() => 
    (window as any).dragTestStore.zoneBItems.map((i: any) => i.id)
  );
  expect(zoneBIds).toContain('item-1');
});
```

### 拖拽状态分类测试 (Drop Status Classification)

*   **Normal**: 拖拽到空区域 → `border-blue-500` (✅)
*   **Duplicated**: 拖拽已存在的项目 → `border-red-500` + "Duplicated" 标签 (✅)
*   **Auto**: 拖拽到自动占位符 → 悬停时 "Manual"，非悬停时 "Auto" (✅)
*   **Isolate**: 拖拽到隔离占位符 → 悬停时 "Connect"，非悬停时 "Isolate" (✅)
*   **Locked**: 拖拽匹配阵营的项目 → `border-amber-500` (✅)
*   **Rejected**: 拖拽不匹配阵营的项目 → `border-red-600` + "Rejected" 标签 (✅)

### 事件序列验证 (Event Sequence)

*   **成功投放**: `dragstart` → `dragenter` → `drop` → `dragend` (✅)
*   **取消拖拽**: `dragstart` → `dragend` (无 `drop`) (✅)
*   **悬停后离开**: `dragstart` → `dragenter` → `dragleave` → `dragend` (✅)

### 常见陷阱与修复 (Common Pitfalls)

#### dragleave 子元素闪烁问题
*   **问题描述**: 当拖拽元素进入子元素（如从 Zone B 空白处移动到 Zone B 内的 `drag-item`）时，父元素会触发 `dragleave`，导致高亮闪烁。
*   **修复方案**: 使用计数器 `dragEnterCounter` 跟踪进入/离开次数，仅在计数归零时才真正触发 `leaveZone`。
*   **代码示例**:
    ```typescript
    const dragEnterCounter = ref<{ A: number; B: number }>({ A: 0, B: 0 })
    
    const handleDragEnter = (zoneId: 'A' | 'B') => {
      if (store.isDragging) {
        dragEnterCounter.value[zoneId]++
        if (dragEnterCounter.value[zoneId] === 1) {
          store.enterZone(zoneId)
        }
      }
    }
    
    const handleDragLeave = (zoneId: 'A' | 'B') => {
      if (store.isDragging) {
        dragEnterCounter.value[zoneId]--
        if (dragEnterCounter.value[zoneId] === 0) {
          store.leaveZone(zoneId)
        }
      }
    }
    
    const handleDragEnd = () => {
      dragEnterCounter.value = { A: 0, B: 0 } // 重置计数器
      store.stopDragging()
    }
    ```

#### 测试断言时机
*   **错误做法**: 仅在 `mouse.up()` 后验证最终状态，无法测试"停靠时高亮"。
*   **正确做法**: 在 `mouse.up()` **之前**插入 `expect(targetZone).toHaveClass(/border-blue-500/)` 断言。

### 8. 产线组标题编辑与高亮链路 (Production Line Title & Highlight)

*   **标题编辑输入框**:
    *   定位器: `.production-group input` (✅)
    *   触发编辑: 点击 `.production-group h3` 标题元素 (✅)
    *   确认按钮: `.production-group button` 配合 SVG path 过滤 (✅)
    
*   **高亮链路追踪**:
    *   高亮节点: `.flow-node.highlighted` (✅)
    *   高亮连线: `.highlighted-connection` (✅)
    *   Store 状态: `logicFlowStore.highlightedNodeIds` (Set) (✅)
    
*   **紧凑模式标题**:
    *   定位器: `.compact-view .compact-group span.truncate` (✅)
    *   显示逻辑: 优先显示 `customName`，否则显示自动计算的名称 (✅)

*   **视图切换按钮**:
    *   量化生产: `getByRole('button', { name: /量化|Quantified/i })` (✅)
    *   逻辑组网: `getByRole('button', { name: /逻辑|Logical/i })` (✅)
    *   注意: i18n 键为 `view.production` 和 `view.logical_flow` (✅)

#### 测试注意事项
*   **SVG 连线可见性**: 使用 `toBeAttached()` 代替 `toBeVisible()`，因为 faint 颜色可能导致 Playwright 判定为 hidden。(✅)
*   **编辑模式切换**: 点击标题后需要 `waitForTimeout(100)` 等待 Vue 响应式更新。(✅)
*   **拖拽后等待**: 拖拽完成后需要 `waitForTimeout(300)` 等待数据更新和 DOM 渲染。(✅)
