# station-binding 设计说明

## 设计目标

在不污染现有 `EmpirePlan` / `StationPlan` 本体的前提下，引入独立的 `SaveBinding` 关系层，并用它替换原地图上的 empire station 弹出放置工作流，使地图工作台能够完成：

- empire 绑定某个 `gameGuid`
- 在该 binding 视角下，为 `sectorGroup` 绑定 save `tradestation`
- 基于 hub binding 计算 `N` 跳 coverage
- 将 coverage 内 save 玩家空间站绑定到已有 empire station
- 或直接导入为新的 empire station
- 或将空闲 empire station 直接拖拽到地图上并仅在 binding 里保存位置
- 在同一 `gameGuid` 的不同 `archiveTime` 间切换视角，并提示当前 time 下的 binding 失效

## 1. 架构分层

### 1.1 基础事实层

- `useEmpireStore`
  - 保存 `sectorGroup`、group 内 station、hub station
  - 提供新建 empire station 的能力
- `useSaveStore`
  - 提供按 `gameGuid + time` 读取 archive、save `tradestation`、玩家空间站 POI 与查找能力
- `useMapStore`
  - 提供 sector 邯接图、sector 定位与跳数搜索能力
- `useEmpireStore`
  - 在 `EmpirePlan.saveBindings[]` 中保存 `SaveBindingPlan`
  - 负责 `gameGuid` 唯一键下的 binding 持久化（每个 empire 可有多个 gameGuid binding）
  - 通过 `active: boolean` 标识当前激活的 binding

### 1.2 派生查询层

新增 binding selector/composable，例如 `useMapBindingViewModel`，负责：

- 当前 empire 的 `SaveBindingPlan` 列表与当前激活 binding
- 当前 binding 视角对应的 `selectedArchiveTime`
- “用户所在空间站所属星区”列表
- 某个选中 save 星区在指定跳数下的过滤星区列表、空间站列表与地图包围盒
- 当前 group binding 与 station binding
- save `tradestation` 候选列表
- `jumpRange` 对应的 `coverageSectorMacros`
- 当前 group 下各规划站的合法候选 save 玩家站
- coverage 内可直接导入的新站候选
- 当前帝国星区下的空闲 empire station 列表
- 当前 time 下的失效结果与非法原因

该层统一从 `empireStore + saveStore + mapStore` 派生，不允许页面组件自己分散拼接。

### 1.3 交互状态层

交互态保留在地图工作台本地，例如 `MapWorkbenchView`：

- `bindingMode: 'idle' | 'bind-hub' | 'bind-station'`
- `selectedBindingKey`
- `selectedSectorGroupId`
- `selectedSaveSectorMacro`
- `selectedJumpRange`
- `selectedStationId`
- `previewHubPoiKey`
- `previewCoverageSectorMacros`
- `previewStationPoiKey`
- `dragEnabledBindingSectorGroupId`

这类状态不进入持久化。

### 1.4 Binding POI 视觉与交互

- binding POI 的显示条件与拖拽条件分离：
  - 显示：当前 binding 视角存在对应 binding 数据时常驻显示，并受 save POI 的 `playerStation` 可见性设置控制
  - 拖拽：仅在该 POI 所属 `sectorGroup` 的 Step 3 上下文中开放
  - 点击：当当前 POI 不可拖拽时，点击进入与 save POI 相同的 tooltip 展示流程
- binding POI 的视觉语义与 save POI 对齐：
  - `owner` 固定按 `player` 处理
  - 普通 binding station 的 `tag/factoryGroup/productionProfile/profileName` 复用 `parser.post.ts` 中玩家 station 的分类逻辑
  - 虚拟中转站强制视为 `tradestation`
  - 图标大小、图标类型与大/小图标规则复用 save POI
  - 相比 save POI，仅额外增加一层虚线六边形外框
  - 虚线六边形外框需要贴合 save POI 本体六边形边框，不按图标包围盒估算
  - tooltip 标题使用用户可读名称：
    - 虚拟中转站显示对应 empire 星区名
    - 普通 binding station 显示空间站名

