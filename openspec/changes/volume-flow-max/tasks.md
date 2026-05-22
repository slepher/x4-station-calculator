# Volume Flow Max - Tasks

## Task 1: 提取共享 buffer 占用计算逻辑

- [x] 文件：`src/store/logic/calculateBufferOccupancy.ts`
- [x] 新增一处共享 helper，负责计算 `consumptionBufferCount / productionBufferCount / totalOccupiedCount / totalOccupiedVolume`
- [x] 共享 helper 统一使用 `Math.max(consumptionBufferCount, productionBufferCount)`
- [x] 不在 helper 中混入 name / price / transport 等非 volume 职责

## Task 2: 清理 deriveProductionFlows 的双模式逻辑

- [x] 文件：`src/store/logic/calculateWareFlowDerived.ts`
- [x] 移除 `volumeContributionMethod` 入参、默认值与 `sum/max` 分支
- [x] 改为复用共享 helper 计算 `totalOccupiedCount / totalOccupiedVolume`
- [x] 保持现有 contribution / price / transport 相关逻辑不被连带修改

## Task 3: 清理 infrastructure 中的重复实现

- [x] 文件：`src/store/logic/calculateInfrastructureModules.ts`
- [x] 移除本地内联的 `consumptionBufferCount + productionBufferCount` 实现
- [x] 改为复用同一共享 helper 计算 storage volume 需求
- [x] 保持 berth / pier 计算逻辑不变

## Task 4: 同步调用链 contract

- [x] 文件：`src/store/logic/empireFlowFacade.ts`, `src/store/useLiveProductionStore.ts`
- [x] 删除已失效的模式透传 contract（`volumeContributionMethod` 从接口和调用链中完全移除）
- [x] 确保 station wareflow、transit-hub volume 与 infrastructure 三条链路只消费 `max` 口径

## Task 5: 构建验证

- [x] 执行 `npm run build`（通过，预存的 `displaySource` 警告与本次变更无关）
