# active-binding Design

## D1. Active 单一入口

`live-production` 的当前 binding 选择必须以 `activeViewStore.activeBinding` 为准。

职责划分必须收敛为：

- `activeViewStore`
  - 持有当前工作台视图
  - 持有当前 `live-production` 指向的 `activeBinding`
  - 持有当前 `activeBindingStation`
- `useSaveBindingStore`
  - 持有当前已装载到内存的 `draftBinding / activeBinding`
  - 在切换完成后与 `activeViewStore.activeBinding` 保持一致
  - 负责 binding 数据本身的创建、更新、保存、丢弃
- `useSaveStore`
  - 持有 `selectedArchive`
  - 在 `live-production` 中被动跟随当前 binding 对齐到合法 archive

这要求 `activeViewStore -> useSaveBindingStore -> useSaveStore` 形成明确主从链路。

## D1.1 动作边界

文档必须明确区分两类动作：

### A. 当前 binding 选择动作

这类动作会改变当前工作台指向的 binding，包括：

- 从列表载入某个 binding
- 从持久化状态恢复当前 binding
- 因 fallback 切换到另一个合法 binding
- 因 active 失效而清空当前 binding

这类动作必须同时更新：

- `activeViewStore.activeBinding`
- `useSaveBindingStore.activeBinding / draftBinding`
- `useSaveStore.selectedArchive`

**唯一允许的入口**：`liveProductionStore.activateBinding(gameGuid)`。该函数有 `_activating` 互斥锁防止重入。

### B. binding 数据编辑动作

这类动作只修改 binding 数据本身，不得改变当前工作台 active 指向，包括：

- 创建 binding 草稿
- 更新 `selectedArchiveTime`
- 更新 `bindingName`
- 更新 `stationPlans`
- `saveBinding`
- `discardChanges`

这类动作必须只修改 binding 数据，不得隐式把某个 `gameGuid` 设置成当前 active binding。

实现不得把 A / B 两类动作的边界留给执行者自行解释。

### 实现收敛措施

| 方法 | 原行为 | 修正后 |
|------|--------|--------|
| `saveBinding()` | 调 `activeViewStore.setActiveId` | 去除（仅持久化） |
| `setSelectedArchiveTime()` | 调 `activeViewStore.setActiveId` | 去除（仅更新指针） |
| 内部 CRUD 方法 | 调 `createOrOpenBinding` | 改用 `loadDraftForGameGuid`（不写 activeView） |
| `createOrOpenBinding()` | 调 `activeViewStore.setActiveId` | 保留（授权切换机制，仅外部调用） |

### 同步机制

`saveBindingStore` 新增 `watch(() => activeViewStore.activeBinding, ...)` 自动同步 draft，确保 `activeViewStore` 变化后 `draftBinding` 跟随。新增 `syncFromActiveView()` / `clearDraft()` 方法供主动同步使用。

## D2. Binding 激活事务

必须定义单一的 binding 激活事务，用于覆盖两类入口：

- 首次 `initialize()`
- 运行中切换 binding（含从列表载入）

事务步骤必须固定为：

1. 校验目标 `gameGuid` 是否存在 binding。
2. 校验该 binding 是否仍有合法 archive。
3. 写入 `activeViewStore.activeBinding`。
4. 令 `useSaveBindingStore` 装载对应 `draftBinding`。
5. 根据 `selectedArchiveTime` 对齐 `useSaveStore.selectedArchive`。
6. `await loadPlayerStationRecords()`（必须在步骤 5 之后、步骤 7 之前，确保 records 来自正确的 archive）。
7. 重建 `planningDerivedMap`（eager）。
8. `markAllDirty()`（延迟 `liveFlowMap` 重建）。
9. `validateActiveStationId()`。
10. 根据当前 binding/archive 状态重设 `mode`。

### 实现

位于 `useLiveProductionStore.activateBinding(gameGuid)`。带 `_activating` 互斥锁防止重入。

### 载入入口截获

`LoadLivePlanModal.vue.handleLoadBinding()` 直接调 `activeViewStore.switchToBinding()` + `liveStore.activateBinding(gameGuid)`，绕过 `openBinding` 的 guard 失效。

`LiveProductionWorkbenchView.vue` 的 `onMounted` 和 `watch(() => activeBinding)` 均直接调 `activateBinding()`（不再用 `openBinding` 的 guard）。