## 2. 数据模型

### 2.1 EmpirePlan 扩展

在现有 `EmpirePlan` 对象中新增 `saveBindings` 字段：

```ts
interface EmpirePlan {
  id: string
  name: string
  sectors?: SectorPlan[]
  sectorLinks?: string[]
  stations: StationPlan[]
  saveBindings?: SaveBindingPlan[]  // 新增
}
```

语义约束：
- 绑定数据直接挂在 `EmpirePlan` 下，而非独立的顶层状态
- 每个 empire 可有多个 `gameGuid` binding
- 通过 `active: boolean` 标识当前激活的 binding

### 2.2 SaveBindingPlan

```ts
interface SaveBindingPlan {
  gameGuid: string
  active: boolean  // 标识当前激活的 binding
  selectedArchiveTime: number | null
  groupBindings: GroupSaveBinding[]
}
```

语义约束：
- 以 `gameGuid` 为唯一键（不再需要 `key` 和 `empireId` 字段）
- `selectedArchiveTime` 只是当前查看快照，不参与唯一键
- 同一 empire 下可有多个 `gameGuid` binding，通过 `active` 标识当前使用的那个

### 2.3 Group Binding

```ts
interface GroupSaveBinding {
  sectorGroupId: string
  tradestationCode?: string  // 可选，绑定后才填充
  sectorMacro?: string       // 可选，绑定后才填充
  jumpRange: number          // 跳数范围：0-5
  coverageSectorMacros: string[]
  tradestationBinding?: StationSaveBinding  // 虚拟中转站位置绑定
  stationBindings: StationSaveBinding[]     // 该 group 下的 station 绑定数组
  free?: boolean                            // 标识该 group 是否由 free sector 拖拽产生
}
```

语义约束：
- 一个 `sectorGroup` 在同一个 `SaveBindingPlan` 内最多绑定一个 save `tradestation`
- `coverageSectorMacros` 是 group 级持久化快照
- `tradestationBinding` 用于存储虚拟中转站的地图位置
- `stationBindings` 嵌套在 group 内，而非顶层数组
- `free=true` 表示该 group 是由 free empire sector 拖拽到地图产生的，此时 `sectorMacro` 和 `tradestationBinding.position` 必填

### 2.4 Station Binding

```ts
interface StationSaveBinding {
  stationId: string
  saveStationCode?: string
  sectorMacro?: string
  position?: { x: number; y: number; z: number }
  free?: boolean
}
```

语义约束：
- 一个 empire station 在同一个 `GroupSaveBinding` 内最多绑定一个 save 玩家站
- 一个 save 玩家站在同一个 `GroupSaveBinding` 内最多绑定到一个 empire station
- 当 `saveStationCode` 为空且存在 `position` 时，表示该 empire station 作为空闲站被直接放置到地图上
- 当 `saveStationCode` 存在且目标在当前 time 下失效时，`position` 仍可单独用于地图显示
- `free=true` 表示该 station 是由 free empire station 拖拽到地图产生的，此时 `sectorMacro` 和 `position` 必填
- free station 只能放置在所属 group binding 的 `coverageSectorMacros` 范围内，落点外鼠标显示禁止符号

### 2.5 时间态解析结果

`missing / stale` 不写入持久化结构，而作为运行态派生结果：

```ts
interface ResolvedGroupSaveBinding extends GroupSaveBinding {
  status: 'ok' | 'missing_at_selected_time'
}

interface ResolvedStationSaveBinding extends StationSaveBinding {
  status: 'ok' | 'missing_at_selected_time'
}
```

这样切换 `selectedArchiveTime` 时，只变化解析结果，不改写 binding 本体。

## 3. Coverage 算法

### 3.1 输入

- 当前 `SaveBindingPlan` 下某个 `GroupSaveBinding` 的 `sectorMacro`
- 用户配置的 `jumpRange`
- 地图 store 提供的 sector 邻接图

### 3.2 输出

- `coverageSectorMacros: string[]`

