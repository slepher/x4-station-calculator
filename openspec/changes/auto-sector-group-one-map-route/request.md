# auto-sector-group-one-map-route Request

## 目标

在地图上绘制当前 binding 的 hub 间 link 路线，帮助用户在地图层直观看到 sector group hub 之间所有可考虑的运输路径候选。路径算法复用 `sector-hub-transport`，路径数据在 live production store 中预计算，并同时服务地图 overlay 与 transit hub link 路径展示。

## 已确认方案（审核重点）

### 路径范围

- 系统 SHALL 绘制当前 binding 中 hub 与 hub 之间的 link route。
- hub link 来源 SHALL 是每个 sector group 的 `connectedGroupIds`。
- 每条 hub link 的两端目标 SHALL 是两端 group 的 transit hub station。
- 当前需求只要求绘制 hub link 路线；普通 station 路线不进入地图 overlay。
- 每条 hub link SHALL 绘制 `sector-hub-transport` 路径算法返回的全部有效候选，而不是只绘制最终最优路径。
- 带 `problems` 的不完整候选 SHALL NOT 绘制在地图上；问题信息仍由 transit hub 运输栏的问题组承接。

### 路径算法与预计算

- hub link 路径 SHALL 使用 `sector-hub-transport` 已定义的 route candidate 算法。
- 路径候选 SHALL 保持 simple path、不重复 sector、gate jump 上限、gate/superhighway/highway/ring 候选与摘要口径一致。
- 路径候选 SHALL 在 `useLiveProductionStore` 中预计算。
- Vue 地图组件 SHALL NOT 自行调用 route builder 计算 hub link route。
- transit hub 中 `Sector Group` link 路径 SHALL 读取 live production store 的预计算结果，不再重复计算同类路径。
- `Station` 分类到普通 station 的路径不属于本次迁移范围，可以继续使用现有计算方式。

### 全局单份路径数据

- live production store SHALL 只维护一份全局 hub link route cache。
- 全局 route cache SHALL 独立于 link 当前是否存在；删除 link 时 SHALL NOT 删除已计算的 route entry。
- binding 与 draft 的 link 集合 SHALL 只决定哪些 cache entries 被显示或被 transit hub 读取。
- 添加 link 时，如果全局 cache 中已有对应 link key 的 route entry，系统 SHALL 复用该 entry。
- 添加 link 时，如果全局 cache 中不存在对应 link key 的 route entry，系统 SHALL 使用 `sector-hub-transport` 新计算一份并写入全局 cache。
- binding-sector 页面 SHALL 根据当前 draft link 集合过滤全局 cache。
- 非 binding-sector 页面 SHALL 根据当前 persisted binding link 集合过滤全局 cache。
- 全局 route cache 的 key SHALL 不带 `binding` / `draft` scope，也 SHALL NOT 只使用 group id。
- 全局 route cache 的 key SHALL 绑定路径两端实际端点：`sectorA + posA + sectorB + posB`。
- 两端端点 SHALL 以无向方式规范化；同一对端点 A-B 与 B-A SHALL 复用同一份路径数据。
- 当某个 sector hub 切换导致 sector 或 position 变化时，系统 SHALL 产生新的路径 key；旧路径数据继续保留但不因当前 link 自动显示。

### 地图显示规则

- 地图 SHALL 新增 hub link route overlay。
- binding-sector 页面 SHALL 显示当前 draft link 集合对应的全局 route 数据。
- binding-sector 页面 SHALL 无视星区路径图层开关，始终显示 draft link routes。
- 非 binding-sector 地图页面 SHALL 显示当前 persisted binding link 集合对应的全局 route 数据。
- 非 binding-sector 地图页面 SHALL 受“星区路径 / Sector Routes”图层开关控制。
- “星区路径 / Sector Routes”开关只控制 hub link route overlay，不影响现有 gate、superhighway、highway ring gate 高亮、sector group color overlay 或资源 overlay。

### 路线染色

