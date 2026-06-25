# fav-ship-blueprint 设计文档

## 架构概览

本变更遵循现有 `store → presenter → vue` 三层架构。由于 ship-build 模块目前尚未完全迁移到 presenter 模式（组件直接访问 store），本变更在现有模式下工作，不引入额外中间层。

## 决策记录

### D1: 收藏按钮交互边界

**决定**：主界面、菜单和模态框中的星星均可点击切换 fav。

**持久化策略**：
- 当前蓝图：切换仅更新内存标记，随 `saveBlueprint()` 统一持久化
- 菜单/模态框中非当前蓝图：切换后立即 `saveBlueprintsToStorage()` 持久化

### D2: 排序策略

**决定**：用户配装组按 `createdAt` 降序排列（最新创建的在前），相同时按名称字母序。

**理由**：
- 创建时间比收藏状态更适合作为默认排序，用户在浏览配装时通常希望看到最近创建的
- 创建时间相同用字母序确保确定性

### D3: 版本升级策略

**决定**：`CURRENT_SHIP_BLUEPRINT_VERSION` 从 `3` 升至 `4`，迁移时对所有 blueprint 补 `favorite: false`。

**理由**：
- `favorite` 是可选字段（`undefined` 等效 `false`），但显式版本升级确保后续代码可依赖字段存在
- 遵循现有 `migrateShipBlueprintStateToCurrent` 的简单版本设置模式
- 与 `ship-build-method` 变更的版本升级方式一致

### D4: 菜单星形图标位置

**决定**：星形图标放在蓝图名称和删除按钮之间，使用 flex 布局，移除 absolute 定位。

### D5: 预设蓝图 fav 策略

**决定**：内置预设蓝图不显示 fav 星标（菜单和模态框中），主界面 fav 按钮始终显示。

**理由**：
- 预设是模板，不可收藏
- 切换到预设时，`loadBlueprint` 的 `shouldApplyToCurrentSaved` 路径需保留 `favorite` 和 `createdAt`，避免覆盖已有蓝图的属性

## 数据流

```
用户点击收藏按钮
  → ShipBuildPanelFit.vue / LoadShipBlueprintModal.vue
  → 判断是否当前蓝图
    → 当前蓝图：仅 toggle favorite 内存标记
    → 非当前蓝图：toggle favorite + saveBlueprintsToStorage()
  → 响应式更新触发 UI 刷新
```

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/types/x4.ts` | 修改 | `ShipBlueprint` 新增 `favorite?: boolean` 和 `createdAt: number` |
| `src/store/logic/storageVersions.ts` | 修改 | `CURRENT_SHIP_BLUEPRINT_VERSION` 3→4→5 |
| `src/store/logic/stateMigrations.ts` | 修改 | 迁移逻辑补充 `favorite: false` 和 `createdAt = lastUpdated` |
| `src/store/useShipBuildStore.ts` | 修改 | 新增 `toggleFavoriteBlueprint`、`saveBlueprintsToStorage`；`saveBlueprint`/`saveAsBlueprint` 设 `createdAt`；`loadBlueprint` 保留 `favorite`+`createdAt` |
| `src/components/ship-build/ShipBuildPanelFit.vue` | 修改 | 收藏按钮始终显示；菜单星标可点击，预设不显示；排序按 `createdAt`；flex 布局 |
| `src/components/ship-build/LoadShipBlueprintModal.vue` | 修改 | 收藏标记可点击，预设不显示 |
