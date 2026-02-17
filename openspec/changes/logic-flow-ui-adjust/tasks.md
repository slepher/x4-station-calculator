# Tasks: Logic Flow UI Adjust

## Implementation Tasks

- [x] 1.1 修改 LogicFlowCandidateZone.vue 的 tier 列宽度
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 修改: `grid-cols-4` → `grid-cols-[2fr_3fr_3fr_4fr]`

- [x] 1.2 修改 LogicFlowPlanningZone.vue 紧凑视图的 tier 列宽度
    - 文件: `src/components/LogicFlowPlanningZone.vue`
    - 修改: `grid-cols-4` → `grid-cols-[2fr_3fr_3fr_4fr]`

- [x] 1.3 修改 LogicFlowPlanningZone.vue 节点网格的 tier 列宽度
    - 文件: `src/components/LogicFlowPlanningZone.vue`
    - 修改: `grid-cols-4` → `grid-cols-[2fr_3fr_3fr_4fr]`

- [x] 1.4 修改 ProductionLineGroup.vue 的 tier 列宽度
    - 文件: `src/components/ProductionLineGroup.vue`
    - 修改: `grid-cols-4` → `grid-cols-[2fr_3fr_3fr_4fr]`

- [x] 1.5 修改 LogicFlowCandidateZone.vue 的间距
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 修改: `p-6` → `p-4`, `gap-6` → `gap-12`

- [x] 1.6 验证构建无错误
    - 运行: `npm run build`

---

## Ware Card Tasks

- [x] 2.1 实现 Grid 重叠布局
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 布局: `grid-template-columns: 1fr auto`
    - 层级: 产品名(col 1-2), T0+压缩率(col 2)

- [x] 2.2 实现渐变遮罩覆盖效果
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 效果: `linear-gradient(to right, transparent, slate-900/80% 30%, slate-900)`
    - T0 标签覆盖产品名时使用渐变过渡
    - hover 时 T0 标签渐变消失

- [x] 2.3 实现压缩率显示
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 位置: T0 标签右侧
    - 格式: 百分比 + 体积图标
    - 颜色: ≤100% 绿色, >100% 红色

- [x] 2.4 实现 hover 展开+按钮
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 行为: hover 时背景层向右扩展，+按钮从右侧滑入
    - 约束: 内容层位置不变，压缩率位置不变

- [x] 2.5 T0 资源排除逻辑
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 规则: T0 资源不显示压缩率和+按钮

- [x] 2.6 验证构建无错误
    - 运行: `npm run build`
