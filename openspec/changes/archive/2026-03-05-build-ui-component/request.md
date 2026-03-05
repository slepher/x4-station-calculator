# 需求说明：build-ui-component

## 目标
将 `StationDashboard` 中用于切换视图的 `view-tab-ui` 逻辑抽取为可复用组件，减少页面内重复模板与样式。
新组件需支持通过 `views`、`colorStyle` 配置展示，并通过 `v-model` 绑定当前视图值。

## 已确认方案（审核重点）
1. **组件抽取目标**
   - 从 `src/components/StationDashboard.vue` 头部的视图切换按钮组中抽取通用组件。
   - 组件负责渲染 tab 列表、激活态样式与禁用态交互。
2. **组件接口**
   - 输入 `views`：数组项至少包含 `key` 与 `label`，可选 `disabled`。
   - 输入 `colorStyle`：控制激活态视觉风格（先支持字符串主题，预留扩展）。
   - 双向绑定：使用 `v-model`（`modelValue` + `update:modelValue`）管理当前选中 view。
3. **StationDashboard 接入方式**
   - 以 `views` 配置替代硬编码四个按钮（materials/volume/time/workers）。
   - 现有 `viewMode` 保持不变，仅替换 UI 触发层。
4. **兼容性与行为约束**
   - 视图切换后的标题、列表、footer 条件渲染行为必须与改造前一致。
   - 不改变现有文案来源（继续由父组件通过 `t(...)` 传入 label）。
5. **样式与测试定位**
   - 将按钮组公共样式迁移到新组件，避免 dashboard 内重复定义。
   - 组件提供稳定 `data-testid`（容器 + 按钮）便于后续复用回归。

## 边界
### In Scope
- 新增通用视图切换组件并在 `StationDashboard` 中替换原切换区。
- 组件支持 `views`、`colorStyle`、`v-model` 三项核心能力。
- 同步更新对应 OpenSpec 文档与测试任务描述。

### Out of Scope
- 本次不强制改造 `StationWareFlowsDashboard`、`EmpireWareFlowsDashboard`（可后续复用）。
- 不调整站点分析业务计算逻辑，仅调整切换 UI 组织方式。
- 不引入新的全局主题系统。

## 验收标准（DoD）
1. `StationDashboard` 视图切换按钮已由独立组件渲染。
2. 组件通过 `v-model` 正确更新并回传当前 view。
3. 组件支持通过 `views` 动态渲染按钮文本与顺序。
4. `colorStyle` 可影响激活态样式，且默认行为与现有视觉一致。
5. 原有四个视图（cost/volume/time/workers）切换行为无回归。
6. 组件与按钮具备稳定 `data-testid`，可用于单测/E2E。

## 未决项
无。
