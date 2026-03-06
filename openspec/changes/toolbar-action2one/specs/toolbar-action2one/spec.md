# toolbar-action2one Specification

## Purpose
统一三模块（ship-build / logicFlow / empire）在 Toolbar 与 SmartSaveDialog 的 `新建/保存/另存为` 行为语义，确保同名操作具备一致的动作编排规则，并在执行时映射到各自 store 函数。

## MODIFIED Requirements

### Requirement: Toolbar Action Semantics Are Unified
系统 MUST 以统一动作语义定义三模块的 Toolbar/SmartSave 操作：`SAVE`、`SAVE_AS(name)`、`NEW`，以及组合动作 `OVERWRITE_AND_NEW`、`SAVE_AS_AND_NEW`、`DISCARD_AND_NEW`。

#### Scenario: 覆盖并新建统一执行序列
- **前提**：用户位于任一模块（ship-build / logicFlow / empire）且触发 `覆盖并新建`
- **当**：用户确认执行
- **那么**：系统 MUST 执行 `SAVE -> NEW`
- **并且**：该流程 MUST NOT 依赖名称输入

#### Scenario: 另存为并新建统一执行序列
- **前提**：用户位于任一模块并触发 `另存为并新建`
- **当**：用户输入合法名称并确认执行
- **那么**：系统 MUST 执行 `SAVE_AS(name) -> NEW`
- **并且**：系统 MUST 创建新对象（新 id）

#### Scenario: 丢弃并新建统一执行序列
- **前提**：用户位于任一模块并触发 `丢弃并新建`
- **当**：用户确认执行
- **那么**：系统 MUST 仅执行 `NEW`

### Requirement: Action Routing Happens At Execution Time
系统 MUST 在“用户点击最终动作按钮”时再完成动作到模块函数的映射，禁止通过 UI 状态推断替代动作语义。

#### Scenario: 名称校验边界
- **前提**：用户触发任一 SmartSave 主动作
- **当**：系统进行输入校验
- **那么**：系统 MUST 仅在 `SAVE_AS(name)` 场景校验名称非空
- **并且**：`SAVE` 与 `OVERWRITE_AND_NEW` MUST NOT 因空名称被阻断

### Requirement: Shared Policy And Runner Are Centralized
系统 MUST 将共享决策与执行抽离为公共模块，避免分散在多个 Vue 组件内。

#### Scenario: 共享策略与执行器落地
- **前提**：开发者实现 toolbar/smartsave 行为
- **当**：实现统一动作框架
- **那么**：纯策略函数 MUST 位于 `src/utils/smartSavePolicy.ts`
- **并且**：执行编排 composable MUST 位于 `src/composables/useSmartSaveRunner.ts`
- **并且**：`StationToolbar.vue` 与 `SmartSaveDialog.vue` SHOULD 仅保留 UI 输入与调用入口
