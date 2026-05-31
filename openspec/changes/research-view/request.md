# request.md — research-view

## 目标

在地化（Terraforming）侧边栏菜单之上增加"研究"菜单，全宽展示 X4 科技树，点击节点弹出详情面板。

## 已确认方案

### 1. 侧边栏集成

- 在 `ProductionSidebar.vue` 的 `fixedItems` 中，`overview` 和 `terraforming` 之间插入 `research` 菜单项
- 蓝图模式下 `!hasSectors` 时显示（同 terraforming 逻辑）
- 点击后 `store.selectResearch()` → `activeEmpireWorkbench = 'research'`
- `LiveProductionWorkbenchView.vue` 同步添加 `showResearch` prop（但不实际渲染 research 视图）

### 2. 页面布局

全宽科技树 + 点击弹出浮层面板（`Teleport to="body"`）。

**DAG 布局**：组内有依赖的节点按连通分量 → 拓扑分层的顺序从左到右排列，层间以 `→` 箭头连接；无依赖的组平铺网格。

```
┌─ 顶部工具栏 ───────────────────────────────────┐
│  [☐ 显示条件解锁项]                             │
├─ 科技树（全宽）─────────────────────────────────┤
│  ┌─ 传送 ────────────────────────────────────┐ │
│  │ [teleport] → [range_I] → ... → [warp_II]  │ │
│  └───────────────────────────────────────────┘ │
│  ┌─ 空间站模块 ──────────────────────────────┐ │
│  │ [dock,prod,stor] → [defence,habitation]   │ │
│  │                 → [build]                  │ │
│  │ [welfare_1] → [welfare_2]                  │ │
│  │ [venture]                                  │ │
│  └───────────────────────────────────────────┘ │
│  ...                                           │
└────────────────────────────────────────────────┘
                              ┌─ 弹出详情面板 ───┐
                              │ ×                │
                              │ 名称、描述        │
                              │ 消耗、依赖、解锁   │
                              └──────────────────┘
```

### 3. 显示规则

| category | 行为 |
|----------|------|
| `default` (30) | 始终显示 |
| `conditional` (15) | 开关控制显示/隐藏 |
| `mission_progress` (9) | 不显示为独立节点；在依赖它的第一个节点上标注 `前置需完成 xxx` |
| `abandoned` (3) | 彻底隐藏 |

### 4. 研究分组

分组名使用 `t('research.group.xxx')` i18n key：

| 组 ID | i18n key | 成员 |
|-------|----------|------|
| `teleport` | `research.group.teleport` | teleportation, range_01/02/03, warp_hq_01/02 |
| `station_modules` | `research.group.station_modules` | module_dock/production/storage/defence/habitation/build, welfare_1/2, venture |
| `ship_mods` | `research.group.ship_mods` | mod_engine/shield/ship/weapon 各 mk1/2/3 |
| `hq_base` | `research.group.hq_base` | high_mass_teleportation, seta |
| `diplomacy` | `research.group.diplomacy` | diplomacy_network, interference_network, agentslot_01/02 |
| `xenon_crisis` | `research.group.xenon_crisis` | xenon_crisis_01/02 |
| `abandoned_ships` | `research.group.abandoned_ships` | ship_* × 7 |
| `pirate_dlc` | `research.group.pirate_dlc` | erlking_core, condensate_sample |
| `terran_dlc` | `research.group.terran_dlc` | tf_tech |
| `xen_equipment` | `research.group.xen_equipment` | equipment_xenon |

### 5. i18n 全面覆盖

所有文本经 `i18n.global.t()` 翻译，无硬编码字符串：

| 文本类型 | i18n 方式 |
|---------|----------|
| 研究名称 | `t(item.nameId)` — 使用游戏 locale `{20216,xxx}` |
| 研究描述 | `t(item.descriptionId)` |
| 分组名称 | `t('research.group.xxx')` — app locale |
| 解锁条件 | `t('research.unlock.xxx', {ship, sector, item, npc})` — 动态参数替换 |
| UI 标签 | `t('research.*')` — app locale |
| DLC 名称 | `gameData.dlcs.find(ego_xxx)` → `t(dlc.nameId)` |
| 消耗品名 | `gameData.localizedWaresMap[wareId]` → `t(ware.nameId)` |
| 解锁船名/物品名/星区名 | `t(unlock.params.xxxNameId)` — 直接从 research.json nameId 取值 |

### 6. 解锁文本动态解析

`resolveUnlockText()` 根据 `unlock.key` 分发，使用 `unlock.params` 中的 `*NameId` 字段：

- `abandoned_ship` → `在{sector}占领废弃船{ship}后解锁`
- `erlking` → `在{sector}接近{ship}，捕获或摧毁后解锁`
- `condensate_sample` → `购买{item}并交付{npc}后解锁`
- `xen_equipment` → `拾取{item}后解锁`
- `interference_network` → `成功完成{count}次外交干涉后解锁`
- 其余 → `t('research.unlock.xxx')`

### 7. 数据流

```
research.json → useGameDataStore.researchData
  → ResearchWorkbench.vue (直接读 store，无中间 presenter)
```

## 边界

### In Scope

- 侧边栏菜单项 + workbench 类型扩展（`activeEmpireWorkbench`, `workbenchMode`, `entityType`, `ProductionSessionState`, `production-ui.ts` 等所有类型引用）
- ResearchWorkbench.vue（单文件，全宽树 + 弹出面板）
- app locale 46 个 research i18n key
- research.json 数据加载器（useGameData.ts + useGameDataStore.ts）

### Out of Scope

- 研究完成状态追踪
- 实际研究排队/执行
- 测试代码

## 验收标准

1. `npm run build` 通过
2. 侧边栏 research 菜单在地化之上，仅蓝图模式显示
3. 默认显示 30 个 default 节点，10 个分组
4. conditional 开关可切换 15 个额外节点
5. 点击节点弹出详情面板，所有文本均通过 `t()` i18n
6. mission_progress 备注以淡化样式标注
7. abandoned 节点不显示
8. 解锁文本动态解析 nameId，无运行时跨源查找

## 未决项

无
