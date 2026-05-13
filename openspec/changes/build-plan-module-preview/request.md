# build-plan-module-preview 需求

## 目标

将 build-plan preview 的真相层从旧的单一 `type` 责任模型，改成以 module 为核心的 preview 项模型。

这次变更只处理 preview 阶段：

1. preview 直接固定 derived 项对应的 `moduleId`
2. preview 区直接消费 preview 真相层，不再转回旧 `goals`
3. preview 区按新的中英 tag 文案、颜色和显示规则渲染
4. preview 的建材范围按完整展开的产线划定，不再使用 `autoFill` 结果作为 root 模块集合

## 已确认方案（审核重点）

### Preview 项拆分

- preview 不再使用单一 `PreviewResponsibility.type`
- preview 真相层拆成两个类型：
  - `PreviewDerivedItem`
  - `PreviewRequiredItem`
- `PreviewLinePlan` 持有的是 preview 项集合，不再持有旧责任 type 集合

### Derived 项规则

- `derived` 项表示“这条线承担什么”
- `derived` 项必须绑定 `moduleId`
- 不允许存在没有 `moduleId` 的 `derived` preview 项
- `derived` 项可以保留 `wareId`
- `derived` 项内部使用 `derived: [...]` 表达标签集合
- `derived` 标签值固定为：
  - `target`
  - `production`
  - `build-material`
- 同一条产线、同一 `wareId + moduleId` 的 `derived` 项合并为一条
- `derived` 内部标签去重合并

### Required 项规则

- `required` 项表示“这条线需要什么”
- `required` 项不绑定 `moduleId`
- `required` 项只表达依赖确认
- `required` 项内部使用 `required: [...]` 表达标签集合
- `required` 标签值固定为：
  - `production`
  - `build-material`
- 同一条产线、同一 `wareId` 的 `required` 项合并为一条
- `required` 内部标签去重合并

### Derived / Required 关系

- `derived` 和 `required` 不共存于同一条 preview 项
- 同一条产线、同一 `wareId` 若同时存在供给侧和需求侧语义，必须拆成两条 preview 项
- `targets[]` 只允许挂在 `derived` 项上

### Targets 规则

- 新增 `targets[]`
- `targets[]` 只表达 preview 项与目标来源的关联
- `targets[]` 不表达 `derived` / `required` 语义
- `targets[]` 每个来源一条数据
- `targets[]` 支持：
  - `build-module`
  - `production-rate`
  - `fleet-rate`
- `targets[]` 元素结构固定为：
  - `type`
  - `count?`
  - `ratePerHour?`
- `targets[]` 不保留 `wareId` 或 `moduleId`
- 没有关联来源的 preview 项不写 `targets`

### Module 选择规则

- preview 为 `derived` 项确认 `moduleId` 时：
  - 先为每条 logic-flow 产线确定 `lineage`
  - `lineage` 生成规则为：
    - 若产线 `isLocked = true`，取 `lockedLineage || subCategory`
    - 否则取 `subCategory`
    - 若仍为空，取 `default`
  - 第一轮优先 `manual`
  - 若 `manual` 有多个，先服从 `lineage`
  - 若仍有多个，取第一个
  - 第二轮检查 `auto`
  - `auto` 阶段只服从 `lineage`
  - 若仍有多个，取第一个
- preview 一旦为 `derived` 项确定 `moduleId`，后续 compute 必须直接读取该值
- compute 不再重新根据 `lineage`、`racePreference` 或 `findBestProducer` 二次生成 `moduleId`
- unmatched 的 `derived` 项也按 `settings.racePreference` 确认 `moduleId`
- unmatched 仍显示为“待规划产线 / Unplanned Line”，但项内 module 已确认

### Preview 建材范围规则

- preview 阶段不使用 `autoFill` 做定量 root 计算
- preview 的 root 模块集合来自“承接目标的完整展开产线”
- root 模块集合按目标产线当前已展开的非 isolated 模块节点收集
- preview 依赖图的首层 buildCost 仅来自这组 root 模块
- `autoFill` 仍属于 compute 阶段，用于数量求解，不再参与 preview root 范围判定

### Preview 展示规则

- preview 区直接消费 preview 真相层，不再转回 `ProductionLineAllocation.goals`
- 如果 preview 项存在 `moduleId`，显示 module 名称，不显示 ware 名称
- `derived` tag 使用绿色
- `required` tag 使用红色
- tag 顺序固定：
  - 先 `derived`
  - 后 `required`
- 产线右上角数量显示该产线已分配 `moduleId` 的去重种类数，不显示 preview 项数量

### i18n 文案

- 中文：
  - `target` -> `目标`
  - `production` -> `材料`
  - `build-material` -> `建材`
- English:
  - `target` -> `Target`
  - `production` -> `Production`
  - `build-material` -> `Material`

## 边界

### In Scope

- 重构 preview 真相层类型
- 重构 preview 生成结果结构
- 调整 preview presenter / Vue 渲染链路
- 调整 preview tag 文案、颜色和显示规则
- 为 `derived` 项在 preview 阶段确认 `moduleId`
- 约束 compute 阶段尊重 preview 已选 `moduleId`

### Out of Scope

- 修改 compute 公式
- 修改 scheme 结果结构
- 修改 steps / cost / duration 结果
- 编写测试代码
- 运行测试

## 验收标准（DoD）

1. preview 真相层不再保留旧的单一 `type` 责任模型
2. preview 真相层拆分为 `derived` 项与 `required` 项两个类型
3. `derived` 项必须带 `moduleId`
4. `required` 项不绑定 `moduleId`
5. `targets[]` 只出现在 `derived` 项上
6. preview 区不再通过 `ProductionLineAllocation.goals` 渲染
7. preview 区存在 `moduleId` 时显示 module 名称
8. preview 区 `derived` 为绿色 tag，`required` 为红色 tag
9. 产线卡片右上角数量显示 module 去重种类数
10. unmatched 的 `derived` 项也能按 race 选出 `moduleId`
11. 文档明确写出 `lineage` 的生成规则
12. 文档明确 compute 不再重复生成 `moduleId`，只尊重 preview 的选择
13. 文档明确 preview 的建材范围来自完整展开产线，而不是 `autoFill` 模块集合

## 未决项

无
