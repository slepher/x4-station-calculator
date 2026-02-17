# Tasks: Logic Flow UI Adjust

## Implementation Tasks

### Tier 列宽度比例

- [x] 1.1 修改 LogicFlowCandidateZone.vue 的 tier 列宽度
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 修改: `grid-cols-4` → `grid-cols-[2fr_3fr_3fr_4fr]`

- [x] 1.2 修改 ProductionLineGroup.vue 的 tier 列宽度
    - 文件: `src/components/ProductionLineGroup.vue`
    - 修改: `grid-cols-4` → `grid-cols-[2fr_3fr_3fr_4fr]`

- [x] 1.3 修正紧凑区布局使用等宽
    - 文件: `src/components/LogicFlowPlanningZone.vue`
    - Line 405: `grid-cols-[2fr_3fr_3fr_4fr]` → `grid-cols-4`
    - Line 492: `grid-cols-[2fr_3fr_3fr_4fr]` → `grid-cols-4`

---

### 间距调整

- [x] 2.1 修改 LogicFlowCandidateZone.vue 的间距
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 修改: `p-4` → `pl-4 pr-8`

- [x] 2.2 修改 LogicFlowPlanningZone.vue 的间距
    - 文件: `src/components/LogicFlowPlanningZone.vue`
    - 添加: `pl-4 pr-8`
    - 移除紧凑视图的 `px-12`

- [x] 2.3 抽取 ProductionLineGroup.vue 内部 padding
    - 文件: `src/components/ProductionLineGroup.vue`
    - 移除: Header 和 Grid 的 `px-4`

- [x] 2.4 统一 draggable-area 的 mb
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 修改: `mb` → `mb-1.5`（与内部 gap 一致）

---

### Ware Card 布局和交互

- [x] 3.1 实现 Grid 重叠布局
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 布局: `grid-template-columns: 1fr auto`
    - 层级: 产品名(col 1-2), T0+压缩率(col 2)

- [x] 3.2 实现 T0 标签半透明背景遮罩
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 效果: `bg-slate-900/70` 半透明背景
    - T0 标签覆盖产品名时使用半透明遮罩

- [x] 3.3 实现 T0 标签 hover 时消失
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 效果: `hover:opacity-0`
    - hover 时 T0 标签渐变消失，露出完整产品名

- [x] 3.4 实现压缩率显示
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 位置: T0 标签右侧
    - 格式: 百分比 + 体积图标
    - 颜色: ≤100% 绿色, >100% 红色
    - hover 时保持显示

- [x] 3.5 实现 hover 展开+按钮
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 行为: hover 时背景层向右扩展，+按钮从右侧滑入
    - 约束: 内容层位置不变，压缩率位置不变

- [x] 3.6 T0 资源特殊处理
    - 文件: `src/components/LogicFlowCandidateZone.vue`
    - 规则: T0 资源不显示压缩率和+按钮，但保留背景染色

---

### 预览算法简化

- [x] 4.1 移除新建规划区预览的复杂算法
    - 文件: `src/components/LogicFlowPlanningZone.vue`
    - 移除: `gridColumnStart` 计算
    - 结果: 预览节点始终显示在第1列

---

### 验证

- [x] 5.1 验证构建无错误
    - 运行: `npm run build`
