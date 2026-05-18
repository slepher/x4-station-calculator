# map-resources-split 需求

## 目标

将地图结构数据与地图资源数据拆分为两个独立输出：

- `x4_data_processor.py` 之后生成的 `maps.json` 只承载纯地图结构，不再包含资源相关字段
- `x4_resource_processor.py` 之后生成的 `map_resources.json` 承载地图资源相关数据，并且不得回写或影响 `maps.json`

本次变更同时覆盖 `8.0` 与 `9.0` 两条资源处理链路，并同步调整前端地图资源消费入口。

## 已确认方案（审核重点）

### 输出边界

- `maps.json` 仅保留地图结构与非资源字段：
  - `clusters`
  - `sectors`
  - `sector_links`
  - `highways`
  - `owner`
  - `area.sunlight`
  - `name/nameId`
  - 坐标、POI、khaak 等非资源字段
- `maps.json` 中移除所有资源相关字段，至少包括：
  - `sector.regions`
  - `sector.resources`
- `map_resources.json` 作为新的地图资源总出口，统一承载：
  - sector 级 `regions`
  - sector 级 `resources`
  - `resourceareas` / area 明细
  - `regionyield_definitions`（9.0）
  - 版本与资源模型标识

### 处理链路职责

- `x4_data_processor.py`
  - 只生成纯地图 `maps.json`
  - 不生成最终资源摘要到 `maps.json`
  - 不依赖 `x4_resource_processor.py` 的执行结果
- `x4_resource_processor.py`
  - 允许只读 `maps.json` 获取 sector / cluster 索引与基础信息
  - 生成 `map_resources.json`
  - 不得修改 `maps.json`
  - `8.0` 和 `9.0` 均输出统一外部结构

### 当前 `sector.regions` 的去向

- 当前 `sector.regions` 被视为资源域数据，而非纯地图字段
- 本次变更后，`sector.regions` 从 `maps.json` 中移除
- 对应数据迁移到 `map_resources.json.sectors[sectorId].regions`

### 前端读取边界

- 地图结构继续从 `maps.json` 读取
- 地图资源相关逻辑统一改从 `map_resources.json` 读取
- 不再允许地图资源 UI 直接依赖 `gameDataStore.maps.sectors[*].resources`
- 需要按 `store -> presenter -> vue` 收口地图资源读取路径，减少组件内直接拼装

### 兼容策略

- 本次变更目标是完成新边界切换，而不是长期双写兼容
- 允许在实现阶段短暂保留中间输出文件（如旧 `resourceareas.json`）作为内部过渡
- 但最终前端正式依赖应切换到 `map_resources.json`

## 边界

### In Scope

- `maps.json` 输出结构去资源化
- `map_resources.json` 新文件设计与生成
- `8.0` / `9.0` 资源处理链路改造
- 地图资源相关前端加载入口、store、presenter、组件消费改造
- OpenSpec 中与地图 JSON 形状、地图资源消费相关的 spec 更新

### Out of Scope

- 非地图资源功能的业务规则调整
- 地图资源筛选算法本身的排序/筛选逻辑变化
- Save 资源提取算法变化
- 地图 UI 视觉样式重设计

## 验收标准（DoD）

1. 运行 `x4_data_processor.py` 后生成的 `maps.json` 不包含 `sector.regions` 与 `sector.resources`
2. 运行 `x4_resource_processor.py` 后生成 `map_resources.json`
3. 运行 `x4_resource_processor.py` 不修改 `maps.json`
4. `8.0` 与 `9.0` 的 `map_resources.json` 对外结构一致，至少都可按 `sectorId` 读取 `regions/resources/areas`
5. 地图资源 tooltip、资源筛选、资源扇形/徽标等前端功能改为读取 `map_resources.json`
6. 前端不再依赖 `gameDataStore.maps.sectors[*].resources`
7. `maps.json` 与 `map_resources.json` 任一文件单独重生成时，不会要求重写另一文件

## 未决项

无
