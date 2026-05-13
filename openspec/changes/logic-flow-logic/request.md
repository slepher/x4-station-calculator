# logic-flow-logic 需求

## 目标

将 `logic-flow` 中关于 `manual / auto / isolated` 的领域语义整理为单一真相来源，并从当前 `build-plan` 的二次解释逻辑中抽离出来，形成可被网页与胶水脚本共同调用的共享 logic 模块。

本次 change 重点不是直接修改某个分配结果，而是先明确：

1. `FlowNode` 数据结构各状态的业务含义。
2. 遇到 `isolated` 时的停止推导规则属于 `logic-flow` 领域真值。
3. `build-plan` 与 `analysis/scripts/build-plan/build-plan-production-line.ts` 只能消费该真值，不得重新递归、重新猜测责任归属。

## 已确认方案（审核重点）

### `FlowNode` 语义

- `manual + !isolated` 表示用户明确声明“本产线生产该 ware / module”。
- `manual + isolated` 表示用户明确声明“本产线在该 ware 处截断，该 ware 作为外部输入存在，本产线不生产它”。
- `auto + !isolated` 表示系统根据上游推导规则自动补出的节点，它是推导结果，不是用户决策。
- `auto + isolated` 不属于当前语义模型中的合法核心状态；若未来出现，必须单独定义，不允许按现有 `manual isolated` 语义偷用。

### 推导边界

- `logic-flow` 向上游推导时，一旦遇到某组中已存在的 `isolated` ware，必须停止继续向上游扩展。
- “停止推导”不仅影响节点补全，也影响后续责任解释。
- 某 ware 被某组显式 `isolated` 后，下游模块不得再把别组的 auto 生产节点当成对该截断点的等价替代解释。

### 模块边界

- `logic-flow` 负责：
  - 还原完整组节点
  - 推导上游 auto 节点
  - 识别显式边界
  - 输出责任解释真值
- `build-plan` 负责：
  - 读取 `logic-flow` 输出的责任真值
  - 转成 preview / allocation / compute 所需结构
- 胶水脚本负责：
  - 读取导出数据
  - 调用共享 logic 模块
  - 打印分析结果
- 不允许脚本或 `build-plan` 自己再实现一套“看到 isolated 就生成 derived / required，再按 manual/auto/isolate 多轮匹配”的平行逻辑。

### 共享 logic 模块

- 需要新增一个从 `logic-flow` 侧导出的共享 logic 模块。
- 模块输入至少包括：
  - `ProductionLineGroup[]`
  - `BuildFlowView`
  - `modulesMap`
  - `modulesByOutputMap`
  - 用户目标或其等价输入
- 模块输出至少包括：
  - 每组的显式生产 / 显式 isolated / auto 推导结果
  - 每条责任的归属结果
  - 责任来源与边界原因
- `build-plan` 与胶水脚本必须共用这一入口。

### 对现有实现的约束

- `computeProductionLineAllocation()` 中当前的这些行为不应继续作为真值层存在：
  - 重新构造 covered 集合
  - 重新沿模块输入递归向上游
  - 通过 `findGroupWithIsolatedWare()` 把 isolated 只当作派生触发器
  - 再按 manual / auto / isolated 多轮扫描决定归属
- 当前实现可以作为迁移前参考，但不能作为需求依据。
- 如果当前代码行为与本文档冲突，默认代码错误。

## 边界

### In Scope

- 说明 `FlowNode` 中 `manual / auto / isolated` 的正式语义
- 说明“遇到 isolated 停止推导”是 `logic-flow` 领域规则
- 明确哪些逻辑属于 `logic-flow` 真值层，哪些属于 `build-plan` 消费层
- 设计一个共享 logic 模块，供 build-plan 与脚本共同调用
- 更新 request / spec / design / tasks 文档，使后续实现可直接按文档执行

### Out of Scope

- 直接修改 `src/**` 实现
- 编写测试代码
- 运行测试
- 调整 build-flow UI 交互
- 重构所有现有 presenter 或 store
- 在本阶段决定最终函数名或最终文件名之外的所有实现细节

## 验收标准（DoD）

1. 文档明确区分 `manual + !isolated`、`manual + isolated`、`auto + !isolated` 的语义。
2. 文档明确说明遇到 `isolated` 时必须停止推导，且这一规则属于 `logic-flow` 领域层。
3. 文档明确说明 `build-plan` 与胶水脚本不得重新实现一套平行解释逻辑。
4. 文档明确给出共享 logic 模块的职责边界与最小输入/输出要求。
5. 文档明确指出当前 `computeProductionLineAllocation()` 中哪些逻辑应迁出到 `logic-flow` 侧。
6. `request.md` / `spec.md` / `design.md` / `tasks.md` 之间对职责边界与迁移方向不存在互相冲突的描述。

## 未决项

无
