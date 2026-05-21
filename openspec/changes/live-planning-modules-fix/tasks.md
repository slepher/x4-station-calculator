# Live Planning Modules Fix - Tasks

## Tasks

### Phase 1: 语义与文案收口

- [x] T1. 统一 `recommendedModules` 的产品语义，明确其属于 planned 基线的一部分
- [ ] T2. 更新 planning 区相关说明与 locale 文案，移除“建议纳入规划 / 点击加入规划”的误导性表达
- [x] T3. 将 recommended 项交互定义收敛为普通 planned 项交互，并明确“点击转正到当前目标总量”

### Phase 2: store / presenter 分层修正

- [x] T4. 将 orphan 判定从 presenter 展示规则提升为 live planning baseline 构造规则
- [x] T5. 在 store / planning 计算路径中输出 recommended subset 所需真源数据
- [x] T5.1 提升 `effectivePlannedModules` 为正式 store 输出字段，并统一 planned 语义计算链入口
- [x] T6. 调整 presenter，使其只负责在 planned 列表中为 recommended subset 组装来源标记
- [x] T7. 确认虚线前置等来源标记仅影响展示，不影响任何计算

### Phase 3: industrial autoFill 边界修正

- [x] T8. 将通用 `calculateAutoIndustryModules` 恢复为 `develop` 语义，不再理解 `referenceModules`
- [x] T9. 将通用 `calculateAutoFillModules` 恢复为不理解 `referenceModules` 的旧入口
- [x] T10. 新增 live planning 专用 industrial floor 函数，用于处理 `archive_total` 基线
- [x] T11. 将 live planning / reference-aware planning 路径切换到新 floor 函数
- [x] T11.1 `calculateAutoIndustryModulesWithFloor` 内部以 `max(planned, floor)` 构建产能基线，调用通用 autoFill，再将 floor-beyond-planned 合并回 `autoIndustryModules`
- [x] T11.2 `autoIndustryModules` 最终结果按 tier desc 统一排序（含 floor 模块）
- [x] T12. 删除或停止依赖工业 producer 的 reference quota 状态机逻辑

### Phase 4: priority 与 flow 展示语义修正

- [x] T13. 明确 recommended subset 产出的 ware 在 resolved priority 上等同 planned ware
- [x] T14. 将 flow 列表顺序语义与 `warePriority` 等级语义拆开表达
- [x] T15. 补充 presenter / UI 需要的显示顺序规则，确保“用户显式 planned -> recommended subset -> auto”可被实现

### Phase 5: planning 区展示修正

- [x] T16. 移除 `recommendedModulesExpanded` 相关文档要求与实现依赖
- [x] T17. 将 recommended 来源模块直接并入 planning 区展示
- [x] T18. 为 recommended 项补充虚线前置等来源样式约束

### Phase 6: planned 区 count 交互与输入确认

- [x] T19. recommended 模块 count 不允许 `< archive`（X4NumberInput min + handleUpdateModuleCount clamp）
- [x] T20. 非 recommend 模块允许 `< archive`，输入不标红
- [x] T21. 已显式规划的模块不进入 `recommendedDisplayModules`
- [x] T22. X4NumberInput 改为失焦确认（`handleBlur` emit），箭头按钮即时确认

## 完成定义

- [ ] `recommendedModules` 在所有文档和实现中都不再被描述为“待采纳建议”
- [ ] planning 区相关文案与交互与“已纳入 planning 的子集”语义一致
- [x] orphan 判定作为 live planning baseline 规则进入 store / planning 路径
- [x] `effectivePlannedModules` 成为 planned 语义计算链的统一入口，且 floor 模块不进入该字段
- [x] 通用 industrial autoFill 回到 `develop` 语义，不再依赖 `referenceModules`
- [x] live planning 的 floor 由新函数专门处理，floor 模块通过 `autoIndustryModules` 暴露
- [x] 工业 autoFill 不再依赖复杂 reference quota 状态机
- [x] `warePriority` 等级与 flow 列表顺序不再混淆
- [x] recommended 模块直接显示在 planning 区中，并通过虚线前置等样式区分来源
- [x] present 使用 `auto*Modules` 直接作为展示数据源，不再从 `effectiveTargetModules` filter delta
- [x] recommended 模块 count 不允许 `< archive`，非 recommend 模块允许 `< archive`
- [x] 已显式规划的模块不进入 `recommendedDisplayModules`
- [x] X4NumberInput 失焦确认，中间输入不触发计算
