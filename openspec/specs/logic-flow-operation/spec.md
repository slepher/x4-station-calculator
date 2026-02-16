# Logic Flow Operation Specification

## Purpose
统一 Logic Flow 模块的操作规范，涵盖拖拽状态、候选区操作、节点权限、T0 资源限制等，确保交互行为一致且可预测。

## ADDED Requirements

### Requirement: Drag State Classification
系统 SHALL 在拖拽过程中根据目标组的状态显示对应的停靠区状态。

#### Scenario: Normal state
- **WHEN** 拖拽产物到组内无该产物的规划组
- **THEN** 显示蓝色边框
- **AND** 允许正常投放

#### Scenario: Duplicated state
- **WHEN** 拖拽产物到组内已存在 Manual 节点的规划组
- **THEN** 显示红色边框和 `Duplicate` 标签
- **AND** 禁止投放

#### Scenario: Auto state
- **WHEN** 拖拽产物到组内存在 Auto 节点的规划组
- **THEN** Header 显示绿色 `Auto` 标签
- **AND** 进入网格后标签变为蓝色 `Manual`
- **AND** 显示停靠点在 Auto 节点位置
- **AND** 投放后节点转正

#### Scenario: Isolate state
- **WHEN** 拖拽产物到组内存在隔离节点的规划组
- **THEN** Header 显示琥珀色 `Isolate` 标签
- **AND** 进入网格后标签变为蓝色 `Connect`
- **AND** 显示停靠点在隔离节点位置
- **AND** 投放后节点解除隔离并触发上游扩展

#### Scenario: Group Locked Rejected state
- **WHEN** 拖拽产物到血统锁定的规划组且产物不匹配
- **THEN** 显示红色边框和 `🚫 Rejected` 标签
- **AND** 禁止投放

#### Scenario: Group Locked Match state
- **WHEN** 拖拽产物到血统锁定的规划组且产物匹配
- **THEN** 显示琥珀色边框
- **AND** 允许正常投放（强制血统映射）

### Requirement: Drag State Priority
系统 SHALL 按以下优先级判断停靠区状态：

#### Scenario: Priority order
- **WHEN** 存在多个状态条件同时满足
- **THEN** 按以下优先级返回最高优先级状态：
  1. Group Locked + 血统不匹配 → Rejected
  2. Duplicated → 禁止投放
  3. Isolate → 可连接投放
  4. Auto → 可转正投放
  5. Group Locked + 血统匹配 → 正常投放
  6. Normal → 正常投放

### Requirement: Candidate Zone T0 Restriction
系统 SHALL 限制 T0 资源和能量电池的拖拽和快速添加操作。

#### Scenario: T0 resource drag restriction
- **WHEN** 用户尝试拖拽 T0 资源（矿石、硅、气体等）
- **THEN** 禁止拖拽操作

#### Scenario: Energy Cells drag restriction
- **WHEN** 用户尝试拖拽能量电池
- **THEN** 禁止拖拽操作

#### Scenario: T0 resource quick add hidden
- **WHEN** 用户查看 T0 资源卡片
- **THEN** 不显示快速添加按钮 (+)

#### Scenario: Energy Cells quick add hidden
- **WHEN** 用户查看能量电池卡片
- **THEN** 不显示快速添加按钮 (+)

### Requirement: Node Permission Matrix
系统 SHALL 根据节点状态严格控制操作按钮的显示。

#### Scenario: Pure Manual node buttons
- **WHEN** 节点为纯 Manual（无下游依赖）
- **THEN** 显示删除按钮 (🗑️)
- **AND** 隐藏隔离按钮
- **AND** 隐藏转正按钮

#### Scenario: Pure Auto node buttons
- **WHEN** 节点为纯 Auto（系统生成）
- **THEN** 隐藏删除按钮
- **AND** 显示隔离按钮 (✂️)
- **AND** 显示转正按钮 (➕)

