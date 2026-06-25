# sector-hub-transport Request

## 目标

在 live `sector transit hub` 页面，将右侧建设成本栏替换为运输栏。运输栏用于展示当前 transit hub station 到 linked sector group hub，以及到当前 sector group 内普通 station 的路径、星门数量、距离明细、station code 与坐标。

## 已确认方案（审核重点）

### 页面入口与替换范围

- 仅替换 transit 页面右侧 `StationDashboard` 建设成本区域。
- 左侧 transit hub build/module 列表不属于本次替换范围。
- 新功能 SHALL 遵守 `store -> presenter -> vue` 三层结构：store 保留领域状态与原始数据，presenter 组装运输栏 UI 数据，Vue 只渲染 presenter 输出并触发 presenter 暴露的行为。

### 分类结构

- 运输栏 SHALL 显示三个分类：
  - `Sector Group`
  - `Station`
  - `问题组`
- `Sector Group` 分类 SHALL 展示当前 sector group 的 linked sector groups，即当前 `BindingSectorGroup.connectedGroupIds` 指向的 groups。
- `Sector Group` 分类的目标 SHALL 是 linked group 的 transit hub station。
- `Station` 分类 SHALL 展示当前 sector group 内的非 transit hub station。
- `Station` 范围 SHALL 来自当前 group 的 anchor sector 与 `coverageSectorMacros`，并以 station 绑定 group 为准，避免混入其他 group 的 station。
- 当前 hub 自身 SHALL NOT 作为目标显示。
- linked group 的 transit hub station SHALL 只显示在 `Sector Group` 分类，不混入 `Station` 分类。
- 无法得到完整路径或完整距离数据的目标 SHALL 统一进入 `问题组`。
- `问题组` 为空时 SHALL 不显示该分类区块。

### 路径与连接语义

- 路径 SHALL 基于 sector graph 生成候选路径。
- 路径 SHALL NOT 重复经过同一 sector。
- 任意两个 sector 之间的连接按唯一连接处理，不设计 gate/superhighway 并存竞争。
- 算法内部 SHALL 生成不重复 sector 的 simple path 候选，不再默认固定截断为 3 条。
- 算法内部 SHALL 丢弃总 gate jump 数超过 5 的路径候选。
- 每条候选 SHALL 携带 `gateCount`、`normalDistanceKm`、`superhighwayDistanceKm`、`highwayDistanceKm`、`engineDistanceKm`、`highwayGateCount`、`engineGateCount` 摘要指标。
- 非 highway 候选 SHALL 满足 `engineDistanceKm = normalDistanceKm` 且 `engineGateCount = gateCount`。
- highway/ring 候选 SHALL 使用 `engineDistanceKm = normalDistanceKm - highwayDistanceKm` 且 `engineGateCount = gateCount - highwayGateCount` 表示需要引擎飞行的部分。
- 未选择运输船时，最终最优路径 SHALL 按以下顺序选择：
  1. 普通距离最短
  2. 星门数最少
  3. 原始枚举顺序
- 这里的普通距离 SHALL NOT 包含 superhighway 距离。
- gate 跨 sector 为瞬时通行：
  - 星门数 `+1`
  - 距离不计入普通距离
  - 明细显示为 gate transit
- 同一 sector 内的 `gate A -> gate B` SHALL 按端点坐标直线距离计入普通距离。
- superhighway 是同 cluster sector 之间的连接：
  - 星门数不增加
  - 距离使用 superhighway 两端点坐标的直线距离
  - superhighway 距离 SHALL 在明细中显示
  - superhighway 距离 SHALL NOT 计入摘要普通总距离，也 SHALL NOT 作为路径排序第二关键字
- 不使用 `sector.highways.spline` 计算跨 sector superhighway；`sector.highways` 属于 sector 内 highway，不是本次 superhighway 距离来源。

### Highway 路径替代

