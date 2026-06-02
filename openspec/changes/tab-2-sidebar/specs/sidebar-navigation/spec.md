# sidebar-navigation Specification

## Purpose

将 blueprint-production 和 live-production 中的水平滚动 tab bar（`StationTabBar.vue` / `SectorStationTabBar.vue`）统一替换为左侧可折叠 sidebar 树形导航，提供垂直导航体验并为功能入口扩展（地球化、科技树等）留出空间。

## ADDED Requirements

### Requirement: Sidebar 导航组件

系统 SHALL 提供一个共享的 sidebar 导航组件 `LiveProductionSidebar.vue`，以垂直树形结构展示所有导航入口项。

#### Scenario: Blueprint 模式展示平铺 station 列表

**前提** 用户处于 blueprint-production 视图
**当** sidebar 渲染时
**那么** sidebar 固定区显示概览 tab
**并且** sidebar 动态区以平铺列表展示所有 station tab（无星区分组）
**并且** sidebar 不显示地球化、科技树、Transit tab

#### Scenario: Live 模式展示完整树形导航

**前提** 用户处于 live-production 视图
**当** sidebar 渲染时
**那么** sidebar 固定区依次显示概览、地球化、科技树 tab
**并且** sidebar 动态区按星区分组展示（Transit → Station 树形结构）
**并且** 星区组可展开/折叠

#### Scenario: 选中态高亮

**前提** 用户在 sidebar 中点击任意 tab
**当** 点击事件触发
**那么** 该 tab 在 sidebar 中显示为选中态（高亮）
**并且** 之前的选中 tab 取消高亮

### Requirement: Sidebar 折叠/展开

系统 SHALL 支持 sidebar 折叠与展开，折叠按钮置于 sidebar 顶部。

#### Scenario: 收起 sidebar

**前提** Sidebar 当前为展开状态
**当** 用户点击 sidebar 顶部的折叠按钮
**那么** sidebar 缩小为一条竖线/handle 区域（宽度约 4-8px）
**并且** 右侧内容区自动扩展为全宽
**并且** 折叠按钮 icon 变更为展开方向指示

#### Scenario: 展开 sidebar

**前提** Sidebar 当前为折叠状态
**当** 用户点击竖线/handle 区域或展开按钮
**那么** sidebar 恢复为完整宽度（约 240px）
**并且** 右侧内容区缩回以适应 sidebar

#### Scenario: 默认展开

**前提** 用户首次进入 blueprint-production 或 live-production 视图
**当** 视图挂载时
**那么** sidebar 默认为展开状态

### Requirement: Sidebar 星区展开/折叠

星区展开/折叠为纯前端行为，由 sidebar 内部 `collapsedSectors` Set 控制，不依赖 store。

**核心规则**：只展开不收起。选中站或 transit 时自动展开对应星区，永不自动折叠。箭头是唯一收起入口。

#### Scenario: 默认初始化

**前提** 用户进入 live-production 视图
**当** sidebar 挂载时
**那么** `collapsedSectors` 初始包含所有星区 ID（全部折叠）
**并且** watcher (`immediate: false`) 检测 `activeTabId` 变化时展开对应星区
**并且** 同时监听 `tabs.length` 变化以处理 stores 延迟加载

#### Scenario: 站 ID 匹配

**前提** `activeTabId` 可能是站名（V1 数据）或 UUID
**当** 查找 tab 匹配时
**那么** 使用 `findTabById` 同时匹配 `tab.id` 和 `tab.name`
**并且** 遍历所有 tabs 查找对应的 `sectorId`

#### Scenario: 选中站/transit 自动展开

**前提** 用户选中某空间站或 transit-hub
**当** `activeTabId` 变化时
**那么** watcher 从 `collapsedSectors` 移除该站对应的 `sectorId`
**并且** 该星区 header 高亮（`isSectorActive` 匹配 transit 或站所属星区）

#### Scenario: 切换总览/地球化/科技树

**前提** 用户点击固定项（概览、地球化、科技树）
**当** `activeTabId` 变化且无 `sectorId`
**那么** `collapsedSectors` 保持不变

#### Scenario: 箭头点击

**前提** 某星区当前为展开/折叠状态
**当** 用户点击箭头按钮（24x24 独立点击区域，`@click.stop`）
**那么** `toggleSectorCollapse` 切换该星区在 `collapsedSectors` 中的状态

#### Scenario: 点击区域分离

**前提** 星区 header 或 station 行渲染
**当** 用户交互时
**那么** 箭头区域仅触发展开/折叠
**并且** 图标+名称区域触发选中
**并且** 整行可右键打开上下文菜单