#### Scenario: Mixed node buttons
- **WHEN** 节点为混合型（Manual + 被依赖）
- **THEN** 显示删除按钮（降级为 Auto）
- **AND** 显示隔离按钮 (✂️)
- **AND** 隐藏转正按钮

#### Scenario: Isolated node buttons
- **WHEN** 节点处于隔离状态
- **THEN** 隐藏删除按钮
- **AND** 显示连接按钮 (🔗)
- **AND** 隐藏转正按钮

#### Scenario: T0 resource node buttons
- **WHEN** 节点为 T0 资源
- **THEN** 隐藏删除按钮
- **AND** 隐藏隔离按钮
- **AND** 隐藏转正按钮

### Requirement: Cascade Delete Logic
系统 SHALL 在删除纯 Manual 节点时级联清理孤儿上游模块和隔离产品。

#### Scenario: Cascade delete orphan upstream
- **WHEN** 用户删除纯 Manual 节点
- **THEN** 删除该节点
- **AND** 遍历其上游依赖
- **AND** 删除不被组内任何其他节点依赖的上游节点
- **AND** 删除失去下游依赖的隔离状态产品节点

#### Scenario: Mixed node downgrade
- **WHEN** 用户删除混合型节点
- **THEN** 节点降级为 Auto 状态
- **AND** 节点保留在组内以满足下游依赖

### Requirement: Isolate Connect Operation
系统 SHALL 通过隔离/连接按钮实现节点身份在"模块"与"产品占位符"之间的切换。

#### Scenario: Isolate operation
- **WHEN** 用户点击隔离按钮 (✂️)
- **THEN** 节点 `isIsolated` 变为 `true`
- **AND** 切断上游依赖
- **AND** 节点身份从"模块"变为"产品占位符"

#### Scenario: Connect operation
- **WHEN** 用户点击连接按钮 (🔗)
- **THEN** 节点 `isIsolated` 变为 `false`
- **AND** 恢复上游依赖
- **AND** 节点身份从"产品占位符"变为"模块"
- **AND** 触发自动扩展

#### Scenario: Isolate button visibility
- **WHEN** 节点存在下游消费者
- **THEN** 显示隔离按钮
- **WHEN** 节点无下游消费者
- **THEN** 隐藏隔离按钮

### Requirement: Planned Status Indicator
系统 SHALL 根据非隔离节点判断产物是否已规划。

#### Scenario: Planned status with non-isolated node
- **WHEN** 产物存在于任意组的非隔离节点中
- **THEN** 候选区对应卡片显示绿点

#### Scenario: Planned status with isolated node
- **WHEN** 产物仅存在于隔离节点中
- **THEN** 候选区对应卡片不显示绿点

### Requirement: Quick Add Menu State
系统 SHALL 在快速添加菜单中显示正确的组状态。

#### Scenario: Menu item duplicated state
- **WHEN** 组内已存在 Manual 节点
- **THEN** 菜单项灰化并显示 `Duplicate` 标签

#### Scenario: Menu item isolate state
- **WHEN** 组内存在隔离节点
- **THEN** 菜单项灰化并显示 `Isolate` 标签

#### Scenario: Menu item auto state
- **WHEN** 组内存在 Auto 节点
- **THEN** 菜单项正常可点击并显示 `Auto` 标签

#### Scenario: Menu item rejected state
- **WHEN** 组被血统锁定且产物不匹配
- **THEN** 菜单项灰化并显示 `🚫` 标识

### Requirement: Terminology Distinction
系统 SHALL 明确区分"节点隔离"与"规划组锁定"两种概念。

#### Scenario: Node isolation attribute
- **WHEN** 节点处于隔离状态
- **THEN** 使用 `node.isIsolated` 属性
- **AND** 状态标签为 `Isolate` / `Connect`

#### Scenario: Group locking attribute
- **WHEN** 规划组处于血统锁定状态
- **THEN** 使用 `group.isLocked` 属性
- **AND** 状态标签为 `Locked`

