# user-save-binding Design

## 设计目标

把 `station-binding` 中的所有 binding 相关能力独立成 `user-save-binding`：包括 binding 数据模型、首页 binding 入口、Step 2 星区组编辑、Step 3 空间站绑定，以及 binding POI 地图交互。

## 结构拆分

### 数据层

- `useEmpireStore` / `saveBindingActions`
  - binding 创建、激活、archive time、group binding、station binding、连接星区
- `useSaveStore`
  - 提供具体 archive 预览，但不由地图层回写 binding active

### UI 层

- `MapSaveArchiveList.vue`
  - 首页 binding 图标入口与投影
- `MapSavePanel.vue`
  - binding 面包屑、Step 2/3 层切换
- `MapBindingSectorGroup.vue`
  - Step 2
- `MapBindingStation.vue`
  - Step 3
- `MapWorkbenchView.vue`
  - binding POI 展示、拖拽权限、tooltip 上下文

## 关键决策

### D1: binding 状态与首页 active 状态彻底分离

- 首页容器和 time 条目的高亮只读 `activeArchiveId`。
- binding 只影响 binding 图标点亮。
- binding 图标点击可以导致 `activeArchiveId` 改变，但那是显式 active 切换的结果，不是绑定状态本身直接参与渲染条件。

### D2: savePanel 独占管理 activeArchiveId

- `MapSavePanel` 内部负责 `selectArchive` / `selectArchiveGroup`。
- 地图层只接收“显示哪份 archive”的事件，不再通过 `select-archive` 回写 `saveStore.activeArchiveId`。
- guid 级 binding 可以保持 `activeArchiveId = guid`，同时地图仍预览 latest archive 实体。

### D3: Step 2 / Step 3 继续保留在 binding change

- Step 2 管理 empire sector 结构、定位星区、coverage、连接星区。
- Step 3 管理 save station 与 empire station 的绑定、失效态与 placement。

### D3.1: Step 2 的候选星区与 coverage 需要区分“锁定可见”和“可加入”

- 若某个 map sector 已被其他 empire sector 占用为定位星区或 coverage，该 map sector 不能进入当前 draft 的 coverage。
- 这类 map sector 仍然保留在 candidate 星区列表中，避免用户误以为它在跳数范围内消失。
- candidate 列表中的这类项使用锁定样式展示，但不显示 `+`，也不能加入 coverage。
- 当前 empire sector 自己已有的 coverage 在打开编辑时会保留，不受这条跨组占用规则误伤。

### D4: Step 3 的普通站与虚拟中转站统一收敛到同一套 binding 语义

- 普通 empire 站与虚拟中转站都以“是否存在 binding 记录、是否存在 `saveStationCode`”判断自由 / 已放置 / 已绑定。
- 不再使用单独的 `free` 语义字段；不存在记录就是自由站点。
- save station 改绑目标时，被顶替的旧目标一律清理旧 binding 并回归自由。
- 显式解绑也直接清理旧 binding 并回归自由，不保留额外的 placed 壳状态。

### D5: Step 3 绑定菜单表达状态，但不承担额外说明文案

- 菜单项仅通过背景色、active、高亮、置灰表达状态。
- 不再显示“已设置位置”“虚拟中转站”等右侧备注文字。
- 已拖拽到地图但未绑定的对象在菜单中仍视为不可绑定候选，只作为状态提示出现。
- 不可绑定项行为上仍然禁用，但 cursor/hover 反馈保持克制，不使用强烈的禁止态视觉。

### D6: Step 3 绑定菜单定位与 Step 2 一致

- 菜单继续从面板右侧弹出，不改变 X 轴弹出方向。
- 菜单的 Y 轴对齐对应 `station-item`。
- 当向下空间不足时，菜单改为向上弹出，并保持菜单底边与触发条目底边齐平。
- Step 3 菜单滚动条风格与 Step 2 绑定菜单统一。

### D7: 导入 save station 时仅以 `module_id` 导入模块

