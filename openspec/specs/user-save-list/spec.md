# user-save-list Specification

## Purpose
TBD - created by archiving change user-save-list. Update Purpose after archive.
## Requirements
### Requirement: Save Panel Homepage

系统 MUST 在打开 `savePanel` 时默认停留在存档首页，而不是自动跳转到子页面。

#### Scenario: 用户打开 savePanel

- **前提** 用户位于地图工作台
- **当** 用户打开 `savePanel`
- **那么** 系统 SHALL 显示存档首页
- **并且** SHALL NOT 自动跳转到 POI 分类页

### Requirement: Guid Group Container Interaction

系统 MUST 允许用户点击 guid 外容器来触发 guid 级 active。

#### Scenario: 点击 guid 外容器

- **前提** 存档首页中存在某个 guid 分组
- **当** 用户点击该 guid 外容器或标题
- **那么** 系统 SHALL 将该 guid 设为 guid 级 active
- **并且** SHALL NOT 直接进入 POI 列表

### Requirement: Homepage Active Projection

系统 MUST 按 `activeArchiveId` 的粒度投影首页高亮。

#### Scenario: activeArchiveId 为 guid

- **前提** `activeArchiveId = guid`
- **当** 首页渲染该分组
- **那么** 标题外容器 SHALL 高亮
- **并且** 最新 time 条目 SHALL 显示镜像高亮

#### Scenario: activeArchiveId 为 guid+time

- **前提** `activeArchiveId = guid_time`
- **当** 首页渲染该分组
- **那么** 仅对应 time 条目 SHALL 高亮

### Requirement: Root Breadcrumb Navigation Only

系统 MUST 让 root 面包屑仅承担导航职责。

#### Scenario: 点击 root 面包屑

- **前提** 用户当前位于 savePanel 的子页面
- **当** 用户点击 root 面包屑
- **那么** 系统 SHALL 返回存档首页
- **并且** SHALL NOT 恢复或重写当前 archive active

