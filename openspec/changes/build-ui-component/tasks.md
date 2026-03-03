# Tasks: build-ui-component

## 1. 通用组件实现

- [x] 1.1 新建 `ViewTabUi` 组件并定义 `views`、`colorStyle`、`modelValue` props。
- [x] 1.2 实现 `update:modelValue` 事件与禁用态点击保护。
- [x] 1.3 在组件中落地统一样式与 `data-testid` 约定。

## 2. StationDashboard 接入

- [x] 2.1 在 `StationDashboard` 中引入 `ViewTabUi` 并配置四个视图项。
- [x] 2.2 使用 `v-model=viewMode` 替换原内联按钮逻辑。
- [x] 2.3 清理 `StationDashboard` 中冗余切换按钮样式定义。

## 3. 构建验证

- [x] 3.1 执行 `npm run build`，确认改造后可正常编译。
