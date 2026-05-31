# design.md — research-view

## 架构

ResearchWorkbench 为单文件组件，直接读 store，无独立 presenter 层：

```
useGameDataStore
  ├── researchData (research.json)
  ├── dlcs (dlcs.json)
  ├── localizedWaresMap (wares.json)
  ├── maps (maps.json)
  └── ships (ships.json)
        │
        ▼
ResearchWorkbench.vue  (vue 层 — 直接读 store, 内联所有逻辑)
```

## 组件树与文件

```
新增:
├── src/components/empire/ResearchWorkbench.vue   # 单文件, 全宽科技树 + 弹出面板

修改:
├── src/components/empire/ProductionSidebar.vue                    # fixedItems + research
├── src/components/empire/presenters/useProductionSidebarPresenter.ts  # showResearch/selectResearch
├── src/components/empire/BlueprintProductionWorkbenchView.vue     # ResearchWorkbench 渲染
├── src/components/empire/LiveProductionWorkbenchView.vue          # showResearch prop
├── src/components/empire/context_toolbar/BlueprintContextToolbar.vue  # workbenchMode type
├── src/types/production-ui.ts                                     # ProductionTabItem type + research
├── src/types/production-workbench-contract.ts                     # workbenchMode/entityType + research
├── src/types/x4.ts                                                # X4ResearchItem/Data/Unlock
├── src/store/useActiveViewStore.ts                                # activeEmpireWorkbench + research
├── src/store/useBlueprintProductionStore.ts                       # selectResearch() + resolveWorkbenchType()
├── src/store/useGameDataStore.ts                                  # researchData ref
├── src/store/logic/useGameData.ts                                 # ResearchData loader
├── src/locales/en.json                                            # 46 research i18n keys
├── src/locales/zh-CN.json                                         # 46 research i18n keys
```

## 关键决策

### 1. 无 presenter 层

研究页为只读展示，数据转换简单（分组 + 筛选 + DAG 布局），全部内联在 `ResearchWorkbench.vue` 的 computed/function 中。

### 2. DAG 布局算法

`layoutGroups` computed 对每个分组计算连通分量和拓扑分层：

```typescript
// 1. 构建边列表 (仅含组内可见节点间的依赖)
// 2. 无边的组 → 所有节点归入一个 flat row（grid 平铺）
// 3. 有边的组 → 找出连通分量
// 4. 每个连通分量 → BFS 拓扑排序分 layers
// 5. 输出 LayoutGroup: { id, nameKey, rows: LayoutRow[] }
//    LayoutRow: { nodes: LayoutNode[], edges: IdPair[] }
//    LayoutNode: { id, layer }
```

模板渲染：
- `edges.length === 0` → `flat-nodes`（CSS grid 平铺）
- `edges.length > 0` → `research-chain`（flex row, `chain-layer` 纵列 + `chain-arrow` 箭头）

超宽链通过 `overflow-x: auto` + `min-width: min-content` 实现组内横向滚动。

### 2.1 连线呈现修正

研究节点卡片风格保持现状，不改成游戏内胶囊按钮。需要调整的是依赖连线：

- 不再使用层间 `→` 字符表达依赖。
- 每个有依赖的 row 使用 SVG overlay 绘制真实 edge。
- 每条 `edges: [sourceId, targetId]` 都渲染为一条独立连线。
- 连线从 source 卡片右侧端口连接到 target 卡片左侧端口。
- 线条使用冷白色、轻微发光、无箭头；端点使用白色圆点。
- 多输入依赖必须多条线汇入同一个 target 左侧端口，不能被简化为“整列指向整列”。

`station_modules` 使用稳定的分行布局，避免通用拓扑排序把不同业务链混排：

```
row: blueprint_hack

[dock]       ┌─> [defence]    ┐
[production] ┼─> [defence]    ├─> [build]
[storage]    ┘                │
                              │
[dock]       ┌─> [habitation] ┘
[production] ┼─> [habitation]
[storage]    ┘

row: welfare
[welfare_1] ──> [welfare_2]

row: standalone
[venture]
```

其中 `blueprint_hack` 必须保留 8 条真实边：

- `dock -> defence`
- `production -> defence`
- `storage -> defence`
- `dock -> habitation`
- `production -> habitation`
- `storage -> habitation`
- `defence -> build`
- `habitation -> build`

`welfare_2` 的 `mission_progress` 依赖不显示为节点或连线，只保留淡化备注。

### 3. i18n 全覆盖

- 名称/描述: `t(item.nameId)` / `t(item.descriptionId)` — game locale
- UI 文本: `t('research.*')` — app locale
- 解锁参数: `t(param.xxxNameId)` — game locale（nameId 预编码在 research.json）
- DLC: `dlcs.find(ego_dlcTag).nameId → t()`

### 4. 弹出面板

使用 `Teleport to="body"` + fixed overlay，点击空白处关闭。不占用固定列空间。

### 4. 分类规则

```typescript
function _classify(wareId, tags):
  if wareId in DEFAULT_SET → "default"
  elif "hidden" in tags and "missiononly" not in tags → "abandoned"
  elif "missiononly" in tags → "mission_progress"
  else → "conditional"
```