- 当 sector 内存在 highway 时，SHALL 为 sector 内普通空间段生成 highway 替代方案。
- 替代方案 SHALL 仅在 segment 展开阶段生成，不参与 route builder 的 sector 级图搜索。
- Spline 插值 SHALL 使用线性折线插值。
- 最近点投影 SHALL 在全 spline 上搜索（非仅限 entry/exit 端点）。
- 每条 highway 有方向，SHALL 只取 P_entry spline 参数 < P_exit spline 参数 的候选。
- 使用距离过滤：若直达距离 < approach + exit 距离，SHALL 剔除该 highway 候选。
- gate 到 highway entry/exit 距离 < 1km 时，SHALL 视为 gate 紧贴 highway，该 approach/exit 段从路径展示中移除。
- 无船选择时，view 层默认使用非 highway 方案。

### 环形高速路径候选

- `maps.highwayRingChains` SHALL 在 maps.json 载入后由 `maps.highwayRings` 派生生成。
- route builder SHALL 将环形高速 chain 候选与普通 BFS simple path 候选合并，而不是替换普通候选。
- 环形高速候选 SHALL 包含：起点到上环 sector 的普通路径、环上 highway 段、环上跨 sector gate transit、下环 sector 到目标的普通路径。
- 环形高速候选 SHALL 将环上 highway 长度计入 `highwayDistanceKm`，将环上跨 sector gate 数计入 `highwayGateCount`。

### 地图高速环路星门显示

- 地图界面 SHALL 高亮属于高速环路组成部分的普通跨 cluster gate 连接。
- 判定时 SHALL 要求该 gate 连接两端 gate 都属于 `maps.highwayRings` 的 gateMatches；只有一端命中时不高亮。
- 高亮 gate 连接 SHALL 去重后只绘制一次。
- 高亮样式 SHALL 使用黄色，并使用普通 gate 连接线宽的 1.5 倍。
- 该显示只影响地图视觉，不改变运输路线计算。

### Sector Group 分类显示

- 折叠摘要 SHALL 显示：
  - 普通总距离，不包含 superhighway 距离
  - 星门数
  - target sector
  - target station
- 展开明细 SHALL 显示完整路径段：
  - 每一段路径端点
  - 每一段距离
  - gate transit 段
  - superhighway 段及其距离
  - 最后末端到 target hub station 的距离
- `Sector Group` 排序 SHALL 按：
  1. 星门数少
  2. 普通总距离短
  3. group order
- `Sector Group` 折叠摘要 SHALL 避免重复显示相同的 target sector 与 target station；当二者同名时只显示一次目标名称，二者不同时可显示 `station · sector`。
- `Sector Group` 展开明细 SHALL 使用动作式路线说明，不直接显示 gate/superhighway 内部 ID。

### Station 分类显示

- `Station` 分类 SHALL 按 sector 分组。
- 每个 sector group 行 SHALL 表示从当前 transit hub 到目标 sector 的末端点。
- 如果进入目标 sector 的最后连接是 gate：
  - 末端点 SHALL 是目标 sector 的 gate
  - sector 层摘要距离 SHALL 是到该 gate 的普通距离
- 如果进入目标 sector 的最后连接是 superhighway：
  - 末端点 SHALL 是目标 sector 的 superhighway exit
  - 明细 SHALL 包含 superhighway 段距离
  - sector 层摘要普通距离 SHALL 不包含 superhighway 段距离
- sector 层摘要 SHALL 显示：
  - 到目标 sector 末端点的普通总距离，不包含 superhighway 距离
  - 星门数
  - sector
- sector 层摘要中普通距离为 `0` 时 SHALL 隐藏距离字段；星门数为 `0` 时 SHALL 隐藏星门数字段。
- sector 层展开明细 SHALL 显示到末端点的路径明细；末端不是 station。
- 当前 hub 与目标 station 同 sector 时，sector 层 SHALL 不显示展开路径；station 行直接显示空间站到空间站距离。
- station 列表 SHALL 显示：
  - station name
  - station code
  - station 坐标
  - 末端点到 station 的距离
  - sector 层普通距离 + 末端点到 station 的普通距离
