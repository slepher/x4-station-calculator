# Tasks: Game Version Switch

## Overview

实现游戏版本切换功能的任务列表，包括动态数据加载重构。

## Task List

### Phase 1: Data Layer

- [ ] **T1.1** 更新 `src/assets/versions.json` 配置文件
  - 已存在，确认包含 8.0 stable 和 9.0 beta 两个版本配置
  - 定义 storage_keys 映射

### Phase 2: Store Layer - Version Management

- [ ] **T2.1** 修改 `src/store/logic/useGameData.ts`
  - 移除所有静态 import（13个数据文件）
  - 扩展 `GameDataFiles` 类型（新增 bullets, maps, factions 等）
  - 新增 `loadGameDataFiles(folderName)` 动态加载函数（加载所有数据文件）
  - 修改所有 `build*` 函数接受数据参数

- [ ] **T2.2** 修改 `src/store/useGameDataStore.ts`
  - 新增版本管理 state（versionsConfig, currentVersion, isBeta, hasStoredVersion, gameData, folderName）
  - 新增版本 computed（currentVersionConfig, versionOptions, needsVersionSetup）
  - 新增数据 computed（bullets, missiles, drones, consumables, maps, regionyields, factions, defaultMaxes, shipSlots, languages）
  - 新增方法 `getStorageKey(module)`
  - 新增方法 `setVersion(version, beta)`
  - 新增方法 `getRawData(file)` （可选，用于特殊场景）
  - 修改 `initialize()` 逻辑

- [ ] **T2.3** 修改 `src/store/useEmpireStore.ts`
  - 使用 `gameDataStore.getStorageKey('empire')` 替代硬编码 key

- [ ] **T2.4** 修改 `src/store/useLogicFlowStore.ts`
  - 使用 `gameDataStore.getStorageKey('logic_flow')` 替代硬编码 key

- [ ] **T2.5** 修改 `src/store/useShipBuildStore.ts`
  - 使用 `gameDataStore.getStorageKey('ship_blueprints')` 替代硬编码 key

### Phase 2.5: Data Loading Refactor - Store Logic

- [ ] **T2.6** 修改 `src/store/logic/workerModuleCalculator.ts`
  - 从 useGameDataStore 获取 consumption 数据
  - 移除静态 import

- [ ] **T2.7** 修改 `src/store/logic/productionCalculator.ts`
  - 从 useGameDataStore 获取 consumption 数据
  - 移除静态 import

### Phase 2.6: Data Loading Refactor - Composables

- [ ] **T2.8** 修改 `src/composables/useEquipmentStats.ts`
  - 从 useGameDataStore 获取 bullets, missiles 数据
  - 移除静态 import

### Phase 2.7: Data Loading Refactor - Ship Build Components

- [ ] **T2.9** 修改 `src/components/ship-build/ShipStoragePanel.vue`
  - 从 useGameDataStore 获取 consumables, drones, missiles, equipments
  - 移除静态 import（4个）

- [ ] **T2.10** 修改 `src/components/ship-build/ShipBuildPanelStats.vue`
  - 从 useGameDataStore 获取 bullets, missiles, defaultMaxes
  - 移除静态 import（3个）

- [ ] **T2.11** 修改 `src/components/ship-build/ShipBuildPanelShip.vue`
  - 从 useGameDataStore 获取 defaultMaxes, shipSlots
  - 移除静态 import（2个）

### Phase 2.8: Data Loading Refactor - Map Components

- [ ] **T2.12** 修改 `src/components/empire/MapSvgCanvas.vue`
  - 从 useGameDataStore 获取 maps 数据
  - 移除静态 import

- [ ] **T2.13** 修改 `src/components/empire/MapResourceFilterSimplePanel.vue`
  - 从 useGameDataStore 获取 maps, regionyields 数据
  - 移除静态 import（2个）

- [ ] **T2.14** 修改 `src/components/empire/MapResourceFilterAdvancedPanel.vue`
  - 从 useGameDataStore 获取 maps, regionyields 数据
  - 移除静态 import（2个）

