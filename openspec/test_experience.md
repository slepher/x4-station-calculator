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
*   **显示缺口开关**:
    *   失败尝试: `.input-group` + `hasText: /显示缺口|Show Gaps/` → `.toggle-chip`（超时，未命中） (❌)
    *   正确定位: `[data-testid="toggle-show-empire-gaps"]` (✅)
    *   注意: 仅在分站视图出现，需先选中 `.station-tab` 才会渲染 (✅)

### 2. 统一仪表盘 (Dashboard & View Modes)
*   **主容器**: `.list-wrapper` (✅)
*   **激活状态**: `.active` (✅)
*   **视图切换按钮组**:
    *   通用定位: `.view-mode-switcher` (✅)
    *   推荐作用域: `.view-mode-switcher` + `hasText: /经济|Economy/` (✅)
    *   数量视图: `switcher.locator('.view-mode-btn').nth(0)` (✅)
    *   经济视图: `switcher.locator('.view-mode-btn').nth(1)` (✅)
    *   仓储视图: `switcher.locator('.view-mode-btn').nth(2)` (✅)
    *   逻辑流视图: `switcher.locator('.view-mode-btn').nth(3)` (✅)
*   **底部汇总**:
    *   利润总计: `.profit-val` (✅)
    *   经济分组总和: `.economy-group-sum` (✅)
*   **分组标题顺序检查**:
    *   失败尝试: 资源视图下 `group-title` 列表未出现“产品/Products”，导致分组顺序断言失败 (❌)

### 3. 资源流项目 (WareFlow & Items)
*   **行容器**: `.flow-wrapper` (✅)
*   **特定标识**: `[data-resource-id="wareId"]` (如 `[data-resource-id="energycells"]`) (✅)
*   **资源名称**: `.header-name` (✅)
*   **主数值**: `.value` (✅) - *注：数量视图显示产量，经济视图显示利润（带 Cr）*
*   **收藏按钮 (FavoriteButton)**:
    *   定位器: `.favorite-btn` (✅)
    *   状态: `.disabled` 表示无可选优先级 (✅)
*   **锁定按钮 (LockButton)**:
    *   定位器: `.flow-wrapper .lock-btn` (✅)
    *   触发显示: hover `.flow-wrapper` 后可见 (✅)
    *   锁定状态: `.lock-btn.is-locked` (✅)
*   **交互逻辑**:
    *   可点击主行: `.main-row` (✅)
    *   展开状态: `.main-row.is-active` (✅)
    *   明细列表: `.list-box` (✅)
    *   明细项: `.list-item` (✅)
    *   明细数值: `.item-val` (✅)

### 模块数量输入 (Module Count)
*   **模块行**: `.module-row` (✅)
*   **数量输入框**: `.x4-num-input` (✅)

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

## 🔍 定位器最佳实践 (Locator Best Practices)

### 搜索模式 (Search Pattern)
```typescript
// 填入搜索词 → 等待防抖 → 点击结果
await page.locator('.search-input').fill('Energy Cells');
await page.waitForTimeout(300); // 等待防抖
await page.locator('.result-item').first().click();
```

### i18n 感知定位器 (i18n-Aware Locators)
使用正则表达式支持多语言：
```typescript
// ✅ 同时支持中英文
await expect(page.locator('.title')).toMatchText(/新建|New/);

// ❌ 只支持单一语言
await expect(page.locator('.title')).toHaveText('新建');
```

### 通用定位器模式 (Common Locator Patterns)

| 元素类型 | 推荐定位器 |
|----------|------------|
| 带文本按钮 | `button:has-text("Label")` 或 `getByRole('button', { name: /Label/i })` |
| 带占位符输入框 | `input[placeholder*="hint"]` |
| 数据属性 | `[data-testid="element-id"]` |
| CSS 类 | `.class-name` (结合上下文使用) |

### 多空间站帝国规划定位器 (Multi-Station Empire)
*   **标签栏**:
    *   帝国总览标签: `.overview-tab` (✅)
    *   分站标签: `.station-tab` (✅)
    *   添加分站按钮: `.add-btn` (✅)
*   **工具栏**:
    *   工具按钮: `.btn-tool` (✅)
    *   帝国名称输入: `.ghost-input.w-64` (✅) - *注意：不是 `.empire-name-input`*
    *   开关按钮: `.toggle-chip` (✅) - *注意：不是 `.toggle-btn`*
    *   工人运算开关: `.toggle-chip.active-green` (✅)
    *   站内补给开关: `.toggle-chip.active-blue` (✅)
