# Empire Management Specification

## Purpose
调整 empire 管理边界，使 empire 不再承担 save binding 与 binding 星区职责，仅保存普通 station 规划；并添加 productionSource 路由以支持 empire / save-binding 数据源切换。

## MODIFIED Requirements

### Requirement: Empire Persistence Boundary

系统 MUST 将 empire persistence 限定为 empire 自身规划数据。

#### Scenario: 保存 empire
- **前提** 用户修改了 active empire
- **当** 用户点击 `保存帝国`
- **那么** 系统 SHALL 保存 empire 名称与 station 规划
- **并且** SHALL NOT 保存 save binding group、station plan、coverage 或 selected archive time

#### Scenario: binding dirty 时保存 empire
- **前提** binding 存在未保存改动
- **当** 用户点击 `保存帝国`
- **那么** 系统 SHALL NOT 清除 binding dirty 状态
- **并且** SHALL NOT 将 binding 改动写入 empire storage

### Requirement: Empire Store Production Source

系统 MUST 在 `useEmpireStore` 添加 productionSource 路由。

#### Scenario: productionSource 为 empire
- **前提** `useEmpireStore.productionSource = 'empire'`
- **当** 系统访问 `stations` / `sectors` / `activeStation`
- **那么** 系统 SHALL 返回 empire data store 的数据

#### Scenario: productionSource 为 save-binding
- **前提** `useEmpireStore.productionSource = 'save-binding'`
- **当** 系统访问 `stations` / `sectors` / `activeStation`
- **那么** 系统 SHALL 返回 save binding store 的派生数据

#### Scenario: 切换到 save-binding source
- **前提** 当前 productionSource 为 `empire`
- **并且** active empire 存在 dirty 改动
- **当** 用户调用 `switchToBinding(gameGuid)`
- **那么** 系统 SHALL 返回需要确认的提示
- **当** 用户确认保存
- **那么** 系统 SHALL 先保存 empire，再切换到 save-binding
- **当** 用户确认放弃
- **那么** 系统 SHALL 放弃 empire 改动，再切换到 save-binding
- **当** 用户取消确认
- **那么** 系统 SHALL NOT 切换 productionSource

## REMOVED Requirements

### Requirement: Empire Owns Binding Sectors

移除理由：binding 星区已经改为 `SaveBindingPlan.groups`，empire 不再保存星区划分或作为 binding Step 2 的数据来源。

### Requirement: Empire Stores Save Bindings

移除理由：save binding 使用独立 `x4_save_bindings` storage，并以 `gameGuid` 为唯一身份。