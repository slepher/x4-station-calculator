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
- binding 面板标题采用与存档面板一致的面包屑结构，三级分别对应：
  - Step 1：存档选择
  - Step 2：玩家名
  - Step 3：empire sector 名
- UI 组织采用“两段式”：
  - 第一段：列出“存档中用户所在空间站所属的所有星区”列表
  - 第二段：进入某个星区后，选择跳数并查看该星区 `N` 跳以内的星区与空间站列表
- Step 1 中普通点击某个 `time` 条目，只表示进入该 `time` 的查看状态：
  - 立即将地图 POI 切换到该 `time` 对应的存档内容
  - 将该 `time` 条目标记为当前高亮
  - 不修改 binding
  - 不自动进入 Step 2
- Step 1 中 `title` 与具体 `time` 条目都存在 hover 出现的“绑定”按钮：
  - 点击 `title` 的按钮：表示将当前 guid 绑定到最新 `time`
  - 点击具体 `time` 的按钮：表示将当前 guid 绑定到该 `time`
  - 若该 guid 还没有 binding，则首次点击时创建 binding
  - 点击任一绑定按钮后，立即进入 Step 2，开始编辑 binding
- Step 1 的“查看状态”只在后续进入 Step 2 / Step 3 时生效；若停留在 Step 1 或关闭 binding 面板，则视为退出查看状态。
- 一旦退出查看状态，地图 POI 与后续解析基线立刻恢复为最近一次绑定操作对应的 `time`。
- Step 1 中 `已绑定` tag 不改变现有样式结构，只区分实边与虚边：
  - 若绑定到最新 `time`：`title` 显示实边 `已绑定`，最新 `time` 显示虚边 `已绑定`
  - 若绑定到具体 `time`：该 `time` 显示实边 `已绑定`，`title` 显示虚边 `已绑定`
- 进入第二段后，地图需要自动缩放/平移到“能容纳所有过滤星区的最大范围”。
- 在第二段中，用户选择目标帝国星区后，系统给出：
  - 可绑定的帝国空间站列表
  - 可直接导入的新 station 操作
  - 帝国星区中转绑定操作
  - 底部“空闲帝国空间站”列表，可直接拖拽到地图上
- Step 2 中下方存档星区列表只作为参考与筛选信息，不再承担进入某个帝国星区 Step 3 的职责。
- Step 2 中进入 Step 3 的责任收敛到上方 empire sector 条目；收缩态下每个 empire sector 条目存在四类交互点：
  - 拖拽手柄：仅用于调整星区顺序
  - Step 3 按钮：直接进入该 empire sector 的 Step 3
  - 定位星区药丸：点击后在地图上定位到该 empire sector 当前绑定的定位星区
  - 绑定按钮：进入该 empire sector 的展开编辑态
- Step 2 中 empire sector 标题/主体区域本身不承担点击展开、进入 Step 3 或地图定位的职责。
- Step 2 一旦存在展开态星区，就进入单星区编辑模式：
  - 所有 empire sector 的拖拽排序手柄失效
  - 所有 Step 3 按钮失效
  - 只能编辑当前展开的单个星区，并通过“确定 / 取消”退出展开态
- Step 2 的“创建星区”按钮和星区顺序调整属于收缩态列表层能力，不属于展开态的单星区编辑能力。
- Step 2 中“创建星区”不会立即创建实体 empire sector；点击后直接进入一个新建中的 draft 编辑态，只有点击“确认”时才真正创建 sector 与对应 binding。
- Step 2 展开编辑态只负责当前星区的单体数据编辑，包括：
  - 修改星区名字
  - 修改定位星区
  - 修改跳数与 coverage
  - 修改连接星区
- Step 2 收缩态布局进一步收敛为：
  - 标题区只保留星区名称与“编辑”按钮
  - 标题区不再重复显示定位星区药丸
  - “编辑”按钮不再带 `>`，仅表示进入展开编辑态
  - 定位星区药丸与 Step 3 按钮放到正文的同一行显示
  - 收缩态中的连接星区结果并入按跳数分组的正文结果中，不再单独显示“连接星区”字样
  - 同一跳数下，普通 coverage 星区药丸与已连接星区药丸混排显示；连接星区药丸颜色与展开编辑态保持一致
