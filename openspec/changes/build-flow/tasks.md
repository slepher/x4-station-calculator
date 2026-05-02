# Build Flow - Tasks

## Tasks

### Phase 1: 派生模型与关系状态

- [x] T1. 定义建筑产线区所需的派生数据结构（line card / output card / tag / target key）
- [x] T2. 在 `LogicFlowPlan` 接口新增 `buildFlow?: BuildFlowPlanData` 字段，确认旧版 plan 无 `buildFlow` 时无需迁移
- [x] T3. 实现目标唯一键与覆盖写入规则
- [x] T4. 实现解绑删除规则

### Phase 2: 现有产线推导

- [x] T5. 从 `ProductionLineGroup` 提取主要产品（仅 `source === 'manual' && !isIsolated`）
- [x] T6. 汇总现有产线自身模块（`!isIsolated && moduleId != null && tier > 0`）`buildCost`，生成全局"需求原材料"
- [x] T7. 按"主要产品命中需求原材料"筛选建筑产线
- [x] T8. 为每条入选产线计算"产线原材料"
- [x] T9. 为每条入选产线计算"产线建材"（模块口径同 T6：排除 isolated 和 tier 0）
- [x] T10. 计算"现产原材料"并集


### Phase 2.5: Assignments 失效清理

- [x] T10a. 实现按 sourceGroupId 查找 assignments 的失效检测（来源产线不存在、不再入选、来源标签失效）
- [x] T10b. 实现按 targetGroupId / targetType 查找 assignments 的失效检测（目标产线不存在、不再入选、目标标签失效）
- [x] T10c. 在派生视图重新计算后自动触发失效清理，清理后的 assignments 写回当前方案

### Phase 2.6: 持久化适配

- [x] T10d. 修改 `savePlan()` / `saveAsPlan()` 将运行时 assignments 写入 `LogicFlowPlan.buildFlow`
- [x] T10e. 修改 `applyPlan()` 从 `plan.buildFlow?.assignments` 恢复运行时 assignments，加载后执行失效清理
- [x] T10f. 确认 `stateMigrations.ts` 透传无 `buildFlow` 的旧版 plan（无需版本号变更）
- [x] T10g. 确认 `importExport.ts` 透传 `buildFlow` 字段

### Phase 3: Presenter 与视图挂载

- [x] T11. 新增 `src/components/logic-flow/presenters/useBuildFlowPresenter.ts`，统一组装 card、tag、菜单与 edge 数据
- [x] T12. 在 `LogicFlowWorkbenchView` 挂载建筑产线区
- [x] T13. 新增产线 card 与产出区 card 组件
- [x] T14. 为来源标签与目标标签提供稳定 DOM 锚点标识
- [x] T15. 实现 `CandidateZone -> BuildFlowZone -> PlanningZone` 的固定布局顺序
- [x] T16. 实现规划区相关拖拽期间 `BuildFlowZone` 的自动隐藏与拖拽结束后的恢复显示
- [x] T16a. 将三类 tag 改为常驻外伸 `+` 按钮布局，并保证按钮柄部盖住 card 边框

### Phase 4: 交互

- [x] T17. 实现来源标签拖拽到同 `wareId` 目标标签的绑定
- [x] T18. 实现 hover `+` 菜单与目标列表
- [x] T19. 让菜单绑定与拖拽绑定复用同一套关系写入逻辑
- [x] T20. 实现目标覆盖行为
- [x] T21. 实现目标解绑入口

### Phase 5: 有向线

- [x] T22. 基于已建立关系渲染来源标签到目标标签的有向线
- [x] T23. 在覆盖时更新连线
- [x] T24. 在解绑时删除连线
- [x] T25. 在布局变化时重算连线锚点

### Phase 6: 构建验证

- [x] T26. 代码完成后执行 `npm run build`

### Phase 7: 建筑材料分组

当前阶段 UI 改动仅限于：将单一产出区 card 拆为按组的多个产出区 card。产线 card 布局不变。

- [ ] T27. 在 `src/types/x4.ts` 新增 `BuildFlowGroup` 类型（`groupKey`、`lineCardGroupIds`、`outputTags`），移除 `BuildFlowOutputCard` 类型
- [ ] T28. 在 `buildFlowDerivation.ts` 实现 `computeBuildFlowGroups()` 递归扩散分组算法
- [ ] T29. 重构 `deriveBuildFlowView()` 返回 `BuildFlowGroup[]` 替代原来的 `lineCards + outputCard`，保持 demandMaterialSet 不变
- [ ] T30. 适配 `useLogicFlowStore`：将 `buildFlowLineCards` / `buildFlowOutputCard` 替换为 `buildFlowGroups` computed
- [ ] T31. 适配 `useBuildFlowPresenter`：
  - `BuildFlowPresenterStore` 接口替换 `outputCard` 为 `buildFlowGroups`
  - `getTargetsForSource()` 限制为同组内目标
  - `getSourcesForTarget()` 限制为同组内来源
  - `edges` 计算不变
- [ ] T32. 适配 `BuildFlowZone.vue`：渲染多个产出区 card（每组一个），替代原来单一产出区；菜单目标列表过滤为同组内
- [ ] T33. 在 `cleanupStaleAssignments()` 新增跨组 assignment 清理规则
- [ ] T34. 执行 `npm run build` 确认构建通过

## 完成定义

- [ ] 建筑产线区从现有 `ProductionLineGroup` 自动推导
- [ ] buildCost 口径正确：排除 `isIsolated` 节点和 `tier === 0` 模块
- [ ] 关系数据独立于现有产线运行时数据，但属于单条 `LogicFlowPlan`
- [ ] "产线原材料""产线建材""分组产出区"按已确认口径正确展示
- [ ] 分组算法正确执行递归扩散，产出区按组分配到多个 card
- [ ] 仅允许同 `wareId` 同组内来源标签与目标标签建立关系
- [ ] 目标标签唯一绑定、支持覆盖与解绑
- [ ] groups 变更后 assignments 失效清理自动执行（含跨组清理）
- [ ] 绑定完成后显示有向线
- [ ] 规划区相关拖拽期间 `BuildFlowZone` 自动隐藏且不干扰拖拽
- [ ] 保存/加载/另存为正确处理 `buildFlow` 字段
- [ ] 旧版 plan 无 `buildFlow` 字段时不报错
- [ ] `npm run build` 通过
