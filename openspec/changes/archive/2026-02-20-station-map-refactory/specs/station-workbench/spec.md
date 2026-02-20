# Station Workbench Specification (Delta)

## MODIFIED Requirements

### Requirement: 分站视图数据绑定 (Station View Data Binding)
分站视图 SHALL 通过当前激活分站标识（`currentStationId`）绑定数据源，并通过统一代理访问分站运行态：
- `StationPlanningPanel`: 绑定到当前分站的 `plannedModules`
- `StationWareFlowsDashboard`: 绑定到当前分站的资源流计算结果
- `StationDashboard`: 绑定到当前分站的建设成本与汇总计算结果

#### Scenario: 分站数据隔离
- **前提** 用户切换到分站 A
- **当** 用户修改模块配置时
- **那么** 修改 SHALL 仅影响分站 A 的运行态数据
- **并且** 其他分站的数据 SHALL 不受影响

#### Scenario: 切站后视图同步
- **前提** 帝国中至少有两个分站
- **当** 用户从分站 A 切换到分站 B
- **那么** 三列视图 SHALL 同步显示分站 B 的状态与计算结果
- **并且** 分站 A 的可见数据 SHALL 不再出现在分站 B 视图

#### Scenario: 可写代理兼容
- **前提** 规划区组件通过 `v-model` 绑定 `plannedModules`
- **当** 用户执行拖拽、增删或数量修改
- **那么** 变更 SHALL 写入当前分站运行态
- **并且** 相关派生模块与资源流 SHALL 被同步刷新
