# live-planning-station 实施任务

## Task 1: store 暴露 planning dashboard 所需基础集合

- [x] 在 `useLiveProductionStore` 梳理 planning + archive 场景下的 dashboard 输入来源
- [x] 产出 `archive.modules` 对应的 built 基础集合
- [x] 产出 `archive.modules + archive.building.modules` 对应的 current total 基础集合
- [x] 产出 `planned + autoIndustry + autoHabitation + autoInfrastructure` 对应的 final planned 基础集合
- [x] 产出按 `moduleId` 逐项 `max` 后的 `effectiveTargetModules`

## Task 2: presenter 组装 planning dashboard 三态语义

- [x] 在 `useProductionDashboardPresenter` 区分 live 语义与 planning + archive 语义
- [x] 在 planning + archive 下组装 `builtScopeModules`
- [x] 在 planning + archive 下组装 `buildingScopeModules = effectiveTargetModules - builtModules`
- [x] 在 planning + archive 下组装 `allScopeModules = effectiveTargetModules`
- [x] 确认 `buildingScopeModules` 不会削减 archive 当前在建数量
- [x] 基于 `buildingScopeModules` 判定 planning 下是否仍存在待建设模组

## Task 3: presenter 显式拆分 displayModules 与 workerModules

- [x] 为 dashboard presenter 提供 `displayModules`
- [x] 为 dashboard presenter 提供 `workerModules`
- [x] 在 planning + archive 下让 `displayModules` 跟随 `moduleScope`
- [x] 在 planning + archive 下让 `workerModules` 固定为 `allScopeModules`
- [x] 非启用场景继续保持现有既有语义

## Task 4: 保留 buildingInProgress 展示语义但移除其 planning 扣减语义

- [x] 梳理 `buildingInProgress` 当前在 dashboard presenter 中的扣减逻辑
- [x] planning + archive 下停止使用 `buildingInProgress` 扣减 `building` scope
- [x] 继续向 `StationDashboard` 透传 `buildingInProgress` 作为展示上下文
- [x] 确认 live 模式下既有 `buildingInProgress` 语义不被误改

## Task 5: StationDashboard 接入 planning scope 模块输入

- [x] 让 `materials / time / volume` 三个 tab 读取 presenter 提供的 `displayModules`
- [x] 让 `workers` tab 读取 presenter 提供的 `workerModules`
- [x] 避免在 `StationDashboard` 内部继续隐式复用单一模块输入
- [x] 保持组件本身不直接依赖 store
- [x] planning 下继续透传 `buildingCargo` 与 `buildingReservation`
- [x] planning 下建筑仓库材料 / 在途材料展示与缺口计算保持 live 语义

## Task 6: planning workers tab 保持当前交互体验

- [x] 在 planning + archive 下保持 `workforceAuto` 可切换
- [x] 在 planning + archive 下保持手动工人数可编辑
- [x] 基于 `workerModules = allScopeModules` 重算 planning workers tab 的工人结果
- [x] 确认不直接读取 archive workforce 数值

## Task 7: LiveProductionWorkbenchView 与调用链接线

- [x] 在 `LiveProductionWorkbenchView` 继续通过 presenter 向 `StationDashboard` 传递 planning dashboard 所需 props
- [x] 不在 Vue 层自行拼接 built/building/all 集合
- [x] 不新增 store 与 presenter 之间、presenter 与 vue 之间的中间层
- [x] planning 下有待建设模组时默认 `moduleScope = building`
- [x] planning 下无待建设模组时隐藏 `moduleScope` 按钮并保持 `built`

## Task 8: 回归边界检查

- [x] 确认本次改动不改写 `live-planning-flow` 的中间 flow 语义
- [x] 确认本次改动不重写 `live-planning-modules` 左侧面板规则
- [x] 确认 `live` 模式 dashboard 既有语义保持不变
- [x] 确认 `overview` / `transit` dashboard 既有语义保持不变

## Task 9: 构建验证

- [x] 实现完成后执行 `npm run build`
- [x] 若有编译错误，修复后重新执行直到通过或出现明确 blocker
