# 星区管理现状分析

## 一、现有架构概述

星区管理仅应用于 **Live Production（存档绑定）** 模式，位于 Map 视图的侧栏面板中。

### 1.1 数据模型

```
SavedSaveBindingsState
  └── BindingPlan[]
       ├── gameGuid
       ├── groups: BindingSectorGroup[]    ← 星区组
       │    ├── id, name, order
       │    ├── sectorMacro               ← 中心（anchor）星区
       │    ├── jumpRange                 ← 覆盖跳数 (0-5)
       │    ├── coverageSectorMacros: CoverageSectorEntry[]
       │    │    └── { ref, jump }
       │    ├── connectedGroupIds: string[]
       │    └── tradeStation?
       └── stationPlans: BindingStationPlan[]
```

类型定义：`src/types/x4.ts:1269` (`BindingSectorGroup`), `src/types/x4.ts:1294` (`SaveBindingPlan`)

### 1.2 核心流程

#### Stage 2: 星区组创建与管理

组件：`src/components/map/MapBindingSectorGroup.vue` (1424 行)

1. 用户点击「New Sector」→ `createSectorAndEdit()` (`MapBindingSectorGroup.vue:621`)
2. 弹出 `MapBindSectorMenu`，用户选取 **anchor 星区**
3. `onBindMenuSelectSector()` (`MapBindingSectorGroup.vue:287`) 调用 `getCoverageSectors()` (`src/store/logic/saveBindingUtils.ts:218`) BFS 计算 jumpRange 内所有可达星区，自动将其中有存档空间站的加入 coverage
4. jumpRange 变化时 `updateDraftJumpRange()` (`MapBindingSectorGroup.vue:502`) 自动更新 coverage
5. 确认：`confirmBinding()` (`MapBindingSectorGroup.vue:461`) 写入 `saveBindingStore`

#### Stage 3 / 生产侧栏

- `deriveBindingStationsFromRecords()` (`src/store/logic/liveStationResolver.ts:113`) 自动将覆盖范围内存档站归入 group。**手动绑定是可选的额外操作**。
- `createEmpireSourceView()` (`src/store/logic/empireSourceView.ts:49`) → `orderedStationsBySector` → `useProductionSidebarPresenter()` (`src/components/empire/presenters/useProductionSidebarPresenter.ts:112`) → `ProductionSidebar.vue`

### 1.3 绑定规则

- 绑定以 `gameGuid` 为主键，一个 guid 一个 `SaveBindingPlan`
- `selectedArchiveTime = null` → guid 级绑定，跟随最新存档；`selectedArchiveTime = number` → time 级绑定，锁定特定快照
- `normalizeState()` 按 `gameGuid` 去重（`useSaveBindingStore.ts:121-127`）

### 1.4 关键文件与函数索引

| 文件 | 关键函数/位置 | 作用 |
|---|---|---|
| `src/store/logic/saveBindingUtils.ts` | `getCoverageSectors():218` | BFS 计算 anchor 周围 jumpRange 内的星区 |
| `src/store/logic/saveBindingUtils.ts` | `buildSectorGraphFromMaps():249` | 从 maps.json 构建星区邻接图 |
| `src/store/logic/liveStationResolver.ts` | `deriveBindingStationsFromRecords():113` | 自动将存档站归入对应 group |
| `src/store/logic/liveStationResolver.ts` | `findGroupBySectorMacro():68` | 查找某星区所属的 group |
| `src/store/logic/empireSourceView.ts` | `createEmpireSourceView():49` | 统一 empire/save-binding 数据视图 |
| `src/store/logic/empireSourceView.ts` | `buildBindingSectorLinks():36` | 从 connectedGroupIds 构建 sectorLinks |
| `src/store/logic/saveBindingSectorScope.ts` | `resolveBindingSectorScope():14` | 解析 group 的 anchor + coverage 星区集合 |
| `src/store/logic/saveBindingSectorScope.ts` | `isSectorMacroInBindingScope():36` | 判断星区是否在 group scope 内 |
| `src/store/useSaveBindingStore.ts` | `createGroup()`, `bindSectorGroup()`, `updateGroup()`, `deleteGroup()` | 星区 group CRUD |
| `src/store/useSaveBindingStore.ts` | `createOrOpenBinding():243` | 创建或打开绑定 |
| `src/components/map/MapBindingSectorGroup.vue` | `onBindMenuSelectSector():287` | anchor 选择 + 自动添加 coverage |
| `src/components/map/MapBindingSectorGroup.vue` | `updateDraftJumpRange():502` | jumpRange 变化时自动更新 coverage |
| `src/components/map/MapBindingSectorGroup.vue` | `confirmBinding():461` | 确认保存 group |
| `src/components/map/MapBindingSectorGroup.vue` | `getCandidateSectorsAtJump():571` | 候选星区（未在 coverage 中的） |
| `src/components/map/MapBindingStation.vue` | `anchorAndCoverageSectors:159` | 展示 group 下各星区及其空间站 |
| `src/components/map/MapBindingStation.vue` | `bindToStation():568` | 手动绑定空间站到蓝图站 |
| `src/components/empire/LiveProductionWorkbenchView.vue` | overview 模式模板:331 | 当前三列布局 (grid-cols-12, 3:5:4) |
| `src/components/empire/ProductionSidebar.vue` | `groupSectors:94`, `dynamicItems:163` | 生产侧栏树形渲染 |
| `src/components/empire/presenters/useProductionSidebarPresenter.ts` | `useProductionSidebarPresenter():112` | 构建侧栏 tabs 数据 |
| `src/components/save/SaveList.vue` | `bindArchive():78` | 绑定按钮（当前跳转地图） |
| `src/components/save/SaveUploadPanel.vue` | `processFile()` | 存档上传 |
| `src/types/x4.ts` | `BindingSectorGroup:1269`, `CoverageSectorEntry:1238`, `SaveBindingPlan:1294` | 类型定义 |