*   **模块搜索**:
    *   搜索框: `.search-box .search-input` (✅)
    *   结果弹出框: `.results-popover` (✅)
    *   结果项: `.results-popover .result-item` (✅)
    *   **搜索模式**: 必须先 `focus()` 再 `fill()`，否则弹出框不会显示 (✅)
        ```typescript
        const searchInput = page.locator('.search-box .search-input');
        await searchInput.focus();
        await searchInput.fill(moduleName);
        const resultItem = page.locator('.results-popover .result-item').first();
        await expect(resultItem).toBeVisible({ timeout: 500 });
        await resultItem.click();
        ```
*   **测试数据 (常用模块)**:
    *   电子黏土产线: 搜索关键词 "Clay"，包含上游产物量子管、微芯片等 (✅)
    *   量子管: 在产品分组中，可通过 `.flow-wrapper` + `hasText: /量子管|Quantum Tube/` 定位 (✅)
    *   能量电池产线: 搜索关键词 "Energy Cell"，无上游依赖 (✅)
*   **对话框**:
    *   模态框容器: `.fixed.inset-0` (✅)
    *   文本输入: `.fixed.inset-0 input[type="text"]` (✅)
    *   删除确认模态框: `.modal-backdrop` (✅) - *注意：不是 `.modal-overlay`*
*   **右键菜单**:
    *   菜单容器: `.context-menu` (✅)
    *   危险操作项: `.menu-item.danger` (✅)
*   **补给优先归类断言**:
    *   先按组定位：`.group-container` + `hasText: /产品|Products|运营|Operations|补给|Supply/` (✅)
    *   再在组内断言：`.flow-wrapper` + `hasText: /医疗物资|Medical Supplies/` (✅)
    *   推荐断言：补给组 `toHaveCount(1)`，产品/运营组 `toHaveCount(0)`，避免全局匹配误判 (✅)

---

## 🕳️ 历史定位大坑 (Pitfalls)

### 环境与配置类

*   **等待 Store 超时**: E2E 测试等待 `window.store`，但 `main.ts` 未暴露它。
    *   **解决方案**: 在 `App.vue` 中当 `isTestEnv` 为真时显式暴露：
        ```typescript
        if (import.meta.env.VITE_TEST_ENV) {
          (window as any).store = useMainStore();
        }
        ```
*   **生产环境 vs 开发环境**: 在 `npm run preview` 中 `import.meta.env.DEV` 为假。
    *   **解决方案**: 使用通过 `addInitScript` 注入的 `isTestEnv` 标志。
*   **Vite Preview 基础路径**: 预览服务器可能使用类似 `/x4-station-calculator/` 的基础路径。
    *   **解决方案**: `playwright.config.ts` 必须在 `baseURL` 和 `webServer.url` 中与之完全匹配。
*   **构建更新滞后**: `npm run preview` 运行的是构建后的 `dist` 文件。修改源码后，必须重新执行 `npm run build` 才能在 preview 模式下生效。
    *   **建议**: 开发测试阶段使用 `npm run dev` 实现热更新，避免忘记构建导致的假阴性失败。
*   **测试中的 TypeScript 错误**: Playwright 可能会尝试编译实际上是 `vitest` 单元测试的 `.spec.ts` 文件。
    *   **解决方案**: 使用 `testDir` 或 `testIgnore` 将其分开。

### UI 交互类

*   **元素不稳定 (element is not stable)**: Playwright 点击按钮时报错 "element is not stable"，通常是因为动画或 DOM 更新导致元素位置变化。
    *   **解决方案**: 
        1. 在点击前添加 `await page.waitForTimeout(100)` 等待动画完成
        2. 使用 `{ force: true }` 选项绕过稳定性检查：`await btn.click({ force: true })`
    *   **适用场景**: 模态框按钮、对话框确认按钮、删除按钮等
*   **提示框持久性**: 设置了 `hideOnClick: false` 的 Tippy 提示框在测试中仍需要手动移动鼠标来验证隐藏行为。(✅)
*   **明细项单位陷阱**: `.item-val` 中仅包含格式化后的数值（如 `+3,000.0`），不包含单位（如 `m³`）。
    *   **解决方案**: 测试验证时避免使用 `toMatch(/m³/)` 匹配明细行数值。
*   **视图名称变更**: "体积视图"已在界面上更名为"仓储视图"。
    *   **解决方案**: 测试定位器应使用 `/仓储|Volume/` 以保持兼容性。