### 3.3 算法原则

- 采用 sector 图上的 BFS / 最短跳数搜索
- 起点星区跳数为 `0`
- 满足 `distance <= jumpRange` 的 sector 全部计入 coverage
- 输出需去重并保持稳定顺序，便于 diff 与持久化
- `N` 跳拓扑定义与高级资源功能保持一致，复用同一套 cluster / sector 可达性规则

## 4. UI 组织

### 4.1 宿主位置

binding UI 放在 `MapWorkbenchView`，原因：

- 当前地图工作台已经同时具备规划 overlay 与 save POI
- binding 动作依赖地图空间上下文，不适合塞进普通表单弹窗
- 可以直接复用现有 map pan / focus / overlay / tooltip 基础能力

### 4.2 三段式布局

- 第一段：选择存档
  - 显示按 gameGuid 分组的存档列表
  - 每个分组显示玩家名称、存档数量
  - 点击分组标题进入，绑定到最新 time
  - 点击具体存档进入，绑定到对应 time
  - 已有绑定的存档显示"已绑定"标记
- 第二段：星区组管理
  - **列表结构**：
    - 上方：帝国星区列表（empire sectors）
    - 下方：存档星区列表（save sectors）
  - **帝国星区项**：
    - 显示名称
    - 未绑定：显示"绑定"按钮
    - 已绑定：显示"取消绑定"按钮 + 覆盖范围星区药丸
  - **绑定按钮弹出菜单**：
    - 组1：存档星区候选
      - 显示经过搜索框筛选且未绑定的存档星区
      - 超过 10 个时提示"请在搜索框中筛选存档星区"
    - 组2：地图可见星区候选
      - 显示地图上可见面积超过 50% 的星区
      - 超过 10 个时提示"请调整地图缩放以缩小候选范围"
  - **绑定后展开**：
    - 跳数选择器（0-5）
    - 覆盖范围星区：跳数范围内的 save 星区，显示为药丸，点击 x 移到备选
    - 备选覆盖星区：跳数范围内的其他星区，显示为药丸，点击 + 移到覆盖范围
    - 取消 | 确定 按钮
  - **存档星区项**：
    - 显示名称 + 空间站数量
    - 已绑定时显示药丸标签：`归属: <帝国星区名>`
    - 不再显示"已绑定"徽章
  - 支持搜索过滤存档星区
