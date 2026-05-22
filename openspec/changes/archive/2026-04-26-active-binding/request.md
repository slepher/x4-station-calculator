# active-binding Request

## 目标

修正 `live-production` 中 `active binding`、`selected archive` 与内存计算态之间的失配问题，消除跨 `gameGuid` 串档、删除存档后的悬空 active，以及切换/载入 binding 后未完整初始化计算与聚合的问题。

本次变更必须将 `activeViewStore` 明确为当前工作台 active 状态的唯一入口，并要求 `useSaveBindingStore`、`useSaveStore`、`useLiveProductionStore` 在该入口变化后执行完整同步。

## 已确认方案（审核重点）

### 1. Active 所有权

- `activeViewStore` 必须作为当前 `live-production` 工作台 active 状态的唯一入口。
- `activeViewStore.activeBinding` 必须表示当前 `live-production` 指向的 binding `gameGuid`。
- `useSaveBindingStore.activeBinding / draftBinding` 必须表示当前已装载到内存中的 binding 草稿，并且必须与 `activeViewStore.activeBinding` 保持一致。
- “切换当前 binding” 与“编辑 binding 数据”必须明确区分，不得混用。
- 只有显式的 binding 载入/切换动作可以改变当前 `activeBinding` 指向；创建 binding、更新时间、保存 binding、修改 stationPlans、修改 bindingName 等普通数据动作不得隐式改写当前工作台 active 指向。
- `activeViewStore.activeBinding === null` 时，`useSaveBindingStore.activeBinding` 也必须为 `null`。

### 2. Save 与 Binding 的同步关系

- `useSaveStore.selectedArchive` 在 `live-production` 模式下必须受当前 binding 约束。
- 当 `activeViewStore.activeBinding` 有值时，系统必须根据 `binding.gameGuid + binding.selectedArchiveTime` 对齐 `selectedArchive`。
- `useLiveProductionStore` 不得在 `selectedArchive.meta.guid !== activeBinding.gameGuid` 时继续暴露 realtime/archive 数据。
- `archiveStation`、`playerStationRecords`、live 模式计算与展示，必须建立在 guid 一致的前提上。

### 3. 删除 Save 后的失效清理

- 删除当前 active binding 对应的 save 后，系统必须判定该 active 是否失效。
- 若该 binding 已无可用 archive，必须清空：
  - `activeViewStore.activeBinding`
  - `activeViewStore.activeBindingStation`
  - `useSaveBindingStore.activeBinding / draftBinding`
- 系统不得只把 `selectedArchive` 置空而保留悬空的 binding active。

### 3.1 存档失效 Binding 的载入约束

- 当某个 binding 对应的 `gameGuid` 已无任何有效 archive 时，该 binding 必须被视为“存档失效”。
- 存档列表或 binding 载入入口中，失效 binding 的存档名后必须显示红色 `[存档失效]` 标签。
- 失效 binding 的“载入”按钮必须禁用，不得允许交互触发载入。
- 系统不得通过点击、恢复 active、或其他常规入口将失效 binding 重新载入到 `live-production`。

### 4. 切换 / 载入 Binding 的完整事务

- 切换 binding 不得只执行 `createOrOpenBinding(gameGuid)`。
- 绑定切换必须是完整事务，至少必须包含：
  - 更新 `activeViewStore.activeBinding`
  - 同步 `useSaveBindingStore.activeBinding / draftBinding`
  - 对齐 `useSaveStore.selectedArchive`
  - 重建 `planningDerivedMap`
  - 重建 `liveFlowMap`
  - 重新校验 `activeStationId`
  - 重新设置 `mode`
- 首次 `initialize()` 与运行中切换 binding，必须复用同一条完整初始化链路，不得存在一条完整、一条残缺的双路径。
- 文档必须明确哪些动作允许改变当前 active binding，哪些动作只允许修改 binding 数据；实现不得把这条边界留给执行者自行判断。

