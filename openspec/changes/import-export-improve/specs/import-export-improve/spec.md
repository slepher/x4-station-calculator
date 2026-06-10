# Import Export Improve Specification

## MODIFIED Requirements

### Requirement: Save Binding Import

存档绑定导入 SHALL 在增量模式下以 `gameGuid` 去重合并。

#### Scenario: Incremental import merges by gameGuid

**前提** 当前存在 `gameGuid = "A"` 的存档绑定  
**当** 以增量模式导入包含 `gameGuid = "A"`（内容有变化）和 `gameGuid = "B"`（新的）的绑定数据  
**那么** `gameGuid = "A"` 的条目 SHALL 被导入数据覆盖  
**并且** `gameGuid = "B"` 的条目 SHALL 被追加  
**并且** 当前已有的其他 `gameGuid` 条目 SHALL 保留

#### Scenario: Overwrite mode replaces all bindings

**前提** 以覆盖模式导入  
**那么** 所有现有存档绑定 SHALL 被导入数据替换

### Requirement: Terraforming Import

地球化导入 SHALL 在增量模式下以 `(mode, planId)` 去重合并。

#### Scenario: Incremental import merges by mode and planId

**前提** 当前存在 `(mode = "live", planId = "guid-X")` 的地球化计划  
**当** 以增量模式导入包含相同 `(mode, planId)` 但执行日志有更新的数据  
**那么** 该计划 SHALL 被导入数据覆盖  
**并且** 新的 `(mode, planId)` 条目 SHALL 被追加

#### Scenario: Overwrite mode replaces all terraforming plans

**前提** 以覆盖模式导入  
**那么** 所有现有地球化计划 SHALL 被导入数据替换

### Requirement: Import Success Reload

导入成功后 SHALL 刷新页面以确保侧边栏同步。

#### Scenario: Page reloads after successful import

**前提** 导入成功完成  
**当** 所有选中模块已应用  
**那么** 页面 SHALL 通过 `window.location.reload()` 重新加载

### Requirement: Terraforming Module Name i18n

`moduleNames.terraforming` SHALL 在中文显示「地球化」，英文显示「Terraforming」。
