## Context

当前 `StationDashboard` 头部的视图切换是内联硬编码按钮，模板与样式耦合在页面内，难以在其他 dashboard 复用。
同时项目中已有多个“view mode switcher”近似实现，存在重复样式与行为分散问题。

## Decisions

1. 新增通用组件 `ViewTabUi`（命名以现有语义 `view-tab-ui` 为模板调用名）。
2. 组件 API 采用最小集合：`views`、`colorStyle`、`modelValue` + `update:modelValue`。
3. `views` 中 `label` 由父组件传入，组件不内置 i18n，保持文案来源单一。
4. `StationDashboard` 只替换切换 UI 层，`viewMode` 及其派生计算保持原有实现。
5. 组件内提供统一 `data-testid` 约定，降低测试定位波动。

## Component Contract

### Props

- `views: Array<{ key: string; label: string; disabled?: boolean }>`
- `colorStyle: string | undefined`
- `modelValue: string`

### Emits

- `update:modelValue`：点击可用 tab 时触发，参数为 `view.key`

### Rendering Rules

- 逐项渲染 `views`。
- `modelValue === item.key` 时应用激活态样式。
- `disabled` 时设置 `disabled` 属性，阻断事件。
- `colorStyle` 通过 class 映射影响激活态视觉（先实现 preset 映射）。

## Integration Plan

1. 新建 `src/components/common/ViewTabUi.vue`。
2. `StationDashboard.vue`：
   - 引入新组件。
   - 构造 `views` 计算项（沿用现有四个视图 key 和 `t(...)` 标签）。
   - 使用 `<ViewTabUi v-model="viewMode" :views="views" colorStyle="sky" />` 替换内联按钮区。
3. 清理 `StationDashboard` 中仅用于旧按钮组的局部样式，保留不相关样式定义。

## Risks

- 若 class 映射设计过窄，后续在其他 dashboard 复用时会再次扩展接口。
- 提取样式后若保留旧 class 名称不完整，可能引发轻微视觉回归。

## Non-Goals

- 本次不批量替换其他 dashboard。
- 不改动业务计算或 store 行为。