- [ ] **T2.15** 修改 `src/components/empire/MapWorkbenchView.vue`
  - 从 useGameDataStore 获取 maps, regionyields, factions 数据
  - 移除静态 import（3个）

### Phase 2.9: Data Loading Refactor - Other Components

- [ ] **T2.16** 修改 `src/components/LanguageSelector.vue`
  - 从 useGameDataStore 获取 languages 数据
  - 移除静态 import

- [ ] **T2.17** 修改 `src/i18n.ts`
  - 改为动态加载游戏 locales
  - 新增 `setGameFolderName(name)` 函数
  - 修改 `getGameLocaleLoader` 使用动态路径

### Phase 3: UI Layer

- [ ] **T3.1** 创建 `src/components/SettingsButton.vue`
  - 齿轮图标按钮
  - 红点指示器（needsVersionSetup）
  - 打开 VersionSettingsModal

- [ ] **T3.2** 创建 `src/components/VersionSettingsModal.vue`
  - 版本下拉框（显示 version-codename，beta 后缀）
  - 保存按钮
  - 调用 `setVersion()`

- [ ] **T3.3** 修改 Toolbar 组件
  - 在语言栏右边添加 SettingsButton

### Phase 4: i18n

- [ ] **T4.1** 添加英文翻译 `src/locales/en.json`
  - settings.gameVersion.title
  - settings.gameVersion.select

- [ ] **T4.2** 添加中文翻译 `src/locales/zh-CN.json`
  - settings.gameVersion.title
  - settings.gameVersion.select

### Phase 5: Testing

- [ ] **T5.1** 单元测试：版本管理逻辑
  - getStorageKey 返回正确值
  - setVersion 写入 localStorage
  - 版本匹配逻辑

- [ ] **T5.2** E2E 测试：版本切换流程
  - 首次访问显示红点
  - 切换版本
  - 数据隔离验证

## Dependencies

```
T1.1 ──► T2.2 ──► T2.3
              ├──► T2.4
              ├──► T2.5
              ├──► T2.6
              ├──► T2.7
              ├──► T2.8
              ├──► T2.9
              ├──► T2.10
              ├──► T2.11
              ├──► T2.12
              ├──► T2.13
              ├──► T2.14
              ├──► T2.15
              ├──► T2.16
              ├──► T2.17
              └──► T3.1 ──► T3.2 ──► T3.3

T2.1 ──► T2.2

T3.2 ──► T4.1
      ──► T4.2

All ──► T5.1
    ──► T5.2
```

## Estimated Effort

| Task | Effort | Notes |
|------|--------|-------|
| T1.1 | XS | 已存在，确认即可 |
| T2.1 | L | 核心重构，新增动态加载 |
| T2.2 | L | 核心重构，大量新增 state/getter |
| T2.3-T2.5 | S | each，简单替换 |
| T2.6-T2.7 | S | each，简单替换 |
| T2.8 | S | 简单替换 |
| T2.9-T2.11 | S | each，飞船组件 |
| T2.12-T2.15 | S | each，地图组件 |
| T2.16 | S | 简单替换 |
| T2.17 | M | i18n 需要特殊处理 |
| T3.1 | S | 新组件 |
| T3.2 | M | 新组件 |
| T3.3 | S | 简单添加 |
| T4.1-T4.2 | S | each |
| T5.1 | M | |
| T5.2 | M | |

**Total**: ~3-4 days

## Not In Scope

以下文件不在本次重构范围内，保持原有实现：

| 类别 | 文件 | 原因 |
|------|------|------|
| Scripts | `scripts/seed/*.tsx` | 脚本运行时可指定版本 |
| Scripts | `scripts/db_fixture.tsx` | 脚本运行时可指定版本 |
| Scripts | `scripts/gen_fixtures.ts` | 脚本运行时可指定版本 |
| Tests | `tests/unit/**/*.spec.ts` | 测试使用 mock 或固定路径 |
| Docs | `docs/**`, `openspec/**` | 文档，不影响运行时 |