### 已知问题

`openBinding()` 的 guard（`if currentDraft?.gameGuid === gameGuid`) 在 draft 已加载时拦截了激活事务。为此所有载入入口改用 `activateBinding()` 直调。

## D3. Guid 一致性门禁

`useLiveProductionStore` 中所有 realtime/archive 读取都必须增加 guid 一致性门禁。

### playerStationRecords

- `playerStationRecords` 不得仅由 `selectedArchive` 驱动。
- 加载前必须先校验：
  - `activeViewStore.activeBinding !== null`
  - `useSaveBindingStore.activeBinding !== null`
  - `selectedArchive !== null`
  - `selectedArchive.meta.guid === activeBinding.gameGuid`

任一条件不满足时，`playerStationRecords` 必须清空。

### archiveStation

- `archiveStation` 不得仅凭 `stationCode` 在当前 `playerStationRecords` 中查找。
- 只有在当前 archive 与 active binding guid 一致时，`archiveStation` 才允许返回 realtime/archive 快照。
- 若 guid 不一致，`archiveStation` 必须为 `null`，并阻断 realtime 模式展示。

## D4. Save 删除后的失效传播

删除 archive 后，系统必须执行 active 失效传播。

### 实现

`useLiveProductionStore` 新增 `watch(() => saveStore.savedArchivesState.list.length, ...)`，检测 list 长度减小后执行。

### selectedArchive Watcher 约束

`watch(selectedArchive, ...)` 只在以下条件全部满足时才执行 `loadPlayerStationRecords()` + `syncLiveFlowMap()`：

- `selectedArchive` 非空且有效
- `activeBinding` 非空
- `archive.meta.guid === binding.gameGuid`
- `binding.selectedArchiveTime === null`（仅无固定时间的 binding 自动跟随最新存档）

目的是防止上传无关存档或上传同 guid 但有固定存档时间的 binding 意外清空 `playerStationRecords`。

### addArchive 保存顺序

`addArchive()` 必须先 `await saveArchiveToDB()` 完成后再设 `selectedArchive.value`，防止 IndexedDB 写入未完成时 watcher 读不到数据。

### 有剩余同 guid archive

- 若当前 binding 对应的 `gameGuid` 仍有其他合法 archive，系统必须把 `selectedArchive` 对齐到 binding 约束下的剩余 archive。
- 之后必须重新执行 binding 激活事务中的重建步骤。

### 无剩余同 guid archive

- 若当前 binding 对应的 `gameGuid` 已无合法 archive，系统必须执行统一清空：
  - `activeViewStore.activeBinding = null`
  - `activeViewStore.activeBindingStation = null`
  - `useSaveBindingStore` 清空当前 draft
  - `useLiveProductionStore` 清空 `playerStationRecords`
  - 清空或重置相关计算缓存

不得留下“binding 仍 active，但 archive 已失效”的悬空状态。

## D4.1 失效 Binding 的列表呈现与交互

binding 列表或载入面板必须为每个 binding 计算“是否仍有有效 archive”状态。

### 呈现规则

- 若某个 binding 对应的 `gameGuid` 已无任何有效 archive，则该项必须显示红色 `[存档失效]` 标签。
- 该标签必须附着在存档名或 binding 名称后，作为稳定可见的失效提示。

### 交互规则

- 失效 binding 的载入按钮必须禁用。
- 禁用后不得触发 `openBinding`、不得切换 `activeViewStore.activeBinding`、不得开始 binding 激活事务。
- 恢复 active 的初始化逻辑也必须复用同一判定：失效 binding 不得被自动载入。

## D5. 计算缓存重建

`live-production` 的主要聚合依赖两套缓存：

- `planningDerivedMap`
- `liveFlowMap`

这两套缓存必须被视为 binding/ archive 激活事务的组成部分，而不是零散的附属步骤。

### planningDerivedMap

- 必须在 binding 切换后按当前 `derivedBindingStations` 全量重建（eager，轻量）。
- 旧 binding 的站点缓存不得残留到新 binding。
- `syncAllBindingStationsToStateMap()` 创建新 map 并遍历 upsert。

### liveFlowMap

- 必须是 lazy 重建（通过 dirty 机制），不在激活事务中 eager 执行。
- 若 archive 与 binding guid 不一致，则必须清空，不得沿用旧缓存。

