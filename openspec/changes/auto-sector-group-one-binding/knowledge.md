# auto-sector-group-one-binding Knowledge

## Fixture

### db.json
- 路径：`tests/fixtures/db.json`
- 版本：`vsn: 6`（加载时必须删除此字段）
- 包含一个 binding `slepher`（gameGuid: `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`），含 4 个 sector groups
- 包含 `x4_station_active_view`：`activeView: 'live-production'`，`activeBinding` 指向上述 gameGuid
- 包含 `x4_save_archives`、`x4_empire_data`、`x4_blueprints` 等其他 store 数据

### save/ 目录
- 路径：`tests/fixtures/save/`
- 包含 `save.json`（主存档）和 `save_old.json`（旧存档）
- 主存档有两个版本，parser_version 分别为 `v7`（有效）和其他（无效）
- 存档 meta：guid `CB8837FE-...`，time ~698441，version `'800'`
- 存档包含多个 sector 数据（player_stations、player_buildstorages、clusterGates 等）

### loadLiveBindingFixture
- 路径：`tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts`
- 入口函数：`loadLiveBindingFixture(page, options?)`
- 行为：
  1. 读取 `db.json` 作为 localStorage 基础数据（移除 `vsn`）
  2. 加载 `save/` 目录下的存档 JSON
  3. 构建 `x4_save_archives` state（按 time 降序，activeArchiveId 指向最新有效存档）
  4. 注入 localStorage（逐个 key 设置，含 `x4_station_active_view`）
  5. 将存档数据写入 IndexedDB（`archive_data` + `player_stations` object stores）
  6. 使用 `gameGuid: 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'`
  7. reload 页面后等待 `#debug-ready-marker`
  8. 点击 `[data-testid="top-view-btn-live-production"]` 进入 live production 模式
  9. 语言设置由测试自行处理
- `transformSave` 选项：可传入回调修改存档数据（用于构造重组场景）
- 存档筛选：只使用 `parser_version === 'v7'` 的存档

### Enter Auto Sector Group
- 进入 auto sector group 的可靠路径：
  1. 确认 `ensureAutoGroupResult(page)` 后 `window.liveStore.autoGroupResult` 非 null
  2. 点击 `page.getByTestId('sidebar-auto-sector-group')`
  3. 等待 `.auto-sector-bar` 可见

### 迁移旧 localStorage key
- 从旧版本 key 迁移到 v9 key（如需要）：
  - `x4_save_bindings` → `x4_save_bindings_v9`
  - `x4_save_archives` → `x4_save_archives_v9`
  - `x4_empire_data` → `x4_empire_data_v9`

## UI Locator

### Sidebar 入口
- `page.getByTestId('sidebar-auto-sector-group')` — 星区编辑详情 sidebar 入口
- Sidebar 入口位于固定菜单（overview/terraforming/...）与星区/站点列表之间的分隔线区域
- 入口标签文本：zh-CN 下为「星区编辑」，en 下为「Sector Groups」
- 红点：`.sidebar-recalc-dot`（仅在 sidebar 入口图标内，`needsAutoGroupRecalc=true` 时可见）
- 禁用：入口元素有 `.disabled` class（`autoGroupResult=null` 时）

### 展示模式
- 三列布局：存档（`3fr`）| 星区（`4fr`）| 资源（`5fr`）
- 详情按钮：`page.getByRole('button', { name: /详情|Detail/ })`
- 地图按钮：`page.getByRole('button', { name: /地图|Map/ })`
- 星区列顶部参数：桥接跳数、覆盖跳数、Hub 阈值（只读文本）

### 计算模式（AutoSectorGroupPanel）
- `layout="columns"` 渲染三列：星区（`5fr`）| 分配（`4fr`）| 交易站（`3fr`）
- 共用顶部栏：`.auto-sector-bar` — 包含返回、地图、计算、快速计算、重置、提交按钮及参数输入
- Hub tab 标识：`.group-item` 列表
- Allocation tab 标识：`.allocation-card` 列表
- Trade Station tab 标识：`.trade-station-card` 列表