*   **i18n Key 显示**: 翻译键显示为 `ui.key_name` 或 `!!key!!`。
    *   **解决方案**: 检查 i18n 配置，测试中使用正则 `/Name|名称/`。
*   **Station Tab 拖拽断言迁移后的结论**: `station-tab-drag` 用例从 `.tab-label` 文本顺序迁移到 `.station-tab[data-station-id]` 后，W1/W3 仍在 `expect(success).toBe(true)` 失败，说明该轮失败根因不在文本读取，而在拖拽重排信号本身未稳定生效。(✅)
    *   **排查建议**: 优先观察拖拽过程是否出现 `.tab-drag-ghost/.tab-drag-chosen`，并确认 `mouse.move(..., { steps: 20 })` 触发后目标位置发生可见插入反馈。
*   **保存动作的状态提示检查**: 站点页点击工具栏保存按钮后，应检查右下角 `StatusMonitor` 的 `save` 分类消息（内容为“保存/Save”语义），再继续后续断言。(✅)

### 测试设计类

*   **仅 Store 操作测试**: 测试仅通过 `page.evaluate` 操作 Store，没有 UI 验证。
    *   **解决方案**: 必须包含 UI 交互和断言。Store 操作可用于 setup，但不能作为唯一验证。
*   **Pinia 未初始化导致单测全挂**: 组件迁移到 `useShipBuildStore()` 后，`@vue/test-utils` 挂载时若未注入 Pinia，会触发 `getActivePinia()` 错误并导致所有用例失败。
    *   **解决方案**: 在 `mount` 前执行 `setActivePinia(createPinia())`，并在 `global.plugins` 注入同一个 pinia 实例。
*   **Ship Build Equipment 当前稳定定位器**: `ship-build-equipment` E2E 在当前实现下可稳定使用 `.mode-tabs .mode-tab`、`.left-rail .slot-type-btn`、`.group-tabs .group-tab`、`.option-wall .option-card`。
    *   **注意**: `ui_knowledge` 中建议的 `ship-build-*` testid 尚未全部落地，编写用例需先用现有 class 定位并控制作用域。
*   **Ship Build Store 调试导出门槛**: 在 preview/e2e 下如果没有设置 `localStorage.isTestEnv=true`，`window.shipBuildStore` 不会导出，`page.evaluate` 读取 store 会报 `undefined`。
    *   **解决方案**: 在测试初始化（清理存储后）先写入 `localStorage.setItem('isTestEnv', 'true')`，再 `reload` 进入页面。

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

> **详细指南请参阅 `x4-drag-test` skill**

本节仅保留项目特定的拖拽定位器记录。

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

---

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

### 9. FlowNode 体积压缩率显示 (Volume Compression Rate)
*   **FlowNode 节点定位**:
    *   按 wareId 定位: `.flow-node[data-ware-id="hullparts"]` (✅)
    *   注意: 不要用 `filter({ hasText: /船体部件/i })` 因为节点标题可能是自定义名称
*   **压缩率显示元素**:
    *   定位器: `.flow-node[data-ware-id="xxx"] .text-\\[7px\\]` 配合 `filter({ hasText: /\d+%/ })` (✅)
    *   颜色类: `text-emerald-400` (≤100%), `text-red-400` (>100%) (✅)
*   **T0 资源节点**:
    *   定位器: `.flow-node[data-ware-id="energycells"], .flow-node[data-ware-id="ore"]` (✅)
    *   特点: T0 节点不显示压缩率，因为 `column === 0` (✅)
*   **Isolated 状态**:
    *   设置方式: 通过 UI 点击隔离按钮 `✂️`（hover 后显示）(✅)
    *   前提条件: 节点必须被下游依赖（`canIsolate = isDepended`）(✅)
    *   视觉标识: 节点内显示 `EXT` 徽章 (✅)
    *   压缩率隐藏: isolated 节点不显示压缩率 (✅)
    *   注意: 不能直接操作 store，必须通过 UI 交互 (✅)

#### 测试注意事项
*   **SVG 连线可见性**: 使用 `toBeAttached()` 代替 `toBeVisible()`，因为 faint 颜色可能导致 Playwright 判定为 hidden。(✅)
*   **编辑模式切换**: 点击标题后需要 `waitForTimeout(100)` 等待 Vue 响应式更新。(✅)
*   **拖拽后等待**: 拖拽完成后需要 `waitForTimeout(300)` 等待数据更新和 DOM 渲染。(✅)

