# Tasks: Game Version Switch

## Overview

实现游戏版本切换功能的任务列表。

## Task List

### Phase 1: Data Layer

- [ ] **T1.1** 创建 `src/assets/versions.json` 配置文件
  - 包含 8.0 stable 和 9.0 beta 两个版本配置
  - 定义 storage_keys 映射

### Phase 2: Store Layer

- [ ] **T2.1** 修改 `src/store/logic/useGameData.ts`
  - 移除静态 import（waresRaw, modulesRaw 等）
  - 新增 `loadGameDataFiles(folderName)` 动态加载函数
  - 修改所有 `build*` 函数接受数据参数

- [ ] **T2.2** 修改 `src/store/useGameDataStore.ts`
  - 新增版本管理 state（versionsConfig, currentVersion, isBeta, hasStoredVersion）
  - 新增 computed（currentVersionConfig, versionOptions, needsVersionSetup）
  - 新增方法 `getStorageKey(module)`
  - 新增方法 `setVersion(version, beta)`
  - 修改 `initialize()` 逻辑

- [ ] **T2.3** 修改 `src/store/useEmpireStore.ts`
  - 使用 `gameDataStore.getStorageKey('empire')` 替代硬编码 key

- [ ] **T2.4** 修改 `src/store/useLogicFlowStore.ts`
  - 使用 `gameDataStore.getStorageKey('logic_flow')` 替代硬编码 key

- [ ] **T2.5** 修改 `src/store/useShipBuildStore.ts`
  - 使用 `gameDataStore.getStorageKey('ship_blueprints')` 替代硬编码 key

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
              └──► T3.1 ──► T3.2 ──► T3.3

T2.1 ──► T2.2

T3.2 ──► T4.1
      ──► T4.2

All ──► T5.1
    ──► T5.2
```

## Estimated Effort

| Task | Effort |
|------|--------|
| T1.1 | S (已存在，需修改) |
| T2.1 | M |
| T2.2 | L |
| T2.3-T2.5 | S (each) |
| T3.1 | S |
| T3.2 | M |
| T3.3 | S |
| T4.1-T4.2 | S (each) |
| T5.1 | M |
| T5.2 | M |

**Total**: ~2-3 days