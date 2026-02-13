## MODIFIED Requirements

### Requirement: 视图模式切换与列表展示
系统 SHALL 提供一个视图模式切换器，允许用户在不同的统计维度间切换。列表内容和底部控制栏随视图动态变化。

#### Scenario: 逻辑组网视图 (Logical Flow View)
- **WHEN** 用户切换到“逻辑组网”视图
- **THEN** 系统展示产业链拓扑画布和候选区
- **AND** 隐藏“量化生产”视图下的具体模块数量和详细资源平衡列表

#### Scenario: 量化生产视图 (Quantified Production View)
- **WHEN** 用户切换到“量化生产”视图
- **THEN** 系统展示原本的模块列表、资源平衡仪表盘和建设汇总
- **AND** 隐藏“逻辑组网”视图的画布
