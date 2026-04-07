# station-binding Change Request

## 目标

为现有生产规划补充一套独立于 `EmpirePlan` 本体的 `SaveBinding` 关系层，用于将某个 empire 与某个游戏存档槽位（`gameGuid`）关联，并在地图工作台中提供带地图参考的 binding 工作流。绑定完成后，系统需要基于 save `tradestation` 推导 `sectorGroup` 的 `N` 跳管辖星区，允许在不同 save 时间点之间切换观察同一套 binding，并支持将 coverage 内的 save 玩家空间站直接导入为 empire 的新 station。

## 已确认方案（审核重点）

### 1. 绑定层定位

- binding 作为附加关系层，而不是 `EmpirePlan` / `StationPlan` / `sectorGroup` 的本体属性。
- `SaveBinding` 保存在 `x4_empire_data` 的根对象中，作为 `SavedEmpiresState.savePlans` 顶层同级字段存在，但不写入单个 `EmpirePlan` 本体。
- 规划本体继续只保存规划数据；save 关系、当前 save 视角与失效提示全部放在独立 binding 层处理。

### 2. SaveBinding 唯一键与时间视角

- 单个 binding 的稳定唯一键为 `empireId + gameGuid`。
- `archiveTime` 不属于 binding 身份，只代表当前选择查看的 save 快照。
- 同一 empire 可以绑定多个 `gameGuid`。
- 同一个 `gameGuid` 也可以被多个 empire 复用，各自拥有独立 binding 计划。
- 上传同一 `gameGuid` 的新存档后，用户可以切换到新的 `archiveTime`，binding 关系保持不变。

### 3. 绑定关系结构

- `SaveBindingPlan` 至少需要包含：
  - `empireId`
  - `gameGuid`
  - `selectedArchiveTime`
  - `groupBindings`
  - `stationBindings`
- `groupBindings` 用于描述：
  - 哪个 `sectorGroup`
  - 绑定到哪个 save `tradestation`
  - `jumpRange`
  - `coverageSectorMacros`
- `stationBindings` 用于描述：
  - 哪个 empire station
  - 绑定到哪个 save 玩家空间站
  - 以及该 station 在 binding 视角下的 `position: { x, y, z }`

### 4. coverage 规则

- `coverage` 以某个 `groupBinding` 绑定的 save `tradestation` 所在星区为起点。
- 系统按地图拓扑上的 `N` 跳计算 `coverageSectorMacros`，跳数来源于该 group binding 的 `jumpRange`。
- `N` 跳拓扑定义与高级资源功能保持一致，复用其可达性语义与边界规则。
- `coverage` 是 `sectorGroup` 的派生辖区，不等同于单个游戏 sector。
- 默认不允许同一个 save sector 同时被多个 `sectorGroup` 声明为自动 coverage；若后续要支持共享辖区，另开变更。

### 5. 站点绑定与直接导入

- 只有位于当前 `sectorGroup.coverageSectorMacros` 内的 save 玩家空间站，才允许参与当前 group 的操作。
- coverage 内的 save 玩家空间站有两条入口：
  - 绑定到已有的 empire station
  - 直接导入为 empire 的新 station
- “直接导入为新 station”不依赖先创建 empire station。
- 导入完成后，新 station 作为独立 empire station 存在；若需要和 save 保持关系，关系仍然只通过 `stationBindings` 表达。
- 某个 empire station 在该 binding 视角下只能处于以下三种状态之一：
  - 绑定到某个 save 玩家空间站
  - 未绑定 save 站，但作为空闲 empire station 被直接拖拽放到地图上
  - 完全未绑定、未放置
- 无论是绑定 save 站，还是空闲 station 直接拖拽到地图上，都要把 `position: { x, y, z }` 保存到 binding 数据中。
- 这样当某个 save 站在当前 `archiveTime` 下失效时，绑定的地图坐标仍然可以单独生效。

### 6. 当前 time 下的失效语义

- binding 本体只保存稳定关系，不保存 `missing/stale` 这类时间态状态。
- 当用户切换到同一 `gameGuid` 的不同 `archiveTime` 时，系统只重新解析当前 time 下的 binding 结果。
- 若当前 time 下找不到某个已绑定的 `tradestation` 或 save 玩家站：
  - binding 关系本身不变
  - UI 仅提示“该 time 下绑定失效”
- 不允许因为当前 time 缺失对象而自动删除 binding。

### 7. 物流语义

- save `tradestation` 作为 `sectorGroup` 的地图锚点与物流中心来源，用于推导 coverage。
- 普通规划站默认只参与组内物流，不直接承担跨 group 干线运输。
- 组间物流继续保留为 hub-to-hub 语义，本次先明确绑定与 coverage 规则，不展开完整求解重构。

### 8. UI 入口与地图工作流