- save parser 已为模块聚合结果补充 `module_id`。
- 从 Step 3 绑定菜单导入新建 empire station 时，只接受带 `module_id` 的模块并写入 `StationPlan.modules`。
- 不回退到 `ref`，避免导入宏 ID 而不是 station 规划侧需要的模块 ID。

### D8: 异常 binding 允许在 Step 3 内直接修复

- 若 save station 指向的 `stationBinding` 仍存在，但其 `stationId` 已无法解析到 empire station，则该 save station 进入异常态。
- 异常态按钮显示红色 `绑定异常`，仍可打开绑定菜单重新选择目标。
- 绑定菜单中额外插入一条“异常空间站”，提供 `x` 动作以清理这条坏 binding。
- 这里的“异常”只影响绑定按钮与菜单，不改变首页 active、Step 2 或其他 save station 的语义。

### D9: 异常导入/转绑必须先释放旧坏 binding

- 当 save station 当前处于异常绑定态时，从菜单执行“导入空间站”或重新绑定到其他 empire station，必须先释放该 `saveStationCode` 上残留的旧 binding。
- 释放旧 binding 时同步清理被替换 station 的 `sectorId` 引用，避免坏记录残留导致按钮仍保持异常态。
- 该规则与普通转绑保持一致：同一个 `saveStationCode` 在同一时刻只允许绑定一个目标。

### D10: 模块搜索面板与 Step 3 导入共享同一套默认排序规则

- `generateFilteredModulesGrouped()` 负责生成搜索面板结果，但不再作为 Step 3 导入排序的数据来源。
- 模块搜索面板默认顺序被抽取为共享 comparator：
  - 组排序使用同一套 type/group 优先级
  - 组内模块排序使用同一套 tier/name 规则
- 搜索面板和 Step 3 导入都调用这套共享 comparator，避免“导入靠拍平 UI 结果”带来的隐性漂移。

### D11: save parser 为 player station 与 buildstorage 保留顶层对象和 code 引用

- `save parser` 为 `player station` 和 `buildstorage` 都保留顶层对象输出。
- `PlayerStationEntry` 新增：
  - `component_id`
  - `cargo`
  - `reservation`
  - `buildstorage_code`
- `BuildStorageEntry` 新增：
  - `station_code`
- `cargo` 表示 station 自己 storage module 的 `cargo/ware` 聚合。
- `reservation` 表示 station 自己 `trade/reservations/reservation/@amount` 的按 `ware` 聚合。
- `player station` 与 `buildstorage` 只通过 `code` 互相引用，不做对象嵌套，也不与 station 自己的 `cargo` / `reservation` 混合。

### D12: buildstorage 只解析 inprogress，不解析 queue

- `buildstorage` 关联 station 只使用：
  - `buildstorage/buildtasks/inprogress/build/@component = station/@id`
- 不使用 `station/listeners/listener[@event="killed"]` 作为 fallback 关联。
- 不解析 `buildstorage/buildtasks/queue/build`。
- 命中关联时：
  - `playerStation.buildstorage_code = buildstorage.code`
  - `buildstorage.station_code = playerStation.code`
- 未命中关联时，`buildstorage` 仍保留在 sector 顶层 `player_buildstorages` 中。

### D13: buildstorage 的 constructions 与 progress 分离

- `playerStation.constructions[]` 继续沿用现有结构，但新增：
  - `id`
- `buildstorage.constructions[]` 也使用同构结构：
  - `id`
  - `index`
  - `ref`
  - `predecessor`
- `buildstorage.progress` 不挂在 `constructions[]` 条目下，而是挂在 `buildstorage` 本体下。
- `buildstorage.progress` 来源固定为：
  - `buildstorage/connections/connection/component[@class="buildmodule"]/connections/connection/component[@class="buildprocessor"]/build`
- `buildstorage.progress` 仅保留：
  - `start`
  - `end`
  - `sequenceindex`

### D14: 输出 id 去掉外层中括号

- parser 输出到 JSON 的 `id`/`component_id`/`target_station_component_id` 等字段统一去掉外层 `[]`。
- 例如：
  - `[0x4646c]` -> `0x4646c`
  - `[0x1f5e]` -> `0x1f5e`

### D15: parser 输出字段命名收敛到简洁名词

