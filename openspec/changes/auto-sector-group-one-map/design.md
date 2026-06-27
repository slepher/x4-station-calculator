# auto-sector-group-one-map Design

## 总览

Map change 负责把共享 draft 呈现在地图侧栏，并把 hub color 转化为地图 overlay。它不创建 draft，不运行分组初始化，不实现核心算法。

## Map 面板结构

Map binding-sector 渲染 `AutoSectorGroupPanel layout="tabs"`。

视图：

- 顶部：各 tab 共用 `AutoSectorBar`，承载返回、地图、参数、计算、重置、提交和全局 gate。
- Hub：group 管理、参数、编辑、drag sort。
- Allocation：assignment cards。
- Trade Station：trade station cards。
- Virtual Station：Map-only，展示 blueprint 来源和 virtual station drafts。
- 添加 hub：Map 和 Live 共用 `HubAddMenu`。Map 使用默认/侧栏入口并提供定位地图能力；Live 使用 `HubAddMenu mode="overlay"` fixed overlay。

- Virtual Station 不受 Hub edit/result 限制；Map binding 界面打开后，virtual station draft 的创建、移动、删除都可继续进行。
- 计算完成后可根据 unresolved 状态切换到第一个待处理 tab。

确认态：

- 隐藏 draft tabs。
- 每个 group 显示进入 station binding 的按钮。
- 确认 auto group 不自动进入 station binding。

## Virtual Station tab

Virtual Station tab 只存在于 `AutoSectorGroupPanel layout="tabs"` 的 Map context。`layout="columns"` 的 Live context 不渲染该 tab。

Tab 内容分两段：

```text
Blueprint 空间站
  - Blueprint empire selector
  - 空白空间站
  - blueprint station list

虚拟空间站
  - 按当前 groups 分组
  - 未分组/提交时移除区域
```

Blueprint empire selector 复用 binding 的 `blueprintEmpireId`。切换来源只影响可拖拽来源列表；已创建 virtual station 是一次性复制结果，不随 blueprint empire 后续变化同步。

Blueprint station drag payload：

```ts
{
  kind: 'blueprintStation'
  source: StationPlan
}
```

drop 到有效 sector 时创建 virtual station draft，复制：

- `name`
- `type`
- `modules`
- `settings`
- `lockedWares`
- `warePriority`

不得复制 source station 的 `id`、`sectorId` 或持续同步引用。

空白空间站 drop 后创建 `type='industrial'`、`modules=[]`、默认 settings、空 `lockedWares`、空 `warePriority` 的 draft。

已存在 virtual station drag payload：

```ts
{
  kind: 'virtualStationDraft'
  draftId: string
}
```

drop 后只更新该 draft 的 `sectorMacro`、`position` 和 `groupId`，不得走 blueprint source 新建路径。

Virtual station 列表按当前 groups 顺序分组。每个 item 显示 station 名称、sector 名、坐标和删除按钮；不显示 group 名。未分组区域显示说明：这些 virtual stations 当前不属于任何 sector group，提交时会被移除。

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

Map 显示目标使用一个变量表达：

```ts
type MapArchiveTarget =
  | { kind: 'default-map' }
  | { kind: 'archive'; guid: string; time: number }
```

该变量只描述地图当前显示什么，不承载 save panel layer/stage。`saveStore.selectedArchive` 继续表示已加载的存档详情，不再用 `null` 表示“用户选择默认地图”。

初始化规则：

- 若用户尚未显式选择 `MapArchiveTarget`，且存在 active binding 与可用 archive，则目标推导为该 active binding 对应 archive。
- 若用户尚未显式选择目标且没有 active binding archive，则目标推导为 `{ kind: 'default-map' }`。
- 点击“默认地图”显式设置 `{ kind: 'default-map' }`。
- 点击某个存档显式设置 `{ kind: 'archive', guid, time }`。
- 点击玩家存档组标题或组级 POI 入口时，guid-level 选择不作为第三种 target；系统必须解析为该 guid 下最新有效 archive，并显式设置 `{ kind: 'archive', guid, time }`。

星区组染色和 hub route overlay 显示规则：

```ts
showBindingOverlay =
  mapArchiveTarget.kind === 'archive' &&
  mapArchiveTarget.guid === activeBinding.gameGuid
```

因此 save panel 当前 layer 不参与 overlay 显隐。用户在 list、category、coord、binding-sector 或 binding-station 中，只要地图显示目标与 active binding guid 匹配即可显示；选择 default-map 或其他 guid archive 时隐藏。

Save panel 生命周期：

- 关闭再打开只恢复关闭前的 `mapSavePanelLayer`、`mapBindingStage` 和 binding context。
- 明确导航入口（例如进入 binding-sector、binding-station、category、list）才覆盖 layer/stage。
- 地图显示目标与 panel layer/stage 分离，避免打开/关闭面板导致染色/连线切换。

渲染层级：

1. 地图背景。
2. faction owner 区域染色与 sector group 区域染色。
3. 高速路、星门、superhighway、跨星区连接和普通星区连线等地图结构。
4. sector 六边形边框、resource pie 和资源 badge。
5. hub route、空间站、POI、拖拽 overlay、文字与交互高亮。

faction owner 区域染色与 sector group 区域染色只作为 sector 内部背景，不得遮蔽高速路、空间站、星门或其他地图实体。Sector 六边形边框必须绘制在染色上方，保证边界清晰。

单个 sector 的背景填充优先级：

1. 若 `showSectorGroupColors` 开启且 `sectorGroupColorMap[sectorId]` 存在，sector group color 负责该 sector 的背景填充，faction owner fill 不参与该 sector。
2. 若不满足上一步且 `showFactionFill` 开启，使用 faction owner fill。
3. 若两者都不适用，显示默认地图背景。

因此关闭星区组染色时，即使 `sectorGroupColorMap` 中仍有该 sector 的颜色数据，也不得隐藏 faction owner fill；只有星区组染色实际可见时，才 suppress 对应 sector 的 faction owner fill。

每个 sector 至多映射一个 hub color；coverage 互斥由核心分组保证。

## Virtual station overlay

Map binding draft overlay 的激活条件必须确保当前确实处于 binding draft 编辑态，且 active binding 与 `autoGroupResult` 属于同一 gameGuid。激活后：

- virtual station overlay 从 `liveStore.virtualStationDrafts` 渲染。
- virtual station overlay 在 Map binding 打开后即可拖动，不要求 Virtual Station tab 激活。
- virtual trade station overlay 从 group trade station draft 渲染。
- virtual trade station overlay 在 Map binding 打开后即可拖动，不要求 Trade Station tab 激活。

Drop 校验：

```text
virtual station:
  target sector 命中唯一 group anchor/coverage -> 接受
  无命中或多命中 -> 拒绝

virtual trade station:
  target sector === group.sectorMacro -> 接受
  其他 sector -> 拒绝
```

virtual station 拖动更新 station draft 的 `sectorMacro`、`position`、`groupId`。virtual trade station 拖动只更新 group draft 的 trade station position，不修改 `TradeStationBinding.sectorMacro`、group `sectorMacro`、coverage 或 station plan。

两类 overlay 沿用现有图标、颜色和样式，不新增额外视觉设计。