- 第三段：绑定空间站
  - **空间站状态判断（基于 binding 数据）**：
    - 自由空间站：无 `stationBinding`（未绑定、未放置）
    - 已放置未绑定：有 `stationBinding`，无 `saveStationCode`（已拖拽到地图，但未绑定 save station）
    - 已绑定：有 `stationBinding`，有 `saveStationCode`（已绑定 save station）
    - 虚拟补给站未放置：无 `tradestationBinding`
    - 虚拟补给站已放置：有 `tradestationBinding`，有 `position`，无 `tradestationCode`
    - 虚拟补给站已绑定：有 `tradestationBinding`，有 `position`，有 `tradestationCode`
  
  - **列表结构调整**：
    - 上方：自由空间站列表
      - 无 `stationBinding` 的 empire station
      - 无 `sectorId` 的 empire station（orphan，兼容性判断）
      - 未放置的虚拟补给站：无 `tradestationBinding`
    - 下方：定位星区和范围星区列表
      - 显示定位星区（`sectorMacro`）+ 覆盖星区（`coverageSectorMacros`）
      - 每个星区用药丸表示，点击药丸 focus 到对应星区
      - 即使星区没有 save 空间站，也显示星区药丸
      - 星区下显示空间站：save 玩家站 + 已放置的 free station + 已放置虚拟补给站（并排显示）
  
  - **Save Station 绑定对象**：
    - 可选条目：
      1. 本星区已放置但未绑定的空间站：有 `stationBinding` 但没有 `saveStationCode`
      2. 自由空间站：没有 `stationBinding`
      3. 已放置未绑定的虚拟补给站：有 `tradestationBinding` + `position`，无 `tradestationCode`
      4. 未放置的虚拟补给站：无 `tradestationBinding`
    - 绑定限制：
      - 虚拟补给站（3、4）只能被定位星区的 save station 绑定
      - 绑定对象不可以重叠：一个 save station 只能绑定一个对象，一个对象只能被一个 save station 绑定
  
  - **绑定/放置操作**：
    - Empire Station 绑定 save station：
      - 创建/更新 `stationBinding`（`saveStationCode` + `sectorMacro` + `position`）
      - 同时设置 `station.sectorId = sectorGroupId`（兼容性）
    - Empire Station 拖拽到地图：
      - 创建 `stationBinding`（`sectorMacro` + `position`）
      - 同时设置 `station.sectorId = sectorGroupId`（兼容性）
    - 虚拟补给站拖拽到地图：
      - 创建/更新 `tradestationBinding`（`sectorMacro` + `position`）
      - 限制：只能放置在定位星区（`anchorSectorMacro`）
    - 虚拟补给站绑定 save station：
      - 未放置：创建 `tradestationBinding`（`position` + `sectorMacro` + `tradestationCode`）
      - 已放置：设置 `tradestationCode`
  - **地图 POI 显示规则**：
    - 已存在的 binding station / 虚拟补给站 POI 在当前 binding 视角下常驻显示
    - 常驻显示受 save POI 的 `playerStation` 可见性设置控制
    - 图标语义、大小与颜色规则与 save POI 保持一致
    - 仅在所属 `sectorGroup` 的 Step 3 中可拖拽重定位
    - 在其他 stage 或其他 `sectorGroup` 上下文中仅显示，不响应拖拽
    - 在不可拖拽状态下，点击 POI 会打开与 save POI 同构的 tooltip
    - tooltip 标题使用 empire 星区名或空间站名，不显示内部 id
  
  - **取消/移除操作**：
    - Empire Station 取消绑定/移除：
      - 清除整个 `stationBinding`
      - 同时清空 `station.sectorId`
    - 虚拟补给站移除：
      - 清除整个 `tradestationBinding`
    - 虚拟补给站取消绑定：
      - 清除 `tradestationCode`（保留 `position`，回到已放置状态）
  
  - **空间站归属原则**：
    - 空间站的星区归属基于 `saveBindings` 数据，而非 `station.sectorId`
    - 只有在绑定 save station 或拖拽到地图时，空间站才归属于某个星区
    - `station.sectorId` 是为了兼容性考虑，绑定界面不以这个为准
  - 已有绑定列表（保持原样显示）

### 4.3 Draft 状态管理（编辑期隔离）

为避免编辑过程中污染 store 数据，引入 **Draft 状态层** 实现编辑期隔离：

#### Draft State 结构
```typescript
interface CoverageDraftEntry {
  ref: string    // sectorMacro
  jump: number   // 跳数距离
}

interface BindingDraftState {
  sectorGroupId: string | null      // 当前编辑的帝国星区
  anchorSectorMacro: string | null  // 定位星区（save sector）
  jumpRange: number                 // 跳数（默认：2）
  coverage: CoverageDraftEntry[]    // 覆盖星区列表（包含跳数信息）
}
```

