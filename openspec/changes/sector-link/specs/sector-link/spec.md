# Sector Link Specification

## Purpose
为星区列表提供可操作的双向连接能力，支持通过拖拽建立星区间连接，并确保任一端删除都能一致移除整条连接。

## ADDED Requirements

### Requirement: Sector Link Entry and Target Zone
系统 MUST 在星区列表项中提供连接入口与可投放目标区。

#### Scenario: 显示连接入口与链接区
- **前提** 用户位于星区显示列表面板
- **当** 星区项渲染
- **那么** 每个星区项 SHALL 显示连接图标
- **并且** 每个星区项 SHALL 显示可投放的链接区

### Requirement: Create Bidirectional Link by Drag-and-Drop
系统 MUST 支持从源星区连接图标拖拽到目标星区链接区后创建双向连接。

#### Scenario: 拖拽建链成功
- **前提** 源星区 A 与目标星区 B 均存在且 A != B
- **当** 用户从 A 的连接图标拖拽并投放到 B 的链接区
- **那么** 系统 SHALL 创建 A-B 连接
- **并且** A 与 B 两侧均 SHALL 显示对方为已连接

### Requirement: Many-to-Many Sector Linking
系统 MUST 支持星区连接关系为多对多。

#### Scenario: 单星区连接多个目标
- **前提** 星区 A 已连接星区 B
- **当** 用户将 A 再连接到星区 C
- **那么** 系统 SHALL 保留 A-B
- **并且** 系统 SHALL 同时存在 A-C

### Requirement: Prevent Self-Link and Duplicate Link
系统 MUST 阻止自连接与重复连接写入。

#### Scenario: 阻止自连接
- **前提** 拖拽源星区与目标星区相同
- **当** 用户尝试投放
- **那么** 系统 SHALL 拒绝创建连接

#### Scenario: 阻止重复连接
- **前提** A-B 连接已存在
- **当** 用户再次尝试创建 A-B
- **那么** 系统 SHALL 不新增重复记录

### Requirement: Delete Link from Either Endpoint
系统 MUST 支持从任一端删除同一条连接，并保证双端同步。

#### Scenario: 从任一端删除连接
- **前提** A-B 连接已存在且在 A/B 两侧可见
- **当** 用户在 A 或 B 任一侧点击该连接删除按钮
- **那么** 系统 SHALL 删除 A-B 连接
- **并且** A 与 B 两侧对应连接项 SHALL 同步消失

### Requirement: Persist and Restore Sector Links
系统 MUST 持久化连接关系并在重载后恢复。

#### Scenario: 刷新后恢复连接
- **前提** 已存在 A-B 与 A-C 连接
- **当** 用户刷新页面或重载应用
- **那么** 系统 SHALL 正确恢复连接数据
- **并且** 列表渲染 SHALL 与保存前一致
