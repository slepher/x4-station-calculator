## Context

飞船建造模块（Ship Build）是 X4 Station Calculator 的核心功能之一，用于配置飞船的装备配装。当前实现中：
- `useShipBuildStore` 管理飞船选择、槽位配置、装备分配等状态
- `selectedByConnection` 是 ref，格式为 `{ [connectionKey]: equipmentId }`
- 仅 `activeView` 持久化到 localStorage，其他状态仅存在内存中

需要重构为：以 blueprint 为数据源，selectedByConnection 为 computed view。

参考现有持久化模式：
- `useEmpireStore`: 使用 `x4_empire_data` key 存储 empire 数据
- `useLogicFlowStore`: 使用 `x4_logic_flow_plans` key 存储 logic flow 数据

## Goals / Non-Goals

**Goals:**
- 实现 ShipBlueprint 数据结构，按 slot_type + group 组织
- 在 useShipBuildStore 中实现 blueprint 源数据 + computed view 模式
- 提供 `setEquipment()`, `setGroupEquipment()`, `setShield()`, `setGroupShield()` 接口
- 实现完整的 CRUD 持久化操作
- 复用现有 UI 按钮和 SmartSaveDialog 组件
- 新建 LoadShipBlueprintModal 组件用于选择已保存的配装方案
- 载入时自动恢复飞船选择和装备配装状态

**Non-Goals:**
- 不实现飞船配装的导入/导出功能（仅 localStorage）
- 不实现版本迁移（首次实现，无历史数据）
- 不修改现有的 empire/logic flow 持久化逻辑
- View 层暂不支持修改数量（count），但数据结构预留

## Decisions

### D1: 数据存储位置
- **决定**: 使用独立的 localStorage key `x4_ship_blueprints`
- **理由**: 与现有 empire/logic flow 存储分离，便于管理和未来扩展
- **备选**: 复用 `x4_empire_data` - 不选，分离更清晰

### D2: 数据分层架构
- **决定**: Store 保存 blueprint（源数据），selectedByConnection 改为 computed
- **理由**:
  - blueprint 是业务领域数据，按 slot_type + group 组织，适合持久化
  - selectedByConnection 是视图数据，按 connectionKey 扁平组织，适合 view 绑定
  - 单一数据源避免不一致
- **备选**: 双向同步 - 不选，增加复杂度

### D3: equipmentId = null 语义
- **决定**: equipmentId = null 表示**取消装备**，从 blueprint 中删除该条记录
- **理由**: 减少持久化数据量，符合业务语义
- **备选**: 设置为 null 保留记录 - 不选，冗余数据

### D4: View 层 selectedByConnection 格式
- **决定**: `Record<string, { equipmentId: string | null, count: number }>`
- **理由**: 为未来支持修改数量预留接口
- **备选**: 只保存 equipmentId - 不选，需要支持 count

### D5: Dirty Check 机制
- **决定**: 使用 JSON 序列化 blueprint 进行快照对比
- **理由**: 简单有效，与 useEmpireStore 模式一致
- **备选**: 每次操作记录变更 - 过度设计

### D6: UI 组件复用策略
- **决定**: 复用 ShipBuildView.vue 中现有的 4 个按钮，复用 SmartSaveDialog 用于 Save As
- **理由**: 保持 UI 一致性，减少新组件数量
- **备选**: 新建独立工具栏 - 不选，增加用户学习成本

### D7: LoadShipBlueprintModal 设计
- **决定**: 创建独立的 Modal 组件，展示已保存的 blueprint 列表
- **理由**: 列表选择场景与名称输入场景不同，需要独立的 UI 模式
- **功能**: 支持选择、删除 blueprint

### D8: 载入自动设置逻辑
- **决定**: 在 loadBlueprint 方法中依次设置 class -> races -> types -> shipId -> connections
- **理由**: 确保筛选条件和选中状态正确设置，保证配装能正确显示

## Risks / Trade-offs

- **风险**: 飞船数据（class/race/type）变更导致已保存 blueprint 失效
  - **缓解**: 载入时进行容错处理，如果飞船不存在则提示用户
- **风险**: connectionKey 格式依赖于飞船槽位结构
  - **缓解**: 如果 connectionKey 对应的槽位不存在，跳过该条记录
- **风险**: View 层修改 count 功能未实现，但数据结构已预留
  - **缓解**: count 字段 blueprint已存在于 和 selectedByConnection 中，后续可直接启用
