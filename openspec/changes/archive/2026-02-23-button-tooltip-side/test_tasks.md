# Test Tasks: button-tooltip-side

## 1. Unit Tests（Vitest）

- 无（本变更仅涉及 UI tooltip placement，暂无可单元化逻辑）。

## 2. Web Integration / E2E - Bootstrapping & State

说明：本章覆盖启动、数据预置、初始状态和状态切换；业务行为放在第 3 章。

- [x] 2.0 测试启动与页面可达性
  - [x] 步骤 1：启动应用并等待页面初始化完成。
  - [x] 步骤 2：进入任意空间站页面，确保渲染 StationWareFlow。
  - [x] 步骤 3：确认右侧 `flow-action-rail` 内可见收藏按钮与锁定按钮。

## 3. Web Integration / E2E - Scenario Content

说明：本章覆盖业务流程与用户可观察结果，不包含定位器/API/自动化实现细节。

- [x] 3.1 收藏按钮 tooltip 向左弹出
  - [x] 步骤 1：在 StationWareFlow 中将鼠标悬停在收藏按钮上。
  - [x] 步骤 2：断言 tooltip 出现且弹出方向为左侧（placement=left）。
  - [x] 步骤 3：断言 tooltip 内容与样式与变更前一致。

- [x] 3.2 锁定按钮 tooltip 向右弹出
  - [x] 步骤 1：在 StationWareFlow 中将鼠标悬停在锁定按钮上。
  - [x] 步骤 2：断言 tooltip 出现且弹出方向为右侧（placement=right）。
  - [x] 步骤 3：断言 tooltip 内容与样式与变更前一致。

- [x] 3.3 按钮交互回归
  - [x] 步骤 1：点击收藏按钮切换优先级状态，确认状态变化正常。
  - [x] 步骤 2：点击锁定按钮切换锁定状态，确认状态变化正常。
  - [x] 步骤 3：若存在不可操作状态，确认按钮禁用表现与原有一致。
