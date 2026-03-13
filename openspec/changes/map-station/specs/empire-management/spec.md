# Empire Management Specification (Delta)

## ADDED Requirements

### Requirement: Station And Sector Location Persistence
系统 MUST 将 `station.location` 与 `sector.location` 作为 empire 可编辑输入的一部分进行持久化。

#### Scenario: 保存 station location
- **前提** 某个 `station` 已写入 `location`
- **当** 用户保存当前 empire
- **那么** 系统 SHALL 将该 `location` 写入 `x4_empire_data`

#### Scenario: 保存 sector transit location
- **前提** 某个 `sector` 已写入 `location`
- **当** 用户保存当前 empire
- **那么** 系统 SHALL 将该 `location` 写入 `x4_empire_data`

#### Scenario: 旧存档缺少 location
- **前提** localStorage 中存在不包含 `location` 的旧 empire 数据
- **当** 系统执行迁移或归一化
- **那么** 系统 SHALL 保持向后兼容
- **并且** 缺少 `location` 的对象 SHALL 仍可正常载入

### Requirement: Location Changes Mark Empire Dirty
系统 MUST 将 `station.location` 或 `sector.location` 的变动视为 empire dirty 输入变动。

#### Scenario: 更新 station location 后进入 dirty
- **前提** 当前 empire 已存在已保存快照
- **当** 用户新增、修改或清除某个 `station.location`
- **那么** 当前 empire SHALL 被视为 dirty
- **并且** 用户 SHALL 可以执行保存

#### Scenario: 更新 sector location 后进入 dirty
- **前提** 当前 empire 已存在已保存快照
- **当** 用户新增、修改或清除某个 `sector.location`
- **那么** 当前 empire SHALL 被视为 dirty
- **并且** 用户 SHALL 可以执行保存
