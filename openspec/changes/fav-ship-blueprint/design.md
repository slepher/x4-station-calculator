# fav-ship-blueprint 设计文档

## 架构概览

本变更遵循现有 `store → presenter → vue` 三层架构。由于 ship-build 模块目前尚未完全迁移到 presenter 模式（组件直接访问 store），本变更在现有模式下工作，不引入额外中间层。

## 决策记录

### D1: 收藏按钮交互边界

**决定**：仅主界面收藏按钮可切换收藏状态，菜单和模态框中的星形仅做状态展示，不可点击切换。

**理由**：
- 用户在配装编辑场景中，收藏决策与当前蓝图绑定最直观
- 菜单/模态框是"浏览和选择"场景，避免误操作
- 减少事件传播复杂度和状态同步窗口

### D2: 收藏排序策略

**决定**：在用户配装组（`blueprint_group_user`）内部，已收藏蓝图排在未收藏之前，各组内保持原有相对顺序。

**理由**：
- 排序仅影响组内顺序，不改变组结构（不拆分收藏组与非收藏组）
- 稳定排序保证同级别的蓝图次序不因收藏状态变化产生额外切换

**实现**：在 `groupedLoadableBlueprintItems` computed 中，对 `userItems` 按 `favorite` 降序排列（`true` 在前）。

### D3: 版本升级策略

**决定**：`CURRENT_SHIP_BLUEPRINT_VERSION` 从 `3` 升至 `4`，迁移时对所有 blueprint 补 `favorite: false`。

**理由**：
- `favorite` 是可选字段（`undefined` 等效 `false`），但显式版本升级确保后续代码可依赖字段存在
- 遵循现有 `migrateShipBlueprintStateToCurrent` 的简单版本设置模式
- 与 `ship-build-method` 变更的版本升级方式一致

### D4: 菜单星形图标位置

**决定**：星形图标放在蓝图名称和删除按钮之间。

**理由**：
- 用户指定
- 名称左侧空间由一个交互按钮占据（载入按钮），星形不应覆盖

## 数据流

```
用户点击收藏按钮
  → ShipBuildPanelFit.vue: toggleFavoriteCurrent()
  → useShipBuildStore.toggleFavoriteBlueprint(id)
    → 在 savedBlueprints.ships 中查找 blueprint
    → 切换 favorite 字段
    → saveBlueprintsToStorage()
    → takeSnapshot()
  → 响应式更新触发 UI 刷新：
    - 按钮图标更新
    - 菜单收藏标记更新
    - 菜单排序更新
```

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/types/x4.ts` | 修改 | `ShipBlueprint` 新增 `favorite?: boolean` |
| `src/store/logic/storageVersions.ts` | 修改 | `CURRENT_SHIP_BLUEPRINT_VERSION` 3→4 |
| `src/store/logic/stateMigrations.ts` | 修改 | 迁移逻辑补充 `favorite: false` |
| `src/store/useShipBuildStore.ts` | 修改 | 新增 `toggleFavoriteBlueprint` 方法 |
| `src/components/ship-build/ShipBuildPanelFit.vue` | 修改 | 新增收藏按钮 + 菜单星形标记 + 排序逻辑 |
| `src/components/ship-build/LoadShipBlueprintModal.vue` | 修改 | 新增收藏标记 |
| `src/locales/en.json` | 修改 | 新增 `fav_add`、`fav_remove` 文案 |
| `src/locales/zh-CN.json` | 修改 | 新增 `fav_add`、`fav_remove` 文案 |
