# Game Version Migration Specification

## ADDED Requirements

### Requirement: Version Modal Download and Clean

版本选择弹窗 SHALL 提供「下载并清理」按钮，允许用户导出 beta 数据后清除 beta 存储。

#### Scenario: Download and Clean button in version modal

**前提** `hasStableCounterpart = true`  
**当** 打开版本选择弹窗  
**那么** 底部 SHALL 显示「下载并清理」按钮，位于「取消」和「迁移」之间  
**并且** hover 时 SHALL 显示 tooltip 说明会清除数据

#### Scenario: Download and Clean executes full cleanup

**前提** 用户点击「下载并清理」  
**那么** SHALL 下载 JSON 导出文件  
**并且** SHALL 清除所有 beta localStorage keys 和 IndexedDB  
**并且** SHALL 切换到正式版并刷新

### Requirement: Version Modal Migration

版本选择弹窗 SHALL 提供「迁移」按钮，将 beta 数据直接覆盖写入正式版。

#### Scenario: Migrate button in version modal

**前提** `hasStableCounterpart = true`  
**当** 打开版本选择弹窗  
**那么** 底部 SHALL 显示「迁移」按钮，位于「下载并清理」和「确定」之间  
**并且** hover 时 SHALL 显示 tooltip

#### Scenario: Migration with stable data confirmation

**前提** 正式版存在数据  
**当** 用户点击「迁移」  
**那么** SHALL 弹出确认对话框展示双方数据数量对比  
**并且** 确认后 SHALL 以覆盖模式写入正式版

#### Scenario: Migration without stable data

**前提** 正式版无任何数据  
**当** 用户点击「迁移」  
**那么** SHALL 直接以覆盖模式写入正式版并清理 beta

### Requirement: Button Order

版本弹窗底部按钮顺序 SHALL 为：取消 → 下载并清理 → 迁移 → 确定/保存并切换。
