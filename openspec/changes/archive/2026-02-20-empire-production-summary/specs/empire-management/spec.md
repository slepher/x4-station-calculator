# Empire Management Specification (Delta)

## MODIFIED Requirements

### Requirement: 空间站流量缓存 (Station Flow Cache)
系统 SHALL 在 EmpireStore 中维护每个空间站的流量分析缓存：
- 缓存键为 `stationId`，值为 `GroupedFlows` 对象
- 初始化时为所有空间站执行 `analyzeWareFlow` 并缓存结果
- 空间站模块更新时自动更新对应的缓存
- 提供缓存访问接口 `getStationFlowCache(stationId)`

#### Scenario: 初始化缓存
- **前提** EmpireStore 初始化完成
- **当** 系统加载帝国数据
- **那么** 系统 SHALL 为每个空间站执行 `analyzeWareFlow`
- **并且** 结果 SHALL 存储到 `stationFlowCache` 中

#### Scenario: 更新缓存
- **前提** 用户修改空间站模块
- **当** `updateStationModules` 被调用
- **那么** 系统 SHALL 重新计算该空间站的流量分析
- **并且** 更新 `stationFlowCache` 中对应的缓存

#### Scenario: 访问缓存
- **前提** 某空间站存在
- **当** 调用 `getStationFlowCache(stationId)`
- **那么** 系统 SHALL 返回该空间站的 `GroupedFlows` 对象
- **并且** 如果缓存不存在，SHALL 返回 null
