# auto-sector-group-one-map Design

## 总览

Map change 负责把共享 draft 呈现在地图侧栏，并把 hub color 转化为地图 overlay。它不创建 draft，不运行分组初始化，不实现核心算法。

## Map 面板结构

Map binding-sector 渲染 `AutoSectorGroupPanel layout="tabs"`。

视图：

- 顶部：三视图共用 `AutoSectorBar`，承载返回、地图、参数、计算、重置、提交和全局 gate。
- Hub：group 管理、参数、编辑、drag sort。
- Allocation：assignment cards。
- Trade Station：trade station cards。
- 添加 hub：Map 和 Live 共用 `HubAddMenu`。Map 使用默认/侧栏入口并提供定位地图能力；Live 使用 `HubAddMenu mode="overlay"` fixed overlay。

编辑态限制：

- Hub 编辑态下 Allocation 和 Trade Station disabled。
- 计算完成后可根据 unresolved 状态切换到第一个待处理 tab。

确认态：

- 隐藏 draft tabs。
- 每个 group 显示进入 station binding 的按钮。
- 确认 auto group 不自动进入 station binding。

## 事件流

```text
SectorGroupList / SectorAllocationList
  emit focus-sector
AutoSectorGroupPanel
  relay focus-sector
MapSavePanel
  relay focus-sector / fit-sectors
MapWorkbenchView
  center map viewport
```

Live view 不 emit focus-sector，避免 Live UI 引入地图耦合。

## Drag sort

Map Hub tab 使用 groups 数组顺序作为排序权威：

- 拖拽只重排数组。
- 不修改 coverage。
- 不修改 connectedGroupIds。
- 不修改 jumpRange。
- 不触发 calculation。
- Confirm 按数组顺序写入。

## Color 分配

颜色候选：

- UI palette：30 色。
- Auto palette：27 彩色候选，不含 transparent。

分配流程：

1. 固定已有且仍有效的颜色。
2. 对缺色、新增或冲突 hub 分配颜色。
3. Stage 1 避开自身 anchor/coverage faction 色。
4. Stage 2 避开 5 跳内 hub color 和 5 跳内 hub faction 色。
5. 逐步放宽 ΔE 阈值。
6. 多候选时使用 maximin 选择最优。
7. 无可解析候选时才使用 fallback。

交互后局部稳定：

- 计算后到提交前，新增一个 hub 只为该 hub 分配颜色。
- 调整一个 hub coverage 时，只判断该 hub 是否需要重分配。
- 单次操作不得自动改变超过一个 hub 的颜色。

## Color UI

Group card 标题显示 16×16 色块：

- 有颜色：填充该色。
- 无颜色：透明虚线边框。
- 编辑态点击打开 SketchPicker。
- 预设色点击后更新 draft 并关闭。
- 透明色点击后清空 `group.color`。
- 非编辑态色块不可点击。

## Map overlay

`sectorGroupColorMap` 来源：

- Binding 模式：`liveStore.autoGroupResult.groups`。
- 非 binding 模式：`saveBindingStore.activeBinding.groups`。

渲染层级：

1. faction owner 色。
2. hub 内部六边形。
3. resource pie。

每个 sector 至多映射一个 hub color；coverage 互斥由核心分组保证。
