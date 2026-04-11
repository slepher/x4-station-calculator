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

---

## 新增需求：Tabbar 折叠展开逻辑

### 背景

当前 StationTabBar 将所有星区的站点平铺展示，用户在多星区场景下难以快速定位目标站点。

### 需求描述

调整星区中转站和星区站点 tab 的显示逻辑：

1. **展开规则**：同一时间仅展开一个星区
2. **展开状态显示**：展开星区时，中转站在前，站点在后
3. **未展开状态显示**：未展开星区仅显示中转站 tab
4. **无星区站点**：平铺排列在最前（不参与折叠逻辑）
5. **点击中转站**：展开对应星区，同时打开中转站视图
6. **点击已展开星区的中转站**：保持展开状态，打开中转站视图
7. **默认展开**：展开 activeTab 所在的星区
8. **activeTab 是站点**：展开该站点所在的星区

### 当前 vs 目标对比

| 项目 | 当前 | 目标 |
|------|------|------|
| 无星区站点 | 平铺在最前 | 保持不变 |
| 星区站点 | 全部平铺展示 | 未展开时隐藏，展开后显示 |
| 中转站位置 | 站点之后 | 中转站在前，站点在后 |
| 展开状态 | 无此概念 | 同时仅展开一个星区 |
| 点击中转站 | 打开中转站视图 | 既展开星区，也打开中转站视图 |
| 默认展开 | 无 | activeTab 所在星区 |

### 验收标准

1. 默认展开 activeStationId 或 activeTransitSectorId 所在的星区
2. 点击未展开星区的中转站，展开该星区（收起其他），并打开中转站视图
3. 点击已展开星区的中转站，保持展开，打开中转站视图
4. 点击站点 tab，自动展开其所在星区（收起其他）
5. 无星区站点始终平铺显示，不受折叠逻辑影响