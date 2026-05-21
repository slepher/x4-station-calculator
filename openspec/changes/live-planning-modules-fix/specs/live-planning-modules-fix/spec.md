# Live Planning Modules Fix Specification

## Purpose

修正 live planning modules 方案中的语义冲突，明确 `recommendedModules` 已经属于 planned 基线的一部分，并直接显示在 planning 区中，仅通过视觉样式区分来源；同时将 industrial autoFill 的通用旧语义与 live planning 专用 floor 语义拆开，避免 reference / floor 规则继续污染通用 autoFill。

## ADDED Requirements

### Requirement: Recommended Modules Are A Planned Subset

在 live planning 场景下，`recommendedModules` SHALL 被视为 planned baseline 的一个子集，而不是“待用户采纳”的候选列表。

#### Scenario: recommended modules participate in planning computation

**前提** 某些 reference-aligned orphan modules 被归入 `recommendedModules`
**当** 系统执行 live planning 计算
**那么** 这些模块 MUST 参与 industrial autoFill baseline
**并且** MUST 参与 flow 计算
**并且** MUST 参与 planned ware 集合判定

#### Scenario: effective planned baseline is emitted as a formal store field

**前提** 系统同时存在显式 planned modules、recommended modules 与 reference production floor
**当** store 输出 station planning state
**那么** 系统 MUST 输出 `effectivePlannedModules`
**并且** 该字段 MUST 表示所有需要按 planned 语义处理的模块集合
**并且** 其顺序 MUST 保持“显式 planned -> recommended subset”
**并且** reference production floor MUST NOT 因此自动进入 `effectivePlannedModules`

#### Scenario: recommended modules render inside the planning list

**前提** 规划面板存在 `recommendedModules`
**当** 用户查看 planning 区中的模块列表
**那么** recommended modules MUST 直接显示在 planning 列表中
**并且** MUST NOT 被拆成独立推荐区块
**并且** MUST NOT 暗示这些模块尚未纳入 planning

### Requirement: Recommended Section Copy Must Match Applied State

planning 区中与 recommended modules 相关的标题、说明与交互文案 SHALL 与“已纳入 planning 的子集”语义一致。

#### Scenario: UI copy must not imply deferred adoption

**前提** 系统渲染 planning 区内与 recommended modules 相关的说明文案
**当** 用户阅读这些文案
**那么** 文案 MUST NOT 使用“建议纳入规划”“点击后加入规划”等暗示未生效状态的表达
**并且** 文案 MUST 明确或至少不违背“这些模块已参与 planning”这一事实

#### Scenario: visual source markers do not change planning result

**前提** 系统对 recommended modules 显示虚线前置等来源标记
**当** 用户查看当前 planning 面板
**那么** 这些来源标记 MUST 只影响展示样式
**并且** MUST NOT 修改任何 planned / auto / flow 计算结果

### Requirement: Orphan Rule Must Be Part Of Planning Baseline Construction

当 orphan 规则用于构造 `recommendedModules` 时，系统 SHALL 将其视为 live planning baseline 构造规则，而不只是 presenter 的 UI 推导规则。

#### Scenario: orphan rule is evaluated before presenter grouping

**前提** 系统存在 `referenceModules`
**当** live planning 路径构造 effective planned baseline
**那么** orphan 判定 MUST 在 store / planning 计算路径中完成
**并且** presenter MUST 仅消费该结果进行分组展示

## MODIFIED Requirements

### Requirement: AutoFill Boundary For Live Planning

通用 industrial autoFill 与 live planning 专用 floor 语义 MUST 分离。

#### Scenario: generic autoFill uses develop semantics

**前提** 系统执行通用 industrial autoFill
**当** 当前路径不是 live planning 专用 floor 路径
**那么** 系统 MUST 使用 `develop` 版本的 industrial autoFill 语义
**并且** MUST NOT 依赖 `referenceModules`

#### Scenario: live planning floor uses a dedicated function

**前提** 当前路径需要基于 `archive_total` 施加 industrial floor
**当** 系统执行 live planning industrial planning
**那么** 系统 MUST 通过独立函数处理 floor
**并且** MUST NOT 将 floor / reference 逻辑混入通用 `calculateAutoIndustryModules`

#### Scenario: floor production modules appear in autoIndustryModules

**前提** archive 中存在未在显式 planned 中的 production 模块（如 microchips x33）
**当** 系统执行 live planning 计算
**那么** 这些模块 MUST 出现在 `autoIndustryModules` 中而不是被吸收进 `effectivePlannedModules`
**并且** MUST 参与 autoFill 基线计算（其产能被计入以减少 deficit）
**并且** MUST 按 tier desc 与其余 auto 模块统一排序

#### Scenario: industrial producer selection no longer uses reference quota state machine

**前提** live planning 已通过 `archive_total` 构造 effective planned baseline
**当** 系统继续补齐工业上游缺口
**那么** 系统 MUST NOT 继续依赖工业 producer 的 reference quota 分摊状态机
**并且** 缺口补齐 MUST 建立在 floor 后 baseline 之上

### Requirement: Recommended Wares Use Planned Priority But Separate Flow Display Order

recommended subset 产出的 ware 在 priority 语义上 SHALL 等同于 planned ware；若需要区分 flow 列表顺序，系统 MUST 将其视为独立的展示语义，而不是 `warePriority` 排序。

#### Scenario: recommended ware resolves to planned priority

**前提** 某个 ware 仅由 recommended subset 中的模块产出
**当** 系统计算该 ware 的 resolved priority
**那么** 该 ware MUST 获得 planned 级 priority `2`

#### Scenario: flow display order is derived from effective planned ordering

**前提** flow 列表需要区分用户显式 planned、recommended subset 与 auto 产出
**当** 系统构造用于 flow 排序的 planned 基线
**那么** 系统 MUST 使用 `effectivePlannedModules` 的顺序
**并且** recommended subset MUST 位于其他 auto 产出之前

#### Scenario: flow display order is not expressed by warePriority

**前提** flow 列表需要区分用户显式 planned、recommended subset 与 auto 产出
**当** 系统定义显示顺序
**那么** 该顺序 MUST 作为 presenter / UI 层展示规则表达
**并且** 系统 MUST NOT 将此顺序描述成 `warePriority` 的内部排序

### Requirement: Recommended Item Interaction Matches Applied State

planning 区中 recommended items 的交互语义 MUST 与“recommended modules 已属于 planned baseline”一致。

#### Scenario: clicking recommended module promotes it to explicit planned total

**前提** 某个模块已位于 `recommendedModules` 分组中
**当** 用户点击该模块
**那么** 系统 MUST 将显式 planned 数量提升到该模块当前目标总量
**并且** MUST NOT 在该目标总量之上再次累加 recommended 数量

#### Scenario: recommended modules use a visual source marker inside planning list

**前提** 某个 planned module 同时属于 recommended subset
**当** 系统渲染 planning 列表
**那么** 该模块 MUST 使用虚线前置或等价弱视觉标记区分来源
**并且** 该标记 MUST 与普通 planned module 并列出现在同一 planning 列表中
