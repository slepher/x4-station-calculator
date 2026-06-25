# fav-ship-blueprint 任务清单

## T1: 类型定义 - ShipBlueprint 新增 favorite 字段

- [x] 在 `src/types/x4.ts` 的 `ShipBlueprint` 接口中新增 `favorite?: boolean`

## T2: 版本升级 - 存储版本升至 4

- [x] 修改 `src/store/logic/storageVersions.ts`：`CURRENT_SHIP_BLUEPRINT_VERSION` 从 `3` → `4`

## T3: 数据迁移 - V3→V4 迁移

- [x] 在 `src/store/logic/stateMigrations.ts` 的 `migrateShipBlueprintStateToCurrent` 中：
  - 对所有 `ships` 中缺少 `favorite` 字段的 blueprint 设置为 `favorite: false`

## T4: Store 方法 - toggleFavoriteBlueprint

- [x] 在 `src/store/useShipBuildStore.ts` 中新增 `toggleFavoriteBlueprint(id: string)` 方法：
  - 若 `id` 为内置预设 → 直接返回
  - 在 `savedBlueprints.value.ships` 中查找匹配的 blueprint
  - 切换 `favorite` 字段（`!bp.favorite`）
  - 调用 `saveBlueprintsToStorage()` 持久化

- [x] 修订 `toggleFavoriteBlueprint`：
  - 移除 `isBuiltInBlueprintId` 守卫
  - 移除 `saveBlueprintsToStorage()` 自动持久化
  - 仅 toggle 内存标记，由调用方决定持久化时机

## T5: 主界面收藏按钮 - ShipBuildPanelFit.vue

- [x] 在 panel-header 的 `ship-blueprint-trigger` 按钮左侧新增收藏按钮：
  - ~~显示条件：`selectedShip` 存在且当前蓝图非内置预设~~（移除条件，始终显示）
  - 点击时仅 toggle 内存标记，不立即持久化
  - 实心/空心星形图标切换
  - 添加 `data-testid="ship-build-blueprint-fav-btn"`

- [x] 修订：
  - 移除按钮的 `v-if="isCurrentBlueprintFavoritable"` 条件
  - `toggleFavoriteCurrent` 仅 toggle 内存，不调持久化

## T6: 下拉菜单 - 收藏标记与排序

- [x] 在 `loadableBlueprintItems` computed 中新增 `favorite` 和 `createdAt` 字段
- [x] 在 `groupedLoadableBlueprintItems` 中按 `createdAt` 降序 + 名称字母序排列
- [x] 在菜单行的名称和删除按钮之间新增星形图标
  - ~~所有蓝图显示~~（仅用户蓝图显示，内置预设不显示）
  - 可点击切换
  - 已收藏显示实心星形，未收藏显示空心星形

- [x] 修订：
  - 预设项不显示星形图标（`v-if="!item.isBuiltIn"`）
  - 点击切换 fav，非当前蓝图立即持久化
  - flex 布局替代 absolute 定位

## T7: 模态框 - 收藏标记

- [x] 在 `LoadShipBlueprintModal.vue` 的蓝图卡片行中新增收藏星形标记
  - ~~仅用户蓝图显示~~（所有蓝图显示）
  - ~~已收藏显示实心星形，不可点击~~（可点击切换）

- [x] 修订：
  - 预设项不显示星形图标
  - 添加 `@click` 处理：切换 fav，非当前蓝图立即持久化

## T8: i18n - 新增文案

- [x] `src/locales/zh-CN.json`：新增 `shipBuild.fav_add`（添加到收藏）、`shipBuild.fav_remove`（取消收藏）
- [x] `src/locales/en.json`：新增 `shipBuild.fav_add`（Add to Favorites）、`shipBuild.fav_remove`（Remove from Favorites）

## T9: 构建验证

- [x] 执行 `npm run build`，确保无 TypeScript 编译错误
- [x] 若构建失败，修复代码后重新构建直至通过

## T10: 附加修订

- [x] `ShipBlueprint.createdAt` 字段、版本 4→5、迁移逻辑
- [x] `saveBlueprint`/`saveAsBlueprint` 首次保存设置 `createdAt`
- [x] `loadBlueprint` preset 路径保留 `favorite` 和 `createdAt`
- [x] 排序改为 `createdAt` 降序 + 名称字母序
- [x] 暴露 `saveBlueprintsToStorage()` 供菜单/模态框 fav 切换使用
- [x] 删除按钮改为常显示