### Group Card（`.group-item`）
| CSS Class | 含义 |
|---|---|
| `.group-item` | 根容器 |
| `.group-item--new` | 新添加的 hub（手动添加） |
| `.group-item--pinned` | 已钉选 group（edit 模式） |
| `.group-item--unpinned` | 未钉选 group |
| `.group-item--baseline` | 基线 group（非 edit 模式） |
| `.group-name` | 组名文本 |
| `.pill--anchor` | 锚点星区 pill |
| `.pill--coverage` | 覆盖星区 pills |
| `.pill--candidate` | 候选星区 pills |
| `.pill--connected` | 连接其他 group 的 pills |
| `.pill--trade-station` | 交易站选择 pill |
| `.pill-action--remove` | 移除 pill 按钮 |
| `.pill-action--add` | 添加 pill 按钮 |
| `.pill-action--transfer` | 转移 pill 按钮 |
| `.jump-readonly` | 只读跳数显示（result 模式） |
| `.jump-control` | 可编辑跳数控件（edit 模式） |
| `.group-stats` | 统计行（覆盖数、不确定数） |
| `.retain-chk` | 保留复选框（edit 模式） |
| `.state-btn` | 组操作按钮 |
| `.state-btn--pinned` | 钉选按钮 |
| `.state-btn--unpinned` | 取消钉选按钮 |
| `.state-btn--delete` | 删除按钮 |
| `.drag-handle` | 拖拽手柄 |

### Allocation Card（`.allocation-card`）
| CSS Class | 含义 |
|---|---|
| `.allocation-card` | 分配卡片容器 |
| `.card-uncertain` | 不确定分配状态 |
| `.card-auto` | 自动分配状态 |
| `.card-standalone` | standalone 分配状态 |
| `.option-row` | 分配选项行 |
| `.option-selected` | 已选择选项行 |
| `.option-radio` | 单选按钮 |
| `.radio-checked` | 已选中单选按钮 |
| `.option-label` | 选项标签文本 |
| `.bridge-plan-card` | 桥接计划卡片 |
| `.card-sector-name` | 星区名称 |

### Trade Station Card（`.trade-station-card`）
| CSS Class | 含义 |
|---|---|
| `.trade-station-card` | 交易站卡片容器 |
| `.candidate-item` | 候选列表项 |
| `.candidate-item--selected` | 已选候选 |
| `.candidate-item--virtual` | 虚拟交易站候选 |
| `.candidate-name` | 候选名称 |

### Button Locator（按钮）
- 编辑按钮：`page.getByRole('button', { name: /编辑|Edit/ })`
- 退出按钮：`page.getByRole('button', { name: /退出|Exit/ })`
- 计算按钮：`page.getByRole('button', { name: /计算|Calculate/ })` — edit 模式 emit `calculate`，result 模式 emit `quick-calculate`（同一按钮，无独立"快速计算"按钮）
- 重置按钮：`page.getByRole('button', { name: /重置|Reset/ })`
- 确认按钮：`page.getByRole('button', { name: /确定|Confirm/ })` — 不是"提交"或"确认"；`showConfirm` 在 `layout="columns"` 模式下为 `true`
- 添加枢纽按钮：`page.getByRole('button', { name: /添加|^Add$/ })`
- 地图按钮：`page.getByRole('button', { name: /地图|Map/ })`

### 展示模式布局
- 星区列（中间列）顶部：桥接跳数、覆盖跳数、Hub 阈值（纯数值标签）
- 详情按钮和地图按钮位于星区列顶部

### 计算模式顶部栏按钮
- `layout="columns"` 模式下 `showBack=false`，无返回按钮。退出计算模式需通过 sidebar 点击"总览"（overview）或"星区编辑"入口
- 确认按钮：`page.getByRole('button', { name: /确定|Confirm/ })`
- 地图按钮：`page.getByRole('button', { name: /地图|Map/ })`

### Sidebar 导航
- 星区编辑入口：`page.getByTestId('sidebar-auto-sector-group')` — 进入计算/详情视图
- 总览入口：`page.getByTestId('sidebar-overview')` — 回到展示模式（替代已移除的返回按钮）

### Confirm Popup（二次确认）
- Popup 容器：`.confirm-popup` 或 `role="dialog"`
- Popup 中确认按钮：在 popup 内查找 `getByRole('button', { name: /确定|Confirm/ })`

## Store Access（E2E 测试中访问 Store）