- station 坐标 SHALL 以 km 显示，由原始 meter 坐标转换。
- `Station` 分类内 station 排序 SHALL 按 production 产线数量从高到低。
- production 产线数量 SHOULD 以 station 正向产出 production flows 的 distinct ware 数量为准；若 presenter 无法取得 flow，可使用生产模块输出 ware distinct count 作为稳定降级。

### 距离显示

- 距离单位 SHALL 为 km。
- 每段距离、总距离、坐标 SHALL 使用 `0.1 km` 精度。
- 极短距离 MAY 显示为 `<0.1 km`。
- 展开明细 SHALL 结合路线与明细，按 sector 分块显示动作行：
  - `离港至出口星门` / `Depart to outbound gate`
  - `星区内转场` / `In-sector transfer`
  - `星门跃迁至 <sector>` / `Gate jump to <sector>`
  - `超级高速至 <sector>` / `Superhighway to <sector>`
  - `入口星门至目标空间站` / `Inbound gate to target station`
- gate transit SHALL 不显示 `0.0 km` 距离。
- gate/superhighway endpoint 内部 ID SHALL NOT 出现在 UI。
- station 目标行 SHALL 显示 station 坐标。
- gate/highway endpoint 坐标不需要常驻显示。

### 问题组

- 无路径、缺 gate 坐标、缺 superhighway endpoint 坐标、缺 station 坐标或其它导致完整路径/距离无法计算的问题 SHALL 统一放入 `问题组`。
- `问题组` 内 SHOULD 显示：
  - 目标类型
  - 目标名称
  - 所属 sector
  - 问题节点列表
- 不需要为每种缺失问题设计独立 UI 状态。

## 边界

### In Scope

- transit 页面右侧运输栏 UI。
- route builder 与 path candidate 选择逻辑。
- gate、superhighway、station 到端点的距离分段。
- 地图上高速环路普通 gate 连接的高亮显示。
- Sector Group、Station、问题组分类与排序。
- presenter 层数据组装。
- 必要的 i18n 文案。
- build validation。

### Out of Scope

- 不修改 Rust parser。
- 不修改 save import 的基础解析流程，除非实现中发现现有 presenter 无法读取已存在字段。
- 不显示多条候选路径；第一版 UI 只显示最终最优路径。
- 不计算跨 sector superhighway 曲线真实长度。
- 不使用 `sector.highways.spline` 作为跨 sector superhighway 长度。
- 不新增用户可切换的路径排序模式。
- 不在本阶段编写测试代码；测试文档与测试实现由独立测试 workflow 处理。

## 验收标准（DoD）

- 进入 live transit hub 页面时，右侧不再显示建设成本 `StationDashboard`，而显示运输栏。
- `Sector Group` 分类能列出 linked sector group 的 transit hub station，并显示普通总距离、星门数、sector、station。
- 展开 `Sector Group` 项时，能看到按 sector 分块的动作式路线明细；superhighway 段显示距离但不计入摘要普通总距离。
- `Station` 分类按 sector 分组；sector 行显示到目标 sector gate 或 superhighway exit 的普通距离、星门数、sector。
- 展开 station sector 行时，能看到到末端点的动作式路径明细；同 sector station 不显示展开路径。
- station 行显示 station name、code、坐标、末端点到 station 距离、普通总距离。
- station 行按 production 产线数量从高到低排序。
- 空问题组不显示；0 km 与 0 星门摘要字段不显示。
- gate/superhighway 内部 ID 不出现在 UI。
- 路径选择在未选择运输船时遵循普通距离优先、星门数其次，且普通距离不包含 superhighway。
- 地图中属于高速环路的普通 gate 连接以黄色 1.5 倍线宽显示，且每条连接只绘制一次。
- 缺失或无法计算的目标统一进入问题组。
- `npm run build` 通过。

## 未决项

无。