- `SaveArchive` / `SectorData` 协议层统一使用 `snake_case`。
- `SectorData` 下按 `code` 唯一的实体集合统一改为 map：
  - `player_stations`
  - `npc_stations`
  - `xenon_stations`
  - `khaak_stations`
  - `player_buildstorages`
  - `datavaults`
  - `erlking_vaults`
  - `abandoned_ships`
- 这些集合的 JSON 结构为 `Record<code, entry>`，不再使用数组。

- `playerStation.cargo`
  - station storage cargo 聚合
- `playerStation.reservation`
  - station reservation 聚合
- `playerStation.buildstorage_code`
  - 关联的 buildstorage code 引用
- `buildstorage.cargo`
  - buildstorage cargo 聚合
- `buildstorage.reservation`
  - buildstorage reservation 聚合
- `buildstorage.constructions`
  - buildstorage `inprogress build/sequence/entry`
- `buildstorage.progress`
  - buildstorage 当前建造进度
- `buildstorage.station_code`
  - 关联的 station code 引用

### D16: parser 结构草案

```ts
interface WareAmount {
  ware: string
  amount: number
}

interface PlayerStationConstruction {
  id?: string
  index: number
  ref: string
  predecessor?: number
  equipments?: StationEquipment[]
}

interface AggregatedStationModule {
  ref: string
  amount: number
  module_id?: string
  type?: string
  group?: string
}

interface AggregatedEquipment {
  type: 'shields' | 'turrets'
  ref: string
  amount: number
  equipment_id?: string
}

interface BuildProgress {
  start?: number
  end?: number
  sequenceindex?: number
}

interface BuildStorageEntry {
  component_id: string
  code: string
  owner: string
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  cargo?: WareAmount[]
  reservation?: WareAmount[]
  station_code?: string
  target_station_component_id?: string
  constructions?: PlayerStationConstruction[]
  modules?: Record<string, AggregatedStationModule>
  equipments?: Record<string, AggregatedEquipment>
  progress?: BuildProgress
}

interface PlayerStationEntry extends StationBaseEntry {
  component_id?: string
  cargo?: WareAmount[]
  reservation?: WareAmount[]
  buildstorage_code?: string
  modules?: Record<string, AggregatedStationModule>
  equipments?: Record<string, AggregatedEquipment>
}

interface SectorData {
  player_stations?: Record<string, PlayerStationEntry>
  npc_stations?: Record<string, NpcStationEntry>
  xenon_stations?: Record<string, FactionStationEntry>
  khaak_stations?: Record<string, FactionStationEntry>
  player_buildstorages?: Record<string, BuildStorageEntry>
  datavaults?: Record<string, DatavaultEntry>
  erlking_vaults?: Record<string, DatavaultEntry>
  abandoned_ships?: Record<string, AbandonedShipEntry>
}
```

### D17: module / equipment 聚合统一改为以 ref 为 key 的 map

- `player_stations` / `npc_stations` / `xenon_stations` / `khaak_stations` 的：
  - `modules`
  - `equipments`
  统一改为 `Record<ref, entry>`
- `player_buildstorages` 也新增：
  - `modules`
  - `equipments`
  同样使用 `Record<ref, entry>`
- `player_buildstorages[*].constructions[*]` 与 `player_stations[*].constructions[*]` 使用同构结构，因此也保留：
  - `equipments`

### D18: module_id / equipment_id 在 post 中 enrich

- Rust parser 只输出原始聚合：
  - `modules[ref].ref/amount`
  - `equipments[ref].ref/amount/type`
  - `constructions[*].equipments[*].ref/type/group/exact`
- `postProcessRustSaveArchive()` 负责 enrich：
  - `modules[*].module_id`
  - `modules[*].type`
  - `modules[*].group`
  - `equipments[*].equipment_id`
- `constructions[*].equipments[*]` 保持 parser 原样，不在 post 中 enrich

## 任务映射来源

- 主要来自旧 `station-binding` change 的 1-24 号任务
- 其中首页 Step 1 入口相关部分，保留在本 change 中作为 binding 首页入口能力
