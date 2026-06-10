# Knowledge: Game Version Switch

## UI Anchors (data-testid)

### VersionSettingsModal

| data-testid | Element | Purpose |
|-------------|---------|---------|
| `version-settings-modal-backdrop` | Modal backdrop | 点击背景关闭弹窗 |
| `version-settings-modal` | Modal content | 弹窗主容器 |
| `version-settings-close` | Close button (×) | 关闭弹窗 |
| `version-select` | Version dropdown | 选择目标版本 |
| `unsaved-modules-panel` | Dirty modules panel | 未保存模块勾选区域 |
| `unsaved-select-all` | Select all checkbox | 全选/取消全选 |
| `unsaved-module-empire` | Empire checkbox | 勾选 empire 模块 |
| `unsaved-module-logic_flow` | Logic flow checkbox | 勾选 logic_flow 模块 |
| `unsaved-module-ship_blueprints` | Ship blueprints checkbox | 勾选 ship_blueprints 模块 |
| `module-name-empire` | Empire name input | isNew empire 模块名称输入 |
| `module-name-logic_flow` | Logic flow name input | isNew logic_flow 模块名称输入 |
| `module-name-ship_blueprints` | Ship blueprints name input | isNew ship_blueprints 模块名称输入 |
| `version-settings-cancel` | Cancel button | 取消操作 |
| `version-switch` | Switch button | 切换版本（未勾选模块时） |
| `version-save-switch` | Save and Switch button | 保存并切换（勾选模块时） |

### Toolbar

| data-testid | Element | Purpose |
|-------------|---------|---------|
| `toolbar-version-btn` | Version switch button | 打开版本弹窗（位于导出按钮右侧） |
| `toolbar-version-indicator` | Red dot indicator | 首次访问提示（needsVersionSetup=true 时显示） |

## i18n Keys

### settings.gameVersion

| Key | EN | CN |
|-----|----|----|
| `title` | Game Version | 游戏版本 |
| `select` | Select game data version | 选择游戏数据版本 |
| `dataIsolationHint` | Data is not shared between versions. Use import/export to transfer data. | 版本之间数据不互通，如需迁移数据请使用导入导出功能。 |
| `save` | Save | 保存 |
| `switch` | Switch | 切换 |
| `saveAndSwitch` | Save and Switch | 保存并切换 |
| `unsavedModules` | Unsaved Modules | 未保存的模块 |
| `selectAll` | Select All | 全选 |
| `saveScopeWarning` | Checked modules will be saved before switching version. | 勾选的模块会在切换版本前先保存。 |
| `moduleNameLabel` | Name | 名称 |

### moduleNames

| Key | EN | CN |
|-----|----|----|
| `moduleNames.sector` | Sector | 星区 |
| `moduleNames.flow` | Flow | 流程 |
| `moduleNames.ship` | Ship | 舰船 |

### Related Keys

| Key | EN | CN | Purpose |
|-----|----|----|---------|
| `sector.new_sector_name` | New Sector | 新建星区 | Empire 模块默认名称 |
| `menu.default_flow_name` | Flow Draft | 新建流程 | Logic flow 模块默认名称 |
| `menu.default_blueprint_name` | New Blueprint | 新蓝图 | Ship blueprints 模块默认名称 |
| `menu.blueprint` | Blueprint | 蓝图 | Ship blueprints 名称后缀 |
| `menu.placeholder_enter_name` | Enter name | 输入名称 | 名称输入框 placeholder |
| `common.cancel` | Cancel | 取消 | 取消按钮 |

## State Model

### useGameDataStore

