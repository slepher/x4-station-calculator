# Live Planning Flow - Tasks

## Task 1: store 接入 planning+archive 的 effectiveModules 新口径

- [x] 文件：`src/store/useLiveProductionStore.ts`
- [x] 仅在 `visualMode === 'planning' && archiveStation != null` 时启用新口径
- [x] 读取 `plannedModules + autoIndustryModules + autoHabitationModules + autoInfrastructureModules`
- [x] 读取 `archive.modules + archive.building.modules`
- [x] 按 `moduleId` 对两侧全部模块逐项取更大 `count`
- [x] 产出 planning+archive 场景可消费的 `effectiveModules`

## Task 2: 基于新口径重算 planning flow 相关结果

- [x] 在 store 侧基于 `effectiveModules` 重算 `productionFlows`
- [x] 让这套 `productionFlows` 直接替代旧 planning 主 flow 数据源
- [x] 在 store 侧基于 `effectiveModules` 重算 `workforce`
- [x] 在 store 侧基于 `effectiveModules` 重算 `efficiency`
- [x] 让所有后续 flow-based aggregation 统一基于这套新 `productionFlows` 继续计算
- [x] 保持 `warePriorityLevels` 现有判定逻辑不变
- [x] 不引入新的显式 `productionOnlyModules` 分类层

## Task 3: 保持隐式职责分离

- [x] 确保 `plannedModules` 继续允许包含所有模块类型
- [x] 确保 flow 仍通过模块 `outputs / inputs` 自然决定流成员
- [x] 确保 habitation 仍通过 workforce 链路生效
- [x] 确保存储 / dock / pier 仍通过 infrastructure 派生链路生效

## Task 4: wareflow presenter 切换到 canonical planning flow 结果

- [x] 文件：`src/components/empire/presenters/useProductionWareflowPresenter.ts`
- [x] 在 `planning + archive` 场景下透传新的 canonical planning flow 及其聚合结果
- [x] 在 `planning + archive` 场景下为 archive 产出 ware 暴露 lock 禁止约束
- [x] 非启用场景继续透传旧 planning 结果
- [x] 不让 `recommendedModules` 进入 flow 计算链

## Task 5: planning wareflow 视图切换 canonical planning flow

- [x] 文件：`src/components/empire/LiveProductionWorkbenchView.vue`
- [x] 文件：`src/components/empire/StationWareFlowsDashboard.vue`
- [x] planning 普通 wareflow 列表改为消费 canonical planning flow
- [x] 保持 `live` 模式视图语义不变
- [x] 保持 `overview` / `transit` 不受影响

## Task 6: planning volume 切到 live allocation 视图骨架并绑定 canonical planning flow

- [x] 文件：`src/components/empire/StationWareFlowsDashboard.vue`
- [x] 文件：`src/components/empire/LiveStationAllocationView.vue`
- [x] `planning + archive + volume` 不再渲染旧 planning volume list
- [x] planning volume 复用 `live-cargo-volume` 的 allocation 视图骨架
- [x] planning volume 的 `currentCount / targetCount` 继续读取 archive `cargo / targetCounts`
- [x] planning volume 的 `recommendedCount` 改为消费基于 canonical planning flow 的聚合结果
- [x] planning volume 展开明细改为消费同一套 canonical planning flow 基准
- [x] 避免主视图与明细口径分裂

## Task 7: archive 产出 ware 的 lock 禁止约束

- [x] 在 store 或现有 ware rule 链路中识别 archive 生产模块产出的 ware
- [x] 在 `planning + archive` 场景下禁止对这些 ware 执行 lock
- [x] 让 UI 能反映该 lock 不可操作状态
- [x] 确认该约束不改写 `warePriorityLevels` 的既有判定语义

## Task 8: 回归检查 StationDashboard 边界

- [x] 确认本次改动不改写 `StationDashboard` 的任何语义
- [x] 确认不复用或污染 dashboard 专用 `effectiveModules` 语义

## Task 9: 构建验证

- [x] 执行 `npm run build`