- 每条 hub link route 的颜色 SHALL 基于 link 两端 hub station 所在 sector 的 `sectorMacro`。
- 系统 SHALL 对两端 `sectorMacro` 字符串按字母序排序。
- 路线颜色 SHALL 使用排序靠前的 `sectorMacro` 所属 group 的 `color`。
- 若排序靠前端所属 group 没有 `color`，该路线 SHALL 使用稳定 fallback 样式，不得阻断其它路线绘制。
- 同一条 hub link 的所有候选 SHALL 使用同一颜色。
- 候选路线 SHALL 不使用透明度降级表达优先级；所有候选都是可考虑选择。
- 多条候选重叠时 SHALL 通过稳定 lane 偏移做视觉消歧，不通过透明度暗示优先级。
- 同一 hub link 的多条候选经过同一基础线路时 SHALL 共用同一 lane，不因 candidate 不同而拆成多条并行线。
- 不同 hub link 经过同一基础线路时 SHALL 分配不同 lane，避免后绘制路线覆盖先绘制路线。
- hub link route SHALL 相对地图原生 gate / superhighway / highway 连接做偏移，避免压在原生连接线上。
- 经过 gate 或 highway endpoint 的 route SHOULD 在端点处收束到真实连接点，再从该点展开到下一段 lane。
- route lane 的连续偏移 SHOULD 尽量保持稳定；由于端点收束、跨 sector / cluster 坐标转换或不同线路类型拼接导致的局部收束与重新展开是允许的。
- 地图 overlay SHALL 保留所有有效 candidate 的星区序列差异；不同 candidate 经过不同星区时都应被绘制。
- 每个 candidate 在单个星区内部 SHALL 聚合为“进入点 -> 离开点”的一条直连段；不绘制该星区内部的中途 gate、highway、ring highway 或其它绕行折线。
- 起点星区的内部段 SHALL 是 hub station 到离开点；中间星区 SHALL 是进入点到离开点；终点星区 SHALL 是进入点到 hub station。
- 同一 hub link 的多条 candidate 在同一星区内具有相同进入点与离开点时，地图 overlay SHALL 合并为一条可视段；不同 hub link 即使入口/出口相同也 SHALL 保留多条并通过 lane 分开。
- 星区内部 A-B 聚合段 SHALL 统一按两端点直连渲染，不复用普通 highway spline，也不展示“过高速/不过高速”的重复候选差异。
- 若同一星区内部 A-B 聚合通道存在环形高速直连，route overlay SHALL 把该通道视为原生环形高速通道：中线留给原生环形高速，所有经过该 A-B 通道的 route lane 都应避让中线。
- 环形高速避让只适用于 `highwayRingChains` 中的环形高速路段；同一星区内其它非环形高速不触发中线预留。
- 同一 hub link 在同一 A-B 通道同时存在普通直连候选与环形高速候选时，地图 overlay SHALL 去重为一条可视 route，并优先采用环形高速通道的 lane 语义。

### 图层控制

- 地图图层控制 SHALL 增加“星区路径 / Sector Routes”开关。
- 开关默认状态 SHOULD 与现有地图图层控制策略保持一致。
- 非 binding-sector 页面关闭该开关时 SHALL 隐藏 persisted binding hub link route。
- binding-sector 页面打开时 SHALL 强制显示 draft hub link route，不受开关状态影响。

## 边界

### In Scope

- live production store 中预计算并保留全局单份 hub link route candidates。
- binding/draft link 集合对全局 route cache 的显示过滤规则。
- transit hub `Sector Group` link 路径读取预计算结果。
- 地图 hub link route overlay。
- 地图图层控制增加“星区路径 / Sector Routes”开关。
- 必要的 i18n 文案。
- build validation。

### Out of Scope

- 不修改 Rust parser。
- 不改变 `sector-hub-transport` 的路径算法口径。
- 不把普通 station route 迁移到 store 预计算。
- 不新增路线优先级 UI 或用户路径选择 UI。
- 不用透明度、偏移或虚线表达候选优先级。
- 不在本阶段编写测试代码；测试文档与测试实现由独立测试 workflow 处理。

## 验收标准（DoD）

- 地图在 binding-sector 页面显示当前 draft link 集合对应的 hub link route candidates。
- 地图在 binding-sector 页面无视“星区路径 / Sector Routes”开关，始终显示 draft link routes。
- 地图在非 binding-sector 页面显示当前 persisted binding link 集合对应的 hub link route candidates。
- 删除 link 不删除全局 route cache 中已计算的路径数据。
- 重新添加 link 时，如果全局 route cache 已存在该 link route，则复用既有候选；不存在时才新计算。
- 非 binding-sector 页面关闭“星区路径 / Sector Routes”开关后，hub link route overlay 被隐藏。
- 每条 hub link 绘制全部有效候选路径，而不是只绘制最优路径。
- 每条候选路径在每个星区内只绘制进入点到离开点的聚合直线，不显示星区内部中途绕行。
- 同一 hub link 在同一星区内相同进入/离开点的多条候选合并为一条；不同 hub link 保留各自可视段。
- 带 `problems` 的不完整候选不绘制在地图 route overlay 中。
- 每条路线颜色按两端 hub station 所在 sector 的 `sectorMacro` 字母序靠前端所属 group color 选择。
- 同一条 hub link 的所有候选使用同一颜色，不通过透明度降级表达优先级。
- 不同 hub link route 在同一基础线路上不会完全覆盖；同一 hub link 的多条候选在同一基础线路上可共用 lane。
- route 与原生 gate / superhighway / highway 连接不会完全重合；经过 gate 或 highway endpoint 时允许收束到端点。
- 星区内部 A-B 路线以端点直连方式显示；存在环形高速直连的 A-B 通道中线保持空出，紫色/橙色等不同 link 不会有任一路线占用中线。
- 同一 link 在同一 A-B 通道不会因为“过环形高速”和“直连”两个候选而重复绘制两条路线。
- transit hub `Sector Group` link 路径读取 live production store 的预计算结果。
- 现有 gate、superhighway、highway ring gate 高亮、sector group color overlay 不受星区路径开关影响。
- `npm run build` 通过。

## 未决项

无。