- Step 2 展开编辑态新增“连接星区”区块：
  - 基于当前 empire sector 的定位星区，自动搜集 5 跳以内的其他 empire sector
  - 仅统计已绑定定位星区的其他 empire sector；未绑定定位星区的不参与连接候选计算
  - 按跳数分组显示连接候选
  - 绿色药丸表示已连接，显示 `x` 用于取消连接
  - 红色药丸表示未连接，显示 `+` 用于建立连接
  - 连接关系是双向的；若 `A <-> B` 已连接，则 A 和 B 的展开编辑态中都要将对方显示为已连接
  - 连接星区的语义沿用帝国连接星区概念，但数据保存到 `saveBinding.groupBinding` 中，而不是旧的帝国连接字段
- Step 2 展开编辑态布局进一步收敛为：
  - 标题行左侧直接用名称输入框替换静态星区名称
  - 标题行右侧放置 `绑定星区>` 按钮，作为唯一的定位星区菜单入口
  - “定位星区”段落标题保持当前字体样式不变
  - “定位星区”段落内容改为一行展示：左侧是定位星区药丸，右侧是跳数控件
  - 因跳数控件已与定位星区同列展示，不再显示“跳跃范围 / Jump Range”描述文字
  - 底部统一放置“删除 / 取消 / 确认”操作区；已有星区显示红色删除按钮，新建中的 draft 不显示删除按钮
- Step 2 展开编辑态中的“绑定星区”菜单规则收敛为：
  - 同时高亮 store 中当前已绑定的定位星区与 draft 中当前选中的定位星区
  - draft 中当前定位星区不可点击，但 hover 样式不需要显式改成禁用态
  - 菜单中不再提供取消绑定的 `x`
- Step 2 展开编辑态中的连接星区药丸文本调整为 `<empire sector>:<map sector>`，同时表达连接对象的 empire 名称与其定位星区。
- Step 2 中 empire sector 下属的 map 星区药丸之间需要保留适当间距，避免当前紧贴显示。
- Step 2 中下方存档星区列表不再显示坐标点数量，而改为显示星区数量类汇总。
- Step 2 中下方存档星区列表里的空间站信息不再显示 `code`，而改为显示与 tooltip 一致的空间站名称；同名空间站需要聚合展示，数量大于 1 时显示 `xN`。
- Step 2 中删除已有 empire sector 时，删除行为需要同时：
  - 删除该 sector 对应的 `groupBinding`
  - 清理与其他 empire sector 的双向连接关系
  - 删除该 empire sector 本身
  - 清理所有 empire station 对该 sector 的引用，避免留下悬空关联
- 底部空闲 empire station 拖拽到地图后，显示大小与小空间站一致，其位置只保存到 binding 数据，不写入 `EmpirePlan`。
- Step 3 继续以 `map sector` 作为分组轴，不改成按 station 状态分组。
- Step 3 的主显示对象是 save 玩家站；每个 sector 下始终先显示 save station 列表，并继续使用现有“绑定”按钮作为唯一主入口，不额外增加复杂绑定摘要区。
- Step 3 中正常绑定且当前 `archiveTime` 下可解析的 empire station，不再作为独立列表项重复显示；它们只通过对应 save station 的绑定按钮/菜单语义体现。
- Step 3 中只有两类 empire station 允许作为 save station 之外的独立列表项补充显示：
  - 有 `position`、无 `saveStationCode` 的 empire station
  - 有 `position`、有 `saveStationCode`，但当前 `archiveTime` 下目标失效的 empire station
- 对于有 `position`、无 `saveStationCode` 的 empire station，列表项需要显示空间站名称以及 `x,z` 坐标，并使用区别于普通 save station 的背景色。
- 对于有 `position`、有 `saveStationCode` 且当前 time 失效的 empire station，列表项只提供“解绑”动作，不允许拖拽重定位，也不允许作为其他 save station 的候选绑定对象。
- save station 的绑定菜单中，候选对象分为三类：
  - 自由 empire station：可点击绑定
  - 有 `position`、无 `saveStationCode` 的 empire station：可点击绑定，并使用不同背景色标识“已放置未绑定”
  - 已绑定到其他 save station 的 empire station：无论当前 `saveStationCode` 是否失效，都必须置灰且不可点击
- 当 save station 绑定到“有 `position`、无 `saveStationCode`”的 empire station 时：
  - 使用 save station 的位置覆盖该 empire station 原有 `position`
  - 写入 `saveStationCode`
  - 该 empire station 从 Step 3 的独立异常/补位列表中移除
  - 地图上的独立 binding POI 同步移除，只保留与 save station 关系对应的呈现
