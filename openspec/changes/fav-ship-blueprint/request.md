# fav-ship-blueprint 变更请求

## 目标

为飞船配装界面新增蓝图收藏功能。用户可通过主界面的收藏按钮收藏/取消收藏当前蓝图，收藏状态在配装面板菜单中以星形图标展示，收藏状态持久化到 localStorage。

## 已确认方案（审核重点）

### 1. 数据模型变更

**`ShipBlueprint` 类型**（`src/types/x4.ts:832-843`）：
- 新增 `favorite?: boolean` 字段（可选，`undefined` 等效 `false`）
- 新增 `createdAt: number` 字段（首次保存时设置，后续更新不变）

**版本升级**：
- `CURRENT_SHIP_BLUEPRINT_VERSION` 从 `3` 升至 `4`（favorite），`4` 升至 `5`（createdAt）

### 2. 迁移逻辑

**位置**：`src/store/logic/stateMigrations.ts`

**规则**：
- 旧数据（version < 4）的 blueprint 若缺少 `favorite` 字段 → 设置为 `false`
- 旧数据（version < 5）的 blueprint 若缺少 `createdAt` 字段 → 设置为 `lastUpdated`

### 3. 收藏按钮（主界面）

**位置**：`ShipBuildPanelFit.vue` panel-header 区域（`ship-blueprint-trigger` 按钮左侧）

**显示条件**：
- 始终显示

**行为**：
- 点击切换当前蓝图的 `favorite` 状态（true ↔ false）
- 切换仅修改内存标记，**不立即持久化到 localStorage**
- fav 标记随 `saveBlueprint()` 保存配装时统一落地
- 图标：实心星星（已收藏）/ 空心星星（未收藏）

### 4. 下拉菜单中的收藏标记

**位置**：`ShipBuildPanelFit.vue` 下拉菜单行（`ship-blueprint-menu-row`）

**布局**：flex 行，文本区域（载入）+ 星标按钮（仅用户蓝图）+ 删除按钮

**行为**：
- 星形图标仅用户蓝图显示（内置预设不显示）
- 星形图标可点击切换 fav
- 点击当前蓝图 → 仅内存标记，不持久化
- 点击非当前蓝图 → toggle 后立即 `saveBlueprintsToStorage()` 持久化
- 已收藏：实心星形；未收藏：空心星形
- hover 高亮仅在文本区域，星标和删除按钮独立响应

**排序**：
- 按 `createdAt` 降序排列（最近创建的在前），相同时按名称字母序

### 5. 旧载入弹窗清理

**位置**：`LoadShipBlueprintModal.vue`

**行为**：
- 旧 toolbar 载入弹窗已不可达，SHALL 删除组件和挂载链。
- `ship-build` 视图的蓝图载入 SHALL 统一通过 `ShipBuildPanelFit.vue` header 蓝图菜单完成。

### 6. localStorage 持久化

**存储 key**：`x4_ship_blueprints`（已有，不变）

**逻辑**：
- `toggleFavoriteBlueprint(id)` 更新内存中的 `ShipBlueprint.favorite`，不自动持久化
- 由调用方决定是否持久化：当前蓝图推迟到 `saveBlueprint()` 时统一持久化；菜单中的非当前蓝图切换后立即调用 `saveBlueprintsToStorage()`

### 7. i18n 文案

新增以下 key（`shipBuild` 命名空间）：

| key | 中文 | English |
|---|---|---|
| `fav_add` | 添加到收藏 | Add to Favorites |
| `fav_remove` | 取消收藏 | Remove from Favorites |

## 边界

### In Scope

- `ShipBlueprint.favorite` 字段添加（可选，默认 `false`）
- `ShipBlueprint.createdAt` 字段添加（首次保存时设置）
- 版本升级 `3` → `4` → `5` 与迁移逻辑
- 主界面收藏按钮（切换当前蓝图收藏状态，不立即持久化）
- 下拉菜单中的收藏星形标记（仅用户蓝图，可点击）
- 删除不可达的旧蓝图载入弹窗 `LoadShipBlueprintModal.vue`
- Store 层 `toggleFavoriteBlueprint` 方法（移除 auto-save）
- 蓝图列表按 `createdAt` 降序 + 名称字母序排列
- 切换到预设时保留已有蓝图的 `favorite` 标记
- i18n 文案新增

### Out of Scope

- 收藏列表的单独筛选/过滤功能
- 跨飞船的收藏汇总视图
- E2E 测试编写（属于 `/x4:test` scope）

## 验收标准（DoD）

1. **收藏切换**：
   - 主界面收藏按钮可切换当前用户蓝图收藏状态（空心 ↔ 实心）
   - 点击后状态立即反映在按钮图标上，不立即持久化

2. **持久化**：
   - 收藏当前蓝图后保存配装，刷新页面后收藏状态保持
   - 新建蓝图默认 `favorite: false`

3. **菜单展示**：
   - 用户蓝图按 `createdAt` 降序 + 名称字母序排列
   - 已收藏蓝图显示实心星形，未收藏显示空心星形
   - 内置预设不显示星形图标
   - 点击非当前蓝图立即持久化
   - 点击文本区域载入蓝图，hover 高亮限定文本区域

4. **旧弹窗清理**：
   - `LoadShipBlueprintModal.vue` 不再存在
   - 源码中不存在 `LoadShipBlueprintModal` / `showLoadShipBlueprintModal` 引用

5. **迁移兼容**：
   - 加载 version=3 旧数据，补 `favorite: false`
   - 加载 version<5 旧数据，补 `createdAt = lastUpdated`

6. **切换预设保护**：
   - 切换到预设蓝图时，已保存用户蓝图的 `favorite` 标记不丢失

7. **编译验证**：
   - `npm run build` 成功

## 未决项

无
