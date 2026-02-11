# storage-auto-fill Specification

## Purpose
TBD - created by archiving change storage-auto-fill. Update Purpose after archive.
## Requirements
### Requirement: 仓储容量计算
系统SHALL复用现有的流量分析逻辑来计算所需的总仓储容量，并支持对主工业区和自动补给区进行独立的双重计算。

#### Scenario: 基于流量分析的计算 (主工业区)
- **前提** 用户完成了模块规划（Phase 1 Industry & Phase 2/3 Census/Supply）
- **当** 系统执行自动填充 Phase 4
- **那么** 系统应调用 `analyzeWareFlow` 计算所有产物和消耗品的总流向
- **并且** 输入模块列表应包含规划模块和自动工业模块，但**排除**自动补给模块（AutoSupply）
- **并且** 系统应分别汇总 `Container`、`Solid` 和 `Liquid` 三种类型的总占用体积（Total Occupied Volume）

#### Scenario: 自动补给区独立仓储 (AutoSupply Storage)
- **前提** 系统已生成自动补给模块 (AutoSupply) 且 `settings.internalSupply` 为开启状态
- **当** 执行 Phase 4 计算时
- **那么** 系统应单独对 `AutoSupply` 模块列表再次调用 `analyzeWareFlow`
- **并且** 根据计算结果生成对应的仓储模块
- **并且** 将这些仓储模块追加到 `autoSupply` 列表中（而非主 `autoStorage`）

### Requirement: 动态仓储模块选择
系统SHALL根据用户设置和现有模块动态选择最佳的仓储模块。

#### Scenario: 优先适配现有模块
- **前提** 规划区中已经存在某种类型的仓储模块（如 Teladi L Container）
- **当** 系统计算出该类型仓储仍有缺口
- **那么** 系统应继续添加同一种 ID 的仓储模块
- **并且** 忽略全局的种族偏好设置

#### Scenario: 基于种族偏好的选择
- **前提** 规划区中不存在对应类型的仓储模块
- **当** 系统需要添加新的仓储模块
- **那么** 系统应根据 `StationSettings.racePreference` 查找对应的 L 级仓储模块
- **并且** 如果首选种族没有对应类型的仓储，则回退到任意种族的同类型最大仓储

### Requirement: 增量填充逻辑
系统SHALL仅填充不足的仓储容量。

#### Scenario: 计算净缺口
- **前提** 系统已计算出总需求容量和规划区现有容量
- **当** 执行填充操作
- **那么** 系统应计算 `缺口 = 总需求 - 现有容量`
- **并且** 仅当缺口为正时，添加足够数量的 L 级仓储模块以覆盖缺口

### Requirement: 数据源增强
系统SHALL支持从游戏数据中读取仓储的具体类型。

#### Scenario: 识别仓储类型
- **前提** 导入游戏数据
- **当** 解析 `storage` 类型的模块
- **那么** 系统应从 XML 的 `cargo` 属性中提取 `max` (capacity) 和 `tags` (type)
- **并且** 将其映射为前端可用的 `cargo: { capacity, type }` 结构

### Requirement: 动态优先级响应
系统SHALL对用户调整的产物优先级做出实时响应。

#### Scenario: 优先级变更触发重算
- **前提** 用户在 UI 中调整了某产物的优先级（如从主产物变为副产物）
- **当** 优先级设置更新
- **那么** 自动填充逻辑应重新计算所需的缓冲容量（基于新的 Buffer Hours 设置）
- **并且** 更新自动仓储模块的数量