### Requirement: Drag Display Module Name
系统 SHALL 在拖拽相关场景中优先显示模块名称而非产品名称。

#### Scenario: Compact view existing node display
- **WHEN** 用户在紧凑版查看已有节点
- **THEN** 显示模块名称（使用 `node.moduleId` 查找 `localizedModulesMap`）
- **AND** 若无 `moduleId` 则回退显示产品名称

#### Scenario: Compact view preview node display
- **WHEN** 用户拖拽产品悬停在现有组上
- **THEN** 预览节点显示模块名称
- **AND** 模块根据 `wareId` + 组的血统（`lockedLineage` 或 `subCategory`）查找

#### Scenario: Compact view new line header display
- **WHEN** 用户拖拽产品悬停在新产线区域
- **THEN** Header 显示即将创建的模块名称
- **AND** 模块根据 `wareId` + 当前选中的 `activeSubCategory` 查找

#### Scenario: Drag ghost element display
- **WHEN** 用户从候选区拖拽产品
- **THEN** 拖拽幽灵元素显示模块名称
- **AND** 模块根据 `wareId` + 拖拽开始时的 `activeSubCategory` 查找

#### Scenario: T0 resource fallback display
- **WHEN** 节点为 T0 资源
- **THEN** 显示产品名称（T0 资源无对应模块）

#### Scenario: Module not found fallback display
- **WHEN** 找不到对应的模块
- **THEN** 回退显示产品名称

### Requirement: Isolation Node Expansion Rules
系统 SHALL 在上游扩展时正确处理隔离节点。

#### Scenario: Isolation not auto-broken during expansion
- **WHEN** 上游扩展遇到隔离节点
- **THEN** 停止追踪该分支
- **AND** 不自动打破隔离状态

#### Scenario: User主动连接隔离节点
- **WHEN** 用户拖拽已隔离的产品到规划区
- **THEN** 解除隔离状态 (`isIsolated = false`)
- **AND** 更新 `moduleId` 为正确的模块
- **AND** 扩展上游依赖

#### Scenario: T0 preview stops at isolated node
- **WHEN** T0 预览追踪遇到隔离节点
- **THEN** 停止追踪该分支
- **AND** 不预览隔离节点上游的 T0 资源

### Requirement: Compact Mode T0 Display
系统 SHALL 在紧凑模式中正确显示 T0 资源。

#### Scenario: T0 display next to group title
- **WHEN** 用户在紧凑模式查看规划组
- **THEN** T0 资源显示在组标题旁边
- **AND** T0 资源不显示在模块区域

#### Scenario: Compact and non-compact use same data source
- **WHEN** 计算T0 资源需求
- **THEN** 紧凑模式和非紧凑模式使用同一数据源
- **AND** 区别仅在于显示方式和过滤条件

### Requirement: Language Switch Updates Ware Text
系统 SHALL 在语言切换时更新所有 ware 文本。

#### Scenario: Language switch updates all ware text
- **WHEN** 用户切换语言
- **THEN** 所有 ware 文本自动更新为新语言
- **AND** 候选区 ware 文本更新
- **AND** 规划区节点 ware 文本更新

### Requirement: Candidate Zone Lock Switch Affects New Groups
系统 SHALL 将候选区锁定开关状态传递给新建的规划区。

#### Scenario: Lock switch affects new groups
- **WHEN** 用户在候选区开启锁定开关
- **AND** 添加产品到新规划区
- **THEN** 新规划区默认锁定

#### Scenario: Unlock switch creates unlocked groups
- **WHEN** 用户在候选区关闭锁定开关
- **AND** 添加产品到新规划区
- **THEN** 新规划区默认不锁定

### Requirement: Drag Cancel Detection
系统 SHALL 正确检测拖拽取消操作。

#### Scenario: Drag out without dropping
- **WHEN** 用户从候选区拖拽产品到规划区
- **AND** 在规划区悬停后拖出来
- **AND** 在空白处释放
- **THEN** 产品不被添加到任何规划区