```typescript
// Version management state
versionsConfig: VersionConfig[]      // 从 versions.json 加载
currentVersion: string               // '8.0' | '9.0'
isBeta: boolean                      // false | true
folderName: string                   // '8.0-Diplomacy' | '9.0-Empire'
hasStoredVersion: boolean            // localStorage['x4_game_version'] 是否存在

// Computed
currentVersionConfig: VersionConfig | undefined  // 当前版本配置
versionOptions: VersionOption[]                  // 版本下拉选项
needsVersionSetup: boolean                       // !hasStoredVersion，红点显示条件

// Methods
getStorageKey(module): string         // 获取当前版本的 storage key
setVersion(version, beta): void       // 写入 x4_game_version + reload
persistVersionSelection(version, beta): void  // 仅写入 x4_game_version，不 reload
displayVersion(version, beta, codename): string  // 显示格式化版本名
displayFullVersion(version, beta): string        // 显示简短版本名
```

### VersionConfig

```typescript
interface VersionConfig {
  version: string        // "8.0" | "9.0"
  beta: boolean          // false | true
  codename: string       // "Diplomacy" | "Empire"
  folder_name: string    // "8.0-Diplomacy" | "9.0-Empire"
  storage_keys: {
    empire: string       // "x4_empire_data" | "x4_empire_data_v9_beta"
    logic_flow: string   // "x4_logic_flow_plans" | "x4_logic_flow_plans_v9_beta"
    ship_blueprints: string // "x4_ship_blueprints" | "x4_ship_blueprints_v9_beta"
    setting: string      // "x4-setting" | "x4-setting_v9_beta"
  }
}
```

### VersionOption (UI)

```typescript
interface VersionOption {
  version: string
  codename: string
  beta: boolean
  label: string          // "8.0-Diplomacy" | "9.0-Empire-beta"
}
```

### Version Key Format

下拉框 option value 格式: `{version}::{beta|stable}`
- 8.0 stable: `"8.0::stable"`
- 9.0 beta: `"9.0::beta"`

## Known Behaviors

### 初始化流程

1. App mounted → `gameData.initialize()` 被调用
2. 读取 `versions.json` 获取版本配置列表
3. 检查 `localStorage['x4_game_version']`
   - 存在: 使用存储的 `{version, beta}`
   - 不存在: 使用 `versions.json` 的默认配置，设置 `hasStoredVersion=false`
4. 根据 `currentVersion + isBeta` 匹配 `VersionConfig`
5. 使用 `folder_name` 动态加载游戏数据文件

### 版本切换流程

1. 点击 toolbar 版本切换按钮 → 打开 `VersionSettingsModal`
2. 弹窗检查三个模块的 dirty 状态: empire, logic_flow, ship_blueprints
3. 用户选择目标版本
4. 根据场景分支:
   - **同版本 + hasStoredVersion=false**: 仅调用 `persistVersionSelection()`，不 reload
   - **同版本 + hasStoredVersion=true**: 按钮禁用，无操作
   - **不同版本 + 未勾选 dirty**: 直接调用 `setVersion()` → reload
   - **不同版本 + 勾选 dirty**: 保存勾选模块 → 调用 `setVersion()` → reload

### Dirty Module 保存逻辑

```typescript
// 模块 dirty 来源
dirtyModules = [
  { key: 'empire', isDirty: empireStore.isDirty, isNew: empireStore.requiresSaveAsOnSave() },
  { key: 'logic_flow', isDirty: logicFlowStore.isDirty, isNew: logicFlowStore.requiresSaveAsOnSave() },
  { key: 'ship_blueprints', isDirty: shipBuildStore.isDirty, isNew: shipBuildStore.requiresSaveAsOnSave() }
].filter(m => m.isDirty)

// 保存逻辑
if (checked.empire) {
  if (isNew) empireStore.saveEmpireAs(inputName)
  else empireStore.saveEmpire()
}
// logic_flow, ship_blueprints 同理
```

### isNew 模块名称输入

- 当勾选的模块 `isNew=true` 时，显示独立名称输入框
- 输入框预填默认名称:
  - empire: `t('sector.new_sector_name')` = "新建星区"
  - logic_flow: `t('menu.default_flow_name')` = "新建流程"
  - ship_blueprints: `{shipName} ${t('menu.blueprint')}` 或 `t('menu.default_blueprint_name')`