- binding 界面需要地图参考，应放在 `MapWorkbenchView` 所在地图工作台内，而不是普通表单弹窗。
- binding 界面直接替换地图上原先“帝国空间站弹出界面”；不再单独支持 empire station 的独立拖拽工作流。
- UI 组织采用“两段式”：
  - 第一段：列出“存档中用户所在空间站所属的所有星区”列表
  - 第二段：进入某个星区后，选择跳数并查看该星区 `N` 跳以内的星区与空间站列表
- 进入第二段后，地图需要自动缩放/平移到“能容纳所有过滤星区的最大范围”。
- 在第二段中，用户选择目标帝国星区后，系统给出：
  - 可绑定的帝国空间站列表
  - 可直接导入的新 station 操作
  - 帝国星区中转绑定操作
  - 底部“空闲帝国空间站”列表，可直接拖拽到地图上
- 底部空闲 empire station 拖拽到地图后，显示大小与小空间站一致，其位置只保存到 binding 数据，不写入 `EmpirePlan`。
- binding 产生的地图 POI 在视觉上需要与 save POI 使用同一套类型、owner 与尺寸语义：
  - 普通 binding station 的类型判定复用 `parser.post.ts` 中玩家 station 的分类逻辑
  - `owner` 固定视为 `player`
  - 虚拟中转站按 `tradestation` 类型处理
  - binding POI 与 save POI 的唯一区别是额外增加一层虚线六边形外框
- binding POI 需要像 save POI 一样常驻显示，不依赖当前是否正在执行拖拽。
- binding POI 的常驻显示受 save POI 的 `playerStation` 可见性设置控制。
- 但 binding POI 只有在其所属 `sectorGroup` 的 Step 3 上下文内才允许拖拽；在其他上下文中仅显示，不可拖动。

### 9. 数据流组织

- 基础事实层：
  - `saveStore` 提供 archive、save POI、候选实体
  - `mapStore` 提供地图拓扑、sector 邻接、跳数搜索、定位能力
  - `empireStore` 提供 `sectorGroup`、group 内 stations、station 新建能力，以及 `SavedEmpiresState.savePlans` 的读写
- 派生查询层：
  - 新增 binding selector/composable，统一拼接当前 binding 视角、用户所在星区列表、过滤后的 `N` 跳星区/空间站、候选 empire station 与非法原因
- 交互状态层：
  - `MapWorkbenchView` 本地维护当前选中的 `bindingKey`、save 星区、跳数、目标帝国星区、stationId、hover/preview 状态
- 持久化命令层：
  - 通过显式 action 执行 group binding、station binding、station import、station position 更新与 archive time 切换

## 边界

### In Scope

- 独立 `SaveBinding` 持久化层
- `empireId + gameGuid` 唯一键规则
- 基于 save `tradestation` 的 `N` 跳 coverage 推导
- 规划站与 save 玩家空间站的绑定
- coverage 内 save 玩家空间站直接导入 empire 新 station
- 同一 `gameGuid` 下不同 `archiveTime` 之间的视角切换
- 当前 time 下 binding 失效提示

### Out of Scope

- NPC 站与规划站的自动绑定
- 仅凭坐标自动静默绑定
- 组间物流求解公式的完整重构
- 共享 coverage / 多 hub 联合管辖
- 测试代码与测试运行细节

## 验收标准（DoD）

1. 系统在 `SavedEmpiresState` 根对象下存在 `savePlans` 顶层字段，并以 `empireId + gameGuid` 作为单个 binding 的唯一键
2. 用户可以在同一 empire 下创建多个 save binding 视角，并在这些视角间切换
3. 用户进入某个 save 星区后，可以设置跳数并得到该星区 `N` 跳以内的星区与空间站列表
4. 地图会自动缩放/平移到能显示所有过滤星区的最大范围
5. 用户可以在同一 `gameGuid` 下切换不同 `archiveTime`，binding 关系保持不变
6. 当前 `archiveTime` 下若找不到已绑定的 `tradestation` 或 save 玩家站，系统会提示“该 time 下绑定失效”，但不会删除 binding
7. 用户可以将过滤范围内的 save 玩家空间站绑定到已有 empire station，或直接导入为新的 empire station
8. 用户可以把空闲 empire station 直接拖拽到地图上，位置写入 binding 数据而不是 `EmpirePlan`
9. 对于已绑定或已放置的 empire station，系统会把 `position: { x, y, z }` 保存在 binding 数据中，使绑定失效后坐标仍可单独生效
10. binding POI 的图标类型、owner 与尺寸语义与 save POI 保持一致，仅额外显示虚线六边形外框
11. binding POI 常驻显示，但显示受 `playerStation` 可见性设置控制，且仅在对应 `sectorGroup` 的 Step 3 上下文中可拖拽

## 未决项

无
