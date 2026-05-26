# terraforming-blocks Design

## 设计目标

本次设计只解决一个问题：任务树中同一 stat 的条件与效果重复展示，导致用户需要在 `condition-list` 与 `effect-list` 两处来回比对。解决方式不是引入第三套组件，而是把“同 stat 条件 + 效果”收敛到一条统一的 presenter 模型与同一条方块图。

同时，右列任务队列采用同一套“效果方块图”语法，避免任务树和任务队列各说各话。

## UI 收敛结果

### 任务树

任务树中的 stat 区域不再理解为“条件层”和“效果层”两个独立列表，而是一个按 `statId` 聚合后的 `stat-impact-list`。

每条 stat 行统一为：

- `stat 名`
- `可选变化值`
- `同一条方块图`

其中同一条方块图同时承载：

- 当前值
- 条件外框（若有）
- 效果增减叠加（若有）

补充规则：

- 已执行过的一次性项目，对于 `ranges` 型 stat 不再显示效果预览目标
- 同类项目中的数字型 stat 仍保留执行结果文本
- 若存在变化值文案，则该文案前移到方块图之前，形成 `stat名 + 变化值 + 方块图` 的顺序
- `stat名`、变化值、方块图之间使用放大的固定横向间距，避免标签贴边

这样用户对某一 stat 的读法固定为：

1. 看当前值在哪里
2. 看这次变化值是多少
3. 看条件外框是否存在、命中哪里
4. 看本次效果会把哪几格推高或拉低

补充视觉语义：

- 完整色带继续以真实 value 为最小单位，而不是 state
- 条件命中区继续覆盖在同一条方块图上方，不拆成旁置需求条
- `increase` 使用空心目标格 + 同色 1/2 内芯
- `decrease` 使用当前实心格内部打孔，孔洞边框沿用该格同色，孔洞填充直接取背景色

### 任务队列

任务队列中不再为可方块化的 stat 使用纯文本变化说明，而改用单行效果方块图。

任务队列与任务树的区别只保留两条：

- 队列不显示条件外框
- 队列不显示效果文案

因此任务队列的 stat 行只回答“这一条执行改了什么”，不回答“它是否满足条件”。

### 数字型 stat

无 `ranges` 的 stat 不参与方块图语义。

任务树中：

- 只有条件：显示 `当前值 + 需求文本`
- 只有效果：显示 `before -> after`
- 条件+效果：显示 `before -> after + 需求文本`

任务队列中：

- 始终显示 `before -> after`

进一步规则：

- 已执行过的一次性项目，对于 `ranges` 型 stat 不再显示效果预览目标
- 同类项目中的数字型 stat 仍保留执行结果文本

## 分层方案

继续遵守 `store -> presenter -> vue` 三层结构。

### store

不新增面向 UI 的拼装结构。继续只提供：

- 当前 runtime stats
- project effects / conditions 的领域数据
- execution timeline 的 before/after stats

### presenter

Presenter 新增“按 stat 聚合”的组装层，作为本次设计的核心。

#### 任务树聚合模型

建议新增一类面向 UI 的模型，例如：

```ts
interface TerraformingTaskStatLineModel {
  statId: string
  statName: string
  hasRanges: boolean
  currentValue: number
  ranges: TerraformingScaleRange[]
  requirementSegments: Array<{ startIndex: number; endIndex: number }>
  effectDirection: 'none' | 'increase' | 'decrease' | 'set'
  effectFromValue: number | null
  effectToValue: number | null
  effectLabel: string
  numericText: string | null
}
```

关键点：

- `condition` 与 `effect` 不再分两组输出
- Presenter 按 `statId` 合并项目里的 stat 条件和 stat effect
- Vue 不再自己判断“这一条是条件还是效果”，只消费单条 line model

#### 队列聚合模型

队列中的 stat 行可以复用同一个基础模型，但不携带 `requirementSegments` 与 `effectLabel`。

队列只需要：

- 执行前值
- 执行后值
- ranges
- 增减方向

## 组件收敛

### TerraformingStatScale

不建议为“合并条件+效果”再新建独立大组件。

更稳的方案是保留 `TerraformingStatScale` 作为唯一基础方块组件，并扩展一个合并模式，使其能够同时渲染：

- 完整 strip
- 条件外框
- 效果叠加

这样现有的 status / condition 语义可以继续保留，新的任务树 stat 行与队列 stat 行共享同一套块渲染逻辑。

`TerraformingTaskNode.vue` 需要从当前的：

- `condition-list`
- `effect-list`

重构为：

- `condition-list`：仅保留项目前置依赖等非 stat 条目
- `stat-impact-list`：承载按 `statId` 合并后的 stat 行
- `effect-list`：仅保留 rebate / sideEffect / description 等非 stat effect 条目

这样既实现“同 stat 合并”，又不会把 dependency / rebate 等异质信息硬塞进同一列表。

### TerraformingResourcePanel

右列的 execution entry 展开区新增 `timeline-stat-lines`：

- 可方块化 stat：单行效果方块图
- 数字型 stat：单行 `before -> after`

并且去掉原本可能重复出现的效果文案。

## 数据流

### 任务树

1. 从 project conditions 中抽取 stat 条件
2. 从 project effects 中抽取 stat effect
3. 按 `statId` 聚合
4. 结合 `currentStats` 与 `ranges` 生成单条 stat line model
5. 交给 Vue 渲染统一 stat 行

### 任务队列

1. 从 execution entry 的 `beforeStats` / `afterStats` 读取差异
2. 过滤出有变化的 stat
3. 按 statDef 判断是否存在 `ranges`
4. 存在 `ranges` 的生成单行效果方块图
5. 不存在 `ranges` 的生成单行文本

## 非目标

- 不在本次设计中加入“取消一次后的三态预览”
- 不把 sideEffect 的触发结果映射成第二层方块图
- 不改动 runtime stat 计算、项目可用性、execution replay 的领域语义
