# 测试经验与定位器知识库 (Test Experience & Locator Knowledge Base)

本文档记录全局可复用的测试经验，change-specific 知识见 `openspec/changes/<change-name>/ui_knowledge.md`。

---

## 定位器最佳实践 (Locator Best Practices)

### i18n 感知定位器
```typescript
// ✅ 同时支持中英文
await expect(page.locator('.title')).toMatchText(/新建|New/);

// ❌ 只支持单一语言
await expect(page.locator('.title')).toHaveText('新建');
```

### 通用定位器模式

| 元素类型 | 推荐定位器 |
|----------|------------|
| 带文本按钮 | `button:has-text("Label")` 或 `getByRole('button', { name: /Label/i })` |
| 带占位符输入框 | `input[placeholder*="hint"]` |
| 数据属性 | `[data-testid="element-id"]` |
| CSS 类 | `.class-name` (结合上下文使用) |

### 搜索模式
```typescript
// 填入搜索词 → 等待防抖 → 点击结果
await page.locator('.search-input').fill('Energy Cells');
await page.waitForTimeout(300); // 等待防抖
await page.locator('.result-item').first().click();
```

---

## 通用控件定位器 (Common Locators)

### 全局
- 语言切换器: `select.first()`
- 新建按钮: `button:has-text(/新建|New/)`
- 搜索框: `input[placeholder*=/搜索|Search/]`

### 模块搜索
- 搜索框: `.search-box .search-input`
- 结果弹出框: `.results-popover`
- 结果项: `.results-popover .result-item`
- **重要**: 必须先 `focus()` 再 `fill()`

---

## 历史定位大坑 (Pitfalls)

### 环境配置
- **Store 未暴露**: 测试中 `window.store` 为 undefined
  - 解决: 在 `App.vue` 中 `isTestEnv` 时暴露
- **构建更新滞后**: `npm run preview` 使用 `dist` 目录
  - 解决: 修改源码后需重新 `npm run build`

### UI 交互
- **元素不稳定**: `element is not stable`
  - 解决: 点击前加 `waitForTimeout(100)` 或用 `{ force: true }`
- **Tippy 提示框**: `hideOnClick: false` 需手动移动鼠标
- **i18n Key 显示**: 翻译失败显示 `ui.key_name`
  - 解决: 使用正则 `/Name|名称/`

### 测试设计
- **仅 Store 操作**: 必须包含 UI 断言
- **Pinia 未初始化**: 单元测试需 `setActivePinia(createPinia())`

---

## Vue 拖拽测试 (使用 x4-drag-test skill)

> 详细指南请参阅 `x4-drag-test` skill

### 拖拽状态分类
- **Normal**: 空区域 → `border-blue-500`
- **Duplicated**: 已存在 → `border-red-500` + "Duplicated"
- **Locked**: 匹配阵营 → `border-amber-500`
- **Rejected**: 不匹配阵营 → `border-red-600`

### 事件序列
- **成功投放**: `dragstart` → `dragenter` → `drop` → `dragend`
- **取消拖拽**: `dragstart` → `dragend` (无 `drop`)

---

## 测试数据 (Test Data)

### 常用模块/产品
- 电子黏土: 搜索 "Clay"，包含上游产物量子管、微芯片
- 能量电池: 搜索 "Energy Cell"，无上游依赖

### 太阳能板 ID
- 通用 ID: `prod_gen_energycells_macro` (不是 `prod_arg_xxx`)

### 模块数据结构注意
- `X4Module.wareId` 是模块内部 ID，不是产品 ID
- 产品 ID 在 `X4Module.outputs` 的 key 中

---

## 运行环境补充（2026-03-01）

- 在当前 CI/沙箱环境执行 Playwright 时，可能出现 Chromium 启动错误：`sandbox_host_linux.cc ... Operation not permitted`。
- 处理方式：在允许提权的前提下运行 `bash skill-scripts/playwright-isolated.sh ...` 进行验证，避免将环境权限问题误判为产品缺陷。


## 运行时异常排查补充（2026-03-04）

- 在 `ImportPlanModal` 切换到 `x4-station` tab 的路径上，若出现 `SyntaxError: 10`，`tests/test-setup.ts` 会将该 console error 提升为测试失败。
- 定位建议：优先检查该 tab 切换时触发的 i18n 文案解析与模板绑定，确认是否存在 message format 解析异常。
- 当 e2e 基于 `vite preview` 运行时，若代码已改但 `dist` 未重建，可能持续复现旧异常；先执行 `npm run build` 再重跑可避免误判。


## 页签切换稳定性补充（2026-03-04）

- 站点页与帝国总览之间切换时，单次点击 `.overview-tab`/`.station-tab` 在并发 E2E 下可能偶发未生效。
- 推荐做法：点击后用状态校验再继续后续定位，例如轮询 `window.empireStore.activeStationId === null`（overview）或 `!== null`（station），避免将未切换导致的 locator miss 误判为产品缺陷。


## Storage Import 打开稳定性补充（2026-03-04）

- 在 `StationToolbar` 上，若标题进入编辑态（中间标题区变为 input），`toolbar-import-btn` 的一次点击可能未触发 `storage-import-wizard` 打开。
- 推荐做法：在导入 helper 中增加“编辑态收敛 + fallback”链路：
  - 先尝试 `Enter/Escape` 退出编辑态，并在可见时点击 `.toolbar-panel input + button`；
  - 再执行常规 `toolbar-import-btn` 点击；
  - 若仍未出现弹窗，执行 `document.querySelector('[data-testid="toolbar-import-btn"]')?.click()` 的 DOM fallback，并配合短重试。


## Ship Selector Helper 约束补充（2026-03-05）

- 在 `ship-build` selector 模式下，不应读取仅存在于 workspace 的头部定位器（如 `ship-build-change-ship-fit-header`）；应先基于 selector 内控件（`ship-build-confirm-ship` / `ship-build-cancel-ship-change`）做前置断言。
- Chapter 2 transition helper 复用于 Chapter 3 时，优先保证 helper 内部前置定位器与当前视图一致，可显著降低跨 case 复用时的超时波动。


## Ship Build 入口前置补充（2026-03-06）

- 在 `ship-level-blueprint` 跑批中，多个 case 同时失败于 `top-view-btn-ship-build` 点击后的 `ship-build-filters` 可见性断言，表现为“入口点击成功但未进入 selector 视图”。
- 建议将 `gotoShipBuild` 设计为“视图收敛 helper”：先判断当前在 workspace 还是 selector，再执行必要切换，避免把固定 `ship-build-filters` 可见作为唯一入口成功条件。
- 对共享状态 helper（如 `ship-toolbar-no-selected-ship` / `ship-toolbar-selected-ship-and-dirty`）应在失败日志中输出当前视图判定信息，降低批量失败时的排障成本。


## Ship Toolbar 切换与任务编号补充（2026-03-06）

- `ship-level-blueprint` 第二轮中，`2.3/3.2/3.3/3.4` 失败集中在同一 `test_defect`：case 先通过 `Discard & New` 回到 selector，再直接执行 fit 面板操作会因未回到 workspace 导致 `ship-build-panel-fit` 不可见。
- 建议将“执行 fit 操作”的 helper 统一增加 selector->workspace 收敛步骤（例如点击目标 ship 并 confirm，或显式切回 panels）后再操作槽位。
- `test_tasks.md` 若存在重复 marker（如同一 case 同时出现两条 `4.1.3`），`apply_test_results.py` 无法区分子项并会同时打标；建议保持 marker 全局唯一（如 `4.1.3` / `4.1.4`）以避免回写歧义。
