# Empire Sidebar Behavior

## 导航

- `guide.empire.sidebar.overview`
  - `action`: 点击 `sidebar-overview`。
  - `expected`: 进入帝国概览，`activeStationId` 为 `null`。
- `guide.empire.sidebar.station`
  - `action`: 点击带目标 `data-station-id` 的 `sidebar-station`。
  - `expected`: 进入对应 station，选中 ID 保持为该实体 ID。
- `guide.empire.sidebar.add-station`
  - `action`: 点击 `sidebar-add-station`。
  - `expected`: 创建站点并切换到新站点上下文。
- `guide.empire.sidebar.reorder-blueprint`
  - `action`: 在 blueprint 的 `sidebar-station-list` 内拖拽站点。
  - `expected`: 站点数组按新顺序更新，active station ID 不变；不完整、重复或未知 ID 的排列被拒绝。
- `guide.empire.sidebar.collapse`
  - `action`: 点击 `sidebar-toggle`。
  - `expected`: Sidebar 展开/折叠，仅改变表现，不改变导航状态。

## 星区与固定入口

- `guide.empire.sidebar.sector-toggle`
  - `action`: 点击带相同 `data-sector-id` 的 `sidebar-sector-toggle`。
  - `expected`: 仅切换该星区展开/折叠。
- `guide.empire.sidebar.transit`
  - `action`: 点击星区内 Transit 入口。
  - `expected`: 进入该星区 Transit；现有 live 模式语义保持不变。
- `guide.empire.sidebar.fixed-entry`
  - `action`: 点击固定入口的 `sidebar-*` test-id。
  - `expected`: 按当前 workbench 能力切换 overview、terraforming、research、NPC trade、blueprint recipe 或其他既有模式。

## 菜单

- `guide.empire.sidebar.menu`
  - `action`: 对 `sidebar-station` 触发右键。
  - `expected`: 显示 `sidebar-context-menu`，提供 binding 跳转、重命名、复制及允许时的删除。
- `guide.empire.sidebar.delete`
  - `action`: 点击 `sidebar-menu-delete`，再点击 `sidebar-delete-confirm`。
  - `expected`: 先显示确认框，确认后删除目标站点；取消使用 `sidebar-delete-cancel`。

## Station 模块输入

- `guide.empire.station.module-input-visible`
  - `action`: 进入任一 station（非概览）。
  - `expected`: 可见 `station-module-search-input`，用于搜索并添加模块。
- `guide.empire.station.module-candidate-popover-visible`
  - `action`: 聚焦 `station-module-search-input`。
  - `expected`: 显示 `station-module-candidate-popover`；输入为空时显示默认候选，输入关键字时按结果刷新。
- `guide.empire.station.module-search-linkage`
  - `action`: 修改 `station-module-search-input` 的关键字。
  - `expected`: 候选项 `station-module-candidate-<moduleId>` 随筛选结果更新，无命中时无候选项。
- `guide.empire.station.module-candidate-popover-hide`
  - `action`: 输入框失焦且焦点不在候选框内，或按 `Esc`。
  - `expected`: `station-module-candidate-popover` 不可见。

旧 TabBar 的 DOM class 只作为迁移背景，不是当前行为断言。
