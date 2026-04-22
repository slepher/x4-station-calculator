# Active Station Refactory - 实现任务

## Tasks

- [x] Task 1: 盘点 `useLiveProductionStore` 中当前实体来源、当前实体、当前可编辑入口的现状调用点
- [x] Task 2: 在 `useLiveProductionStore` 中定义并导出 `editableStationPlan`
- [x] Task 3: 收敛 `bindingStation` / `archiveStation` 为当前实体来源对象
- [x] Task 4: 重构 `activeStation` 使其只表达 `bindingStation | archiveStation`
- [x] Task 5: 将 station plan 编辑入口迁移到 `editableStationPlan`
- [x] Task 6: 保留 transit 的统一实体链路，但移除 transit 对 station plan 编辑主路径的借用
- [x] Task 7: 结合 presenter / view 清理实体与模式边界的消费点
- [x] Task 8: 修改 `useBlueprintProductionStore` 使 station 编辑主路径与 live store 兼容
- [x] Task 9: 完成来源层一步到位收口，移除实体选源中的 mode 残留
- [x] Task 10: 类型与注释清理
- [x] Task 11: 构建验证

## Phase 1: 现状梳理

### Task 1: 盘点 `useLiveProductionStore` 中当前实体来源、当前实体、当前可编辑入口的现状调用点

- [x] 标记 `bindingStation` 当前承担的职责
- [x] 标记 `archiveStation` 当前承担的职责
- [x] 标记 `activeStation` 当前承担的职责
- [x] 标记哪些 setter / actions 正在把 `activeStation` 当作 mutation target
- [x] 标记哪些 `workbenchMode === 'transit'` 分支是在做行为分流，哪些是在重复做实体选源

## Phase 2: Store 对象边界收口

### Task 2: 在 `useLiveProductionStore` 中定义并导出 `editableStationPlan`

- [x] 新增 `editableStationPlan` computed
- [x] 当前规则固定为：`station` 模式取当前普通站点 binding plan，`transit` 模式返回 `null`
- [x] 字段至少覆盖现有编辑入口已使用的 `id/name/type/sectorId/modules/settings/lockedWares/warePriority`

### Task 3: 收敛 `bindingStation` / `archiveStation` 为当前实体来源对象

- [x] 明确 `bindingStation` 只负责表达当前实体的 binding 来源
- [x] 明确 `archiveStation` 只负责表达当前实体的 archive 来源
- [x] 检查 `station` / `transit` 下两者是否都能稳定表达当前实体来源
- [x] 删除或改写把它们当作 UI 组装对象或编辑目标对象的残留用法
- [x] 移除 `bindingStation` / `archiveStation` 内部以 `mode` 作为实体选源主路径的残留

### Task 4: 重构 `activeStation` 使其只表达 `bindingStation | archiveStation`

- [x] 将 `activeStation` 改为统一实体归一化层
- [x] 优先从 `bindingStation` 归一化
- [x] binding 不存在时 fallback 到 `archiveStation`
- [x] 保证 `station` / `transit` 页面下都可获得统一当前实体
- [x] 删除 `activeStation` 上混入的“当前可编辑 plan”职责
- [x] 确认 `activeStation` 的统一建立在来源层已真实收口的前提上，而不是表面包装

## Phase 3: 编辑入口迁移

### Task 5: 将 station plan 编辑入口迁移到 `editableStationPlan`

- [x] `plannedModules` 改为只读写 `editableStationPlan`
- [x] `lockedWares` 改为只读写 `editableStationPlan`
- [x] `warePriority` 改为只读写 `editableStationPlan`
- [x] station module actions 改为只以 `editableStationPlan` 为 mutation target
- [x] station ware rule actions 改为只以 `editableStationPlan` 为 mutation target
- [x] station 侧 settings 写入口改为只以 `editableStationPlan` 为 mutation target

### Task 6: 保留 transit 的统一实体链路，但移除 transit 对 station plan 编辑主路径的借用

- [x] transit 页面继续拥有 `activeStation`
- [x] transit 页面继续走 `context` / `stationState(entityType = 'transit')`
- [x] transit 页面不再借用 station plan 的模块、锁定、优先级编辑主路径
- [x] 保留 transit 特有 settings 写入路径

## Phase 4: Presenter / View 消费点对齐

### Task 7: 结合 presenter / view 清理实体与模式边界的消费点

- [x] 校验 `LiveProductionWorkbenchView.vue` 中 `station` 页面消费 `activeStation + editableStationPlan + context + stationState`
- [x] 校验 `LiveProductionWorkbenchView.vue` 中 `transit` 页面消费 `activeStation + context + stationState`
- [x] 校验 import modal 仅在 `station` 实体下暴露 station 输入
- [x] 校验 toolbar / planning / wareflow / dashboard presenter 不再把“当前实体”和“当前可编辑 plan”混为一谈

## Phase 5: Blueprint 兼容对齐

### Task 8: 修改 `useBlueprintProductionStore` 使 station 编辑主路径与 live store 兼容

- [x] 在 blueprint store 中新增 `editableStationPlan`
- [x] 将 `plannedModules` / `lockedWares` / `warePriority` 改为依赖 `editableStationPlan`
- [x] 将 blueprint 的 module actions / ware rule actions / setting actions 改为依赖 `editableStationPlan`
- [x] 将 blueprint toolbar 中 rename/type/count/minerals 更新改为依赖 `editableStationPlan`

## Phase 6: 来源层一步到位收口

### Task 9: 完成来源层一步到位收口，移除实体选源中的 mode 残留

- [x] 清理 `useLiveProductionStore` 中当前实体来源解析残留的 `mode === 'station'` / `mode === 'transit'` 实体选源分支
- [x] 确认 `archiveStation` 不再通过模式分支直接决定当前实体 archive 来源
- [x] 确认 `bindingStation` 不再通过模式分支直接决定当前实体 binding 来源
- [x] 确认最终结构是“来源层统一解析 -> `activeStation` 归一化”，而不是“来源层分叉 + `activeStation` 表面统一”

## Phase 7: 类型与注释清理

### Task 10: 类型与注释清理

- [x] 清理类型、注释、命名中把 `activeStation` 表述为“当前可编辑 plan”的残留
- [x] 清理类型、注释、命名中把 `transit` 当作独立实体来源链路的误导性表述
- [x] 不为未来 transit 可编辑增加 `sourceKind` 或其他预埋字段

## Phase 8: 构建验证

### Task 11: 构建验证

- [x] 运行 `npm run build`
- [x] 若本次重构引入编译错误，则修复后重跑
- [x] 记录是否还有未清理的调用点或阻塞项