#### 数据流设计
```
┌─────────────────────────────────────────────────────────────┐
│                      Draft 数据流                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│   │   Draft      │    │    Store     │    │  localStorage│ │
│   │  (临时编辑)   │    │  (实际数据)   │    │  (持久存储)  │ │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘ │
│          │                   │                   │          │
│          │  编辑操作          │                   │          │
│          │  (jumpRange,       │                   │          │
│          │   coverage)        │                   │          │
│          ▼                   │                   │          │
│   ┌──────────────┐           │                   │          │
│   │  确认保存     │───────────►│                   │          │
│   │  (bindSector │   写入      │                   │          │
│   │   Group)     │   store    │                   │          │
│   └──────────────┘           │                   │          │
│          │                   │                   │          │
│          │                   │  自动同步          │          │
│          │                   │──────────────────►│          │
│          │                   │                   │          │
│   ┌──────────────┐           │                   │          │
│   │  取消编辑     │           │                   │          │
│   │  (closeDraft)│           │                   │          │
│   └──────────────┘           │                   │          │
│          │                   │                   │          │
│          ▼                   │                   │          │
│   ┌──────────────┐           │                   │          │
│   │  丢弃草稿     │           │                   │          │
│   │  (不写入)     │           │                   │          │
│   └──────────────┘           │                   │          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 关键设计决策

1. **编辑期隔离**
   - 所有编辑操作只修改 `draft`，不修改 store
   - `empireStore.bindSectorGroup()` 只在确认时调用
   - `localStorage` 保存的是 store 数据，不包含 draft

2. **无备份机制**
   - 取消编辑直接丢弃 draft 数据
   - 不恢复到之前的状态（store 数据始终是最新确认的）

3. **初始化逻辑**
   - 点击"绑定"按钮 → 从 store 加载当前 binding 到 draft
   - 选择新星区 → 使用默认跳数(2)计算 coverage
   - 选择已绑定星区 → 继承之前的跳数和 coverage

4. **增量更新**
   - 跳数增加：添加新跳数范围内但不在旧范围内的星区
   - 跳数减少：移除超出新跳数范围的星区
   - 原有星区保持不变

5. **单编辑状态**
   - 同时只能有一个帝国星区处于编辑状态
   - 切换到另一星区时自动取消当前编辑

### 4.4 模式切换

#### Bind Hub Mode

- 用户先选中一个 `SaveBindingPlan`
- 再选中一个 `sectorGroup`
- 地图主打亮 save `tradestation` 候选
- 点击候选后，右侧 inspector 显示：
  - `stationCode`
  - 所在 sector
  - 当前 `jumpRange`
  - 预计 coverage
- 确认后写入 `GroupSaveBinding`

#### Bind Station Mode

- 用户先选中一个 `SaveBindingPlan`
- 再选中某个 save 星区，进入第三段
- 用户设置跳数
- 地图主打亮 `N` 跳以内且有玩家空间站的星区范围
- 用户再选中目标帝国星区
- 操作区提供：
  - 绑定到该帝国星区下的已有 empire station（导入按钮）
  - 将空闲 empire station 直接拖拽到地图

### 4.4 地图交互行为

- 进入第三段时：
  - 发出 `focus-sector` 事件将选中的星区居中显示
- 跳数变化时：
  - 重新计算覆盖范围内的星区（有玩家空间站的）
  - 发出 `fit-sectors` 事件缩放地图以显示所有这些星区
- 存档时间切换：
  - 使用 gameGuid 对应存档组的最新存档作为默认值
  - 切换时间点只影响解析结果，不影响 binding 身份
- 空闲站拖拽：
  - 从空闲站列表拖拽到地图时，位置写入 `StationSaveBinding.position`
  - 不修改 `EmpirePlan.location`
- 存档数据的 sectorMacro 与游戏数据的 sectorId 存在大小写差异：
  - 在 `buildSectorGraph` 中统一小写化处理

### 4.5 数据约束

- 一个 save 玩家站在同一 `SaveBindingPlan` 内只能绑定到一个 empire station（store 层强制）
- `bindStationToSaveStation()` 返回 boolean 表示是否成功
- 存档时间回退：`selectedArchiveTime === null` 时使用 gameGuid 对应存档组的最新存档
- `isSaveStationBound(sectorGroupId, saveStationCode)` 需要传入 `sectorGroupId` 参数，因为绑定是按 group 组织的
- `getStationCandidates` 收集所有 group 的 bound codes 进行去重判断
- `resolveGroupSaveBinding` 增强校验：`sectorMacro` 和 `tradestationCode` 缺失时返回 `missing_at_selected_time`
- `isTradestation` 判断改为严格 `=== true`

### 4.6 Free Sector/Station 拖拽行为

#### Free Sector 拖拽
- free empire sector 可拖拽到地图任意位置
- drop 后创建 `GroupSaveBinding`，设置 `sectorMacro`、`tradestationBinding.position`、`free=true`
- 列表中仍显示该 free sector，但显示星区 tag（从 `sectorMacro` 解析）和清除按钮（x）
- 点击 x 清除整个 `groupBinding`，该 sector 从 free 列表消失

#### Free Station 拖拽
- free empire station 只能拖拽到所属 group binding 的 `coverageSectorMacros` 范围内
- 鼠标在范围外时显示 `cursor: not-allowed` 禁止符号
- drop 后在 `stationBindings` 中新增/更新 `StationSaveBinding`，设置 `sectorMacro`、`position`、`free=true`
- 列表中仍显示该 free station，但显示星区 tag 和清除按钮（x）
- 点击 x 清除该 `stationBinding`，该 station 从 free 列表消失

#### 地图 POI 显示
- 已放置的 free sector/station 通过 `sectorMacro` + `position` 在地图上显示 POI
- 复用现有 `MapOverlayLayer` 渲染链路，从 `saveBindings` 构建 `bindingOverlays`

## 5. Store Action 设计

### 5.1 EmpireStore 中的 SaveBindings Action

`useEmpireStore` 需要提供明确命令式 action（均以 `gameGuid` 为标识符）：

- `createBinding(gameGuid)` - 创建新的 SaveBindingPlan
- `getBindingByGameGuid(gameGuid)` - 获取指定 gameGuid 的 binding
- `getActiveBinding()` - 获取当前激活的 binding
- `setActiveBinding(gameGuid)` - 设置当前激活的 binding
- `setSelectedArchiveTime(gameGuid, archiveTime)` - 切换存档时间视角
- `bindSectorGroup(input)` - 绑定星区组（设置 sectorMacro、jumpRange、coverageSectorMacros）
- `updateSectorGroupJumpRange(gameGuid, sectorGroupId, jumpRange)` - 更新跳数范围
- `clearSectorGroupBinding(gameGuid, sectorGroupId)` - 清除整个 group binding
- `getGroupBinding(gameGuid, sectorGroupId)` - 获取指定 group binding
- `setTradestationBinding(input)` - 设置中转站绑定（saveStationCode）
- `clearTradestationBinding(gameGuid, sectorGroupId)` - 清除中转站绑定
- `bindStationToSaveStation(input)` - 绑定 empire station 到 save 玩家站
- `clearStationBinding(gameGuid, sectorGroupId, stationId)` - 清除 station 绑定
- `setStationBindingPosition(gameGuid, sectorGroupId, stationId, position)` - 设置 station 的地图位置
- `setFreeSectorBinding(input)` - 设置 free sector 绑定（sectorMacro、position、free=true）
- `setFreeStationBinding(input)` - 设置 free station 绑定（sectorMacro、position、free=true）
- `isSaveStationAlreadyBound(gameGuid, sectorGroupId, saveStationCode)` - 检查 save 站是否已绑定
- `importSaveStationAsBinding(input)` - 导入 save 站为 binding
- `deleteBinding(gameGuid)` - 删除整个 binding plan

同时继续负责：

- `createStation(...)`
- 将从 save 导入的 station 变成独立 empire station 本体

### 5.3 直接导入新站

从 save 导入新站的流程：

1. 用户在某个 `SaveBindingPlan` 视角下选中 coverage 内的 save 玩家站
2. inspector 点击"导入为新站"
3. `empireStore.createStation(...)` 创建新的 empire station
4. `empireStore.bindStationToSaveStation(...)` 在对应的 `GroupSaveBinding.stationBindings[]` 中新增一条 `StationSaveBinding`
5. 若用户随后在地图上调整位置，位置写入 `StationSaveBinding.position`

这里不需要额外导入记录表，因为后续关系仍然只通过 `StationSaveBinding` 表达。

### 5.4 空闲站直接放置

空闲 empire station 直接拖拽到地图的流程：

1. 用户在第二段中选择目标帝国星区
2. 在底部空闲 station 列表中拖拽某个 empire station 到地图
3. 地图按小空间站尺寸显示该 station
4. `empireStore.setStationBindingPosition(...)` 在对应的 `GroupSaveBinding.stationBindings[]` 中新增/更新 `StationSaveBinding` 的 `position`
5. 该位置只存在于 binding 中，不写入 `EmpirePlan`

### 5.5 Free Sector 拖拽放置

free empire sector 拖拽到地图的流程：

1. 用户在第二段中拖拽某个 free empire sector 到地图
2. 地图按中转站图标尺寸显示该 sector
3. `empireStore.setTradestationBinding(...)` 创建/更新 `GroupSaveBinding`，设置 `sectorMacro`、`tradestationBinding.position`、`free=true`
4. 该位置只存在于 binding 中，不写入 `SectorPlan`

### 5.6 Free Station 落点限制

free empire station 拖拽时的落点限制：

1. 检查鼠标位置对应的 `sectorMacro` 是否在 `coverageSectorMacros` 范围内
2. 不在范围内时，鼠标显示 `cursor: not-allowed` 禁止符号
3. drop 时如果不在范围内，拒绝放置

## 6. 数据流

### 6.1 单向流

1. 用户选择当前 `SaveBindingPlan`
2. 用户从第二段选择某个 save 星区，进入第三段
3. **绑定星区**：用户将 save 星区绑定到帝国星区（选择现有或新建）
4. 用户设置跳数
5. selector 计算过滤星区、空间站列表与地图包围盒
6. 地图自动缩放到过滤范围
7. **绑定空间站**（任选顺序）：
   - 绑定 save 玩家站到已有 empire station
     - 点击"Bind"按钮弹出选择框
     - 从 idle stations 下拉列表中选择目标 empire station
     - 确认后调用 `bindStationToSaveStation` 写入绑定
   - 导入 save 玩家站为新 empire station
     - 点击"Import"按钮直接创建新站并写入 binding
   - 绑定 empire station 到 save tradestation
8. `empireStore` action 写入 group / station binding
9. selector 自动重算候选、地图显示与当前 time 下的解析状态

### 6.2 关键约束

- 地图不是业务真相来源，只是选择器
- inspector 不直接持久化对象快照
- `selectedArchiveTime` 的切换只影响解析结果，不影响 binding 身份
- 当前 time 下找不到对象时，只提示失效，不自动删关系
- empire station 的地图位置真相在 binding 中，而不在 `EmpirePlan`

## 7. 风险与对策

### 7.1 风险：binding 与单个 empire plan 本体耦合

- 对策：将 binding 放在 `EmpirePlan.saveBindings[]` 中，绑定数据自然归属对应 empire
- 好处：避免跨 empire 的 binding 管理，简化数据迁移与删除逻辑

### 7.2 风险：archive time 被误当作 binding 身份

- 对策：明确以 `gameGuid` 为唯一键（不需要复合键）
- `selectedArchiveTime` 只作视角字段，严禁参与唯一键
- 通过 `active: boolean` 标识当前激活的 binding

### 7.3 风险：导入新站后又需要追踪来源

- 对策：不加额外导入记录表；只要导入后立即建立 `StationSaveBinding`，后续关系就已足够表达

### 7.4 风险：当前 time 缺失对象导致用户误以为关系丢失

- 对策：UI 明确显示“当前 time 下失效”
- 严禁在 archive 中找不到对象时自动解绑

### 7.5 风险：coverage 计算与高级资源的跳数口径不一致

- 对策：直接复用高级资源功能已有的 `N` 跳拓扑定义与实现口径，避免出现两套 sector 可达性语义

### 7.6 风险：saveBindings 在迁移时被丢弃

- 对策：`normalizeEmpireStateShape` 必须保留 `saveBindings` 字段
- `migrateEmpireStateToCurrent` 链路中不能丢失 binding 数据
- 用户点击 Save 时 `saveEmpire()` 会序列化整个 `activeEmpire`（包含 `saveBindings`）到 localStorage
