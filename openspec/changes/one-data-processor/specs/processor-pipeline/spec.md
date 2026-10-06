## ADDED Requirements

### Requirement: Target Selection

处理器 SHALL 使用同一流水线支持 `all`、单个数据目标和逗号分隔多目标，目标范围与版本范围独立。SHALL 覆盖全部既有产物，区分 `resource-info` 与 `map-resources`。旧 data/map/resources SHALL 分别归一化为 all/maps/map-resources。

#### Scenario: Full Migration Across Versions

- **当** 用户执行 `all --all-versions`
- **那么** SHALL 按配置顺序为每个版本执行完整迁移，包含地图资源计算
- **并且** 每个版本 SHALL 使用独立运行状态与输出、缓存路径。

#### Scenario: Multiple Targets

- **当** 用户执行 `ships,equipments --version 9.0`
- **那么** SHALL 更新两个目标及其归属产物，公共依赖只计算一次。

#### Scenario: Legacy Names

- **当** 用户执行原 data、map 或 resources 名称
- **那么** SHALL 进入对应的统一目标流程
- **并且** data SHALL 包含地图资源计算，帮助文本 SHALL 明确这一行为变化。

#### Scenario: Invalid Target Selection

- **当** 目标未知、为空、重复，或 all 与其他目标组合
- **那么** SHALL 在运行阶段前报错并返回非零退出码。

### Requirement: Dependency Preparation

处理器 SHALL 用固定依赖关系准备本轮输入；必要计算与允许写入的产物范围 MUST 分离。不得要求用户先运行其他命令，不得用旧输出代替自动生成的本轮依赖。

#### Scenario: Empty Output Directory

- **前提** 原始输入完整且输出目录为空
- **当** 用户执行任一公开单项目标
- **那么** SHALL 自动计算必要依赖，完成目标产物
- **并且** SHALL 不写出未选中的依赖类别。

#### Scenario: Current Run Map Resources

- **前提** 输出目录中存在旧地图
- **当** 用户执行 all
- **那么** 地图资源 SHALL 使用本轮地图及资源定义
- **并且** SHALL 不将旧地图作为自动依赖输入。

#### Scenario: Explicit Input Override

- **当** 用户指定 maps-json 或其他受支持的输入路径覆盖
- **那么** SHALL 使用明确指定的输入
- **并且** 输入缺失或无效 SHALL 报错，不回退到默认输入。

### Requirement: Output Ownership

每个文件 SHALL 有明确归属。地图解析 SHALL 提供资源中间数据；resourceareas.json 最终内容 SHALL 由地图资源阶段写出。计算和保存 SHALL 分离，并保持既有 JSON 契约及算法。

#### Scenario: Complete Final Outputs

- **当** 用户从空目录执行 all
- **那么** 8.0 与 9.0 的最终产物 SHALL 分别等价于相同输入下原 TS data 加 resources 的最终产物
- **并且** SHALL 包含 map_resources.json，不重复写出同名资源中间文件。

#### Scenario: Map Only

- **当** 用户只执行 maps
- **那么** SHALL 更新 maps.json 及其所需语言条目
- **并且** SHALL 不修改派系、地图资源副文件或资源缓存。

#### Scenario: Resource Only

- **当** 用户只执行 map-resources
- **那么** SHALL 更新归属资源产物和适用缓存
- **并且** SHALL 不修改 maps.json 或 factions.json。

#### Scenario: Unselected Files

- **前提** 输出目录存在其他类别数据
- **当** 用户执行单项或多项迁移
- **那么** 未选中的数据文件 SHALL 保持原内容，不能由空数据覆盖。

### Requirement: Shared Language Preservation

单项或多项迁移 SHALL 合并本轮需要的语言条目，保留未选择类别的已有翻译；all 与独立 languages SHALL 重建完整语言包及语言清单。

#### Scenario: Partial Language Update

- **前提** 语言包同时包含船和地图条目
- **当** 用户只更新 ships
- **那么** SHALL 更新本轮船及关联名称翻译
- **并且** 地图等未选类别的翻译 SHALL 保留。

#### Scenario: Languages Only

- **当** 用户执行 languages
- **那么** SHALL 收集全部类别所需名称并重建完整语言包
- **并且** SHALL 不写其他数据文件。

### Requirement: Resource Scope And Model Rules

处理器 SHALL 保留 regions/resourceareas 模型、版本缓存隔离和现有资源计算行为。sector SHALL 仅适用于唯一目标 map-resources。资源专用选项 SHALL 只在执行计划包含资源计算时生效，模型不支持的选项 SHALL 报错。

#### Scenario: Sector Update

- **当** 用户执行 map-resources --sector 指定星区
- **那么** SHALL 保留其他星区资源与逐格缓存内容。

#### Scenario: Full Or Multi Target Sector Conflict

- **当** 用户对 all 或多目标传入 sector
- **那么** SHALL 在执行前报错，不生成部分资源的整体迁移结果。

#### Scenario: Unsupported Model Options

- **当** 用户为 9.0+ 传入逐格缓存、强制逐格重算或存档覆盖选项
- **那么** SHALL 报错；8.0 SHALL 保留这些选项的原有语义。

### Requirement: Failure Reporting

处理器 SHALL 在执行前验证目标与通用参数冲突；运行失败 SHALL 报告版本及阶段并停止后续阶段和版本。无需提供跨文件事务或自动回滚。

#### Scenario: Stage Failure

- **当** 某版本的资源阶段失败
- **那么** SHALL 返回非零退出码，报告失败版本与阶段，不宣称该版本迁移成功
- **并且** SHALL 不执行后续版本。