### 10. Logic Flow UI Adjust 测试定位器
*   **候选区 Ware Card**:
    *   定位器: `.ware-card-wrapper[data-ware-id="xxx"]` (✅)
    *   注意: 不是 `.ware-card`，而是 `.ware-card-wrapper`
*   **候选区 Grid 布局**:
    *   定位器: `.candidate-zone .ware-grid` (✅)
    *   列宽样式: `grid-cols-[2fr_3fr_3fr_4fr]`
*   **ProductionLineGroup Grid 布局**:
    *   定位器: `.production-group .grid` (✅)
    *   列宽样式: `grid-cols-[2fr_3fr_3fr_4fr]`
*   **紧凑视图**:
    *   容器: `.compact-view` (✅)
    *   组容器: `.compact-group` (✅)
    *   节点网格: `.compact-node-grid` (✅)
    *   新建区域: `.drop-target` (✅)
*   **压缩率显示**:
    *   容器: `.compression-rate-container` (✅)
    *   文本: `.compression-rate-text` (✅)
    *   颜色类: `text-emerald-400` (≤100%), `text-red-400` (>100%) (✅)
*   **T0 资源卡片**:
    *   定位器: `.ware-card-wrapper[data-tier="0"]` (✅)
    *   特点: T0 卡片不显示压缩率和+按钮 (✅)
*   **快速添加按钮**:
    *   定位器: `.ware-card-add-btn` (✅)
    *   触发: hover 时显示 (✅)
*   **资源预览容器**:
    *   定位器: `.resource-preview-container` (✅)
    *   行为: hover 时 opacity 变为 0 (✅)

### 11. Station Tab Drag（station-tab-drag）
*   **W1 拖拽重排未生效**:
    *   现象: `tests/e2e/station-tab-drag/station-tab-drag.spec.ts:73` 中 `expect(success).toBe(true)` 失败，3 次拖拽后仍未达到目标顺序。(❌)
    *   信号: 拖拽动作完成但顺序断言未变化，需优先核查断言口径与 DOM 稳定性。
*   **W3 刷新后顺序读取为空**:
    *   现象: `tests/e2e/station-tab-drag/station-tab-drag.spec.ts:98` 中期望数组非空，实际 `[]`。(❌)
    *   建议: 刷新后先等待 `.station-tab` 可见或数量大于 0，再读取顺序，避免过早采样。

### 12. Import Logic Flow（import-logic-flow）执行记录补充
*   **E2E 方案列表文本定位 strict mode 冲突**:
    *   现象: `getByText('ILF Valid Single Group')` 同时命中工具栏标题与弹窗列表项，触发 strict mode violation（`tests/e2e/import-logic-flow/import-logic-flow.spec.ts` 的 2.1 用例）。(❌)
    *   建议: 在 `logicflow-import-modal` 或 `LoadFlowPlanModal` 容器内做作用域定位，优先 `data-testid` + scoped locator，避免全局 `getByText`。(✅)
*   **导入链路稳定定位器可用**:
    *   入口按钮: `[data-testid="logicflow-import-entry-station"]` / `[data-testid="logicflow-import-entry-empire"]` (✅)
    *   选择弹窗: `[data-testid="logicflow-import-modal"]`、`[data-testid="logicflow-import-plan-select"]`、`[data-testid="logicflow-import-group-select"]`、`[data-testid="logicflow-import-continue"]` (✅)
    *   站点确认弹窗: `[data-testid="station-import-confirm-modal"]`、`[data-testid="station-import-confirm-new"]`、`[data-testid="station-import-confirm-overwrite"]` (✅)
    *   warning 汇总弹窗: `[data-testid="logicflow-import-warning-modal"]` (✅)
*   **Unit 执行前置问题**:
    *   现象: 定向执行 `tests/unit/import-logic-flow/import-logic-flow.spec.ts` 时，`vue-i18n` mock 缺少 `createI18n` 导出导致 suite 启动失败，显示 `0 test`。(❌)
    *   建议: 参照仓库其他 unit 测试的 i18n mock，补齐 `createI18n`（或使用 partial mock）。(✅)

### 13. Import Logic Flow（import-logic-flow）回归通过补充
*   **Unit i18n mock 修复**:
    *   问题: `vue-i18n` mock 仅提供 `useI18n`，在 `src/i18n.ts` 初始化路径下缺少 `createI18n` 导出导致 suite 启动失败。(❌)
    *   修复: 在 unit mock 中补齐 `createI18n` 返回对象，定向 unit 恢复执行并通过（11/11）。(✅)
