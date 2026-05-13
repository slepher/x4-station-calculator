# Logic Flow Logic Specification

## Purpose

统一 `logic-flow` 对 `manual / auto / isolated` 节点语义的定义，并要求 `build-plan` 与胶水脚本共用同一责任解释真值，不再各自实现平行逻辑。

## ADDED Requirements

### Requirement: `manual`、`auto`、`isolated` 的语义必须固定

**前提** 系统使用 `FlowNode` 表达逻辑流节点  
**当** 任一模块解释节点语义  
**那么** 系统 MUST 将 `manual + !isolated` 解释为用户显式生产声明  
**并且** MUST 将 `manual + isolated` 解释为用户显式边界声明  
**并且** MUST 将 `auto + !isolated` 解释为系统推导结果  
**并且** MUST NOT 将 auto 节点与显式 isolated 边界视为同等级的责任真值

#### Scenario: 显式 isolated 不是普通生产节点

**前提** 某组包含 `manual + isolated` 的 `energycells` 节点  
**当** 下游模块解释该节点  
**那么** 系统将其视为“本组不生产 energycells，此处截断”  
**并且** 不将其解释为“本组存在一个普通 energycells 生产节点”

### Requirement: 遇到 isolated 时必须停止向上游推导

**前提** `logic-flow` 正在对某 ware 执行向上游扩展  
**当** 当前组中已存在该 ware 的 `isolated` 节点  
**那么** 系统 MUST 停止继续向上游推导  
**并且** MUST NOT 再补出该 ware 的 auto 上游链条用于覆盖该截断点

#### Scenario: isolated 截断当前组的 energycells 推导

**前提** 产线 A 中显式存在 `isolated energycells`  
**当** 系统从 A 的模块输入继续向上游扩展  
**那么** 系统在 `energycells` 处停止  
**并且** A 不再因为该路径额外获得新的 `energycells` auto 生产解释

### Requirement: 责任解释必须以内置于 logic-flow 的共享模块为准

**前提** 系统需要将目标、组节点与 build-flow assignment 解释为责任归属  
**当** 网页 build-plan 或胶水脚本读取责任结果  
**那么** 两者 MUST 调用同一共享 logic 模块  
**并且** MUST NOT 各自维护不同的责任推导规则  
**并且** MUST NOT 在消费层重新递归节点图或重新猜测边界

#### Scenario: 网页与脚本共用责任解释结果

**前提** 网页与脚本读取同一 export / groups / buildFlowView  
**当** 两者执行责任解释  
**那么** 两者得到同一责任归属真值  
**并且** 不因调用路径不同而出现不同的 required / derived 分配结果

### Requirement: 共享模块必须区分组事实与责任结果

**前提** 共享 logic 模块输出解释结果  
**当** 上层消费该结果  
**那么** 输出 MUST 同时包含：
- 组级事实（显式生产、显式 isolated、auto 推导）
- 责任结果（owner、type、source、related groups）

**并且** MUST NOT 只返回一个丢失边界原因的扁平 goals 列表

#### Scenario: 上层能识别责任来自显式 isolated 边界

**前提** 某条 required / production 责任由显式 isolated 边界决定  
**当** 上层读取责任结果  
**那么** 上层可以从输出中识别：
- 责任属于哪个 group
- 责任类型是什么
- 它为什么属于该组
- 是否由显式 isolated 边界触发

### Requirement: build-plan 不得重新实现 logic-flow 语义

**前提** `build-plan` 需要把责任结果转成 preview / allocation / compute 输入  
**当** `build-plan` 执行格式转换  
**那么** 它 MAY 格式化共享模块输出  
**但是** MUST NOT 重新实现：
- covered set 构造
- 模块输入递归向上游遍历
- isolated 触发 derived / required 的平行语义
- manual / auto / isolated 多轮扫描分配

#### Scenario: build-plan 只消费责任真值

**前提** 共享模块已输出责任结果  
**当** `build-plan` 生成 previewResult  
**那么** 它直接消费责任结果  
**并且** 不再从 `groups` 自行重跑第二套解释逻辑