### 5. 计算与聚合初始化

- `planningDerivedMap` 必须在 binding 载入后按当前 binding 站点完整重建。
- `liveFlowMap` 必须在 archive 对齐后按当前 archive 站点完整重建。
- `empireGroupedFlows`、sector 聚合、overview 聚合必须在 binding 切换后读取到新一轮已重建的缓存，不得继续使用旧 binding 的残留结果。

### 6. Binding 编辑阶段的 Dirty 规则

- binding 界面的编辑不要求实时展示 production 结果。
- 系统不得因为进入 `live-production` 就默认重算全部结果。
- 编辑阶段必须只写入 dirty 标记，结果重算必须在真正需要读取结果时按 dirty 状态触发。
- 文档与实现必须使用显式的 `dirty = 'all'` 表示整体脏状态，不得再用 `null` 承载“全脏”语义。

#### 6.1 调整星区

- 若本次星区编辑未影响连接关系，且未影响范围内空间站集合，则不得标记 dirty。
- 只要本次星区编辑影响了连接关系，或影响了范围内空间站集合，则必须将当前 binding 的结果整体标记为 dirty。

#### 6.2 自由空间站绑定 / 解绑

- binding 界面没有单独的“调整空间站模块”操作。
- 自由空间站绑定 / 解绑必须等价视为“调整空间站模块”。
- 该操作只允许将目标空间站标记为 dirty，不得提升为星区 dirty 或全局 dirty。

## 边界

### In Scope

- `activeViewStore` / `useSaveBindingStore` / `useSaveStore` / `useLiveProductionStore` 的 active 同步关系
- `live-production` 中 binding 切换、archive 对齐、失效清理、计算重建与聚合重建
- 对应的回归测试与文档同步

### Out of Scope

- blueprint-production 主路径重构
- map/save 面板整体交互改版
- save 解析格式、IndexedDB 结构、archive 导入流程改造
- 与本次 active 同步问题无关的 presenter / view 分层调整

## 验收标准（DoD）

1. 当 `activeViewStore.activeBinding` 从持久化恢复后，`useSaveBindingStore` 必须载入同一 `gameGuid` 的 draftBinding，且 `useSaveStore.selectedArchive` 必须对齐到该 binding 指定的 archive。
2. 当删除当前 active binding 对应的 save，且该 binding 已无任何有效 archive 时，`activeViewStore.activeBinding` 与 `useSaveBindingStore.activeBinding` 必须同时清空。
3. 当当前 binding 为 A、当前 selected archive 为 B 时，`useLiveProductionStore` 不得显示 A binding 下的 realtime/archive 数据，不得出现“可切 realtime 但内容来自 B”的行为。
4. 运行中切换 binding 后，`planningDerivedMap`、`liveFlowMap`、`empireGroupedFlows` 与 station/overview 聚合必须完成重建，不得继续显示上一个 binding 的残留结果。
5. 首次进入 `live-production` 与运行中切换 binding，必须走同一条绑定装载与重算链路，行为一致。
6. 当某个 binding 已无有效 archive 时，载入入口必须显示红色 `[存档失效]` 标签，且载入按钮必须不可交互。
7. binding 界面中的星区编辑只有在影响连接关系或范围内空间站集合时才允许整体标记 dirty；否则不得标记 dirty。
8. binding 界面中的自由空间站绑定 / 解绑必须仅标记目标空间站 dirty。
9. 必须补充回归测试覆盖：
  - A/B 不同 `gameGuid` 场景下删除 A 后再打开 A binding
  - binding 切换后的 overview/station 聚合刷新
  - active invalidation 后的清空行为
  - 普通 binding 数据编辑动作不会隐式切换当前 active binding
  - 失效 binding 的标签显示与载入禁用行为
  - 星区编辑的 dirty 判定
  - 自由空间站绑定 / 解绑仅标记目标空间站 dirty

## 未决项

无。