---

## 二、当前痛点

1. **生产侧栏混乱**：一个 group 覆盖数跳可能包含几十上百个空间站，树形列表无搜索/筛选。
2. **星区划分需大量人工决策**：几个 group、每个 group 的 anchor 在哪、jumpRange 多大、如何避免 overlap，缺乏辅助。

---

## 三、以 save_009.json 为例的分析

分析脚本：`analysis/scripts/analyze_sector_grouping.py`

该存档共 22 个星区有玩家空间站，总计 45 个 station。

### Hub 排序（Tier 1 + 纯 hub 标识）

```
Pure hubs (prod_lines=0, 共 11 station, 7 星区):
  32M m³ — HDJ-767  Hatikvah's Choice I
  32M m³ — LDT-095  CEO's Doubt
  32M m³ — YMY-537  Tharka's Cascade XV
  32M m³ — AQJ-601  Eighteen Billion
  32M m³ — ECX-552  Nopileos' Fortune VI
  30M m³ — TXV-976  Asteroid Belt
  24M m³ — UFM-908  Family Zhin

Impure (prod_lines>0, 示例):
  52M/68prod — PPK-396  Atiya's Misfortune I (HQ, score=753K)
  18M/8prod  — LPZ-398  True Sight (score=2M)
  56M/1565prod — AYP-883  Matrix #101 (score=35K, 被 Tharka XV 吸收)
  ...
```

### 分组结果（7 组，16 星区确定分配）

| Group | Hub | Container | 确定成员 |
|---|---|---|---|
| 1 | Hatikvah's Choice I / HDJ-767 | 32M | Hatikvah's Choice I, Heretic's End (jump=2), Hatikvah's Faith (jump=2) |
| 2 | CEO's Doubt / LDT-095 | 32M | CEO's Doubt (9 stations，仅自身) |
| 3 | Tharka's Cascade XV / YMY-537 | 32M | Tharka's Cascade XV/XVII, Matrix #79B (jump=1), Matrix #101 (jump=1) |
| 4 | Eighteen Billion / AQJ-601 | 32M | Eighteen Billion (仅自身) |
| 5 | Nopileos' Fortune VI / ECX-552 | 32M | Nopileos' Fortune II, Nopileos' Fortune VI, Pious Mists IV (jump=2) |
| 6 | Asteroid Belt / TXV-976 | 30M | Asteroid Belt, Mercury (T2 自动吸收, jump=3) |
| 7 | Family Zhin / UFM-908 | 24M | Family Zhin, Family Nhuut (jump=1) |

**注意**：Grand Exchange I/IV 和 Savage Spur I/II 因 score 相近被置为存疑，未自动分配。Mercury 因 Tier 2 不能独立成 hub，自动被 Sol 吸收。

### 存疑（共 6 星区，用户选择）

**类型 A — score 相近**（等距且 score 差距 < 30%）：

| 星区 | 候选 A | 候选 B | 差距 |
|---|---|---|---|
| Grand Exchange I | AQJ-601 (Eighteen Billion, jump=1, 32M) | ECX-552 (Nopileos' Fortune, jump=1, 32M) | 0% |
| Grand Exchange IV | 同上 | 同上 | 0% |
| Savage Spur I | YMY-537 (Tharka's Cascade, jump=2, 32M) | TXV-976 (Sol, jump=2, 30M) | 6% |
| Savage Spur II | 同上 | 同上 | 6% |

**类型 B — 带产线超出 jumpRange 但在 5 跳内**：

| 星区 | Station | 容量 | 产线 | 最近纯 hub | 距离 |
|---|---|---|---|---|---|
| True Sight | LPZ-398 | 18M | 8 | HDJ-767 (Hatikvah's Choice) | 3 jumps |
| Atiya's Misfortune I | PPK-396 (HQ) | 52M | 68 | TXV-976 (Asteroid Belt) | 4 jumps |

### Tier 2 自动吸收

| 星区 | 被吸收到 | 距离 |
|---|---|---|
| Mercury | Sol (TXV-976) | 3 jumps (超出 jumpRange 但 Tier 2 不能独立，自动吸收) |

### 例外：0 个

所有星区均在某个纯 hub 的 5 跳范围内。
