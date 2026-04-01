# Tasks: Game Version Switch

## Overview

实现游戏版本切换功能的任务列表。

**核心原则**：切换版本 = 存储 + 页面刷新，数据在 initialize 时一次性加载。

## Task List

### Phase 1: Data Layer

- [x] **T1.1** 更新 `src/assets/versions.json` 配置文件
  - 已存在，确认包含 8.0 stable 和 9.0 beta 两个版本配置
  - 定义 storage_keys 映射

### Phase 2: Store Layer - Version Management

- [x] **T2.1** 修改 `src/store/logic/useGameData.ts`
  - 移除所有静态 import（13个数据文件）
  - 扩展 `GameDataFiles` 类型
  - 新增 `loadGameDataFiles(folderName)` 动态加载函数
  - 修改所有 `build*` 函数接受数据参数

- [x] **T2.2** 修改 `src/store/useGameDataStore.ts`
  - 版本管理 state（versionsConfig, currentVersion, isBeta, folderName）
  - 方法 `getStorageKey(module)`
  - 方法 `setVersion(version, beta)` - 存储 + 刷新页面

- [x] **T2.3** 修改 `src/store/useEmpireStore.ts`
  - 使用 `gameDataStore.getStorageKey('empire')` 替代硬编码 key

- [x] **T2.4** 修改 `src/store/useLogicFlowStore.ts`
  - 使用 `gameDataStore.getStorageKey('logic_flow')` 替代硬编码 key

- [x] **T2.5** 修改 `src/store/useShipBuildStore.ts`
  - 使用 `gameDataStore.getStorageKey('ship_blueprints')` 替代硬编码 key

- [x] **T2.6** 修改 `src/store/logic/workerModuleCalculator.ts`
  - 从 useGameDataStore 获取 consumption 数据

- [x] **T2.7** 修改 `src/store/logic/productionCalculator.ts`
  - 从 useGameDataStore 获取 consumption 数据

### Phase 2.5: 简化数据访问（移除 computed 包装）

- [x] **T2.8** 简化 `src/store/useGameDataStore.ts`
  - 将 bullets, missiles, drones 等从 computed 改为普通 ref
  - 数据在 initialize 时一次性加载
  - `setVersion()` 改为存储 + `location.reload()`

- [x] **T2.9** 简化组件数据访问
  - `useEquipmentStats.ts` - 保持 computed 用于构建内部 map（正确用法）
  - `ShipStoragePanel.vue` - 使用 gameData.xxx 直接访问
  - `ShipBuildPanelStats.vue` - 使用 gameData.xxx 直接访问
  - `ShipBuildPanelShip.vue` - 使用 gameData.xxx 直接访问
  - `MapSvgCanvas.vue` - 使用 gameData.xxx 直接访问
  - `MapResourceFilterSimplePanel.vue` - 使用 gameData.xxx 直接访问
  - `MapResourceFilterAdvancedPanel.vue` - 使用 gameData.xxx 直接访问
  - `MapWorkbenchView.vue` - 使用 gameData.xxx 直接访问
  - `LanguageSelector.vue` - 使用 gameData.xxx 直接访问

### Phase 2.6: i18n 动态加载

- [x] **T2.10** 修改 `src/i18n.ts`
  - 改为动态加载游戏 locales
  - 新增 `setGameFolderName(name)` 函数

### Phase 2.7: 修复初始化时序问题

- [x] **T2.11** 修复 `src/store/useShipBuildStore.ts` 初始化时序
  - 问题：`loadBlueprintsFromStorage()` 在 store 定义体中直接调用
  - 解决：添加 `initialize()` 异步函数，移除立即调用
  - 确保 `gameData.initialize()` 在读取 storage 前执行

- [x] **T2.12** 修复 `src/store/useLogicFlowStore.ts` 初始化时序
  - 问题：`loadPlansFromStorage()` 在 `gameData.initialize()` 之前调用
  - 解决：调整 `init()` 为 async，先 await gameData.initialize()

- [x] **T2.13** 更新 `src/store/useStationStore.ts` 初始化调用
  - 添加 `await logicFlow.init()`
  - 添加 `shipBuildStore.initialize()` 调用

- [x] **T2.14** 重构初始化协调机制
  - 移除 `useEmpireStore` 末尾的自动 `initialize()` 调用
  - 移除 `useStationStore` 的初始化逻辑，变为纯展示层
  - 在 `App.vue` 添加 `initializeApp()` 统一协调初始化
  - 初始化顺序：gameData → empire/logicFlow/shipBuild (并行)

### Phase 3: UI Layer

- [x] **T3.1** 创建 `src/components/SettingsButton.vue`
  - 齿轮图标按钮
  - 红点指示器（needsVersionSetup）
  - 打开 VersionSettingsModal

- [x] **T3.2** 创建 `src/components/VersionSettingsModal.vue`
  - 版本下拉框（显示 version-codename，beta 后缀）
  - 保存按钮
  - 调用 `setVersion()`

- [x] **T3.3** 修改 Toolbar 组件
  - 初版在语言栏右边添加 SettingsButton

- [x] **T3.4** 扩展 `src/components/VersionSettingsModal.vue`
  - 显示 dirty 模块多选列表与全选
  - 红框强调保存范围
  - 选中项为 isNew 时显示独立名称输入框
  - 按钮规则切换为 `取消|切换` / `取消|保存并切换`

- [x] **T3.5** 扩展同版本确认分支
  - 目标版本与当前版本相同且未写入 `x4_game_version` 时，仅写库不 reload
  - 目标版本与当前版本相同且已写库时，`切换` 按钮置灰
  - dirty 模块保存流仅对真实版本切换生效

- [x] **T3.6** 调整版本入口位置与样式
  - 隐藏工具栏中的 `SettingsButton` 入口，但不删除组件文件
  - 新增导出按钮右侧的独立版本切换按钮
  - 新按钮沿用 `btn-tool` 风格并使用黑色底色
  - 首次未写入 `x4_game_version` 的红点提示迁移到该版本切换按钮

### Phase 4: i18n

- [x] **T4.1** 添加英文翻译 `src/locales/en.json`
  - settings.gameVersion.title
  - settings.gameVersion.select

- [x] **T4.2** 添加中文翻译 `src/locales/zh-CN.json`
  - settings.gameVersion.title
  - settings.gameVersion.select

- [x] **T4.3** 为版本切换保存流补充 i18n
  - 未保存模块标题
  - 全选
  - 保存范围提示
  - 模块名称
  - 切换 / 保存并切换
  - 名称输入标签

### Phase 5: Testing

- [x] **T5.1** 单元测试：版本管理逻辑
  - getStorageKey 返回正确值
  - setVersion 写入 localStorage
  - 版本匹配逻辑

- [x] **T5.2** E2E 测试：版本切换流程
  - 首次访问显示红点
  - 切换版本
  - 数据隔离验证

- [x] **T5.3** 单元测试：版本弹窗未保存模块流程
  - dirty 模块默认不勾选
  - 全选行为
  - 按钮状态切换
  - isNew 模块单独名称输入框
  - 保存选中模块后切版本

- [x] **T5.4** 单元测试：同版本确认与禁用逻辑
  - 未写库但目标版本与当前版本相同时，仅写入 `x4_game_version`
  - 已写库且目标版本与当前版本相同时，切换按钮置灰

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