### Dirty 机制

- `dirtyBindingStationIds: ref<'all' | Set<string> | null>` — `'all'` 表示全脏，`Set` 表示指定站点脏，`null` 表示干净。
- 站级 getter（`getStationFlowCache()`）调用 `computeDirtyStation(stationId)` 按需计算。
- 聚合 computed（`empireGroupedFlows`、`stationFlowCache`、`sectorInternalDataMap`、`sectorLinkCalcMap`）读取前调用 `flushAllDirtyStations()`。
- `syncAfterStationFlowChange()` 改为仅 `markStationDirty(stationId)`，不再 eager 执行 `syncLiveFlowMapForStation`。
- `syncBindingStationDerivedSnapshot()` 改为仅 `markStationDirty(stationId)`。

## D6. 聚合读数一致性

`empireGroupedFlows`、sector 聚合、overview 读数均依赖上述缓存。

因此必须满足：

- binding 切换完成前，不得暴露上一轮 binding 的聚合结果。
- binding 切换完成后，overview / transit / station 三种模式必须统一读取新缓存。
- 首次初始化与运行时切换不能各走一套不同的聚合初始化逻辑。

### expandedSectorId 清理

`validateActiveStationId()` 在 `activeBindingStation === null`（binding 切换）或 station 无效时，必须同步清空 `expandedSectorId`，防止切换后残留展开状态。

## D6.1 Dirty 驱动而非视图驱动的重算

binding 编辑阶段不要求实时看到 production 结果，因此系统不得采用“每次进入 `live-production` 就重算全部”的策略。

正确策略必须为：

- 编辑阶段只写入 dirty 状态
- 读取结果时才根据 dirty 状态决定是否重算
- 未 dirty 的结果再次查看时不得重复重算

## D6.2 编辑影响范围规则

### 调整星区

这里的“调整星区”包括：

- 修改 group 连接关系
- 修改 group anchor / coverage / jump range
- 其他会影响连接关系或范围内空间站集合的星区编辑

dirty 规则必须固定为：

- 若本次编辑未影响连接关系，且未影响范围内空间站集合，则不 dirty
- 只要影响了连接关系，或影响了范围内空间站集合，则将当前 binding 结果整体标记为 dirty

这里不得引入更细的局部裁量规则。

### 自由空间站绑定 / 解绑

- binding 界面没有单独的“调整空间站模块”入口
- 自由空间站绑定 / 解绑必须等价视为“调整空间站模块”
- 该操作只允许将目标空间站标记为 dirty
- 该操作不得提升为星区 dirty
- 该操作不得提升为全局 dirty

## D7. 回归测试范围

必须新增或更新回归测试覆盖以下场景：

1. A、B 两个不同 `gameGuid` 的 archive 同时存在，binding 绑定 A；删除 A 后重新打开 A binding，不得读到 B 的 realtime 数据。
2. 切换 binding 后，overview 聚合与 station 聚合必须刷新为新 binding 的结果。
3. 当前 active binding 失效后，`activeViewStore` 与 `useSaveBindingStore` 必须同步清空。
4. 初始化恢复路径与运行中切换路径的缓存重建行为必须一致。
5. 失效 binding 必须显示红色 `[存档失效]` 标签，且载入按钮禁用。
6. 文档必须明确"切换当前 binding"的允许入口与"仅修改 binding 数据"的禁止越权行为，不得把 active 写路径留给执行者决定。
7. 编辑阶段必须采用 dirty 驱动的延迟重算，而不是视图切换即重算。
8. 星区编辑的 dirty 规则必须按"是否影响连接关系或范围内空间站集合"二值化处理。
9. 自由空间站绑定 / 解绑必须等价视为站点级模块变更，仅目标空间站 dirty。
10. 上传无关存档不得清空当前 binding 的 `playerStationRecords`。
11. 上传同 guid 存档但 binding 固定了 `selectedArchiveTime`，不得自动刷新 binding 数据。
12. 从列表载入 binding 后空间站列表正确显示（`activateBinding` 而非 `openBinding` 执行激活）。
13. binding 切换后 `expandedSectorId` 清空，星区不残留展开状态。
14. 普通 binding 数据编辑动作（`saveBinding` / `setSelectedArchiveTime` / 内部 CRUD）不会隐式切换当前 active binding。
