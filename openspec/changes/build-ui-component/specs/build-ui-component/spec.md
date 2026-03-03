# Build UI Component Specification

## Purpose
将 `StationDashboard` 的视图切换按钮组抽取为可复用组件，统一交互与样式入口，并通过 `views`、`colorStyle` 与 `v-model` 支撑可配置复用。

## ADDED Requirements

### Requirement: Reusable View Tab Component

#### Scenario: Render Tabs From Views Config
- **前提**：父组件传入 `views`，每项包含 `key` 与 `label`。
- **当**：视图切换组件渲染。
- **那么**：组件按 `views` 顺序渲染对应 tab 按钮。

#### Scenario: Render Disabled Tab
- **前提**：`views` 某项设置 `disabled=true`。
- **当**：组件渲染该项按钮。
- **那么**：按钮呈现禁用态且不可触发切换。

### Requirement: V-Model Driven Selection

#### Scenario: Highlight Active Tab From Model Value
- **前提**：父组件通过 `v-model` 传入当前 `modelValue`。
- **当**：组件渲染按钮组。
- **那么**：与 `modelValue` 相同 `key` 的按钮显示激活态。

#### Scenario: Emit Update On Click
- **前提**：用户点击非禁用 tab 按钮。
- **当**：点击事件触发。
- **那么**：组件发出 `update:modelValue`，值为该 tab 的 `key`。

### Requirement: Color Style Configuration

#### Scenario: Apply Color Style Preset
- **前提**：父组件传入 `colorStyle`。
- **当**：组件渲染激活态按钮。
- **那么**：激活态样式按 `colorStyle` 对应规则呈现。

### Requirement: Station Dashboard Integration

#### Scenario: Replace Inline View Switcher
- **前提**：`StationDashboard` 已接入视图切换组件。
- **当**：用户在 dashboard 头部切换 tab。
- **那么**：`viewMode` 值与原逻辑一致更新。
- **并且**：标题、内容区、footer 的条件渲染行为与改造前一致。

### Requirement: Stable Test Locators

#### Scenario: Provide Deterministic Test IDs
- **前提**：组件用于自动化回归。
- **当**：组件完成渲染。
- **那么**：组件容器与各 tab 按钮提供稳定 `data-testid`。