### Requirement: 科技树 workbenchMode 空壳

系统 SHALL 在 `workbenchMode` 中新增 `'tech-tree'` 模式，并为其提供占位渲染。

#### Scenario: Live 模式点击科技树 tab

**前提** 用户处于 live-production 视图且 sidebar 展开
**当** 用户点击 sidebar 中的科技树 tab
**那么** workbenchMode 切换为 `'tech-tree'`
**并且** 内容区渲染占位组件（显示"科技树 开发中"或等效文本）
**并且** activeStationId 被清空

#### Scenario: Blueprint 模式不展示科技树

**前提** 用户处于 blueprint-production 视图
**当** sidebar 渲染时
**那么** 固定区仅显示概览 tab
**并且** 不包含科技树 tab

## MODIFIED Requirements

### Requirement: BlueprintProductionWorkbenchView 使用 sidebar

`BlueprintProductionWorkbenchView` SHALL 使用 sidebar 替代 `StationTabBar` 进行 station 导航。

#### Scenario: Sidebar 替换 tab bar

**前提** 页面加载 blueprint-production 视图
**当** 组件渲染时
**那么** 页面左侧显示 sidebar 而非水平 tab bar
**并且** blueprint overview 和 station 内容区渲染逻辑保持不变
**并且** 点击 sidebar 中的 station tab 行为与点击旧 tab bar 一致

#### Scenario: Context toolbar 不受 sidebar 状态影响

**前提** Blueprint production 视图已加载
**当** sidebar 展开或折叠时
**那么** context toolbar 的内容和功能不受影响
**并且** toolbar 在 sidebar 右侧占据全宽（始终位于内容区上方）

### Requirement: LiveProductionWorkbenchView 使用 sidebar

`LiveProductionWorkbenchView` SHALL 使用 sidebar 替代 `SectorStationTabBar` 进行所有模式导航。

#### Scenario: Terraforming 入口迁移至 sidebar

**前提** 用户处于 live-production 视图
**当** 用户点击 sidebar 固定区中的地球化 tab
**那么** workbenchMode 切换为 `'terraforming'`
**并且** 内容区渲染 terraforming 三栏布局（TerraformingSectorPanel + TerraformingTaskList + TerraformingResourcePanel）
**并且** TerraformingToolbar 正常显示

#### Scenario: 概览入口迁移至 sidebar

**前提** 用户处于 live-production 视图
**当** 用户点击 sidebar 固定区中的概览 tab
**那么** workbenchMode 切换为 `'overview'`
**并且** 内容区渲染 SaveUploadPanel + SaveList + EmpireWareFlowsDashboard

#### Scenario: Transit 入口迁移至 sidebar

**前提** 用户处于 live-production 视图且存在星区
**当** 用户点击某星区下的 Transit tab
**那么** workbenchMode 切换为 `'transit'`
**并且** 内容区渲染 TransitHubBuildPanel + TransitHubCenterDashboard

### Requirement: Station tab 右键菜单保留

Station tab 的右键菜单功能 SHALL 在 sidebar 中保留。

#### Scenario: 右键重命名 station

**前提** 用户在 sidebar 中对某个 station tab 右键
**当** 右键菜单弹出且选择重命名
**那么** 显示重命名输入框或弹窗
**并且** 重命名后 sidebar 中 station tab 名称更新

#### Scenario: 右键删除 station（live）

**前提** 用户在 live-production 视图的 sidebar 中对某个 station tab 右键
**当** 右键菜单弹出且选择删除
**那么** 显示删除确认弹窗
**并且** 确认后 station 被移除且 sidebar 刷新

#### Scenario: 右键复制/删除 station（blueprint）

**前提** 用户在 blueprint-production 视图的 sidebar 中对某个 station tab 右键
**当** 右键菜单弹出
**那么** 菜单包含复制和删除选项（与旧 StationTabBar 一致）

## REMOVED Requirements

### Requirement: StationTabBar.vue 移除

**Justification**: 被 `LiveProductionSidebar.vue` 替代。

- FROM: `src/components/empire/StationTabBar.vue` 在 `BlueprintProductionWorkbenchView.vue` 中使用
- 移除后，blueprint 视图通过 sidebar 组件实现 station 导航

### Requirement: SectorStationTabBar.vue 移除

**Justification**: 被 `LiveProductionSidebar.vue` 替代。

- FROM: `src/components/empire/SectorStationTabBar.vue` 在 `LiveProductionWorkbenchView.vue` 中使用
- 移除后，live 视图通过 sidebar 组件实现所有模式导航（包括 overview、terraforming、transit、station）
