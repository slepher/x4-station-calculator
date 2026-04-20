# station-derived-map Self Attributes Tasks

## Tasks

### Phase S1: 收口对外接口

- [x] S1. 删除 `StationDerivedMap` 对外导出的计算接口
- [x] S1a. 删除 `setComputeDeps`
- [x] S1b. 删除 `updateStaticDeps`
- [x] S2. 保留并实现以下对外写接口：
  - `upsertStation(stationId, seed)`
  - `updateModules(stationId, modules)`
  - `updateSettings(stationId, settings)`
  - `updateLockedWares(stationId, lockedWares)`
  - `updateWarePriority(stationId, warePriority)`
  - `refreshStation(stationId)`
  - `refreshAll()`
  - `removeStation(stationId)`
  - `clear()`
- [x] S3. 禁止外部继续直接组合 `compute + setSemantics + updateAggregation`

### Phase S2: 建立 station 自身输入快照

- [x] S4. 在 `StationDerivedMap` 内新增 `StationDerivedSnapshot`
- [x] S5. `StationDerivedSnapshot` 必须包含：
  - `modulesMode`
  - `inputModules`
  - `fullModules`
  - `settings`
  - `lockedWares`
  - `warePriority`
  - `workforcesOverride?`
  - `archiveSemanticsSource?`
- [x] S6. `upsertStation(stationId, seed)` 必须写入或覆盖该快照

### Phase S3: 固定 modulesMode 语义

- [x] S7. `modulesMode` 固定为 `'plan' | 'full'`
- [x] S8. `plan` 模式下，`modules` 视为规划模块，map 必须自动推导 `fullModules`
- [x] S9. `full` 模式下，`modules` 视为完整模块，map 不得自动补派生模块
- [x] S10. `workforces` 仅在 `full` 模式下生效
- [x] S11. `archiveSemanticsSource` 仅在 `full` 模式下生效
- [x] S12. `plan` 模式下传入 `workforces` 或 `archiveSemanticsSource` 时，不得让其进入内部有效快照

### Phase S4: 收束 settings 有效字段

- [x] S13. 定义内部 `StationDerivedSettings` 类型
- [x] S14. `StationDerivedSettings` 只允许包含以下字段：
  - `racePreference`
  - `considerWorkforceForAutoFill`
  - `sunlight`
  - `useHQ`
  - `workforceAuto`
  - `manualWorkforce`
- [x] S15. 实现 settings 截断逻辑
- [x] S16. `upsertStation(...)` 保存 settings 前必须截断
- [x] S17. `updateSettings(...)` 保存 settings 前必须截断
- [x] S18. 额外字段不得进入内部 snapshot
- [x] S19. 额外字段不得参与变更比较
- [x] S20. 截断后的有效字段未变化时，不得触发重算

### Phase S5: 将更新判断下沉到 map 内部

- [x] S21. 为所有 `update*` 接口增加"实质性影响判断"
- [x] S22. `update*` 在重算前必须先归一化输入并与当前 snapshot 比较
- [x] S23. 无实质性变化时，必须直接返回，不得触发 flow、semantics 或 aggregation 更新
- [x] S24. "仅对象引用变化但归一化后内容相同"的情况不得触发重算
- [x] S25. `updateModules(stationId, modules)` 必须读取该 station 的 `modulesMode`
- [x] S26. `plan` 模式下的 `updateModules` 必须执行：
  - 更新 `inputModules`
  - 推导 `fullModules`
  - 重算 flow
  - 重算 semantics
  - 更新 aggregation
- [x] S27. `full` 模式下的 `updateModules` 必须执行：
  - 更新 `inputModules`
  - 令 `fullModules = inputModules`
  - 重算 flow
  - 重算 semantics
  - 更新 aggregation
- [x] S28. `updateSettings(stationId, settings)` 必须只在存在实质性变化时触发 flow + aggregation
- [x] S29. `updateLockedWares(stationId, lockedWares)` 必须只在存在实质性变化时触发 flow + aggregation
- [x] S30. `updateWarePriority(stationId, warePriority)` 必须只在存在实质性变化时触发 flow + aggregation
- [x] S31. `refreshStation(stationId)` 必须触发 flow + semantics + aggregation
- [x] S32. `refreshAll()` 必须遍历全部 stations 触发 flow + semantics，并最终统一更新 aggregation

### Phase S6: full 模式附加规则

- [x] S33. `full` 模式下若存在 `workforcesOverride`，必须跳过内部工人推导
- [x] S34. `full` 模式下若存在 `archiveSemanticsSource`，必须以其作为 semantics 主来源
- [x] S35. `archiveSemanticsSource` 字段不完整时，必须基于 `fullModules` 补齐缺失 semantics
- [x] S36. 未传 `archiveSemanticsSource` 时，`full` 模式必须完全基于 `fullModules` 生成 semantics

### Phase S7: 外部调用清理

- [x] S37. `useBlueprintProductionStore` 改为只调用属性更新接口
- [x] S38. `useLiveProductionStore` 改为只调用属性更新接口
- [x] S39. 删除 store 层对 map 计算接口的直接依赖
- [x] S40. 删除 store 层手工组合 `compute + setSemantics + updateAggregation` 的路径
- [x] S40a. `StationDerivedMap` 静态依赖改为仅构造函数注入
- [x] S40b. blueprint store 自持 planning `StationDerivedMap` 实例
- [x] S40c. live store 自持 planning `StationDerivedMap` 实例
- [x] S40d. live store 自持 archive/live `StationDerivedMap` 实例
- [x] S40e. 删除 blueprint 与 live 共享 planning map 的路径
- [x] S40f. facade / presenter / 组件不再依赖模块级共享 planning map

### Phase S8: 验证

- [x] S41. 确认 `settings` 额外字段不会进入 snapshot
- [x] S42. 确认 `settings` 额外字段变化不会触发重算
- [x] S43. 献认 `update*` 在无实质性变化时不会触发重算
- [x] S44. 献认 `plan` / `full` 两种模式下 `updateModules` 行为符合定义
- [x] S45. 运行 `npm run build`
