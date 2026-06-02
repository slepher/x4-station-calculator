# fav-ship-blueprint 变更请求

## 目标

为飞船配装界面新增蓝图收藏功能。用户可通过主界面的收藏按钮收藏/取消收藏当前蓝图，收藏状态在菜单和模态框中以星形图标展示，收藏的蓝图在列表中优先排列，状态持久化到 localStorage。

## 已确认方案（审核重点）

### 1. 数据模型变更

**`ShipBlueprint` 类型**（`src/types/x4.ts:832-843`）：
- 新增 `favorite?: boolean` 字段（可选，`undefined` 等效 `false`）

**版本升级**：
- `CURRENT_SHIP_BLUEPRINT_VERSION` 从 `3` 升至 `4`（`src/store/logic/storageVersions.ts:3`）

### 2. 迁移逻辑

**位置**：`src/store/logic/stateMigrations.ts:436-467` `migrateShipBlueprintStateToCurrent`

**规则**：
- 旧数据（version < 4）的 blueprint 若缺少 `favorite` 字段 → 设置为 `false`
- 新数据直接读取 `blueprint.favorite` 字段

### 3. 收藏按钮（主界面）

**位置**：`ShipBuildPanelFit.vue` panel-header 区域（`ship-blueprint-trigger` 按钮左侧）

**显示条件**：
- 当前已选择飞船
- 当前蓝图非内置预设（`isBuiltInBlueprintId(id)` 为 `false`）

**行为**：
- 点击切换当前蓝图的 `favorite` 状态（true ↔ false）
- 切换后立即保存到 localStorage
- 图标：实心星星（已收藏）/ 空心星星（未收藏）

**隐藏条件**：
- 内置预设蓝图（空配/低配/中配/高配）不显示收藏按钮

### 4. 下拉菜单中的收藏标记

**位置**：`ShipBuildPanelFit.vue` 下拉菜单行（`ship-blueprint-menu-row`）

**行内布局**：`[配装名称] [星形图标(仅展示)] [删除按钮]`

**行为**：
- 星形图标仅展示状态，不可点击切换
- 仅用户蓝图显示（内置预设不显示）
- 已收藏：实心星形；未收藏：不显示或空心
- 根据用户选择：菜单中的星形图标放在名称和删除按钮之间

**排序**：
- 在用户配装组（`blueprint_group_user`）内，已收藏的蓝图排在未收藏之前

### 5. 模态框中的收藏标记

**位置**：`LoadShipBlueprintModal.vue` 蓝图卡片行

**行为**：
- 星形图标仅展示状态，不可点击切换
- 仅用户蓝图显示

### 6. localStorage 持久化

**存储 key**：`x4_ship_blueprints`（已有，不变）

**逻辑**：
- `toggleFavoriteBlueprint(id)` 更新内存中的 `ShipBlueprint.favorite`
- 调用 `saveBlueprintsToStorage()` 立即写入 localStorage
- 读取时自动加载

### 7. i18n 文案

新增以下 key（`shipBuild` 命名空间）：

| key | 中文 | English |
|---|---|---|
| `fav_add` | 添加到收藏 | Add to Favorites |
| `fav_remove` | 取消收藏 | Remove from Favorites |

## 边界

### In Scope

- `ShipBlueprint.favorite` 字段添加（可选，默认 `false`）
- 版本升级 `3` → `4` 与迁移逻辑（补 `favorite: false`）
- 主界面收藏按钮（切换当前蓝图收藏状态）
- 下拉菜单中的收藏星形标记（仅展示）与收藏优先排序
- 模态框中的收藏星形标记（仅展示）
- Store 层 `toggleFavoriteBlueprint` 方法
- i18n 文案新增

### Out of Scope

- 收藏列表的单独筛选/过滤功能
- 跨飞船的收藏汇总视图
- E2E 测试编写（属于 `/x4:test` scope）
- 内置预设蓝图的收藏支持

## 验收标准（DoD）

1. **收藏切换**：
   - 主界面收藏按钮可切换当前用户蓝图收藏状态（空心 ↔ 实心）
   - 点击后状态立即反映在按钮图标上

2. **持久化**：
   - 收藏后刷新页面，收藏状态保持不变
   - 新建蓝图默认 `favorite: false`

3. **菜单展示**：
   - 用户配装组中已收藏蓝图排在未收藏之前
   - 已收藏蓝图在名称右侧显示实心星形图标
   - 内置预设不显示星形图标

4. **模态框展示**：
   - 已收藏蓝图在卡片中显示星形图标
   - 内置预设不显示星形图标

5. **迁移兼容**：
   - 加载 version=3 的旧数据，所有蓝图自动设置 `favorite: false`
   - 迁移后保存的数据 version=4

6. **编译验证**：
   - `npm run build` 成功，无 TypeScript 类型错误

## 未决项

无