*   **LoadFlowPlanModal 选择器稳定化**:
    *   问题: 2.1 场景下全局文本定位与卡片按钮定位都可能误命中或空命中（toolbar 同名标题、卡片类名复用）。(❌)
    *   修复: 先定位加载弹窗容器（`.fixed.inset-0` + `Load Flow Plan` 标题特征），再在弹窗作用域内定位 `Load Plan` 按钮并按顺序点击（A=first, B=nth(1)）。(✅)
*   **定向回归结果**:
    *   `vitest tests/unit/import-logic-flow/import-logic-flow.spec.ts`: 11 passed。(✅)
    *   `playwright tests/e2e/import-logic-flow/import-logic-flow.spec.ts`: 11 passed。(✅)

### 14. Import Logic Flow（import-logic-flow）二级内容区定位补充
*   **二级选择控件形态变更**:
    *   现象: `logicflow-import-group-select` 在运行时为 `div` 内容区而非 `<select>`，对其执行 `selectOption()` 会报错 “Element is not a <select> element”。(❌)
    *   修复: 测试中先判断容器 tagName；`select` 分支走 `selectOption`，`div` 分支点击 `button[data-testid^="logicflow-import-group-item-"]`。(✅)
*   **2.12/2.13 断言口径修正**:
    *   现象: 用例原先等待 `[data-testid="logicflow-import-group-panel"]`，页面并无该 testid，导致误失败。(❌)
    *   修复: 改为断言 `[data-testid="logicflow-import-group-select"]` 可见，且 `select[data-testid="logicflow-import-group-select"]` 不存在；继续断言无搜索/分页/排序控件。(✅)
*   **回归结果**:
    *   `playwright tests/e2e/import-logic-flow/import-logic-flow.spec.ts`: 16 passed。(✅)

### 15. Import Logic Flow（import-logic-flow）新口径 2.11~2.20
*   **导入主流程定位迁移**:
    *   Station 二级容器: `[data-testid="logicflow-import-group-list"]` (✅)
    *   Station 规划区卡片: `[data-testid^="logicflow-import-group-item-"]` (✅)
    *   Station 直接导入: `[data-testid^="logicflow-import-group-direct-"]` (✅)
    *   Empire 方案卡片区: `[data-testid="logicflow-import-plan-list"]`, `[data-testid^="logicflow-import-plan-item-"]` (✅)
*   **底部继续按钮口径**:
    *   新口径要求导入仅通过卡片动作触发；`[data-testid="logicflow-import-continue"]` 仅作为“应不存在”断言项。(✅)
*   **2.20 弹框判定一致性**:
    *   状态 S1：新建与导入均不弹 SmartSaveDialog。(✅)
    *   状态 S2：新建与导入均弹 SmartSaveDialog。(✅)
*   **定向回归结果**:
    *   `vitest tests/unit/import-logic-flow/import-logic-flow.spec.ts`: 11 passed。(✅)
    *   `playwright tests/e2e/import-logic-flow/import-logic-flow.spec.ts`: 22 passed。(✅)

### 16. Import Logic Flow（import-logic-flow）状态/切换专项补充
*   **`isDirty` 判定包含 `activeStationId`**:
    *   历史现象: 保存后若立即切换到“帝国总览”（`activeStationId: stationId -> null`），`shouldConfirmBeforeEmpireReset()` 会变为 `true`，导致 `New` 触发 SmartSaveDialog。(⚠️)
    *   新需求口径: `activeStationId` 变化不应引起 dirty；仅站点/总览切换不得单独触发保存确认。(✅)
*   **状态/切换标题过滤命中**:
    *   新增用例标题前缀:
      *   `状态：帝国已保存基线态`
      *   `状态：帝国待保存更改态`
      *   `切换：帝国已保存基线态->帝国待保存更改态`
      *   `切换：帝国待保存更改态->帝国已保存基线态`
    *   命令结果:
      *   `npx playwright test tests/e2e/import-logic-flow -g "状态："`: 2 passed。(✅)
      *   `npx playwright test tests/e2e/import-logic-flow -g "切换："`: 2 passed。(✅)
*   **本轮回归结果**:
    *   `npx vitest run tests/unit/import-logic-flow`: 11 passed。(✅)
    *   `npx playwright test tests/e2e/import-logic-flow`: 26 passed。(✅)
