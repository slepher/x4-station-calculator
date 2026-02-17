## Why

逻辑组网功能目前仅支持单一工作区，无法保存多个方案。用户在规划复杂产业链时，需要能够保存、加载、切换不同的逻辑组网方案，与空间站设计方案的管理体验保持一致。同时，切换到逻辑组网视图时，标题栏应采用紫色系主题，以视觉上区分两种工作模式。

## What Changes

- 为逻辑组网添加完整的方案管理系统（新建、保存、另存为、加载、删除）
- 标题栏根据当前视图动态切换主题色（生产视图：蓝色系，逻辑组网视图：紫色系）
- 标题栏功能按钮根据当前视图调用对应的 Store 方法
- 新建独立的逻辑组网方案加载对话框
- 复用 SmartSaveDialog 组件，通过 props 区分 Store 类型
- 方案数据仅保存 manual 和 isolated 节点，auto 节点在载入时自动重建
- 新增逻辑组网设置存储（候选区锁定按钮状态）

## Capabilities

### New Capabilities

- `logic-flow-plans`: 逻辑组网方案管理功能，包括方案的创建、保存、加载、删除，以及方案数据的持久化与重建

### Modified Capabilities

- `title-as-plan-title`: 标题栏功能扩展，支持根据视图类型动态切换主题色和功能行为

## Impact

### 数据结构变更
- `src/types/x4.ts`: 新增 `LogicFlowPlan`, `SavedFlowGroup`, `SavedFlowNode`, `SavedFlowPlansState`, `LogicFlowSettings` 类型

### Store 变更
- `src/store/useLogicFlowStore.ts`: 新增方案管理状态和方法

### 组件变更
- `src/components/StationToolbar.vue`: 主题色动态切换 + 功能按钮行为切换
- `src/components/SmartSaveDialog.vue`: 新增 `storeType` prop
- `src/components/LoadFlowPlanModal.vue`: 新建组件

### 持久化变更
- 新增 `x4_logic_flow_plans` localStorage key
- 新增 `x4_logic_flow_settings` localStorage key

### i18n 变更
- 新增逻辑组网方案相关的翻译键