### 窗口暴露
- `window.liveStore` — `useLiveProductionStore` 实例
  - `liveStore.autoGroupResult` — `ShallowRef<AutoGroupResult | null>`
  - `liveStore.calculationMode` — `Ref<'result' | 'edit'>`
  - `liveStore.virtualStationDrafts` — `Ref<BindingStationPlan[]>`
  - `liveStore.virtualStationDraftInitializedKey` — `Ref<string | null>`
  - `liveStore.prefJumpRange` / `liveStore.bridgeSearchJumpRange` / `liveStore.prefThreshold` — `Ref<number>`
  - `liveStore.needsAutoGroupRecalc` — `ComputedRef<boolean>`
  - `liveStore.initAutoGroupDraft()` — 初始化 shared draft
  - `liveStore.activateBinding(gameGuid)` — 激活 binding 并重新初始化
- `window.saveBindingStore` — `useSaveBindingStore` 实例
  - `saveBindingStore.activeBinding` — 当前 active BindingPlan
  - `saveBindingStore.bindingList` — 所有 binding 列表
  - `saveBindingStore.saveBinding()` — 持久化
- `window.saveStore` — 存档 store
- `window.activeViewStore` — `useActiveViewStore` 实例
  - `activeViewStore.activeBinding` — 当前选中的 binding gameGuid
  - `activeViewStore.activeBindingWorkbench` — 当前 workbench 类型

### 常用 Store 操作模式
```ts
// 读取 autoGroupResult
const r = await page.evaluate(() => (window as any).liveStore.autoGroupResult)

// 设置 needsAutoGroupRecalc 状态（修改 appliedAutoGroupArchiveTime）
await page.evaluate(() => {
  const binding = (window as any).saveBindingStore.activeBinding
  if (binding) binding.appliedAutoGroupArchiveTime = 0 // 使 recalc = true
})

// 清空 autoGroupResult（测试禁用状态）
await page.evaluate(() => {
  (window as any).liveStore.autoGroupResult = null
})

// 切换 active binding
await page.evaluate((gameGuid: string) => {
  (window as any).liveStore.activateBinding(gameGuid)
}, newGameGuid)
```

### Fixture Store 状态
- 加载后 `window.liveStore.autoGroupResult` 应该非 null 且有 groups
- 四个 sector group 均为 baseline group（来自 db.json binding 的已保存 groups）
- binding 中包含虚拟交易站和带 `saveStationCode` 的 station plans

## 测试关键点

### 模式切换不触发计算
验证方式：在切换前后比较 `autoGroupResult` 的引用或内容保持不变。

### Shared draft 隔离
- 跨 context 切换必定重新初始化
- 同一 context 内多次访问保持幂等

### 验证 `appliedAutoGroupArchiveTime`
```ts
const at = await page.evaluate(() => {
  return (window as any).saveBindingStore.activeBinding?.appliedAutoGroupArchiveTime
})
expect(at).toBeDefined()
```

### 验证 `normalizeState` 字段保留
通过直接设置 localStorage 的 `x4_save_bindings` JSON 并重新加载，然后验证字段值。

### 验证 reset 不执行算法
通过 spy 或检查 `autoGroupResult` 内容与 `calculationBaseline` 一致来验证。

### Edit 模式限制
- 按钮行为：edit 模式下 `handleConfirm()` 返回 false
- 无需恢复 snapshot：退出 edit 只切回 result，不重置 draft

### 语言设置
- 使用 `page.locator('select').filter({ hasText: /简体中文|English/ }).selectOption('zh-CN')`
- Must go through UI — 不能直接设置 localStorage/Cookie
- 在 `beforeEach` 的 fixture 加载后设置

### 动画禁用
```ts
await page.addStyleTag({
  content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
})
```

## 已知 E2E 经验

- 组件中无 `data-testid`（除 sidebar 入口），全部使用 CSS class 选择器
- `.auto-sector-bar` 是确认进入计算模式的关键 selector
- `page.waitForTimeout()` 常用于等待 Vue 响应式更新和渲染（200-500ms）
- Store 直接操作后需要 `waitForTimeout` 等待响应式传播
- `#debug-ready-marker` 是 app 就绪标记
- Map 面板操作与 Live 面板操作使用同一份 shared draft，勿在 Map 侧重复初始化