- binding 产生的地图 POI 在视觉上需要与 save POI 使用同一套类型、owner 与尺寸语义：
  - 普通 binding station 的类型判定复用 `parser.post.ts` 中玩家 station 的分类逻辑
  - `owner` 固定视为 `player`
  - 虚拟中转站按 `tradestation` 类型处理
  - binding POI 与 save POI 的唯一区别是额外增加一层虚线六边形外框
  - 虚拟中转站标题显示对应的 empire 星区名，普通 binding station 标题显示空间站名，不显示内部 id
- binding POI 需要像 save POI 一样常驻显示，不依赖当前是否正在执行拖拽。
- binding POI 的常驻显示受 save POI 的 `playerStation` 可见性设置控制。
- 但 binding POI 只有在其所属 `sectorGroup` 的 Step 3 上下文内才允许拖拽；在其他上下文中仅显示，不可拖动。
- 非可拖动状态下，点击 binding POI 仍需要像 save POI 一样弹出 tooltip。

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
12. 非可拖动状态下点击 binding POI 会弹出和 save POI 同构的 tooltip
13. binding POI 的标题使用 empire 星区名或空间站名，不显示内部 id
14. Step 3 中正常绑定且当前 time 可解析的 empire station 不会作为独立列表项重复出现，只通过对应 save station 的绑定按钮/菜单体现
15. Step 3 中有 `position`、无 `saveStationCode` 的 empire station 会以独立补位项显示空间站名称与 `x,z` 坐标，并可作为 save station 绑定菜单候选
16. Step 3 中有 `position`、有 `saveStationCode` 且当前 time 失效的 empire station 只显示失效状态与解绑入口，不允许拖拽重定位
17. save station 的绑定菜单会将已绑定到其他 save station 的 empire station 置灰且不可点击，且该限制不因当前 time 失效而放宽
18. Step 2 中下方存档星区列表不再承担进入 Step 3 的职责；进入 Step 3 只能从对应 empire sector 条目正文中的 Step 3 按钮发起
19. Step 2 中一旦存在展开态星区，排序手柄与 Step 3 按钮均失效，用户只能编辑当前展开星区并通过底部“取消 / 确认”退出
20. Step 2 中“创建星区”会先进入新建 draft 编辑态，只有点“确认”时才真正创建 empire sector；新建 draft 不显示删除按钮
21. Step 2 展开编辑态会新增“连接星区”区块，基于定位星区自动收集 5 跳内、已绑定定位星区的其他 empire sector，并按跳数分组显示
22. Step 2 中连接星区关系为双向关系，语义沿用帝国连接星区，但持久化位置改为 `saveBinding.groupBinding`
23. Step 2 收缩态中，定位星区与 Step 3 同行显示；连接星区结果并入按跳数分组的正文结果中，不单独显示“连接星区”字样
24. Step 2 展开编辑态标题行使用名称输入框与 `绑定星区>` 按钮；“定位星区”段落内容使用“定位星区药丸 + 跳数控件”，不再显示跳数说明文字
25. Step 2 绑定星区菜单会同时高亮 store 定位星区与 draft 定位星区，其中 draft 定位星区不可点击，菜单不再提供解绑 `x`
26. Step 2 连接星区药丸文本改为 `<empire sector>:<map sector>`，收缩态颜色与展开编辑态保持一致
27. Step 2 下方存档星区列表中的空间站显示改为 tooltip 同源名称并按同名聚合，数量大于 1 时显示 `xN`
28. 删除已有 empire sector 时，会同步删除 `groupBinding`、清理双向连接、删除 empire sector，并清理 empire station 对其的引用
29. Step 1 中普通点击 `time` 会切换 POI 并高亮该 `time`，但不会修改 binding，也不会自动进入 Step 2
30. Step 1 中点击 `title` 或 `time` 的 hover“绑定”按钮会创建/更新 binding，并立即进入 Step 2
31. Step 1 的查看状态只在进入 Step 2/3 时生效；停留在 Step 1 或关闭绑定面板均视为退出查看状态
32. Step 1 中 `已绑定` tag 仅通过实边/虚边区分“绑定到最新”与“绑定到具体 time”，不改变现有卡片样式结构

## 未决项

无
