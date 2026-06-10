# Game Version Migration Specification

## ADDED Requirements

### Requirement: Migration Actions Visibility

迁移和清理按钮 SHALL 仅在选中版本等于当前版本时显示，且此时 SHALL 隐藏切换按钮。

#### Scenario: Buttons shown when selected equals current version

**前提** `hasStableCounterpart = true` 且下拉选中版本与当前版本一致  
**当** 打开版本选择弹窗  
**那么** SHALL 显示「取消」「下载并清理」「迁移」按钮  
**并且** SHALL NOT 显示「切换」「保存并切换」按钮

#### Scenario: Buttons hidden when selected differs from current

**前提** 下拉选中版本不等于当前版本  
**当** 打开版本选择弹窗  
**那么** SHALL NOT 显示「下载并清理」「迁移」按钮  
**并且** SHALL 显示「切换」「保存并切换」按钮

### Requirement: Version Modal Download and Clean

版本选择弹窗 SHALL 提供「下载并清理」按钮，允许用户导出 beta 数据后清除 beta 存储。

#### Scenario: Download and Clean executes full cleanup

**前提** 用户点击「下载并清理」  
**那么** SHALL 下载 JSON 导出文件  
**并且** SHALL 清除所有 beta localStorage keys 和 IndexedDB  
**并且** SHALL 切换到正式版并刷新

### Requirement: Version Modal Migration

版本选择弹窗 SHALL 提供「迁移」按钮，通过现有的导入流水线将 beta 数据覆盖写入正式版。

#### Scenario: Migration via applyImportPayload

**前提** 用户点击「迁移」  
**那么** SHALL 构造 stable-target `gameDataStore` wrapper  
**并且** SHALL 通过 `applyImportPayload(mode: 'overwrite')` 写入正式版

#### Scenario: Migration confirmation when stable has data

**前提** 正式版存在数据  
**当** 用户点击「迁移」  
**那么** SHALL 弹出确认对话框展示双方各模块数据数量对比  
**并且** 确认后 SHALL 执行覆盖迁移

#### Scenario: Direct migration when stable has no data

**前提** 正式版无任何数据  
**当** 用户点击「迁移」  
**那么** SHALL 直接执行覆盖迁移

## MODIFIED Requirements

### Requirement: Import Wizard Module Display

导入向导 SHALL 始终显示全部 7 个模块类型，不受 JSON 内容影响。

#### Scenario: All modules always visible

**前提** 加载任意 JSON 文件  
**那么** 导入列表 SHALL 显示 empire / flow / ship / save / binding / build-plan / terraforming 共 7 项  
**并且** 不在 JSON 中的模块 SHALL 显示 count = 0

### Requirement: Import Overwrite Cleanup

覆盖导入时，选中但无数据的模块 SHALL 写入合法空状态而非移除 key。

#### Scenario: Overwrite writes empty state

**前提** 覆盖模式导入，某模块选中但 payload 中无数据  
**那么** SHALL 通过 `persistModule` 写入空状态 `{ version, list: [], activeId: null }`  
**并且** SHALL NOT 调用 `localStorage.removeItem`

### Requirement: Import Storage Key Mapping

`getStorageKey` SHALL 为全部 7 个 module key 提供显式映射，未知 key SHALL throw Error。

#### Scenario: All keys explicitly mapped

**前提** 调用 `getStorageKey(moduleKey, gameDataStore)`  
**那么** EMPIRE/FLOW/SHIP/SAVE/BINDING/BUILD_PLAN/TERRAFORMING SHALL 各自映射到 `gameDataStore.getStorageKey(...)` 调用  
**并且** 未知 key SHALL throw Error

### Requirement: Store Auto-Creation Prevention

Store 初始化 SHALL NOT 在无数据时创建默认记录。

#### Scenario: Empty list does not trigger defaults

**前提** 从 localStorage 读取到 `list: []` 的空状态  
**那么** blueprint store SHALL NOT 创建默认 empire 或 station  
**并且** terraforming store SHALL NOT 写入空状态到 localStorage
