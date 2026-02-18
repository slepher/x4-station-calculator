## Why

当前应用仅支持单个空间站的规划，用户无法同时管理多个空间站组成的帝国网络。实际游戏场景中，玩家通常需要规划多个协同工作的空间站（如能源站、食品厂、船厂等），这些空间站之间存在资源流动和工人供给关系。需要将界面从"单空间站模式"扩展为"多空间站 Tab页模式"。

## What Changes

- **BREAKING**: 数据模型从 V1 迁移到 V2，localStorage 存储结构变更
- 新增 `EmpirePlan` 数据结构，包含多个 `StationPlan`
- 新增标签栏组件，支持在"帝国总览"和各分站之间切换
- 新增动态工具栏，根据当前选中的 Tab 显示不同内容
- 新增分站类型：工业站、补给站、中转站、船厂
- 补给站根据帝国所有工业站的工人需求总和生成补给模块
- 站内补给开关控制 `calculateAutoFill` 是否生成补给区
- V1 用户数据自动迁移到 V2，保持向后兼容

## Capabilities

### New Capabilities

- `empire-management`: 帝国管理能力，包括多站数据结构、V1→V2 数据迁移、分站 CRUD 操作
- `station-tabs`: 标签栏切换能力，固定"帝国总览"标签 + 动态分站标签 + 新建/删除分站
- `context-toolbar`: 动态工具栏能力，根据选中 Tab 显示不同控件组

### Modified Capabilities

- `station-workbench`: 修改为支持多站视图切换，内容区域根据选中 Tab 显示总览或分站三列布局

## Impact

- **Store**: 新增 `useEmpireStore.ts`，重构 `useStationStore.ts` 数据绑定逻辑
- **Components**: `StationWorkbench.vue` 架构调整，新增 `StationTabBar.vue`、`ContextToolbar.vue`
- **Types**: `src/types/x4.ts` 新增 `EmpirePlan`、`StationType` 等类型定义
- **localStorage**: 存储键从 `x4_station_data` 变更为 `x4_empire_data`，需迁移逻辑
- **i18n**: 新增多站相关翻译键
