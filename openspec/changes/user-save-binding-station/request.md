# user-save-binding-station Request

## 背景

`stand-alone-binding` 已完成 save binding 的基础架构，包括数据存储、binding 管理、地图 POI 投影。现在需要完善量化生产界面中用户与 save binding station 的交互体验。

## 核心需求

### 1. 空间站编辑体验

用户在 `save-binding` production source 下编辑空间站时：

- 编辑 `modules` 更新到 `BindingStationPlan`，不自动保存
- 编辑 `settings`（阳光、种族偏好等）更新到 `BindingStationPlan`
- 删除空间站时，若有 `BindingStationPlan` 则删除 plan，若无 plan 则保持 covered save station（仅取消选中）
- 重命名空间站更新 `BindingStationPlan.name`

### 2. 空间站创建体验

用户在 binding 模式下创建空间站：

- 创建虚拟空间站（无 `saveStationCode`），分配到指定 group
- 从蓝图 empire 导入 modules 到现有 save station plan
- 创建 transit hub（星区中转站）

### 3. Dirty 状态与保存

binding 使用显式保存模式：

- 编辑操作更新 draft，设置 `isDirty = true`
- 用户点击"保存绑定"才持久化到 `x4_save_bindings`
- 切换 empire/source、关闭 binding 需要确认保存/放弃

### 4. UI 适配

- `StationPlanningPanel` 在 binding 模式下需显示"保存绑定"按钮
- `StationTabBar` 在 binding 模式下显示 binding groups 作为星区
- `StationDashboard` 显示正确的 dirty 状态
- 总览界面切换数据源按钮正确工作

## 验收标准

1. 用户进入 binding 后，空间站列表正确显示（covered save stations + virtual stations）
2. 编辑空间站后，binding 显示 dirty 状态
3. 点击"保存绑定"后，数据持久化，dirty 状态清除
4. 切换回 empire 时，binding 保持 draft 状态（不丢失）
5. 再次进入同一 binding 时，恢复上次编辑状态