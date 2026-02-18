# Station Tabs Module Specification

## Purpose
描述标签栏模块的组件结构和交互能力，包括标签切换、右键菜单功能。

## Current Implementation

当前实现为单一组件 `StationTabBar.vue`，包含所有标签栏功能。

**文件位置**: `src/components/StationTabBar.vue`

## Future Module Structure (规划中)

```
StationTabBar/
├── StationTabBar.vue          # 主组件 - 标签栏容器
├── StationTab.vue             # 单标签组件
├── StationContextMenu.vue     # 右键菜单组件
└── types.ts                   # 类型定义
```

## Components

### StationTabBar.vue (当前实现)

**职责**: 标签栏容器，管理标签列表、选中状态和右键菜单

**内部状态**:
- `showMenu: boolean` - 右键菜单显示状态
- `menuStationId: string | null` - 右键菜单目标分站 ID
- `showDeleteConfirm: boolean` - 删除确认对话框状态
- `stationToDelete: string | null` - 待删除的分站 ID

**Store 依赖**:
- `useEmpireStore` - 获取分站列表、选中状态、执行 CRUD 操作

### StationTab.vue (规划中)

**职责**: 渲染单个标签，处理点击和右键事件

**Props**:
- `id: string | null` - 分站 ID（null 表示帝国总览）
- `name: string` - 标签名称
- `type: StationType | 'overview'` - 分站类型
- `active: boolean` - 是否选中

**Emits**:
- `click()` - 点击标签
- `contextmenu(event: MouseEvent)` - 右键点击

### StationContextMenu.vue (规划中)

**职责**: 显示分站操作菜单

**Props**:
- `stationId: string` - 目标分站 ID
- `position: { x: number, y: number }` - 菜单位置

**Emits**:
- `rename(stationId: string)` - 重命名
- `duplicate(stationId: string)` - 复制
- `delete(stationId: string)` - 删除
- `close()` - 关闭菜单

## Requirements

### Requirement: 标签栏布局 (Tab Bar Layout)
标签栏 SHALL 采用水平布局，从左到右排列：
- **固定标签**: 第一个标签永远是"帝国总览"
- **动态标签**: 后续跟随用户创建的各个分站
- **[+] 按钮**: 新建工业站

#### Scenario: 标签栏初始状态
- **前提** 帝国中无分站
- **当** 用户查看标签栏时
- **那么** 标签栏 SHALL 仅显示"帝国总览"标签和 [+] 按钮

### Requirement: 帝国总览标签 (Empire Overview Tab)
帝国总览标签 SHALL 作为固定标签：
- 始终显示在标签栏第一位
- 点击后 activeStationId 设为 null
- 显示帝国总览视图

#### Scenario: 切换到帝国总览
- **前提** 用户正在查看某个分站
- **当** 用户点击"帝国总览"标签
- **那么** activeStationId SHALL 设为 null
- **并且** 内容区域 SHALL 显示帝国总览视图

### Requirement: 分站标签 (Station Tabs)
每个分站 SHALL 对应一个动态标签：
- 显示分站名称和类型图标
- 选中状态有明显的背景色区分
- 支持右键菜单操作

#### Scenario: 分站标签显示
- **前提** 帝国中存在分站
- **当** 用户查看标签栏时
- **那么** 每个分站 SHALL 显示为一个标签
- **并且** 标签 SHALL 显示分站名称和类型图标（如 🏭 工业、📦 补给）

#### Scenario: 切换分站
- **前提** 用户正在查看帝国总览或其他分站
- **当** 用户点击某个分站标签
- **那么** activeStationId SHALL 设为该分站 ID
- **并且** 内容区域 SHALL 显示该分站的三列布局视图

### Requirement: 新建分站按钮 (Add Station Button)
[+] 按钮 SHALL 用于新建工业站：
- 点击后创建新的工业站
- 新分站自动激活

#### Scenario: 新建工业站
- **前提** 用户点击 [+] 按钮
- **当** 系统创建新分站时
- **那么** 新分站 type SHALL 为 'industrial'
- **并且** 新分站 SHALL 自动激活
- **并且** 标签栏 SHALL 显示新分站标签

### Requirement: 分站菜单 (Station Menu)
StationContextMenu 组件 SHALL 提供以下菜单项：
- **重命名**: 编辑分站名称
- **复制分站**: 创建分站副本
- **导入蓝图**: 导入模块配置
- **删除分站**: 删除该分站（最后一项）

#### Scenario: 删除分站确认
- **前提** 用户在分站菜单中点击删除
- **当** 系统执行删除操作时
- **那么** 系统 SHALL 显示确认对话框
- **并且** 确认后才执行删除

#### Scenario: 删除当前激活分站
- **前提** 用户删除当前激活的分站
- **当** 删除完成后
- **那么** activeStationId SHALL 切换到 null
- **并且** 视图 SHALL 切换到帝国总览

### Requirement: 标签选中状态 (Tab Selected State)
选中的标签 SHALL 有明显的视觉区分：
- 选中标签使用亮色背景
- 未选中标签使用暗色背景
- 悬停时有过渡动画

#### Scenario: 标签选中视觉反馈
- **前提** 用户切换标签
- **当** 新标签被选中时
- **那么** 新标签 SHALL 显示亮色背景
- **并且** 之前选中的标签 SHALL 显示暗色背景