- 名称输入为空时，'保存并切换' 按钮 disabled

### 按钮状态规则

| 条件 | 按钮 | 状态 |
|------|------|------|
| 未勾选任何模块 | '切换' / 'Switch' | 可点击 |
| 勾选至少一个模块 | '保存并切换' / 'Save and Switch' | 可点击（若名称有效） |
| 同版本 + hasStoredVersion=true | '切换' | disabled |
| 同版本 + hasStoredVersion=false | '保存' / 'Save' | 可点击 |
| 勾选 isNew 模块 + 名称空 | '保存并切换' | disabled |

### Storage Key 映射

| 版本 | empire | logic_flow | ship_blueprints |
|------|--------|------------|-----------------|
| 8.0 stable | `x4_empire_data` | `x4_logic_flow_plans` | `x4_ship_blueprints` |
| 9.0 beta | `x4_empire_data_v9_beta` | `x4_logic_flow_plans_v9_beta` | `x4_ship_blueprints_v9_beta` |

### 红点显示条件

- `needsVersionSetup = computed(() => !hasStoredVersion)`
- 当 `localStorage['x4_game_version']` 不存在时显示红点
- 用户确认版本后红点消失

## E2E Locator Patterns

### 弹窗打开

```typescript
// 点击版本切换按钮
await page.locator('[data-testid="toolbar-version-btn"]').click()

// 等待弹窗出现
await page.locator('[data-testid="version-settings-modal"]').waitFor({ state: 'visible' })
```

### 红点检查

```typescript
// 检查红点可见性
const indicator = page.locator('[data-testid="toolbar-version-indicator"]')
await expect(indicator).toBeVisible()  // 或 .toBeHidden()
```

### 版本选择

```typescript
// 选择版本
await page.locator('[data-testid="version-select"]').selectOption('9.0::beta')
```

### 勾选模块

```typescript
// 勾选 empire
await page.locator('[data-testid="unsaved-module-empire"]').check()

// 全选
await page.locator('[data-testid="unsaved-select-all"]').check()
```

### 按钮操作

```typescript
// 切换版本
await page.locator('[data-testid="version-switch"]').click()

// 保存并切换
await page.locator('[data-testid="version-save-switch"]').click()

// 取消
await page.locator('[data-testid="version-settings-cancel"]').click()
```

### i18n 兼容 locator

```typescript
// 使用正则匹配双语
await page.locator('text=/游戏版本|Game Version/i').waitFor()
await page.locator('button', { hasText: /切换|Switch/i }).click()
```

## Existing Test Coverage

### game-data-version-validation.spec.ts

覆盖内容:
- 非法存储版本回退到默认版本
- 版本显示格式 (`displayVersion`, `displayFullVersion`, `versionOptions`)

### version-settings-modal.spec.ts

覆盖内容:
- 选择 9.0 版本并传递 beta 参数给 `setVersion`
- dirty 模块默认不勾选
- 勾选后按钮切换为 'Save and Switch'
- isNew 模块名称输入框
- 同版本未写库场景（仅 `persistVersionSelection`）
- 同版本已写库场景（按钮禁用）

## Gap Analysis

| Test ID | Description | Status |
|---------|-------------|--------|
| T5.1 | Unit: getStorageKey/setVersion | 部分覆盖 |
| T5.2 | E2E: 版本切换流程 | 未覆盖 |
| T5.3 | Unit: 未保存模块流程 | 已覆盖 |
| T5.4 | Unit: 同版本确认禁用 | 已覆盖 |

### 待补充测试

1. **E2E 首次访问红点** - 验证 needsVersionSetup 状态下红点显示
2. **E2E 版本切换数据隔离** - 验证切换后 storage key 正确
3. **E2E dirty 模块保存** - 验证勾选保存流程完整执行
4. **E2E isNew 模块名称输入** - 验证名称空时按钮禁用
