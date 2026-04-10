# Empire Management Specification

## Purpose
调整 empire 管理边界，使 empire 不再承担 save binding 与 binding 星区职责，仅保存普通 station 规划。

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

## REMOVED Requirements

### Requirement: Empire Owns Binding Sectors

移除理由：binding 星区已经改为 `SaveBindingPlan.groups`，empire 不再保存星区划分或作为 binding Step 2 的数据来源。

### Requirement: Empire Stores Save Bindings

移除理由：save binding 使用独立 `x4_save_bindings` storage，并以 `gameGuid` 为唯一身份。
